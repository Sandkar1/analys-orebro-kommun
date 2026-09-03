#!/usr/bin/env python3
"""Normalize the local Örebro protocol archive to one PDF per meeting.

The script treats a meeting as the combination of committee, meeting date and,
when necessary, the protocol-level diary number printed on the first page. It
splits legacy collection PDFs at verified protocol cover pages, joins public
and immediately adjusted parts from the same meeting, and moves every changed
source PDF to a recoverable source archive outside ``data/Protokoll``.

The production data parser is deliberately not invoked.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable

from pypdf import PdfReader, PdfWriter


ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "data" / "Protokoll"
SOURCE_ARCHIVE = ROOT / "data" / "Protokoll-kallfiler"
STAGE = ROOT / "data" / "Protokoll-normalization-stage"
STATE_PATH = ARCHIVE / "state.json"
MANIFEST_PATH = ARCHIVE / "meetings.json"
DATE_RE = re.compile(r"20\d{2}-\d{2}-\d{2}")
DIARY_RE = re.compile(
    r"(?<![A-Za-zÅÄÖåäö])[A-ZÅÄÖ][A-Za-zÅÄÖåäö]{0,12}\s+\d{1,6}/20\d{2}"
    r"(?![A-Za-zÅÄÖåäö])"
)
SECTION_RE = re.compile(r"(?m)^\s*§\s*(\d{1,4})\b")
PAGE_COUNT_CACHE: dict[Path, int] = {}
PAGE_TEXT_SIGNATURE_CACHE: dict[Path, tuple[str, ...]] = {}


BODY_DISPLAY: dict[str, str] = {
    "byggnadsnamnden": "Byggnadsnämnden",
    "bygg-och-miljonamnden": "Bygg- och miljönämnden",
    "forskolenamnden": "Förskolenämnden",
    "fritidsnamnden": "Fritidsnämnden",
    "funktionsstodsnamnden": "Funktionsstödsnämnden",
    "grundskolenamnden": "Grundskolenämnden",
    "gymnasienamnden": "Gymnasienämnden",
    "gymnasie-och-arbetsmarknadsnamnden": "Gymnasie- och arbetsmarknadsnämnden",
    "hemvardsnamnden": "Hemvårdsnämnden",
    "kommunfullmaktige": "Kommunfullmäktige",
    "kommunstyrelsen": "Kommunstyrelsen",
    "kommunstyrelsens-hallbarhetsutskott": "Kommunstyrelsens hållbarhetsutskott",
    "kommunstyrelsens-personalutskott": "Kommunstyrelsens personalutskott",
    "kommunstyrelsens-trygghetsutskott": "Kommunstyrelsens trygghetsutskott",
    "kultur-och-fritidsnamnden": "Kultur- och fritidsnämnden",
    "kulturnamnden": "Kulturnämnden",
    "landsbygdsnamnden": "Landsbygdsnämnden",
    "markplanerings-och-exploateringsnamnden": "Markplanerings- och exploateringsnämnden",
    "miljonamnden": "Miljönämnden",
    "myndighetsutskott-programnamnd-social-valfard": "Myndighetsutskott Pn social välfärd",
    "overformyndarnamnden": "Överförmyndarnämnden",
    "programnamnd-barn-och-utbildning": "Programnämnd barn och utbildning",
    "programnamnd-samhallsbyggnad": "Programnämnd samhällsbyggnad",
    "programnamnd-social-valfard": "Programnämnd social välfärd",
    "samverkansgrupp-forskolenamnden": "Samverkansgrupp Förskolenämnden",
    "samverkansgrupp-grundskolenamnden": "Samverkansgrupp Grundskolenämnden",
    "socialnamnden": "Socialnämnden",
    "tekniska-namnden": "Tekniska nämnden",
    "teknik-och-servicenamnden": "Teknik- och servicenämnden",
    "utskott-forsorjningsstod-vuxam": "Utskott Försörjningsstöd Vuxam",
    "valnamnden": "Valnämnden",
    "vardboendenamnden": "Vårdboendenämnden",
    "vard-och-omsorgsnamnden": "Vård- och omsorgsnämnden",
    "vuxenutbildnings-och-arbetsmarknadsnamnden": "Vuxenutbildnings- och arbetsmarknadsnämnden",
    "foreningsutskott-programnamnd-social-valfard": "Föreningsutskott Programnämnd social välfärd",
}

FOLDER_ALIASES = {
    "kommunstyrelsens-hallbarhetssutskott": "kommunstyrelsens-hallbarhetsutskott",
    "socialnamnden-2023-2024": "socialnamnden",
}


# The first matching normalized phrase determines the internal meeting body.
# Specific sub-bodies must precede their parent committee.
BODY_PHRASES: tuple[tuple[str, str], ...] = (
    ("samverkansgrupp förskolenämnden", "samverkansgrupp-forskolenamnden"),
    ("samverkansgrupp grundskolenämnden", "samverkansgrupp-grundskolenamnden"),
    ("föreningsutskott programnämnd social välfärd", "foreningsutskott-programnamnd-social-valfard"),
    ("myndighetsutskott pn social välfärd", "myndighetsutskott-programnamnd-social-valfard"),
    ("utskott försörjningsstöd vuxam", "utskott-forsorjningsstod-vuxam"),
    ("överförmyndarnämnden sekretessärenden", "overformyndarnamnden"),
    ("vuxenutbildnings- och arbetsmarknadsnämnden", "vuxenutbildnings-och-arbetsmarknadsnamnden"),
    ("programnämnd barn och utbildning", "programnamnd-barn-och-utbildning"),
    ("programnämnd samhällsbyggnad", "programnamnd-samhallsbyggnad"),
    ("programnämnd social välfärd", "programnamnd-social-valfard"),
    ("funktionsstödsnämnden", "funktionsstodsnamnden"),
    ("grundskolenämnden", "grundskolenamnden"),
    ("förskolenämnden", "forskolenamnden"),
    ("byggnadsnämnden", "byggnadsnamnden"),
    ("gymnasienämnden", "gymnasienamnden"),
    ("hemvårdsnämnden", "hemvardsnamnden"),
    ("landsbygdsnämnden", "landsbygdsnamnden"),
    ("miljönämnden", "miljonamnden"),
    ("överförmyndarnämnden", "overformyndarnamnden"),
    ("socialnämnden", "socialnamnden"),
    ("vårdboendenämnden", "vardboendenamnden"),
)


KS_SCAN = Path("2020-2022/kommunstyrelsen/Kommunstyrelsen protokoll.pdf")
LANDSBYGD_SCAN = Path("2021/landsbygdsnamnden/Landsbygdsnämnden 2021.pdf")
SOV_2021_SCAN = Path("2021/programnamnd-social-valfard/Programnämnd Social välfärd 2021.pdf")


@dataclass(frozen=True)
class Start:
    page: int
    date: str
    body_slug: str
    diary: str = ""


# This source is image-only. Each start was verified from an OCR rendering of
# the original first page, including committee, date and top-right diary.
KS_SCAN_STARTS: tuple[Start, ...] = (
    Start(1, "2020-02-11", "kommunstyrelsen", "Ks 7/2020"),
    Start(5, "2020-02-11", "kommunstyrelsen", "Ks 7/2020"),
    Start(20, "2020-02-11", "kommunstyrelsen", "Ks 7/2020"),
    Start(35, "2020-03-17", "kommunstyrelsen", "Ks 8/2020"),
    Start(42, "2020-03-17", "kommunstyrelsen", "Ks 8/2020"),
    Start(49, "2020-03-17", "kommunstyrelsen", "Ks 8/2020"),
    Start(68, "2020-03-17", "kommunstyrelsen", "Ks 8/2020"),
    Start(110, "2020-04-14", "kommunstyrelsen", "Ks 9/2020"),
    Start(184, "2020-04-14", "kommunstyrelsen", "Ks 9/2020"),
    Start(189, "2020-08-25", "kommunstyrelsen", "Ks 12/2020"),
    Start(196, "2020-08-25", "kommunstyrelsen", "Ks 12/2020"),
    Start(211, "2020-09-15", "kommunstyrelsen", "Ks 13/2020"),
    Start(216, "2020-09-15", "kommunstyrelsen", "Ks 13/2020"),
    Start(236, "2020-10-13", "kommunstyrelsen", "Ks 14/2020"),
    Start(246, "2020-10-13", "kommunstyrelsen", "Ks 14/2020"),
    Start(271, "2020-11-10", "kommunstyrelsen", "Ks 15/2020"),
    Start(276, "2020-11-10", "kommunstyrelsen", "Ks 15/2020"),
    Start(299, "2020-12-08", "kommunstyrelsen", "Ks 16/2020"),
    Start(306, "2020-12-08", "kommunstyrelsen", "Ks 16/2020"),
    Start(350, "2020-03-17", "kommunstyrelsens-hallbarhetsutskott", "Ks 21/2020"),
    Start(359, "2020-03-17", "kommunstyrelsens-hallbarhetsutskott", "Ks 21/2020"),
    Start(368, "2020-04-14", "kommunstyrelsens-hallbarhetsutskott", "Ks 22/2020"),
    Start(374, "2020-04-14", "kommunstyrelsens-hallbarhetsutskott", "Ks 22/2020"),
    Start(380, "2020-05-05", "kommunstyrelsens-hallbarhetsutskott", "Ks 23/2020"),
)


# Corrections verified against the first page and the municipality's official
# historical listing. This also migrates already-normalized archives.
KNOWN_MEETING_DATE_CORRECTIONS = {
    ("kommunstyrelsen", "2020-10-15"): "2020-10-13",
}

# Values read directly from the top-right corner of the protocol's first page.
# These are needed when an image-only legacy PDF has already been normalized
# and therefore no longer carries the original scan-boundary metadata.
KNOWN_PROTOCOL_DIARIES = {
    (
        row.body_slug,
        KNOWN_MEETING_DATE_CORRECTIONS.get((row.body_slug, row.date), row.date),
    ): row.diary
    for row in KS_SCAN_STARTS
    if row.diary
}


def corrected_meeting_date(body_slug: str, date: str) -> str:
    return KNOWN_MEETING_DATE_CORRECTIONS.get((body_slug, date), date)


def verified_protocol_diary(body_slug: str, date: str, diary: str) -> str:
    return KNOWN_PROTOCOL_DIARIES.get((body_slug, date), diary)


@dataclass
class Part:
    source: Path
    source_relative: str
    start_page: int
    end_page: int
    date: str
    body_slug: str
    diary: str
    source_kind: str
    text_signature: str = ""
    sections: tuple[int, ...] = ()
    declared_sections: tuple[int, ...] = ()
    source_urls: tuple[str, ...] = ()

    @property
    def pages(self) -> int:
        return self.end_page - self.start_page + 1


@dataclass
class Meeting:
    date: str
    body_slug: str
    diary: str
    additional_diaries: list[str] = field(default_factory=list)
    parts: list[Part] = field(default_factory=list)
    dropped_duplicates: list[Part] = field(default_factory=list)
    paragraph_overlaps: list[dict[str, Any]] = field(default_factory=list)
    destination: Path | None = None


def normalized_space(value: str) -> str:
    return " ".join(value.split())


def normalized_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold()
    return " ".join(value.split())


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def run_pdftotext(path: Path) -> list[str]:
    executable = shutil.which("pdftotext")
    if not executable:
        raise RuntimeError("pdftotext is required but was not found on PATH")
    try:
        result = subprocess.run(
            [executable, "-layout", "-enc", "UTF-8", str(path), "-"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=180,
        )
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f"pdftotext timed out for {path}") from error
    if result.returncode:
        raise RuntimeError(f"pdftotext failed for {path}")
    pages = result.stdout.decode("utf-8", errors="replace").replace("\r\n", "\n").split("\f")
    if pages and not pages[-1].strip():
        pages.pop()
    return pages


def read_first_page(path: Path) -> str:
    executable = shutil.which("pdftotext")
    if not executable:
        raise RuntimeError("pdftotext is required but was not found on PATH")
    try:
        result = subprocess.run(
            [executable, "-f", "1", "-l", "1", "-layout", "-enc", "UTF-8", str(path), "-"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=60,
        )
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f"pdftotext timed out reading the first page of {path}") from error
    if result.returncode:
        raise RuntimeError(f"pdftotext failed for {path}")
    return result.stdout.decode("utf-8", errors="replace")


def first_page_diary(text: str) -> str:
    lines = [normalized_space(line) for line in text.splitlines() if normalized_space(line)]
    candidates: list[str] = []
    for line in lines[:20]:
        matches = DIARY_RE.findall(line)
        if "protokoll" in line.casefold() and len(matches) == 1:
            return matches[0]
        candidates.extend(matches)
    unique = list(dict.fromkeys(candidates))
    return unique[0] if len(unique) == 1 else ""


def first_page_date(text: str) -> str:
    match = re.search(r"(?im)^\s*Datum\s*:\s*(20\d{2}-\d{2}-\d{2})\b", text)
    return match.group(1) if match else ""


def body_from_page(text: str) -> str:
    clean = normalized_text(text)
    for phrase, slug in BODY_PHRASES:
        if phrase in clean:
            return slug
    return ""


def is_protocol_cover(text: str) -> bool:
    clean = normalized_text(text)
    return bool(
        first_page_date(text)
        and body_from_page(text)
        and "datum:" in clean
        and ("närvarande" in clean or ("tid:" in clean and "plats:" in clean))
    )


def detect_native_starts(relative: Path, pages: list[str]) -> list[Start]:
    starts: list[Start] = []
    for number, page in enumerate(pages, start=1):
        if not is_protocol_cover(page):
            continue
        starts.append(Start(number, first_page_date(page), body_from_page(page), first_page_diary(page)))

    # These source pages are scans with no native text. Their metadata was
    # manually verified from the original page image.
    if relative == LANDSBYGD_SCAN:
        starts.append(Start(1, "2021-02-03", "landsbygdsnamnden", "Ln 152/2020"))
    elif relative == SOV_2021_SCAN:
        starts.append(Start(1, "2021-02-04", "programnamnd-social-valfard", "Sov 6/2021"))
    return sorted(set(starts), key=lambda row: row.page)


def source_urls_by_path(state: dict[str, Any]) -> dict[str, tuple[str, ...]]:
    result: dict[str, list[str]] = defaultdict(list)
    protocols = state.get("protocols", {}) if isinstance(state, dict) else {}
    for url, record in protocols.items():
        if isinstance(record, dict) and record.get("local_path"):
            result[str(record["local_path"]).replace("\\", "/")].append(str(url))
    return {path: tuple(sorted(set(urls))) for path, urls in result.items()}


def state_diaries_by_path(state: dict[str, Any]) -> dict[str, str]:
    result: dict[str, str] = {}
    protocols = state.get("protocols", {}) if isinstance(state, dict) else {}
    for record in protocols.values():
        if not isinstance(record, dict) or not record.get("local_path") or not record.get("diary_number"):
            continue
        path = str(record["local_path"]).replace("\\", "/")
        diary = normalized_space(str(record["diary_number"]))
        existing = result.get(path)
        if existing and normalized_diary(existing) != normalized_diary(diary):
            raise RuntimeError(f"Scraper state has conflicting protocol diaries for {path}")
        result[path] = diary
    return result


def manifest_diaries_by_path(manifest: dict[str, Any]) -> dict[str, str]:
    result: dict[str, str] = {}
    for meeting in manifest.get("meetings", []):
        if not isinstance(meeting, dict) or not meeting.get("local_path") or not meeting.get("diary_number"):
            continue
        result[str(meeting["local_path"]).replace("\\", "/")] = normalized_space(str(meeting["diary_number"]))
    return result


def read_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return {"schema_version": 1, "updated_at": "", "protocols": {}}
    payload = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("protocols"), dict):
        raise RuntimeError(f"Invalid scraper state: {STATE_PATH}")
    return payload


def page_count(path: Path) -> int:
    cached = PAGE_COUNT_CACHE.get(path)
    if cached is not None:
        return cached
    executable = shutil.which("pdfinfo")
    if not executable:
        raise RuntimeError("pdfinfo is required but was not found on PATH")
    result = subprocess.run(
        [executable, str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    output = result.stdout.decode("utf-8", errors="replace")
    match = re.search(r"(?m)^Pages:\s+(\d+)\s*$", output)
    if result.returncode or not match:
        raise RuntimeError(f"pdfinfo could not read page count for {path}")
    count = int(match.group(1))
    PAGE_COUNT_CACHE[path] = count
    return count


def add_part_details(part: Part, pages: list[str]) -> None:
    selected = pages[part.start_page - 1 : part.end_page]
    text = "\f".join(selected)
    clean = normalized_text(text)
    part.text_signature = hashlib.sha256(clean.encode("utf-8")).hexdigest() if clean else ""
    part.sections = tuple(sorted({int(value) for value in SECTION_RE.findall(text)}))
    cover = "\n".join(selected[:2])
    match = re.search(r"(?im)^\s*Paragraf(?:er)?\s+([^\n]+)", cover)
    declared: set[int] = set()
    if match:
        for first, last in re.findall(r"(\d{1,4})(?:\s*[–-]\s*(\d{1,4}))?", match.group(1)):
            start, end = int(first), int(last or first)
            if start <= end and end - start <= 1_000:
                declared.update(range(start, end + 1))
    part.declared_sections = tuple(sorted(declared))


def duplicate_sources(paths: Iterable[Path]) -> tuple[set[Path], dict[Path, Path]]:
    groups: dict[str, list[Path]] = defaultdict(list)
    for path in paths:
        groups[sha256_path(path)].append(path)
    keep: set[Path] = set()
    duplicates: dict[Path, Path] = {}
    for rows in groups.values():
        rows.sort(key=lambda p: (" (" in p.stem, len(p.name), p.as_posix().casefold()))
        primary = rows[0]
        keep.add(primary)
        duplicates.update({other: primary for other in rows[1:]})
    return keep, duplicates


def collection_candidate(path: Path) -> bool:
    relative = path.relative_to(ARCHIVE)
    first = relative.parts[0]
    return first == "2020-2022" or (first in {"2020", "2021", "2022"} and not DATE_RE.match(path.name))


def collect_parts(
    state: dict[str, Any], previous_manifest: dict[str, Any] | None = None
) -> tuple[list[Part], set[Path], dict[Path, Path], dict[Path, list[str]]]:
    pdfs = sorted(ARCHIVE.rglob("*.pdf"))
    keep, exact_duplicates = duplicate_sources(pdfs)
    urls_by_path = source_urls_by_path(state)
    diaries_by_path = state_diaries_by_path(state)
    for relative, diary in manifest_diaries_by_path(previous_manifest or {}).items():
        diaries_by_path.setdefault(relative, diary)
    parts: list[Part] = []
    collection_sources: set[Path] = set()
    diagnostics: dict[Path, list[str]] = defaultdict(list)

    kept_paths = sorted(keep)
    candidates = [path for path in kept_paths if collection_candidate(path) and path.relative_to(ARCHIVE) != KS_SCAN]
    ordinary = [path for path in kept_paths if path not in candidates and path.relative_to(ARCHIVE) != KS_SCAN]
    ordinary_needing_text = [path for path in ordinary if path.relative_to(ARCHIVE).as_posix() not in diaries_by_path]
    with ThreadPoolExecutor(max_workers=6) as executor:
        list(executor.map(page_count, kept_paths))
        candidate_pages = dict(zip(candidates, executor.map(run_pdftotext, candidates)))
        first_pages = dict(zip(ordinary_needing_text, executor.map(read_first_page, ordinary_needing_text)))

    for path in pdfs:
        if path not in keep:
            continue
        relative = path.relative_to(ARCHIVE)
        relative_posix = relative.as_posix()
        if relative == KS_SCAN:
            starts = list(KS_SCAN_STARTS)
            pages = [""] * page_count(path)
        elif collection_candidate(path):
            pages = candidate_pages[path]
            starts = detect_native_starts(relative, pages)
        else:
            pages = []
            starts = []

        unique_meetings = {(row.date, row.body_slug, row.diary.casefold()) for row in starts}
        is_collection = relative == KS_SCAN or len(unique_meetings) > 1 or len(starts) > 1
        if is_collection:
            collection_sources.add(path)
            if not starts or starts[0].page != 1:
                raise RuntimeError(f"Collection does not start at a verified protocol cover: {relative}")
            count = len(pages) if pages else page_count(path)
            for index, start in enumerate(starts):
                end = starts[index + 1].page - 1 if index + 1 < len(starts) else count
                part = Part(
                    source=path,
                    source_relative=relative_posix,
                    start_page=start.page,
                    end_page=end,
                    date=corrected_meeting_date(start.body_slug, start.date),
                    body_slug=start.body_slug,
                    diary=verified_protocol_diary(
                        start.body_slug,
                        corrected_meeting_date(start.body_slug, start.date),
                        start.diary,
                    ),
                    source_kind="collection_pages",
                    source_urls=urls_by_path.get(relative_posix, ()),
                )
                add_part_details(part, pages)
                parts.append(part)
            covered = sum(row.pages for row in parts if row.source == path)
            if covered != count:
                raise RuntimeError(f"Page coverage mismatch for {relative}: {covered} of {count}")
            diagnostics[path].append(f"split {count} pages at {len(starts)} verified protocol covers")
            continue

        filename_date = DATE_RE.search(path.name)
        if starts:
            start = starts[0]
            date, body_slug, diary = start.date, start.body_slug, start.diary
        else:
            if not filename_date:
                raise RuntimeError(f"Cannot identify meeting date in single PDF: {relative}")
            date = filename_date.group(0)
            body_slug = FOLDER_ALIASES.get(relative.parent.name, relative.parent.name)
            diary = diaries_by_path.get(relative_posix, "")
            if not diary:
                first_text = first_pages.get(path) or (pages[0] if pages else "")
                if first_text:
                    diary = first_page_diary(first_text)
        date = corrected_meeting_date(body_slug, date)
        diary = verified_protocol_diary(body_slug, date, diary)
        count = page_count(path)
        parts.append(
            Part(
                source=path,
                source_relative=relative_posix,
                start_page=1,
                end_page=count,
                date=date,
                body_slug=body_slug,
                diary=diary,
                source_kind="whole_pdf",
                source_urls=urls_by_path.get(relative_posix, ()),
            )
        )
    return parts, collection_sources, exact_duplicates, diagnostics


def normalized_diary(value: str) -> str:
    return normalized_space(value).casefold()


def group_meetings(parts: list[Part]) -> list[Meeting]:
    buckets: dict[tuple[str, str], list[Part]] = defaultdict(list)
    for part in parts:
        if part.body_slug not in BODY_DISPLAY:
            raise RuntimeError(f"Unknown committee folder/body: {part.body_slug} ({part.source_relative})")
        if not part.date.startswith("20"):
            raise RuntimeError(f"Invalid meeting date: {part.date} ({part.source_relative})")
        buckets[(part.body_slug, part.date)].append(part)

    meetings: list[Meeting] = []
    for (body_slug, date), rows in sorted(buckets.items(), key=lambda item: (item[0][1], item[0][0])):
        known: dict[str, str] = {}
        for row in rows:
            if row.diary:
                known.setdefault(normalized_diary(row.diary), row.diary)
        if (body_slug, date) == ("overformyndarnamnden", "2021-01-19"):
            primary_key = normalized_diary("Ön 13/2021")
            if primary_key not in known:
                raise RuntimeError("Expected public protocol diary Ön 13/2021 for Överförmyndarnämnden 2021-01-19")
            additional = [value for key, value in known.items() if key != primary_key]
            meetings.append(Meeting(date, body_slug, known[primary_key], additional, rows))
            continue
        if len(known) <= 1:
            diary = next(iter(known.values()), "")
            meetings.append(Meeting(date, body_slug, diary, [], rows))
            continue
        if any(not row.diary for row in rows):
            raise RuntimeError(f"Ambiguous no-diary PDF among several meetings on {date} for {body_slug}")
        by_diary: dict[str, list[Part]] = defaultdict(list)
        for row in rows:
            by_diary[normalized_diary(row.diary)].append(row)
        meetings.extend(Meeting(date, body_slug, known[key], [], grouped) for key, grouped in sorted(by_diary.items()))
    return meetings


def part_sort_key(part: Part) -> tuple[Any, ...]:
    comparison = part.declared_sections or part.sections
    first_section = comparison[0] if comparison else 1_000_000
    source_rank = 0 if part.source_kind == "collection_pages" else 1
    return first_section, -part.pages, source_rank, part.source_relative.casefold(), part.start_page


def hydrate_group_parts(meetings: list[Meeting]) -> None:
    needed: set[Path] = set()
    for meeting in meetings:
        if len(meeting.parts) == 1:
            continue
        for part in meeting.parts:
            if part.text_signature or part.sections or part.source == ARCHIVE / KS_SCAN:
                continue
            needed.add(part.source)
    paths = sorted(needed)
    with ThreadPoolExecutor(max_workers=6) as executor:
        text_cache = dict(zip(paths, executor.map(run_pdftotext, paths)))
    for meeting in meetings:
        if len(meeting.parts) == 1:
            continue
        for part in meeting.parts:
            if part.source not in text_cache or part.text_signature or part.sections:
                continue
            pages = text_cache[part.source]
            add_part_details(part, pages)


def deduplicate_parts(meeting: Meeting) -> None:
    kept: list[Part] = []
    signatures: set[str] = set()
    section_sets: dict[tuple[int, ...], Part] = {}
    declared_sets: dict[tuple[int, ...], Part] = {}
    for part in sorted(meeting.parts, key=part_sort_key):
        if part.text_signature and part.text_signature in signatures:
            meeting.dropped_duplicates.append(part)
            continue
        if part.sections and part.sections in section_sets:
            meeting.dropped_duplicates.append(part)
            continue
        if part.declared_sections and part.declared_sections in declared_sets:
            meeting.dropped_duplicates.append(part)
            continue
        part_comparison = part.declared_sections or part.sections
        overlaps = [
            sorted(set(part_comparison).intersection(other.declared_sections or other.sections))
            for other in kept
            if part_comparison and (other.declared_sections or other.sections)
        ]
        overlaps = [values for values in overlaps if values]
        if overlaps:
            meeting.paragraph_overlaps.append(
                {
                    "paragraphs": overlaps[0],
                    "source": part.source_relative,
                    "page_start": part.start_page,
                    "reason": "Distinct source parts use the same paragraph number; both are preserved",
                }
            )
        kept.append(part)
        if part.text_signature:
            signatures.add(part.text_signature)
        if part.sections:
            section_sets[part.sections] = part
        if part.declared_sections:
            declared_sets[part.declared_sections] = part
    meeting.parts = kept


def diary_filename_suffix(value: str) -> str:
    clean = re.sub(r"[^A-Za-zÅÄÖåäö0-9 -]+", "-", value).strip(" -")
    return f" ({clean})" if clean else ""


def assign_destinations(meetings: list[Meeting]) -> None:
    same_day: dict[tuple[str, str], int] = defaultdict(int)
    for meeting in meetings:
        same_day[(meeting.body_slug, meeting.date)] += 1
    for meeting in meetings:
        suffix = diary_filename_suffix(meeting.diary) if same_day[(meeting.body_slug, meeting.date)] > 1 else ""
        filename = f"{meeting.date} {BODY_DISPLAY[meeting.body_slug]}{suffix}.pdf"
        meeting.destination = ARCHIVE / meeting.date[:4] / meeting.body_slug / filename


def changed_meeting(meeting: Meeting, collection_sources: set[Path]) -> bool:
    if len(meeting.parts) != 1 or meeting.dropped_duplicates:
        return True
    part = meeting.parts[0]
    if part.source in collection_sources or part.start_page != 1 or part.end_page != page_count(part.source):
        return True
    return part.source.resolve() != meeting.destination.resolve()


def transformed_meeting(meeting: Meeting, collection_sources: set[Path]) -> bool:
    if len(meeting.parts) != 1 or meeting.dropped_duplicates:
        return True
    part = meeting.parts[0]
    return part.source in collection_sources or part.start_page != 1 or part.end_page != page_count(part.source)


def write_meeting(meeting: Meeting, destination: Path) -> int:
    writer = PdfWriter()
    expected = 0
    readers: dict[Path, PdfReader] = {}
    for part in meeting.parts:
        reader = readers.setdefault(part.source, PdfReader(str(part.source)))
        if part.end_page > len(reader.pages):
            raise RuntimeError(f"Page range exceeds source PDF: {part.source_relative}")
        for index in range(part.start_page - 1, part.end_page):
            writer.add_page(reader.pages[index])
            expected += 1
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + ".part")
    with temporary.open("wb") as handle:
        writer.write(handle)
    os.replace(temporary, destination)
    actual = page_count(destination)
    if actual != expected:
        raise RuntimeError(f"Written page count mismatch for {destination}: {actual} != {expected}")
    return actual


def safe_backup_path(source: Path) -> Path:
    return SOURCE_ARCHIVE / source.relative_to(ARCHIVE)


def move_to_backup(source: Path) -> Path:
    destination = safe_backup_path(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        source_hash = sha256_path(source)
        if sha256_path(destination) == source_hash:
            source.unlink()
            return destination
        destination = destination.with_name(f"{destination.stem}.history-{source_hash[:12]}{destination.suffix}")
        if destination.exists():
            if sha256_path(destination) != source_hash:
                raise RuntimeError(f"Source backup collision: {destination}")
            source.unlink()
            return destination
        os.replace(source, destination)
    else:
        os.replace(source, destination)
    return destination


def atomic_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def remove_empty_archive_directories() -> None:
    directories = sorted((path for path in ARCHIVE.rglob("*") if path.is_dir()), key=lambda path: len(path.parts), reverse=True)
    for directory in directories:
        try:
            directory.rmdir()
        except OSError:
            pass


def read_manifest() -> dict[str, Any]:
    if not MANIFEST_PATH.exists():
        return {"schema_version": 2, "meetings": []}
    payload = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("meetings"), list):
        raise RuntimeError(f"Invalid meeting manifest: {MANIFEST_PATH}")
    return payload


def state_sources_by_meeting(state: dict[str, Any]) -> dict[str, dict[Path, list[str]]]:
    result: dict[str, dict[Path, list[str]]] = defaultdict(lambda: defaultdict(list))
    for url, record in state.get("protocols", {}).items():
        if not isinstance(record, dict) or not record.get("local_path") or not record.get("source_local_path"):
            continue
        source = (ARCHIVE / str(record["source_local_path"])).resolve()
        if source.exists():
            result[str(record["local_path"]).replace("\\", "/")][source].append(str(url))
    return result


def page_text_signatures(path: Path) -> tuple[str, ...]:
    cached = PAGE_TEXT_SIGNATURE_CACHE.get(path)
    if cached is not None:
        return cached
    pages = run_pdftotext(path)[: page_count(path)]
    signatures = tuple(hashlib.sha256(normalized_text(page).encode("utf-8")).hexdigest() for page in pages)
    PAGE_TEXT_SIGNATURE_CACHE[path] = signatures
    return signatures


def recover_source_entries(path: Path, source_groups: dict[Path, list[str]]) -> list[dict[str, Any]] | None:
    if len(source_groups) < 2:
        return None
    canonical = page_text_signatures(path)
    empty_signature = hashlib.sha256(b"").hexdigest()
    if not canonical or all(signature == empty_signature for signature in canonical):
        return None
    recovered: list[dict[str, Any]] = []
    included_count = 0
    for source_path, urls in source_groups.items():
        source = page_text_signatures(source_path)
        matches = [
            index
            for index in range(len(canonical) - len(source) + 1)
            if source and canonical[index : index + len(source)] == source
        ]
        included = len(matches) == 1
        if included:
            included_count += 1
        recovered.append(
            {
                "source_path": source_path.relative_to(ROOT).as_posix(),
                "page_start": 1,
                "page_end": len(source),
                "output_page_start": matches[0] + 1 if included else None,
                "output_page_end": matches[0] + len(source) if included else None,
                "included": included,
                "source_urls": sorted(set(urls)),
            }
        )
    if included_count < 2:
        return None
    recovered.sort(
        key=lambda source: (
            not source["included"],
            int(source.get("output_page_start") or 1_000_000),
            str(source["source_path"]).casefold(),
        )
    )
    return recovered


def known_legacy_source_entries(meeting: Meeting) -> list[dict[str, Any]] | None:
    source_path = SOURCE_ARCHIVE / KS_SCAN
    if not source_path.exists():
        return None
    selected: list[tuple[int, int]] = []
    total_pages = page_count(source_path)
    for index, start in enumerate(KS_SCAN_STARTS):
        date = corrected_meeting_date(start.body_slug, start.date)
        if start.body_slug != meeting.body_slug or date != meeting.date:
            continue
        end = KS_SCAN_STARTS[index + 1].page - 1 if index + 1 < len(KS_SCAN_STARTS) else total_pages
        selected.append((start.page, end))
    if not selected:
        return None
    output_page = 1
    sources: list[dict[str, Any]] = []
    for start, end in selected:
        pages = end - start + 1
        sources.append(
            {
                "source_path": source_path.relative_to(ROOT).as_posix(),
                "page_start": start,
                "page_end": end,
                "output_page_start": output_page,
                "output_page_end": output_page + pages - 1,
                "included": True,
                "source_urls": [],
            }
        )
        output_page += pages
    return sources


def manifest_entry(
    meeting: Meeting,
    path: Path,
    moved: dict[Path, Path] | None = None,
    previous: dict[str, Any] | None = None,
    recovered_sources: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    moved = moved or {}
    urls = sorted({url for part in meeting.parts + meeting.dropped_duplicates for url in part.source_urls})
    digest = sha256_path(path)
    local_path = path.relative_to(ARCHIVE).as_posix()

    # An idempotent normalization run sees an already canonical meeting as one
    # whole PDF. Preserve the more detailed source/page provenance recorded by
    # the run that originally joined or split it.
    preserved_previous = bool(
        previous
        and (
            str(previous.get("local_path") or "") == local_path
            or (
                str(previous.get("body_slug") or "") == meeting.body_slug
                and corrected_meeting_date(meeting.body_slug, str(previous.get("date") or "")) == meeting.date
            )
        )
        and str(previous.get("sha256") or "") == digest
        and isinstance(previous.get("sources"), list)
    )
    known_legacy_sources = known_legacy_source_entries(meeting)
    if recovered_sources:
        sources = recovered_sources
    elif known_legacy_sources:
        sources = known_legacy_sources
    elif preserved_previous:
        sources = json.loads(json.dumps(previous["sources"], ensure_ascii=False))
        next_output_page = 1
        for source in sources:
            if not isinstance(source, dict):
                continue
            if source.get("included") and source.get("output_page_start") is None:
                source_pages = int(source.get("page_end") or 0) - int(source.get("page_start") or 1) + 1
                source["output_page_start"] = next_output_page
                source["output_page_end"] = next_output_page + source_pages - 1
            if source.get("included"):
                next_output_page = int(source.get("output_page_end") or next_output_page - 1) + 1
    else:
        sources = []
        output_page = 1
        for part in meeting.parts + meeting.dropped_duplicates:
            if part.source in moved:
                source_path = moved[part.source]
            else:
                backup = safe_backup_path(part.source)
                if backup.exists():
                    source_path = backup
                elif part.source.exists():
                    source_path = part.source
                elif len(meeting.parts) == 1 and part.source_kind == "whole_pdf":
                    source_path = path
                else:
                    source_path = part.source
            included = part in meeting.parts
            output_start = output_page if included else None
            output_end = output_page + part.pages - 1 if included else None
            sources.append(
                {
                    "source_path": source_path.relative_to(ROOT).as_posix(),
                    "page_start": part.start_page,
                    "page_end": part.end_page,
                    "output_page_start": output_start,
                    "output_page_end": output_end,
                    "included": included,
                    "source_urls": list(part.source_urls),
                }
            )
            if included:
                output_page = output_end + 1
    return {
        "date": meeting.date,
        "body": BODY_DISPLAY[meeting.body_slug],
        "body_slug": meeting.body_slug,
        "diary_number": meeting.diary,
        "diary_numbers": [meeting.diary, *meeting.additional_diaries] if meeting.diary else meeting.additional_diaries,
        "local_path": local_path,
        "pages": page_count(path),
        "bytes": path.stat().st_size,
        "sha256": digest,
        "source_urls": urls,
        "sources": sources,
        "paragraph_overlaps": (
            previous.get("paragraph_overlaps", []) if preserved_previous and previous else meeting.paragraph_overlaps
        ),
    }


def update_state(state: dict[str, Any], meetings: list[Meeting], moved: dict[Path, Path]) -> None:
    by_url: dict[str, Meeting] = {}
    for meeting in meetings:
        for part in meeting.parts + meeting.dropped_duplicates:
            for url in part.source_urls:
                by_url[url] = meeting
    for url, record in state.get("protocols", {}).items():
        if url not in by_url or not isinstance(record, dict):
            continue
        meeting = by_url[url]
        destination = meeting.destination
        old_relative = str(record.get("local_path") or "").replace("\\", "/")
        old_path = ARCHIVE / old_relative if old_relative else None
        if old_path in moved:
            record.setdefault("source_sha256", record.get("sha256", ""))
            record.setdefault("source_bytes", record.get("bytes", 0))
            record["source_local_path"] = os.path.relpath(moved[old_path], ARCHIVE).replace("\\", "/")
        record["local_path"] = destination.relative_to(ARCHIVE).as_posix()
        record["meeting_path"] = record["local_path"]
        meeting_hash = sha256_path(destination)
        meeting_bytes = destination.stat().st_size
        record["sha256"] = meeting_hash
        record["bytes"] = meeting_bytes
        record["meeting_sha256"] = meeting_hash
        record["meeting_bytes"] = meeting_bytes
    state["schema_version"] = max(int(state.get("schema_version") or 1), 2)
    state["updated_at"] = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def validate_archive(meetings: list[Meeting], state: dict[str, Any]) -> dict[str, Any]:
    pdfs = sorted(ARCHIVE.rglob("*.pdf"))
    bad_paths: list[str] = []
    keys: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    for path in pdfs:
        relative = path.relative_to(ARCHIVE)
        if len(relative.parts) != 3 or not re.fullmatch(r"20\d{2}", relative.parts[0]):
            bad_paths.append(relative.as_posix())
            continue
        match = DATE_RE.match(path.name)
        if not match:
            bad_paths.append(relative.as_posix())
            continue
        keys[(relative.parts[0], relative.parts[1], match.group(0))].append(relative.as_posix())
        page_count(path)
    duplicates = {"|".join(key): values for key, values in keys.items() if len(values) > 1}
    missing_state = []
    for url, record in state.get("protocols", {}).items():
        if isinstance(record, dict) and record.get("local_path") and not (ARCHIVE / str(record["local_path"])).exists():
            missing_state.append({"url": url, "local_path": record["local_path"]})
    if bad_paths or duplicates or missing_state:
        raise RuntimeError(
            "Archive validation failed: "
            + json.dumps({"bad_paths": bad_paths, "duplicate_meetings": duplicates, "missing_state": missing_state}, ensure_ascii=False)
        )
    return {
        "pdfs": len(pdfs),
        "meetings": len(meetings),
        "bytes": sum(path.stat().st_size for path in pdfs),
        "bad_paths": 0,
        "duplicate_committee_dates": 0,
        "missing_state_paths": 0,
    }


def build_report(
    meetings: list[Meeting],
    changed: list[Meeting],
    collection_sources: set[Path],
    exact_duplicates: dict[Path, Path],
    diagnostics: dict[Path, list[str]],
    transformed: list[Meeting],
    renamed: list[Meeting],
) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "archive": ARCHIVE.relative_to(ROOT).as_posix(),
        "source_archive": SOURCE_ARCHIVE.relative_to(ROOT).as_posix(),
        "meetings_detected": len(meetings),
        "meetings_changed": len(changed),
        "meetings_rebuilt": len(transformed),
        "meetings_renamed_only": len(renamed),
        "collection_sources": len(collection_sources),
        "exact_duplicate_sources": len(exact_duplicates),
        "deduplicated_parts": sum(len(meeting.dropped_duplicates) for meeting in meetings),
        "meetings_with_paragraph_overlaps": sum(bool(meeting.paragraph_overlaps) for meeting in meetings),
        "paragraph_overlap_meetings": [
            {
                "date": meeting.date,
                "body": BODY_DISPLAY[meeting.body_slug],
                "diary_number": meeting.diary,
                "overlaps": meeting.paragraph_overlaps,
            }
            for meeting in meetings
            if meeting.paragraph_overlaps
        ],
        "collections": {
            path.relative_to(ARCHIVE).as_posix(): messages for path, messages in sorted(diagnostics.items(), key=lambda row: row[0].as_posix())
        },
        "changes": [
            {
                "date": meeting.date,
                "body": BODY_DISPLAY[meeting.body_slug],
                "diary_number": meeting.diary,
                "destination": meeting.destination.relative_to(ARCHIVE).as_posix(),
                "included_parts": len(meeting.parts),
                "dropped_duplicate_parts": len(meeting.dropped_duplicates),
                "paragraph_overlap_count": len(meeting.paragraph_overlaps),
                "pages": sum(part.pages for part in meeting.parts),
            }
            for meeting in changed
        ],
    }


def run(apply: bool) -> dict[str, Any]:
    if not ARCHIVE.exists():
        raise RuntimeError(f"Archive does not exist: {ARCHIVE}")
    if STAGE.exists() and any(STAGE.iterdir()):
        raise RuntimeError(f"Normalization stage is not empty: {STAGE}")
    state = read_state()
    previous_manifest = read_manifest()
    previous_by_path = {
        str(entry.get("local_path") or ""): entry
        for entry in previous_manifest.get("meetings", [])
        if isinstance(entry, dict) and entry.get("local_path")
    }
    state_source_groups = state_sources_by_meeting(state)
    parts, collection_sources, exact_duplicates, diagnostics = collect_parts(state, previous_manifest)
    meetings = group_meetings(parts)
    hydrate_group_parts(meetings)
    for meeting in meetings:
        deduplicate_parts(meeting)
    assign_destinations(meetings)
    changed = [meeting for meeting in meetings if changed_meeting(meeting, collection_sources)]
    transformed = [meeting for meeting in changed if transformed_meeting(meeting, collection_sources)]
    renamed = [meeting for meeting in changed if meeting not in transformed]
    report = build_report(meetings, changed, collection_sources, exact_duplicates, diagnostics, transformed, renamed)
    if not apply:
        return report

    STAGE.mkdir(parents=True, exist_ok=True)
    for meeting in transformed:
        staged = STAGE / meeting.destination.relative_to(ARCHIVE)
        write_meeting(meeting, staged)

    changed_sources = set(collection_sources) | set(exact_duplicates)
    for meeting in transformed:
        changed_sources.update(part.source for part in meeting.parts + meeting.dropped_duplicates)
    moved: dict[Path, Path] = {}
    for source in sorted(changed_sources):
        if source.exists():
            moved[source] = move_to_backup(source)

    for meeting in renamed:
        part = meeting.parts[0]
        meeting.destination.parent.mkdir(parents=True, exist_ok=True)
        if meeting.destination.exists():
            raise RuntimeError(f"Rename destination already exists: {meeting.destination}")
        PAGE_COUNT_CACHE.pop(meeting.destination, None)
        os.replace(part.source, meeting.destination)

    for meeting in transformed:
        staged = STAGE / meeting.destination.relative_to(ARCHIVE)
        meeting.destination.parent.mkdir(parents=True, exist_ok=True)
        PAGE_COUNT_CACHE.pop(meeting.destination, None)
        PAGE_COUNT_CACHE.pop(staged, None)
        os.replace(staged, meeting.destination)

    remove_empty_archive_directories()

    # Remove only the now-empty staging tree. Source files are never deleted;
    # they have been moved to SOURCE_ARCHIVE above.
    for directory in sorted((path for path in STAGE.rglob("*") if path.is_dir()), reverse=True):
        directory.rmdir()
    STAGE.rmdir()

    update_state(state, meetings, moved)
    atomic_json(STATE_PATH, state)
    recovery_candidates: list[tuple[Path, dict[Path, list[str]]]] = []
    for meeting in meetings:
        relative = meeting.destination.relative_to(ARCHIVE).as_posix()
        previous = previous_by_path.get(relative, {})
        previous_sources = previous.get("sources", []) if isinstance(previous, dict) else []
        detailed_previous = sum(
            bool(source.get("included") and source.get("output_page_start") is not None)
            for source in previous_sources
            if isinstance(source, dict)
        ) >= 2
        groups = state_source_groups.get(relative, {})
        if meeting not in changed and len(groups) >= 2 and not detailed_previous:
            recovery_candidates.append((meeting.destination, groups))
    with ThreadPoolExecutor(max_workers=6) as executor:
        recovered_values = list(executor.map(lambda row: recover_source_entries(*row), recovery_candidates))
    recovered_by_path = {
        path: recovered
        for (path, _), recovered in zip(recovery_candidates, recovered_values)
        if recovered
    }
    entries = [
        manifest_entry(
            meeting,
            meeting.destination,
            moved,
            previous_by_path.get(meeting.destination.relative_to(ARCHIVE).as_posix()),
            recovered_by_path.get(meeting.destination),
        )
        for meeting in meetings
    ]
    manifest = {
        "schema_version": 2,
        "generated_at": report["generated_at"],
        "meeting_count": len(entries),
        "meetings": entries,
    }
    atomic_json(MANIFEST_PATH, manifest)
    report["validation"] = validate_archive(meetings, state)
    return report


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write normalized PDFs and move changed sources to the source archive")
    parser.add_argument("--archive", type=Path, default=ARCHIVE, help="Protocol archive to normalize")
    parser.add_argument("--source-archive", type=Path, default=None, help="Recoverable source archive (default: sibling <archive>-kallfiler)")
    parser.add_argument("--state", type=Path, default=None, help="Scraper state path (default: <archive>/state.json)")
    parser.add_argument("--manifest", type=Path, default=None, help="Meeting manifest path (default: <archive>/meetings.json)")
    parser.add_argument("--report", type=Path, default=None, help="Optional path for the JSON report")
    return parser.parse_args(argv)


def configure_paths(args: argparse.Namespace) -> None:
    global ARCHIVE, SOURCE_ARCHIVE, STAGE, STATE_PATH, MANIFEST_PATH
    ARCHIVE = args.archive.resolve()
    SOURCE_ARCHIVE = (
        args.source_archive.resolve()
        if args.source_archive
        else ARCHIVE.parent / f"{ARCHIVE.name}-kallfiler"
    )
    STAGE = ARCHIVE.parent / f"{ARCHIVE.name}-normalization-stage"
    STATE_PATH = args.state.resolve() if args.state else ARCHIVE / "state.json"
    MANIFEST_PATH = args.manifest.resolve() if args.manifest else ARCHIVE / "meetings.json"


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    configure_paths(args)
    try:
        report = run(args.apply)
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    if args.report:
        atomic_json(args.report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
