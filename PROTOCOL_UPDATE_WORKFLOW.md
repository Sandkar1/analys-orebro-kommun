# Update municipal protocols

The normal update has two commands:

```powershell
python scripts\scrape_new_protocols.py
python scripts\parse_new_protocols.py
```

## 1. Scrape and normalize

The scraper checks Örebro municipality's protocol listings and downloads only
official URLs absent from `data/Protokoll/state.json`. It reads the
protocol-level `Diarienummer` from the first-page header; it never substitutes
an agenda item's diary number.

After a successful download, normalization runs automatically. The public
archive always has one PDF per actual meeting:

```text
data/Protokoll/<year folder>/<committee>/<date> <committee>.pdf
```

The incomplete, unpublished legacy archive is visibly labelled as
`2020 (ej komplett, ej inläst)` through `2022 (ej komplett, ej inläst)`.
Folders from 2023 onward use the plain four-digit year.

Separate official parts from the same meeting are joined. Multi-meeting legacy
collections are split. Changed originals are retained recoverably under
`data/Protokoll-kallfiler/`, outside the canonical archive.

`data/Protokoll/meetings.json` records the meeting, exact protocol diary,
canonical hash, official source URLs, and the output pages contributed by each
source. `data/Protokoll/latest-run.json` records the scraper result. Repeating a
successful run downloads nothing and does not rewrite PDFs.

## 2. Parse and publish

The GitHub Pages data has a hard lower date boundary of `2023-01-01`.
Protocols from 2020–2022 may remain in the canonical PDF archive for manual
work, but the parser excludes them and validation rejects any pre-2023 row in
the website data bundle or derived indexes.

The parser reads `meetings.json`, so a meeting published as several official
PDFs is parsed once. For each selected meeting it:

1. verifies the canonical hash, meeting date, committee, and first-page
   protocol `Diarienummer`;
2. extracts sections, decisions, agenda-item diary numbers, attendance,
   proposals, and formal votes;
3. keeps each section's correct official source URL;
4. stops on unresolved metadata, overlapping replacements, or uncertain votes;
5. rebuilds and validates all derived indexes in staging;
6. splits protocol-data output before any file reaches 95,000,000 bytes; and
7. publishes only after every check passes.

If a newly found official PDF contains a section missing from an otherwise
imported meeting, only that explicitly numbered section is appended. Existing
sections are not parsed a second time.

A protocol without an unambiguous first-page diary remains in the canonical
PDF archive but is marked `needs_review` and is not published automatically.
Failures leave production data unchanged and are recorded in
`data/Protokoll/parser/latest-report.json`.

Read-only checks:

```powershell
python scripts\scrape_new_protocols.py --dry-run
python scripts\parse_new_protocols.py --list-pending
python scripts\parse_new_protocols.py --check-structure
```

Before the first live parser publication, its complete parse/build can be
verified without publishing:

```powershell
python scripts\parse_new_protocols.py --stage-only
```

That command parses PDFs, so it should only be run when parser verification is
explicitly approved.

## Requirements

- Python 3.9 or newer with `pypdf`
- Poppler `pdftotext` and `pdfinfo`
- Node.js for rebuilding the browser indexes
- `pdftoppm` and Tesseract only when first-page OCR is needed
