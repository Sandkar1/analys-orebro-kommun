import importlib.util
import json
import os
import sys
import unittest
from pathlib import Path

from pypdf import PdfWriter


SCRIPT = Path(__file__).with_name("scrape_new_protocols.py")
SPEC = importlib.util.spec_from_file_location("scrape_new_protocols", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ProtocolDiscoveryTests(unittest.TestCase):
    def test_extracts_nested_sitevision_files(self):
        payload = {
            "folders": [
                {
                    "name": "Protokoll 2026",
                    "files": [{"name": "2026-08-20 Nämnden.pdf", "url": "/download/example.pdf"}],
                }
            ]
        }
        source = (
            '<h2>Protokoll för Testnämnden, 2025–2026</h2>'
            "<script>AppRegistry.registerInitialState('component', "
            + json.dumps(payload, ensure_ascii=False)
            + ");</script>"
        )
        states = MODULE.extract_initial_states(source)
        self.assertEqual(len(states), 1)
        files = list(MODULE.iter_state_files(states[0], "fallback"))
        self.assertEqual(files[0][0]["name"], "2026-08-20 Nämnden.pdf")
        self.assertEqual(files[0][1], "Protokoll 2026")
        self.assertEqual(MODULE.nearest_section_label(source, states[0]["_offset"]), "Protokoll för Testnämnden, 2025–2026")

    def test_protocol_filter_rejects_agendas(self):
        self.assertTrue(MODULE.is_protocol_pdf("2026-08-20 Nämnden.pdf", "Protokoll 2026"))
        self.assertTrue(MODULE.is_protocol_pdf("Omedelbart justerat protokoll § 4.pdf"))
        self.assertFalse(MODULE.is_protocol_pdf("2026-08-20 Ärendelista.pdf", "Ärendelistor"))
        self.assertFalse(MODULE.is_protocol_pdf("Budget 2026.pdf", "Dokument"))

    def test_anchor_collector_preserves_text(self):
        anchors = MODULE.collect_anchors('<a href="/one"><span>Test</span> nämnd</a>')
        self.assertEqual(anchors, [("/one", "Test nämnd")])


class ProtocolDiaryTests(unittest.TestCase):
    def test_uses_protocol_header_not_nearby_item_title(self):
        first_page = """Protokoll Bom 600/2025
Bygg- och miljönämnden
Datum: 2026-08-20
§ 5 Protokoll Bom 11/2025
"""
        self.assertEqual(MODULE.extract_protocol_diary(first_page), ("Bom 600/2025", "Protokoll Bom 600/2025"))

    def test_accepts_ocr_prefix_before_protocol_word(self):
        first_page = "Cd Protokoll Bom 747/2023\nÖREBRO\n"
        self.assertEqual(MODULE.extract_protocol_diary(first_page)[0], "Bom 747/2023")

    def test_does_not_guess_between_multiple_top_page_candidates(self):
        first_page = "Bom 1/2026\nKs 2/2026\nNämnden\n"
        self.assertEqual(MODULE.extract_protocol_diary(first_page), ("", ""))


class ExistingBundleTests(unittest.TestCase):
    def test_reads_urls_from_checked_in_pack_assignments(self):
        urls = MODULE.known_bundle_urls(SCRIPT.parent.parent / "data" / "municipal-protocol-data-orebro-v2.js")
        self.assertEqual(len(urls), 716)
        self.assertTrue(all(url.startswith("https://www.orebro.se/download/") for url in urls))

    def test_reads_reusable_first_page_diaries(self):
        diaries = MODULE.known_protocol_diaries(SCRIPT.parent.parent / "data" / "municipal-protocol-diary-data.js")
        self.assertGreaterEqual(len(diaries), 700)
        self.assertTrue(all(value for value in diaries.values()))


class CanonicalArchiveTests(unittest.TestCase):
    def test_metadata_correction_does_not_move_shared_meeting_pdf(self):
        url = next(
            value
            for value, correction in MODULE.KNOWN_METADATA_CORRECTIONS.items()
            if "§§ 113–122" in str(correction.get("title"))
        )
        canonical = "2026/vard-och-omsorgsnamnden/2026-08-20 Vård- och omsorgsnämnden.pdf"
        records = {
            url: {
                "title": "old title.pdf",
                "body": "Vård- och omsorgsnämnden",
                "local_path": canonical,
                "meeting_path": canonical,
            }
        }
        migrations = MODULE.reconcile_corrected_archive_records(Path("unused"), records)
        self.assertEqual(migrations, [])
        self.assertEqual(records[url]["local_path"], canonical)
        self.assertIn("§§ 113–122", records[url]["title"])

    def test_raw_download_without_meeting_path_requires_normalization(self):
        records = {
            "https://example/new.pdf": {
                "local_path": "2026/test/2026-08-27 Test § 1.pdf",
                "status": "downloaded",
            }
        }
        self.assertTrue(MODULE.archive_needs_normalization(Path("missing"), records, False))

    def test_scraper_normalizer_integration_creates_one_canonical_meeting(self):
        root = MODULE.ROOT / f".scraper-normalization-test-{os.getpid()}"
        output = root / "Protokoll"
        raw = output / "2026" / "kommunstyrelsen" / "2026-09-01 Kommunstyrelsen extra.pdf"
        state_path = output / "state.json"
        raw.parent.mkdir(parents=True, exist_ok=True)
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        with raw.open("wb") as handle:
            writer.write(handle)
        raw_size = raw.stat().st_size
        url = "https://example/meeting.pdf"
        MODULE.atomic_write_json(
            state_path,
            {
                "schema_version": 1,
                "protocols": {
                    url: {
                        "title": raw.name,
                        "body": "Kommunstyrelsen",
                        "local_path": raw.relative_to(output).as_posix(),
                        "diary_number": "Ks 1/2026",
                        "status": "downloaded",
                    }
                },
            },
        )
        try:
            report = MODULE.normalize_archive(output, state_path)
            canonical = output / "2026" / "kommunstyrelsen" / "2026-09-01 Kommunstyrelsen.pdf"
            state = MODULE.load_state(state_path)
            self.assertTrue(canonical.exists())
            self.assertFalse(raw.exists())
            self.assertEqual(report["validation"]["pdfs"], 1)
            self.assertEqual(report["validation"]["meetings"], 1)
            self.assertEqual(state["protocols"][url]["meeting_path"], canonical.relative_to(output).as_posix())
            self.assertEqual(canonical.stat().st_size, raw_size)
        finally:
            for directory_root in (root,):
                for path in sorted((row for row in directory_root.rglob("*") if row.is_file()), reverse=True):
                    path.unlink()
                for path in sorted((row for row in directory_root.rglob("*") if row.is_dir()), reverse=True):
                    path.rmdir()
                if directory_root.exists():
                    directory_root.rmdir()


if __name__ == "__main__":
    unittest.main()
