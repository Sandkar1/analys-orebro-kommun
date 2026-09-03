from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))

import normalize_protocol_pdfs as normalizer


def part(*, start: int = 1, end: int = 2, diary: str = "Ks 1/2020") -> normalizer.Part:
    return normalizer.Part(
        source=Path("source.pdf"),
        source_relative="2020/kommunstyrelsen/source.pdf",
        start_page=start,
        end_page=end,
        date="2020-01-01",
        body_slug="kommunstyrelsen",
        diary=diary,
        source_kind="collection_pages",
    )


class NormalizeProtocolPdfTests(unittest.TestCase):
    def test_known_kommunstyrelsen_date_correction(self) -> None:
        self.assertEqual(normalizer.corrected_meeting_date("kommunstyrelsen", "2020-10-15"), "2020-10-13")
        self.assertEqual(normalizer.corrected_meeting_date("kommunstyrelsen", "2020-11-10"), "2020-11-10")
        self.assertEqual(normalizer.verified_protocol_diary("kommunstyrelsen", "2020-10-13", ""), "Ks 14/2020")
        self.assertEqual(normalizer.verified_protocol_diary("kommunstyrelsen", "2020-02-11", ""), "Ks 7/2020")

    def test_manifest_diary_is_reused_for_already_normalized_pdf(self) -> None:
        manifest = {
            "meetings": [
                {
                    "local_path": "2020/kommunstyrelsen/2020-10-15 Kommunstyrelsen.pdf",
                    "diary_number": "Ks 14/2020",
                }
            ]
        }
        self.assertEqual(
            normalizer.manifest_diaries_by_path(manifest),
            {"2020/kommunstyrelsen/2020-10-15 Kommunstyrelsen.pdf": "Ks 14/2020"},
        )

    def test_declared_paragraph_ranges_are_expanded(self) -> None:
        row = part()
        normalizer.add_part_details(
            row,
            ["Protokoll\nParagraf 1–3, 5 och 7-8\n", "§ 1 Ett\n§ 2 Två\n§ 3 Tre\n§ 5 Fem\n§ 7 Sju\n§ 8 Åtta"],
        )
        self.assertEqual(row.declared_sections, (1, 2, 3, 5, 7, 8))

    def test_same_declared_protocol_prefers_longer_copy(self) -> None:
        short = part(start=1, end=2)
        long = part(start=3, end=7)
        short.declared_sections = (10, 11)
        long.declared_sections = (10, 11)
        meeting = normalizer.Meeting("2020-01-01", "kommunstyrelsen", "Ks 1/2020", [], [short, long])
        normalizer.deduplicate_parts(meeting)
        self.assertEqual(meeting.parts, [long])
        self.assertEqual(meeting.dropped_duplicates, [short])

    def test_distinct_diaries_on_same_day_remain_distinct_meetings(self) -> None:
        first = part(diary="Ks 1/2020")
        second = part(diary="Ks 2/2020")
        meetings = normalizer.group_meetings([first, second])
        self.assertEqual(len(meetings), 2)
        self.assertEqual({meeting.diary for meeting in meetings}, {"Ks 1/2020", "Ks 2/2020"})

    def test_missing_diary_is_rejected_when_same_day_has_multiple_diaries(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "Ambiguous no-diary"):
            normalizer.group_meetings([part(diary="Ks 1/2020"), part(diary="Ks 2/2020"), part(diary="")])

    def test_backup_collision_keeps_both_different_sources(self) -> None:
        root = normalizer.ROOT / ".normalizer-test"
        archive = root / "Protokoll"
        source_archive = root / "Protokoll-kallfiler"
        source = archive / "2026" / "test" / "meeting.pdf"
        backup = source_archive / "2026" / "test" / "meeting.pdf"
        source.parent.mkdir(parents=True, exist_ok=True)
        backup.parent.mkdir(parents=True, exist_ok=True)
        source.write_bytes(b"new version")
        backup.write_bytes(b"old version")
        old_archive, old_source_archive = normalizer.ARCHIVE, normalizer.SOURCE_ARCHIVE
        normalizer.ARCHIVE, normalizer.SOURCE_ARCHIVE = archive, source_archive
        moved = None
        try:
            moved = normalizer.move_to_backup(source)
            self.assertEqual(backup.read_bytes(), b"old version")
            self.assertEqual(moved.read_bytes(), b"new version")
            self.assertIn(".history-", moved.name)
            self.assertFalse(source.exists())
        finally:
            normalizer.ARCHIVE, normalizer.SOURCE_ARCHIVE = old_archive, old_source_archive
            for path in (moved, backup):
                if path and path.exists():
                    path.unlink()
            for directory in sorted((path for path in root.rglob("*") if path.is_dir()), reverse=True):
                directory.rmdir()
            if root.exists():
                root.rmdir()


if __name__ == "__main__":
    unittest.main()
