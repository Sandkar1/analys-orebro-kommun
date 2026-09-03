import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("parse_new_protocols.py")
SPEC = importlib.util.spec_from_file_location("parse_new_protocols", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ProtocolParserTests(unittest.TestCase):
    def fixture_record(self):
        return {
            "url": "https://www.orebro.se/download/example.pdf",
            "title": "2026-08-27 Testnämnden.pdf",
            "body": "Testnämnden",
            "diary_number": "Tn 12/2026",
            "sha256": "",
            "local_path": "2026/testnamnden/example.pdf",
            "status": "downloaded",
        }

    def fixture_pages(self):
        return [
            """
                           Protokoll                                      Tn 12/2026

Testnämnden
Datum:     2026-08-27

Närvarande ledamöter
Anna Andersson (S)
Bo Berg (M)

Tjänstgörande ersättare
Carin Carlsson (L)                 Ersätter Någon Annan (L)

Övriga närvarande
En Tjänsteperson, sekreterare
            """,
            """
ÖREBRO                                 Protokoll

         § 10 Fördelning av budgetmedel
         Ärendenummer: Tn 99/2026
         Handläggare: Exempel Handläggare

         Ärendebeskrivning
         Nämnden behöver fördela årets budgetmedel.

         Yrkande
         Anna Andersson (S) yrkar bifall till förvaltningens förslag.

         Proposition
         Ordföranden finner att nämnden beslutar enligt förslaget.

         Beslut
         Testnämnden beslutar:
         1. Budgetmedlen fördelas enligt bilagan.
         2. Beslutet gäller från den 1 september.

                                                                    2 (2)
            """,
        ]

    def test_protocol_header_diary_is_source_of_truth(self):
        text = "Protokoll    Tn 12/2026\nProtokoll Bom 11/2025 nämns i ett ärende"
        diary, evidence = MODULE.protocol_diary_from_first_page(text)
        self.assertEqual(diary, "Tn 12/2026")
        self.assertIn("Protokoll", evidence)

    def test_parse_protocol_sections_and_attendance(self):
        parsed = MODULE.parse_protocol_record(self.fixture_record(), self.fixture_pages())
        self.assertFalse(parsed.blocks_publish(), parsed.report())
        self.assertEqual(parsed.protocol_diary, "Tn 12/2026")
        self.assertEqual(len(parsed.documents), 1)
        document = parsed.documents[0]
        self.assertEqual(document["dn"], "Tn 99/2026")
        self.assertEqual(document["p"]["10.1"], "Testnämnden beslutar: Budgetmedlen fördelas enligt bilagan.")
        self.assertEqual(document["p"]["10.2"], "Testnämnden beslutar: Beslutet gäller från den 1 september.")
        self.assertEqual(document["pm"]["10.1"]["source_page"], 2)
        self.assertEqual(len(parsed.members) // 6, 3)
        self.assertEqual(len(parsed.positions) // 6, 2)

    def test_ambiguous_protocol_metadata_blocks_publish(self):
        pages = self.fixture_pages()
        pages[0] = pages[0].replace("Tn 12/2026", "Tn 13/2026", 1)
        parsed = MODULE.parse_protocol_record(self.fixture_record(), pages)
        self.assertTrue(parsed.blocks_publish())
        self.assertIn("protocol_diary_mismatch", {issue.code for issue in parsed.issues})

    def test_vote_without_resolvable_tally_requires_review(self):
        mapping, events, rows, issues = MODULE.extract_vote(
            [], "Omröstning begärs och genomförs.", "case_example", 0, ["10"]
        )
        self.assertEqual(mapping["10"], "vote_case_example_1")
        self.assertTrue(events)
        self.assertFalse(rows)
        self.assertIn("vote_not_resolved", {issue.code for issue in issues})

    def test_merge_offsets_flat_document_references(self):
        current = {
            "schema": "municipal-protocol-ui-pack-v2",
            "pf": "2026-01-01",
            "pt": "2026-01-01",
            "d": [{"i": "old", "dt": "2026-01-01", "t": "Old", "p": {"1": ""}, "b": "N", "doc": "old.pdf", "u": "old"}],
            "r": [],
            "pr": [],
            "mr": [],
        }
        protocol = MODULE.parse_protocol_record(self.fixture_record(), self.fixture_pages())
        protocol.votes = [0, "10.1", "Anna Andersson", "S", "Ja", "vote:1"]
        merged = MODULE.merge_protocols(current, [protocol])
        self.assertEqual(merged["r"][0], 1)
        self.assertEqual(merged["pt"], "2026-08-27")
        self.assertEqual(MODULE.validate_pack(merged), [])

    def test_merge_rejects_overlapping_stable_section_id(self):
        protocol = MODULE.parse_protocol_record(self.fixture_record(), self.fixture_pages())
        current = {
            "schema": "municipal-protocol-ui-pack-v2",
            "pf": "2026-08-27",
            "pt": "2026-08-27",
            "d": [{**protocol.documents[0], "u": "https://example/existing.pdf"}],
            "r": [],
            "pr": [],
            "mr": [],
        }
        with self.assertRaisesRegex(RuntimeError, "collides"):
            MODULE.merge_protocols(current, [protocol])

    def test_split_pack_keeps_every_file_under_limit(self):
        documents = []
        rows = []
        for index in range(8):
            documents.append(
                {
                    "i": f"doc_{index}",
                    "dt": "2026-01-01",
                    "t": f"Document {index}",
                    "p": {str(index): "x" * 450},
                    "b": "Testnämnden",
                    "doc": f"doc-{index}.pdf",
                    "u": f"https://example/{index}",
                }
            )
            rows.extend([index, str(index), "Anna Andersson", "S", "Ja", f"vote:{index}"])
        pack = {
            "schema": "municipal-protocol-ui-pack-v2",
            "pf": "2026-01-01",
            "pt": "2026-01-01",
            "d": documents,
            "r": rows,
            "pr": [],
            "mr": [],
        }
        parts = MODULE.split_pack(pack, maximum_bytes=1800)
        self.assertGreater(len(parts), 1)
        self.assertTrue(all(len(rendered.encode("utf-8")) <= 1800 for rendered, _ in parts))
        combined_documents = [document for _, part in parts for document in part["d"]]
        combined_votes = [value for _, part in parts for value in part["r"]]
        self.assertEqual(combined_documents, documents)
        self.assertEqual(combined_votes, rows)

    def test_current_pack_is_compatible(self):
        pack = MODULE.load_protocol_pack()
        self.assertEqual(MODULE.validate_pack(pack), [])
        self.assertGreaterEqual(len(pack["d"]), 11001)
        self.assertTrue(all(row["dt"] >= MODULE.PUBLIC_DATA_FROM for row in pack["d"]))
        self.assertEqual(len(pack["r"]) % 6, 0)
        self.assertEqual(len(pack["pr"]) % 6, 0)
        self.assertEqual(len(pack["mr"]) % 6, 0)

    def test_pending_selection_excludes_already_imported_urls(self):
        pack = {"d": [{"u": "https://example/already.pdf"}]}
        state = {
            "protocols": {
                "https://example/already.pdf": {"status": "downloaded", "title": "Already"},
                "https://example/new.pdf": {"status": "downloaded", "title": "New"},
                "https://example/review.pdf": {"status": "needs_review", "title": "Review"},
            }
        }
        pending = MODULE.pending_records(state, pack)
        self.assertEqual([row["url"] for row in pending], ["https://example/new.pdf"])

    def test_pack_rejects_document_before_public_cutoff(self):
        pack = {
            "pf": "2022-12-01",
            "pt": "2022-12-01",
            "d": [
                {
                    "i": "old",
                    "dt": "2022-12-01",
                    "t": "Old",
                    "p": {"1": ""},
                    "b": "TestnÃ¤mnden",
                    "doc": "2022-12-01 TestnÃ¤mnden.pdf",
                    "u": "https://example/old.pdf",
                }
            ],
            "r": [],
            "pr": [],
            "mr": [],
        }
        self.assertTrue(any("public GitHub Pages cutoff" in error for error in MODULE.validate_pack(pack)))

    def test_pending_meetings_before_2023_are_archive_only(self):
        old_url = "https://example/old.pdf"
        new_url = "https://example/new.pdf"
        state = {
            "protocols": {
                old_url: {"status": "downloaded", "title": "2022-12-01 TestnÃ¤mnden.pdf"},
                new_url: {"status": "downloaded", "title": "2023-01-12 TestnÃ¤mnden.pdf"},
            }
        }
        manifest = {
            "meetings": [
                {"date": "2022-12-01", "body": "TestnÃ¤mnden", "local_path": "2022/test/old.pdf", "source_urls": [old_url]},
                {"date": "2023-01-12", "body": "TestnÃ¤mnden", "local_path": "2023/test/new.pdf", "source_urls": [new_url]},
            ]
        }
        pending, issues = MODULE.pending_meeting_records(state, {"d": []}, manifest)
        self.assertEqual(issues, [])
        self.assertEqual([row["date"] for row in pending], ["2023-01-12"])

    def test_canonical_meeting_is_selected_once_for_multiple_source_urls(self):
        full = "https://example/full.pdf"
        immediate = "https://example/section-10.pdf"
        state = {
            "protocols": {
                full: {"status": "downloaded", "title": "2026-08-27 Testnämnden.pdf"},
                immediate: {"status": "downloaded", "title": "2026-08-27 Testnämnden § 10.pdf"},
            }
        }
        manifest = {
            "meetings": [
                {
                    "date": "2026-08-27",
                    "body": "Testnämnden",
                    "diary_number": "Tn 12/2026",
                    "local_path": "2026/testnamnden/2026-08-27 Testnämnden.pdf",
                    "sha256": "abc",
                    "pages": 4,
                    "source_urls": [immediate, full],
                    "sources": [
                        {
                            "included": True,
                            "output_page_start": 1,
                            "output_page_end": 3,
                            "source_urls": [full],
                        },
                        {
                            "included": True,
                            "output_page_start": 4,
                            "output_page_end": 4,
                            "source_urls": [immediate],
                        },
                    ],
                }
            ]
        }
        pending, issues = MODULE.pending_meeting_records(state, {"d": []}, manifest)
        self.assertEqual(issues, [])
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["url"], full)
        self.assertEqual(pending[0]["source_urls"], [full, immediate])
        self.assertEqual(MODULE.source_url_for_page(pending[0], 4), immediate)

    def test_new_source_for_existing_section_requires_review(self):
        full = "https://example/full.pdf"
        immediate = "https://example/section-10.pdf"
        state = {
            "protocols": {
                full: {"status": "downloaded", "title": "2026-08-27 Testnämnden.pdf"},
                immediate: {"status": "downloaded", "title": "2026-08-27 Testnämnden § 10.pdf"},
            }
        }
        manifest = {
            "meetings": [
                {
                    "date": "2026-08-27",
                    "body": "Testnämnden",
                    "local_path": "2026/testnamnden/2026-08-27 Testnämnden.pdf",
                    "source_urls": [full, immediate],
                }
            ]
        }
        pack = {
            "d": [
                {
                    "dt": "2026-08-27",
                    "b": "Testnämnden",
                    "u": full,
                    "p": {"10": "Beslut"},
                }
            ]
        }
        pending, issues = MODULE.pending_meeting_records(state, pack, manifest)
        self.assertEqual(pending, [])
        self.assertEqual([issue["code"] for issue in issues], ["partial_source_coverage"])

    def test_half_imported_meeting_selects_only_new_declared_section(self):
        full = "https://example/full.pdf"
        correction = "https://example/section-11.pdf"
        state = {
            "protocols": {
                full: {"status": "downloaded", "title": "2026-08-27 Testnämnden.pdf"},
                correction: {"status": "downloaded", "title": "2026-08-27 Testnämnden § 11.pdf"},
            }
        }
        manifest = {
            "meetings": [
                {
                    "date": "2026-08-27",
                    "body": "Testnämnden",
                    "local_path": "2026/testnamnden/2026-08-27 Testnämnden.pdf",
                    "source_urls": [full, correction],
                }
            ]
        }
        pack = {"d": [{"dt": "2026-08-27", "b": "Testnämnden", "u": full, "p": {"10": "Beslut"}}]}
        pending, issues = MODULE.pending_meeting_records(state, pack, manifest)
        self.assertEqual(issues, [])
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["include_sections"], ["11"])
        self.assertEqual(pending[0]["source_urls"], [correction])
        self.assertEqual(MODULE.source_url_for_section(pending[0], "11", 5), correction)

    def test_half_imported_meeting_rejects_unvalidated_supplement(self):
        full = "https://example/full.pdf"
        correction = "https://example/section-11.pdf"
        state = {
            "protocols": {
                full: {"status": "imported", "title": "2026-08-27 TestnÃ¤mnden.pdf"},
                correction: {"status": "needs_review", "title": "2026-08-27 TestnÃ¤mnden Â§ 11.pdf"},
            }
        }
        manifest = {
            "meetings": [
                {
                    "date": "2026-08-27",
                    "body": "TestnÃ¤mnden",
                    "local_path": "2026/testnamnden/2026-08-27 TestnÃ¤mnden.pdf",
                    "source_urls": [full, correction],
                }
            ]
        }
        pack = {"d": [{"dt": "2026-08-27", "b": "TestnÃ¤mnden", "u": full, "p": {"10": "Beslut"}}]}
        pending, issues = MODULE.pending_meeting_records(state, pack, manifest)
        self.assertEqual(pending, [])
        self.assertEqual([issue["code"] for issue in issues], ["meeting_sources_not_ready"])

    def test_supplement_parse_omits_existing_sections_and_attendance(self):
        record = self.fixture_record()
        record.update(
            {
                "include_sections": ["10"],
                "source_urls": [record["url"]],
                "section_urls": {"10": record["url"]},
            }
        )
        parsed = MODULE.parse_protocol_record(record, self.fixture_pages())
        self.assertFalse(parsed.blocks_publish(), parsed.report())
        self.assertEqual(len(parsed.documents), 1)
        self.assertEqual(parsed.members, [])


if __name__ == "__main__":
    unittest.main()
