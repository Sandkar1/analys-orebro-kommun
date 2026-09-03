#!/usr/bin/env python3
"""Parse archived Örebro protocols and merge them into the municipal data pack.

The default command is the second half of the update workflow. It parses only
archived source URLs not already present in the checked-in protocol pack,
stages every output, validates the complete merged structure, rebuilds the
derived decision indexes, and publishes only after all checks pass.

No uncertain extraction is silently accepted. Review findings produce a report
and leave production data untouched.
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
import tempfile
import unicodedata
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable, Sequence


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
ARCHIVE_ROOT = DATA_DIR / "Protokoll"
ARCHIVE_STATE = ARCHIVE_ROOT / "state.json"
MEETING_MANIFEST = ARCHIVE_ROOT / "meetings.json"
PROTOCOL_BUNDLE = DATA_DIR / "municipal-protocol-data-orebro-v2.js"
PROTOCOL_MANIFEST = DATA_DIR / "municipal-protocol-data-manifest.js"
PROTOCOL_DIARIES = DATA_DIR / "municipal-protocol-diary-data.js"
PARSER_REPORT = ARCHIVE_ROOT / "parser" / "latest-report.json"
MAXIMUM_DATA_FILE_BYTES = 95_000_000
TARGET_DATA_FILE_BYTES = 90_000_000
PUBLIC_DATA_FROM = "2023-01-01"
PARTY_PATTERN = r"S|M|C|L|KD|V|MP|SD|ÖrP"
DIARY_PATTERN = re.compile(
    r"(?<![A-Za-zÅÄÖåäö])[A-ZÅÄÖ][A-Za-zÅÄÖåäö]{0,9}\s+\d{1,6}/20\d{2}"
    r"(?![A-Za-zÅÄÖåäö])"
)
DATE_PATTERN = re.compile(r"\b20\d{2}-\d{2}-\d{2}\b")
SECTION_PATTERN = re.compile(r"^\s*§\s*(\d{1,4}[A-Za-z]?)\s+(.{2,})\s*$")
FOOTER_PATTERN = re.compile(r"^\s*\d+\s*\(\s*\d+\s*\)\s*$")
PERSON_PATTERN = re.compile(
    rf"^\s*(?P<name>[A-ZÅÄÖ][A-Za-zÅÄÖåäöÀ-ÿ'’.-]+(?:\s+[A-ZÅÄÖ][A-Za-zÅÄÖåäöÀ-ÿ'’.-]+){{1,7}})"
    rf"\s*\((?P<party>{PARTY_PATTERN})\)"
)
PERSON_ANY_PATTERN = re.compile(
    rf"(?P<name>[A-ZÅÄÖ][A-Za-zÅÄÖåäöÀ-ÿ'’.-]+(?:\s+[A-ZÅÄÖ][A-Za-zÅÄÖåäöÀ-ÿ'’.-]+){{1,7}})"
    rf"\s*\((?P<party>{PARTY_PATTERN})\)"
)
NAMED_VOTE_PATTERN = re.compile(
    rf"^\s*(?P<name>[A-ZÅÄÖ][A-Za-zÅÄÖåäöÀ-ÿ'’.-]+(?:\s+[A-ZÅÄÖ][A-Za-zÅÄÖåäöÀ-ÿ'’.-]+){{1,7}})"
    rf"\s*\((?P<party>{PARTY_PATTERN})\)\s+(?P<vote>Ja|Nej|Avstår|Frånvarande)\s*$",
    re.IGNORECASE,
)
BODY_TYPES = {
    "kommunfullmäktige": "kommunfullmaktige",
    "kommunstyrelsen": "kommunstyrelsen",
}
FIELD_HEADINGS = {
    "ärendebeskrivning": "ad",
    "sammanfattning": "ad",
    "bakgrund": "ad",
    "yrkande": "yd",
    "yrkanden": "yd",
    "proposition": "pd",
    "propositionsordning": "pd",
    "beslutsgång": "pd",
    "omröstning": "vd",
    "votering": "vd",
    "beslut": "bd",
}
OTHER_HEADINGS = {
    "beslutsunderlag",
    "förslag till beslut",
    "förvaltningens förslag till beslut",
    "reservation",
    "reservationer",
    "särskilt yttrande",
    "protokollsanteckning",
    "jäv",
    "skickas till",
    "expedieras till",
    "upplysningar",
}
ATTENDANCE_HEADINGS = {
    "närvarande ledamöter": "ledamot",
    "tjänstgörande ersättare": "tjänstgörande ersättare",
    "närvarande ersättare": "ersättare",
}


def utc_now() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def atomic_write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(prefix=path.name, suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as output:
            output.write(value)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary_name, path)
    except Exception:
        try:
            os.unlink(temporary_name)
        except OSError:
            pass
        raise


def atomic_write_json(path: Path, value: Any) -> None:
    atomic_write_text(path, json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def normalized_space(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalized_key(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", str(value or ""))
    ascii_value = "".join(character for character in decomposed if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", "_", ascii_value.casefold()).strip("_")


def is_public_protocol_date(value: str) -> bool:
    date = str(value or "")
    return bool(DATE_PATTERN.fullmatch(date) and date >= PUBLIC_DATA_FROM)


def stable_hash(*values: str, length: int = 16) -> str:
    payload = "\x1f".join(normalized_space(value).casefold() for value in values)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:length]


def clean_join(lines: Iterable[str]) -> str:
    cleaned = [normalized_space(line) for line in lines if normalized_space(line)]
    return "\n".join(cleaned).strip()


def js_assigned_json(text: str, marker_pattern: str) -> Any:
    match = re.search(marker_pattern, text)
    if not match:
        raise RuntimeError(f"JSON assignment marker not found: {marker_pattern}")
    start = text.find("=", match.start()) + 1
    while start < len(text) and text[start].isspace():
        start += 1
    value, _ = json.JSONDecoder().raw_decode(text[start:])
    return value


def load_manifest(path: Path = PROTOCOL_MANIFEST) -> dict[str, Any]:
    if not path.exists():
        return {"version": "legacy", "parts": [{"src": "data/municipal-protocol-data-orebro-v2.js"}]}
    value = js_assigned_json(path.read_text(encoding="utf-8"), r"window\.municipalProtocolDataManifest\s*=")
    if not isinstance(value, dict) or not isinstance(value.get("parts"), list) or not value["parts"]:
        raise RuntimeError(f"Invalid municipal protocol manifest: {path}")
    return value


def load_protocol_pack(manifest_path: Path = PROTOCOL_MANIFEST) -> dict[str, Any]:
    manifest = load_manifest(manifest_path)
    parts: list[dict[str, Any]] = []
    for expected_index, descriptor in enumerate(manifest["parts"], start=1):
        source = str(descriptor.get("src") or "")
        source_path = Path(source)
        if not source_path.is_absolute():
            source_path = ROOT / source_path
        if not source_path.exists():
            raise RuntimeError(f"Protocol data part is missing: {source_path}")
        part = js_assigned_json(
            source_path.read_text(encoding="utf-8"),
            rf"window\.municipalProtocolPackParts\s*\[\s*{expected_index}\s*\]\s*=",
        )
        if not isinstance(part, dict):
            raise RuntimeError(f"Protocol data part {expected_index} is not an object")
        parts.append(part)
    first = parts[0]
    return {
        **{key: value for key, value in first.items() if key not in {"d", "r", "pr", "mr"}},
        "d": [row for part in parts for row in part.get("d", [])],
        "r": [row for part in parts for row in part.get("r", [])],
        "pr": [row for part in parts for row in part.get("pr", [])],
        "mr": [row for part in parts for row in part.get("mr", [])],
    }


def validate_flat_rows(name: str, rows: Any, document_count: int, indexed: bool) -> list[str]:
    errors: list[str] = []
    if not isinstance(rows, list):
        return [f"{name} must be an array"]
    if len(rows) % 6:
        errors.append(f"{name} length {len(rows)} is not divisible by six")
        return errors
    if indexed:
        for offset in range(0, len(rows), 6):
            index = rows[offset]
            if not isinstance(index, int) or not 0 <= index < document_count:
                errors.append(f"{name} row {offset // 6} refers to invalid document index {index!r}")
                if len(errors) >= 20:
                    break
    return errors


def validate_pack(pack: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    documents = pack.get("d")
    if not isinstance(documents, list):
        return ["d must be an array"]
    for index, document in enumerate(documents):
        if not isinstance(document, dict):
            errors.append(f"d[{index}] is not an object")
            continue
        for key in ("i", "dt", "t", "p", "b", "doc", "u"):
            if key not in document:
                errors.append(f"d[{index}] lacks required field {key}")
        if document.get("dt") and not DATE_PATTERN.fullmatch(str(document["dt"])):
            errors.append(f"d[{index}] has invalid date: {document['dt']!r}")
        elif document.get("dt") and str(document["dt"]) < PUBLIC_DATA_FROM:
            errors.append(
                f"d[{index}] predates the public GitHub Pages cutoff {PUBLIC_DATA_FROM}: {document['dt']!r}"
            )
    errors.extend(validate_flat_rows("r", pack.get("r"), len(documents), True))
    errors.extend(validate_flat_rows("pr", pack.get("pr"), len(documents), True))
    errors.extend(validate_flat_rows("mr", pack.get("mr"), len(documents), False))
    if errors:
        return errors[:100]
    dates = [str(row.get("dt") or "") for row in documents if row.get("dt")]
    if dates:
        if str(pack.get("pf") or "") != min(dates):
            errors.append(f"pf must be {min(dates)}, got {pack.get('pf')!r}")
        if str(pack.get("pt") or "") != max(dates):
            errors.append(f"pt must be {max(dates)}, got {pack.get('pt')!r}")
    return errors


@dataclass
class Issue:
    severity: str
    code: str
    message: str
    page: int = 0
    section: str = ""


@dataclass
class ParsedProtocol:
    url: str
    title: str
    body: str
    date: str
    protocol_diary: str
    local_path: str
    sha256: str
    source_urls: list[str] = field(default_factory=list)
    documents: list[dict[str, Any]] = field(default_factory=list)
    votes: list[Any] = field(default_factory=list)
    positions: list[Any] = field(default_factory=list)
    members: list[Any] = field(default_factory=list)
    issues: list[Issue] = field(default_factory=list)

    def blocks_publish(self) -> bool:
        return any(issue.severity in {"error", "review"} for issue in self.issues)

    def report(self) -> dict[str, Any]:
        return {
            "url": self.url,
            "title": self.title,
            "body": self.body,
            "date": self.date,
            "protocol_diary": self.protocol_diary,
            "local_path": self.local_path,
            "sha256": self.sha256,
            "source_urls": self.source_urls,
            "documents": len(self.documents),
            "vote_rows": len(self.votes) // 6,
            "position_rows": len(self.positions) // 6,
            "member_rows": len(self.members) // 6,
            "issues": [asdict(issue) for issue in self.issues],
        }


def archive_record_path(record: dict[str, Any]) -> Path:
    raw = Path(str(record.get("local_path") or ""))
    if raw.is_absolute():
        return raw
    return ARCHIVE_ROOT / raw


def load_archive_state(path: Path = ARCHIVE_STATE) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict) or not isinstance(value.get("protocols"), dict):
        raise RuntimeError(f"Invalid scraper state: {path}")
    return value


def load_meeting_manifest(path: Path = MEETING_MANIFEST) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict) or not isinstance(value.get("meetings"), list):
        raise RuntimeError(f"Invalid canonical meeting manifest: {path}")
    return value


def declared_title_sections(title: str) -> set[str]:
    marker = re.search(r"§{1,2}\s*(.+?)(?:\.pdf)?$", title, re.IGNORECASE)
    if not marker:
        return set()
    sections: set[str] = set()
    for match in re.finditer(r"(\d{1,4})(?:\s*[–-]\s*(\d{1,4}))?", marker.group(1)):
        first, last = int(match.group(1)), int(match.group(2) or match.group(1))
        if last < first or last - first > 1_000:
            continue
        sections.update(str(number) for number in range(first, last + 1))
    return sections


def pack_meeting_sections(pack: dict[str, Any]) -> dict[tuple[str, str], set[str]]:
    result: dict[tuple[str, str], set[str]] = {}
    for document in pack.get("d", []):
        key = (str(document.get("dt") or ""), normalized_key(str(document.get("b") or "")))
        sections = result.setdefault(key, set())
        for point in (document.get("p") or {}):
            sections.add(str(point).split(".", 1)[0])
        match = re.search(r"§\s*(\d{1,4}[A-Za-z]?)", str(document.get("ht") or ""))
        if match:
            sections.add(match.group(1))
    return result


def preferred_source_url(urls: Sequence[str], state: dict[str, Any]) -> str:
    def score(url: str) -> tuple[int, int, str]:
        record = state.get("protocols", {}).get(url, {})
        title = normalized_key(str(record.get("title") or "")) if isinstance(record, dict) else ""
        partial = sum(word in title for word in ("omedelbart", "sekretess", "justerad", "paragraf"))
        partial += 1 if "§" in str(record.get("title") or "") else 0
        return partial, len(title), url

    return min((str(url) for url in urls if url), key=score, default="")


def meeting_page_sources(meeting: dict[str, Any], state: dict[str, Any]) -> list[dict[str, Any]]:
    included = [source for source in meeting.get("sources", []) if isinstance(source, dict) and source.get("included")]
    output: list[dict[str, Any]] = []
    for source in included:
        urls = [str(url) for url in source.get("source_urls", []) if url]
        start = source.get("output_page_start")
        end = source.get("output_page_end")
        if (start is None or end is None) and len(included) == 1:
            start, end = 1, int(meeting.get("pages") or 0)
        if start is None or end is None:
            continue
        output.append(
            {
                "page_start": int(start),
                "page_end": int(end),
                "url": preferred_source_url(urls, state),
                "source_urls": urls,
            }
        )
    return output


def canonical_meeting_record(
    meeting: dict[str, Any],
    urls: Sequence[str],
    state: dict[str, Any],
    include_sections: Sequence[str] = (),
    section_urls: dict[str, str] | None = None,
) -> dict[str, Any]:
    source_urls = sorted({str(url) for url in urls if url})
    local_path = str(meeting.get("local_path") or "")
    return {
        "url": preferred_source_url(source_urls, state),
        "source_urls": source_urls,
        "title": Path(local_path).name,
        "body": str(meeting.get("body") or ""),
        "date": str(meeting.get("date") or ""),
        "diary_number": str(meeting.get("diary_number") or ""),
        "sha256": str(meeting.get("sha256") or ""),
        "local_path": local_path,
        "status": "downloaded",
        "page_sources": meeting_page_sources(meeting, state),
        "include_sections": list(include_sections),
        "section_urls": section_urls or {},
    }


def pending_meeting_records(
    state: dict[str, Any], pack: dict[str, Any], meeting_manifest: dict[str, Any]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    existing_urls = {str(document.get("u") or "").strip() for document in pack.get("d", []) if document.get("u")}
    existing_sections = pack_meeting_sections(pack)
    protocols = state.get("protocols", {})
    pending: list[dict[str, Any]] = []
    issues: list[dict[str, Any]] = []
    allowed_statuses = {"downloaded", "parsed", "imported"}
    for meeting in meeting_manifest.get("meetings", []):
        if not isinstance(meeting, dict):
            continue
        urls = sorted({str(url) for url in meeting.get("source_urls", []) if url})
        if not urls:
            # Legacy PDFs without an official URL remain in the canonical
            # archive, but are intentionally outside the incremental updater.
            continue
        date = str(meeting.get("date") or "")
        body = str(meeting.get("body") or "")
        if not is_public_protocol_date(date):
            # Pre-2023 PDFs may be retained in the private/canonical archive,
            # but they must never enter the GitHub Pages data bundle.
            continue
        key = (date, normalized_key(body))
        direct = set(urls).intersection(existing_urls)
        missing = set(urls).difference(existing_urls)
        if direct:
            unavailable = [
                url
                for url in sorted(missing)
                if not isinstance(protocols.get(url), dict) or protocols[url].get("status") not in allowed_statuses
            ]
            if unavailable:
                issues.append(
                    {
                        "code": "meeting_sources_not_ready",
                        "date": date,
                        "body": body,
                        "local_path": meeting.get("local_path", ""),
                        "source_urls": unavailable,
                        "message": "One or more official sources have not passed scraper metadata validation",
                    }
                )
                continue
            existing = existing_sections.get(key, set())
            supplement_sections: set[str] = set()
            section_urls: dict[str, str] = {}
            ambiguous: list[str] = []
            for url in sorted(missing):
                record = protocols.get(url, {})
                title = str(record.get("title") or "") if isinstance(record, dict) else ""
                declared = declared_title_sections(title)
                if declared and declared.isdisjoint(existing):
                    supplement_sections.update(declared)
                    section_urls.update({section: url for section in declared})
                else:
                    ambiguous.append(url)
            if supplement_sections and not ambiguous:
                pending.append(
                    canonical_meeting_record(
                        meeting,
                        sorted(missing),
                        state,
                        sorted(supplement_sections, key=lambda value: int(re.match(r"\d+", value).group(0))),
                        section_urls,
                    )
                )
            elif ambiguous:
                issues.append(
                    {
                        "code": "partial_source_coverage",
                        "date": date,
                        "body": body,
                        "local_path": meeting.get("local_path", ""),
                        "present_urls": sorted(direct),
                        "unresolved_urls": ambiguous,
                        "message": "Some sources for this meeting overlap existing or do not declare their sections; automatic append is unsafe",
                    }
                )
            continue
        same_meeting_documents = existing_sections.get(key, set())
        if same_meeting_documents:
            issues.append(
                {
                    "code": "meeting_identity_already_present",
                    "date": date,
                    "body": body,
                    "local_path": meeting.get("local_path", ""),
                    "source_urls": urls,
                    "message": "The data pack already has this committee/date under different source URLs; automatic append is unsafe",
                }
            )
            continue
        unavailable = [
            url
            for url in urls
            if not isinstance(protocols.get(url), dict) or protocols[url].get("status") not in allowed_statuses
        ]
        if unavailable:
            issues.append(
                {
                    "code": "meeting_sources_not_ready",
                    "date": date,
                    "body": body,
                    "local_path": meeting.get("local_path", ""),
                    "source_urls": unavailable,
                    "message": "One or more official sources have not passed scraper metadata validation",
                }
            )
            continue
        pending.append(canonical_meeting_record(meeting, urls, state))
    pending.sort(key=lambda row: (str(row.get("date") or ""), str(row.get("body") or ""), row["url"]))
    issues.sort(key=lambda row: (str(row.get("date") or ""), str(row.get("body") or ""), str(row.get("code") or "")))
    return pending, issues


def pending_records(
    state: dict[str, Any], pack: dict[str, Any], meeting_manifest: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    if meeting_manifest is not None:
        return pending_meeting_records(state, pack, meeting_manifest)[0]
    # Compatibility fallback for callers with a pre-normalization archive.
    existing_urls = {str(document.get("u") or "").strip() for document in pack.get("d", []) if document.get("u")}
    pending: list[dict[str, Any]] = []
    for url, source in state["protocols"].items():
        record = dict(source)
        record["url"] = str(record.get("url") or url)
        record["source_urls"] = [record["url"]]
        if record["url"] not in existing_urls and record.get("status") in {"downloaded", "parsed", "imported"}:
            pending.append(record)
    return sorted(pending, key=lambda row: (str(row.get("title") or ""), str(row.get("body") or ""), row["url"]))


def run_pdftotext(path: Path) -> list[str]:
    executable = shutil.which("pdftotext")
    if not executable:
        raise RuntimeError("pdftotext is required but was not found on PATH")
    result = subprocess.run(
        [executable, "-layout", "-enc", "UTF-8", str(path), "-"],
        capture_output=True,
        check=False,
    )
    text = result.stdout.decode("utf-8", errors="replace")
    if result.returncode or not text.strip():
        error = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"pdftotext failed for {path}: {error or 'empty output'}")
    return text.replace("\r\n", "\n").replace("\r", "\n").split("\f")


def protocol_diary_from_first_page(text: str) -> tuple[str, str]:
    lines = [normalized_space(line) for line in text.splitlines() if normalized_space(line)]
    candidates: list[tuple[str, str]] = []
    for line in lines[:20]:
        matches = DIARY_PATTERN.findall(line)
        if "protokoll" in line.casefold() and len(matches) == 1:
            return matches[0], line
        candidates.extend((match, line) for match in matches)
    unique = {candidate for candidate, _ in candidates}
    if len(unique) == 1:
        candidate = next(iter(unique))
        evidence = next(line for value, line in candidates if value == candidate)
        return candidate, evidence
    return "", ""


def first_page_date(text: str) -> str:
    match = re.search(r"(?im)^\s*Datum:\s*(20\d{2}-\d{2}-\d{2})\b", text)
    return match.group(1) if match else ""


def ignorable_line(value: str) -> bool:
    clean = normalized_space(value)
    return (
        not clean
        or bool(re.fullmatch(r"(?i)(?:örebro\s+)?protokoll(?:\s+digitalt justerat)?", clean))
        or clean.casefold() in {"örebro", "digitalt justerat", "digitalt justerat protokoll"}
        or bool(FOOTER_PATTERN.fullmatch(clean))
    )


def normalize_heading(value: str) -> str:
    return normalized_space(value).rstrip(":").casefold()


def heading_field(heading: str) -> str:
    if heading in FIELD_HEADINGS:
        return FIELD_HEADINGS[heading]
    if heading.startswith(("ärendebeskrivning", "sammanfattning av ärendet", "bakgrund och sammanfattning")):
        return "ad"
    if heading in {"nämndens beslut", "kommunfullmäktiges beslut", "kommunstyrelsens beslut"}:
        return "bd"
    return ""


def extract_attendance(pages: Sequence[str], date: str, body: str, document_title: str) -> tuple[list[Any], list[Issue]]:
    rows: list[Any] = []
    issues: list[Issue] = []
    role = ""
    seen: set[tuple[str, str, str]] = set()
    for page_number, page in enumerate(pages[:3], start=1):
        for raw in page.splitlines():
            heading = normalize_heading(raw)
            if heading in ATTENDANCE_HEADINGS:
                role = ATTENDANCE_HEADINGS[heading]
                continue
            if heading.startswith("övriga") or heading.startswith("paragraf"):
                role = ""
            if not role:
                continue
            match = PERSON_PATTERN.match(raw)
            if not match:
                continue
            name = normalized_space(match.group("name"))
            party = match.group("party")
            key = (name.casefold(), party.casefold(), role)
            if key in seen:
                continue
            seen.add(key)
            rows.extend([date, body, document_title, name, party, role])
    if not rows:
        issues.append(Issue("review", "attendance_not_extracted", "No elected attendees could be extracted from the first pages"))
    return rows, issues


@dataclass
class SectionSource:
    number: str
    title: str
    page_start: int
    page_end: int
    lines: list[tuple[int, str]]


def section_sources(pages: Sequence[str]) -> tuple[list[SectionSource], list[Issue]]:
    flattened: list[tuple[int, str]] = []
    for page_number, page in enumerate(pages, start=1):
        flattened.extend((page_number, line) for line in page.splitlines())
    starts: list[tuple[int, re.Match[str]]] = []
    for index, (_, line) in enumerate(flattened):
        match = SECTION_PATTERN.match(line)
        if match:
            starts.append((index, match))
    issues: list[Issue] = []
    sections: list[SectionSource] = []
    for position, (start, match) in enumerate(starts):
        end = starts[position + 1][0] if position + 1 < len(starts) else len(flattened)
        segment = flattened[start + 1 : end]
        relevant_pages = [page for page, line in segment if not ignorable_line(line)]
        sections.append(
            SectionSource(
                number=match.group(1),
                title=normalized_space(match.group(2)),
                page_start=flattened[start][0],
                page_end=max(relevant_pages or [flattened[start][0]]),
                lines=segment,
            )
        )
    if not sections:
        issues.append(Issue("error", "sections_not_found", "No protocol section headers were found"))
    duplicates = sorted({section.number for section in sections if sum(row.number == section.number for row in sections) > 1})
    if duplicates:
        issues.append(Issue("review", "duplicate_sections", f"Duplicate section numbers in one PDF: {', '.join(duplicates)}"))
    return sections, issues


def split_section_fields(source: SectionSource) -> tuple[str, str, dict[str, str], list[str]]:
    title_continuation: list[str] = []
    fields: dict[str, list[str]] = {"ad": [], "yd": [], "pd": [], "vd": [], "bd": []}
    raw_cleaned: list[str] = []
    active = ""
    diary = ""
    metadata_started = False
    for _, raw in source.lines:
        if ignorable_line(raw):
            continue
        line = normalized_space(raw)
        if not line:
            continue
        raw_cleaned.append(line)
        diary_match = re.match(r"(?i)^Ärendenummer:\s*(.+?)\s*$", line)
        if diary_match:
            diary = normalized_space(diary_match.group(1))
            metadata_started = True
            active = ""
            continue
        if re.match(r"(?i)^Handläggare:", line):
            metadata_started = True
            active = ""
            continue
        heading = normalize_heading(line)
        detected_field = heading_field(heading)
        if detected_field:
            metadata_started = True
            active = detected_field
            continue
        if heading in OTHER_HEADINGS:
            metadata_started = True
            active = ""
            continue
        if not metadata_started and not active and len(line) <= 160:
            title_continuation.append(line)
            continue
        if active:
            fields[active].append(line)
    title = normalized_space(" ".join([source.title, *title_continuation]))
    return title, diary, {key: clean_join(value) for key, value in fields.items()}, raw_cleaned


def classify_matter(title: str, description: str) -> str:
    text = f"{title} {description}".casefold()
    rules = [
        ("interpellation", "interpellation"),
        ("motion", "motion"),
        ("ledamotsinitiativ", "member_initiative"),
        ("medborgarförslag", "member_initiative"),
        ("val av", "appointment"),
        ("protokollsjusterare", "appointment"),
        ("delegationsordning", "delegation_matter"),
        ("delegationsbeslut", "delegation_matter"),
        ("budget", "budget_matter"),
        ("ekonomisk", "financial_report"),
        ("delårsrapport", "financial_report"),
        ("årsredovisning", "financial_report"),
        ("remiss", "referral_response"),
        ("detaljplan", "planning_matter"),
        ("planprogram", "planning_matter"),
        ("taxa", "fee_or_tax_matter"),
        ("avgift", "fee_or_tax_matter"),
        ("riktlinje", "document_matter"),
        ("policy", "document_matter"),
        ("information", "information_matter"),
        ("anmälan", "administrative_matter"),
        ("godkännande av dagordning", "administrative_matter"),
        ("jäv", "administrative_matter"),
        ("övriga frågor", "question"),
    ]
    return next((result for needle, result in rules if needle in text), "unclassified")


def classify_result(decision: str) -> tuple[str, str, str]:
    text = decision.casefold()
    if not text:
        return "decision_not_extracted", "not_extracted", "low"
    if "avslås" in text or "avslår" in text:
        return "reject", "rejected", "high"
    if "bifalls" in text or "bifaller" in text:
        return "approve", "approved", "high"
    if "återrem" in text:
        return "refer_back", "referred_back", "high"
    if "bordlägg" in text:
        return "postpone", "postponed", "high"
    if "utgår" in text:
        return "withdraw", "withdrawn", "high"
    if "läggs till handlingarna" in text or "tas till protokollet" in text or "informationen tas" in text:
        return "acknowledge", "information_only", "high"
    return "other", "other", "high"


def decision_points(section_number: str, decision: str) -> dict[str, str]:
    if not decision:
        return {section_number: ""}
    lines = decision.splitlines()
    preamble: list[str] = []
    numbered: list[tuple[str, list[str]]] = []
    current: tuple[str, list[str]] | None = None
    for line in lines:
        match = re.match(r"^\s*(\d+)\.\s*(.*)$", line)
        if match:
            current = (match.group(1), [match.group(2)])
            numbered.append(current)
        elif current:
            current[1].append(line)
        else:
            preamble.append(line)
    if not numbered:
        return {section_number: normalized_space(decision.replace("\n", " "))}
    prefix = normalized_space(" ".join(preamble))
    output: dict[str, str] = {}
    for suffix, content in numbered:
        value = normalized_space(" ".join(content))
        output[f"{section_number}.{suffix}"] = normalized_space(f"{prefix} {value}")
    return output


def extract_positions(text: str, document_index: int, point: str) -> list[Any]:
    rows: list[Any] = []
    seen: set[tuple[str, str, str]] = set()
    flattened = normalized_space(text.replace("\n", " "))
    sentence_pattern = re.compile(r"([^.!?]{0,260}?)\s+yrkar\s+([^.!?]+)", re.IGNORECASE)
    for sentence in sentence_pattern.finditer(flattened):
        people = list(PERSON_ANY_PATTERN.finditer(sentence.group(1)))
        request = sentence.group(2).casefold()
        if "bifall" in request:
            stance = "Bifallsyrkande"
        elif "avslag" in request:
            stance = "Avslagsyrkande"
        elif "återrem" in request:
            stance = "Återremissyrkande"
        elif "bordlägg" in request:
            stance = "Bordläggningsyrkande"
        else:
            stance = "Yrkande"
        for person in people:
            name, party = normalized_space(person.group("name")), person.group("party")
            key = (name.casefold(), party.casefold(), stance)
            if key in seen:
                continue
            seen.add(key)
            proposal_id = f"proposal_{stable_hash(str(document_index), point, name, party, request)}"
            rows.extend([document_index, point, name, party, stance, proposal_id])
    return rows


def tally_value(text: str, label: str) -> int | None:
    patterns = [
        rf"(?i)\b{label}(?:-röster|röster)?\s*[:=]?\s*(\d+)",
        rf"(?i)\b(\d+)\s+{label}(?:-röster|röster)?\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return int(match.group(1))
    return None


def extract_vote(
    source_lines: Sequence[str], vote_text: str, document_id: str, document_index: int, points: Sequence[str]
) -> tuple[dict[str, str], dict[str, Any], list[Any], list[Issue]]:
    lowered = vote_text.casefold()
    held = bool(re.search(r"\b(omröstning|votering)\b", lowered)) and bool(
        re.search(r"begär|genomför|verkställ|utfall|röster|röstade", lowered)
    )
    if not held:
        return {}, {}, [], []
    counts = {
        "stated_yes": tally_value(vote_text, "ja"),
        "stated_no": tally_value(vote_text, "nej"),
        "stated_abstain": tally_value(vote_text, "avstår"),
        "stated_absent": tally_value(vote_text, "frånvarande"),
    }
    named: list[tuple[str, str, str]] = []
    for line in source_lines:
        match = NAMED_VOTE_PATTERN.match(line)
        if match:
            vote = match.group("vote").capitalize()
            named.append((normalized_space(match.group("name")), match.group("party"), vote))
    event_id = f"vote_{document_id}_1"
    event = {
        "points": list(points),
        "source_kind": "formal_vote",
        "vote_type": "roll_call" if named else "recorded_tally",
        "vote_status": "held_roll_call" if named else "held_tally_only",
        "tally_status": "stated" if any(value is not None for value in counts.values()) else "unknown",
        **{key: value for key, value in counts.items() if value is not None},
    }
    mapping = {point: event_id for point in points}
    rows: list[Any] = []
    for sequence, (name, party, vote) in enumerate(named, start=1):
        rows.extend([document_index, points[0], name, party, vote, f"{event_id}:{sequence}"])
    issues: list[Issue] = []
    if not named and not any(value is not None for value in counts.values()):
        issues.append(Issue("review", "vote_not_resolved", "A formal vote was detected but neither named votes nor a tally could be extracted"))
    elif not named:
        issues.append(Issue("review", "named_vote_list_not_extracted", "A formal vote tally was found but the individual roll-call list was not extracted"))
    if len(points) > 1:
        issues.append(Issue("review", "vote_point_mapping_ambiguous", "A formal vote was detected for a section with multiple decision points"))
    vote_mentions = len(re.findall(r"\b(?:omröstning|votering)\b", lowered))
    if vote_mentions > 2:
        issues.append(Issue("review", "multiple_vote_events_possible", "The section may contain more than one formal vote event"))
    if named and any(value is not None for value in counts.values()):
        named_counts = {
            "stated_yes": sum(vote == "Ja" for _, _, vote in named),
            "stated_no": sum(vote == "Nej" for _, _, vote in named),
            "stated_abstain": sum(vote == "Avstår" for _, _, vote in named),
            "stated_absent": sum(vote == "Frånvarande" for _, _, vote in named),
        }
        conflicts = [key for key, value in counts.items() if value is not None and value != named_counts[key]]
        if conflicts:
            issues.append(Issue("review", "vote_tally_conflict", f"Named vote list conflicts with stated counts: {', '.join(conflicts)}"))
    return mapping, {event_id: event}, rows, issues


def body_type(body: str) -> str:
    key = body.casefold()
    if key in BODY_TYPES:
        return BODY_TYPES[key]
    if key.startswith("kommunstyrelsens "):
        return "kommunstyrelseutskott"
    return "namnd"


def source_url_for_page(record: dict[str, Any], page: int) -> str:
    for source in record.get("page_sources", []):
        if not isinstance(source, dict):
            continue
        start, end = int(source.get("page_start") or 0), int(source.get("page_end") or 0)
        if start <= page <= end and source.get("url"):
            return str(source["url"])
    return str(record.get("url") or "")


def source_url_for_section(record: dict[str, Any], section: str, page: int) -> str:
    section_url = record.get("section_urls", {}).get(str(section))
    return str(section_url) if section_url else source_url_for_page(record, page)


def parse_protocol_record(record: dict[str, Any], pages: Sequence[str] | None = None) -> ParsedProtocol:
    path = archive_record_path(record)
    title = str(record.get("title") or path.name)
    body = str(record.get("body") or "")
    expected_diary = str(record.get("diary_number") or "")
    expected_hash = str(record.get("sha256") or "")
    date_match = DATE_PATTERN.search(title)
    expected_date = str(record.get("date") or (date_match.group(0) if date_match else ""))
    primary_url = str(record.get("url") or "")
    source_urls = list(dict.fromkeys(str(url) for url in record.get("source_urls", []) if url))
    if primary_url and primary_url not in source_urls:
        source_urls.insert(0, primary_url)
    local_path = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)
    parsed = ParsedProtocol(
        url=primary_url,
        title=title,
        body=body,
        date=expected_date,
        protocol_diary=expected_diary,
        local_path=local_path,
        sha256=expected_hash,
        source_urls=source_urls,
    )
    if not path.exists() and pages is None:
        parsed.issues.append(Issue("error", "pdf_missing", f"Archived PDF is missing: {path}"))
        return parsed
    if pages is None:
        data_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        if expected_hash and data_hash != expected_hash:
            parsed.issues.append(Issue("error", "pdf_hash_mismatch", f"SHA-256 differs from scraper state for {path}"))
            return parsed
        pages = run_pdftotext(path)
    if not pages:
        parsed.issues.append(Issue("error", "pdf_text_empty", "No PDF pages were extracted"))
        return parsed
    actual_date = first_page_date(pages[0])
    actual_diary, diary_evidence = protocol_diary_from_first_page(pages[0])
    if not expected_date or actual_date != expected_date:
        parsed.issues.append(Issue("review", "date_mismatch", f"Filename/state date {expected_date!r} differs from first-page date {actual_date!r}", 1))
    if not actual_diary:
        parsed.issues.append(Issue("review", "protocol_diary_missing", "No unambiguous protocol-level Diarienummer was found in the first-page header", 1))
    elif expected_diary and actual_diary.casefold() != expected_diary.casefold():
        parsed.issues.append(Issue("review", "protocol_diary_mismatch", f"State has {expected_diary!r}; first-page header has {actual_diary!r} ({diary_evidence})", 1))
    else:
        parsed.protocol_diary = actual_diary
    if normalized_key(body) not in normalized_key(pages[0]):
        parsed.issues.append(Issue("review", "body_mismatch", f"Expected body {body!r} was not found on the first page", 1))
    sources, section_issues = section_sources(pages)
    parsed.issues.extend(section_issues)
    document_title = title
    include_sections = {str(section) for section in record.get("include_sections", []) if section}
    if not include_sections:
        members, attendance_issues = extract_attendance(pages, expected_date, body, document_title)
        parsed.members = members
        parsed.issues.extend(attendance_issues)
    used_ids: set[str] = set()
    for source in sources:
        if include_sections and source.number not in include_sections:
            continue
        section_url = source_url_for_section(record, source.number, source.page_start)
        section_title, agenda_diary, fields, raw_lines = split_section_fields(source)
        identifier_base = f"case_body_{normalized_key(body)}_{expected_date.replace('-', '_')}_{normalized_key(source.number)}"
        identifier = identifier_base
        if identifier in used_ids:
            identifier = f"{identifier_base}_{stable_hash(section_url, source.number, section_title, length=8)}"
        used_ids.add(identifier)
        matter_basis = agenda_diary or section_title
        matter_id = f"matter_{stable_hash(body, matter_basis)}"
        points = decision_points(source.number, fields["bd"])
        matter_type = classify_matter(section_title, fields["ad"])
        result, outcome, confidence = classify_result(fields["bd"])
        point_meta: dict[str, Any] = {}
        for point, decision in points.items():
            point_meta[point] = {
                "result": result,
                "decision_level": "information_only" if outcome == "information_only" else ("unknown" if not fields["bd"] else "final_decision"),
                "decision_stage": "information" if outcome == "information_only" else ("consideration" if not fields["bd"] else "final"),
                "decision_disposition": "acknowledge" if outcome == "information_only" else (result if result not in {"other", "decision_not_extracted"} else "other"),
                "decision_subject": None,
                "matter_type": matter_type,
                "matter_type_state": "unclassified" if matter_type == "unclassified" else "classified",
                "matter_outcome": outcome,
                "confidence": confidence,
                "decision_point_id": None if not decision else f"decision_point_{stable_hash(identifier, point, decision)}",
                "matter_id": matter_id,
                "source_url": section_url,
                "local_path": local_path,
                "source_page": source.page_start,
                "source_page_end": source.page_end,
                "extraction_status": "formal_decision" if fields["bd"] else "decision_not_extracted",
            }
        document_index = len(parsed.documents)
        vote_map, vote_events, vote_rows, vote_issues = extract_vote(
            raw_lines,
            "\n".join([fields["pd"], fields["vd"]]),
            identifier,
            document_index,
            list(points),
        )
        parsed.votes.extend(vote_rows)
        for issue in vote_issues:
            issue.page = source.page_start
            issue.section = source.number
            parsed.issues.append(issue)
        if vote_events:
            event = next(iter(vote_events.values()))
            for point in points:
                for key in ("stated_yes", "stated_no", "stated_abstain", "stated_absent"):
                    if key in event:
                        point_meta[point][key] = event[key]
        for point in points:
            parsed.positions.extend(extract_positions(fields["yd"], document_index, point))
        parsed.documents.append(
            {
                "i": identifier,
                "mi": matter_id,
                "dt": expected_date,
                "t": section_title,
                "ht": f"§ {source.number} {section_title}",
                "ad": fields["ad"],
                "yd": fields["yd"],
                "pd": fields["pd"],
                "vd": fields["vd"],
                "bd": fields["bd"],
                "p": points,
                "pm": point_meta,
                "v": vote_map,
                "ve": vote_events,
                "b": body,
                "bt": body_type(body),
                "doc": document_title,
                "u": section_url,
                "lp": local_path,
                "dn": agenda_diary,
                "cn": "",
                "mt": matter_type,
                "mo": outcome,
                "cf": confidence,
            }
        )
    if include_sections:
        extracted = {str(document.get("ht") or "").split(" ", 2)[1] for document in parsed.documents}
        missing_sections = sorted(include_sections.difference(extracted))
        if missing_sections:
            parsed.issues.append(
                Issue(
                    "review",
                    "supplement_sections_missing",
                    f"Requested supplementary section(s) were not found in the canonical PDF: {', '.join(missing_sections)}",
                )
            )
    return parsed


def ensure_unique_identifier(document: dict[str, Any], existing: set[str]) -> None:
    identifier = str(document.get("i") or "")
    if identifier not in existing:
        existing.add(identifier)
        return
    raise RuntimeError(
        f"New protocol section collides with an existing stable identifier: {identifier}. "
        "The source must be reviewed for overlapping or replacement protocol PDFs."
    )


def merge_protocols(pack: dict[str, Any], protocols: Sequence[ParsedProtocol]) -> dict[str, Any]:
    merged = {
        **{key: value for key, value in pack.items() if key not in {"d", "r", "pr", "mr"}},
        "d": [dict(row) for row in pack.get("d", [])],
        "r": list(pack.get("r", [])),
        "pr": list(pack.get("pr", [])),
        "mr": list(pack.get("mr", [])),
    }
    existing_urls = {str(document.get("u") or "") for document in merged["d"]}
    identifiers = {str(document.get("i") or "") for document in merged["d"]}
    member_keys = {
        tuple(str(value) for value in merged["mr"][offset : offset + 6])
        for offset in range(0, len(merged["mr"]), 6)
    }
    for protocol in protocols:
        if not is_public_protocol_date(protocol.date):
            raise RuntimeError(
                f"Refusing to publish protocol dated {protocol.date!r}; GitHub Pages starts at {PUBLIC_DATA_FROM}"
            )
        overlapping_urls = existing_urls.intersection(protocol.source_urls or [protocol.url])
        if overlapping_urls:
            raise RuntimeError(f"Refusing to append already imported source URL(s): {', '.join(sorted(overlapping_urls))}")
        offset = len(merged["d"])
        for document in protocol.documents:
            copy = json.loads(json.dumps(document, ensure_ascii=False))
            ensure_unique_identifier(copy, identifiers)
            merged["d"].append(copy)
        for rows_name, source_rows in (("r", protocol.votes), ("pr", protocol.positions)):
            for index in range(0, len(source_rows), 6):
                row = list(source_rows[index : index + 6])
                row[0] = int(row[0]) + offset
                merged[rows_name].extend(row)
        for index in range(0, len(protocol.members), 6):
            row = tuple(str(value) for value in protocol.members[index : index + 6])
            if row not in member_keys:
                merged["mr"].extend(row)
                member_keys.add(row)
        existing_urls.update(protocol.source_urls or [protocol.url])
    dates = [str(document.get("dt") or "") for document in merged["d"] if document.get("dt")]
    if dates:
        merged["pf"], merged["pt"] = min(dates), max(dates)
    return merged


def rows_for_document_range(rows: Sequence[Any], start: int, end: int) -> list[Any]:
    output: list[Any] = []
    for offset in range(0, len(rows), 6):
        index = int(rows[offset])
        if start <= index < end:
            output.extend(rows[offset : offset + 6])
    return output


def attendance_owners(pack: dict[str, Any]) -> dict[tuple[str, str, str], int]:
    owners: dict[tuple[str, str, str], int] = {}
    for index, document in enumerate(pack["d"]):
        key = (str(document.get("dt") or ""), str(document.get("b") or ""), str(document.get("doc") or ""))
        owners.setdefault(key, index)
    return owners


def part_payload(pack: dict[str, Any], start: int, end: int, first: bool, owners: dict[tuple[str, str, str], int]) -> dict[str, Any]:
    payload = {key: value for key, value in pack.items() if key not in {"d", "r", "pr", "mr"}} if first else {}
    payload["d"] = pack["d"][start:end]
    payload["r"] = rows_for_document_range(pack["r"], start, end)
    payload["pr"] = rows_for_document_range(pack["pr"], start, end)
    members: list[Any] = []
    for offset in range(0, len(pack["mr"]), 6):
        row = pack["mr"][offset : offset + 6]
        owner = owners.get((str(row[0]), str(row[1]), str(row[2])))
        if (owner is None and first) or (owner is not None and start <= owner < end):
            members.extend(row)
    payload["mr"] = members
    return payload


def render_part(index: int, payload: dict[str, Any]) -> str:
    return (
        "window.municipalProtocolPackParts=window.municipalProtocolPackParts||{};"
        f"window.municipalProtocolPackParts[{index}]={compact_json(payload)};\n"
    )


def split_pack(pack: dict[str, Any], maximum_bytes: int = MAXIMUM_DATA_FILE_BYTES) -> list[tuple[str, dict[str, Any]]]:
    owners = attendance_owners(pack)
    document_count = len(pack["d"])
    parts: list[tuple[str, dict[str, Any]]] = []
    start = 0
    part_index = 1
    while start < document_count:
        low, high, best = start + 1, document_count, start
        while low <= high:
            middle = (low + high) // 2
            payload = part_payload(pack, start, middle, part_index == 1, owners)
            size = len(render_part(part_index, payload).encode("utf-8"))
            if size <= min(maximum_bytes, TARGET_DATA_FILE_BYTES if maximum_bytes == MAXIMUM_DATA_FILE_BYTES else maximum_bytes):
                best = middle
                low = middle + 1
            else:
                high = middle - 1
        if best == start:
            payload = part_payload(pack, start, start + 1, part_index == 1, owners)
            size = len(render_part(part_index, payload).encode("utf-8"))
            if size > maximum_bytes:
                raise RuntimeError(f"One protocol document requires {size} bytes and cannot fit below {maximum_bytes}")
            best = start + 1
        payload = part_payload(pack, start, best, part_index == 1, owners)
        rendered = render_part(part_index, payload)
        if len(rendered.encode("utf-8")) > maximum_bytes:
            raise RuntimeError(f"Protocol part {part_index} exceeds {maximum_bytes} bytes")
        parts.append((rendered, payload))
        start = best
        part_index += 1
    if not parts:
        parts.append((render_part(1, part_payload(pack, 0, 0, True, owners)), part_payload(pack, 0, 0, True, owners)))
    return parts


def write_pack_staging(pack: dict[str, Any], directory: Path, build_id: str) -> tuple[Path, list[dict[str, Any]]]:
    directory.mkdir(parents=True, exist_ok=True)
    descriptors: list[dict[str, Any]] = []
    for index, (rendered, _) in enumerate(split_pack(pack), start=1):
        name = "municipal-protocol-data-orebro-v2.js" if index == 1 else f"municipal-protocol-data-orebro-v2.part{index}.js"
        path = directory / name
        path.write_text(rendered, encoding="utf-8", newline="\n")
        size = path.stat().st_size
        if size > MAXIMUM_DATA_FILE_BYTES:
            raise RuntimeError(f"Staged protocol part exceeds 95 MB: {path} ({size} bytes)")
        descriptors.append({"src": f"data/{name}", "bytes": size})
    manifest_path = directory / PROTOCOL_MANIFEST.name
    manifest = {"version": build_id, "parts": descriptors}
    manifest_path.write_text(f"window.municipalProtocolDataManifest={compact_json(manifest)};\n", encoding="utf-8", newline="\n")
    return manifest_path, descriptors


def load_diary_pack(path: Path = PROTOCOL_DIARIES) -> dict[str, Any]:
    if not path.exists():
        return {"generatedAt": "", "source": "first-page protocol headers", "byUrl": {}, "byTitle": {}, "missing": []}
    value = js_assigned_json(path.read_text(encoding="utf-8"), r"window\.municipalProtocolDiaryPack\s*=")
    if not isinstance(value, dict):
        raise RuntimeError(f"Invalid diary pack: {path}")
    value.setdefault("byUrl", {})
    value.setdefault("byTitle", {})
    value.setdefault("missing", [])
    return value


def write_diary_staging(protocols: Sequence[ParsedProtocol], directory: Path) -> Path:
    diaries = load_diary_pack()
    for protocol in protocols:
        for url in protocol.source_urls or [protocol.url]:
            diaries["byUrl"][url] = protocol.protocol_diary
        diaries["byTitle"][protocol.title] = protocol.protocol_diary
    diaries["generatedAt"] = utc_now()
    diaries["source"] = "first-page top-right protocol header extracted from archived public PDF sources"
    missing_urls = {str(row.get("url") or "") for row in diaries.get("missing", []) if isinstance(row, dict)}
    missing_urls.difference_update(url for protocol in protocols for url in (protocol.source_urls or [protocol.url]))
    diaries["missing"] = [row for row in diaries.get("missing", []) if not isinstance(row, dict) or str(row.get("url") or "") in missing_urls]
    path = directory / PROTOCOL_DIARIES.name
    path.write_text(f"window.municipalProtocolDiaryPack={compact_json(diaries)};\n", encoding="utf-8", newline="\n")
    return path


def run_derived_builder(staging_data: Path, manifest: Path, diary: Path, build_id: str) -> dict[str, Any]:
    derived = staging_data / "derived"
    command = [
        "node",
        str(ROOT / "scripts" / "generate-municipal-decision-index.mjs"),
        "--protocol-manifest",
        str(manifest),
        "--diary-file",
        str(diary),
        "--output-dir",
        str(derived),
        "--version",
        build_id,
    ]
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(f"Derived decision-index build failed:\n{result.stdout}\n{result.stderr}")
    try:
        summary = json.loads(result.stdout.strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError) as error:
        raise RuntimeError(f"Derived builder returned an invalid summary: {result.stdout}") from error
    return {"directory": str(derived), **summary}


def run_staged_audit(manifest: Path, diary: Path) -> dict[str, Any]:
    command = [
        "node",
        str(ROOT / "scripts" / "audit-municipal-data.mjs"),
        "--protocol-manifest",
        str(manifest),
        "--diary-file",
        str(diary),
    ]
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    try:
        report = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Municipal data audit returned invalid output:\n{result.stdout}\n{result.stderr}") from error
    if result.returncode:
        raise RuntimeError(f"Municipal data audit rejected the staged build:\n{result.stdout}\n{result.stderr}")
    return report


def update_index_versions(source: Path, destination: Path, build_id: str) -> None:
    text = source.read_text(encoding="utf-8")
    for filename in ("municipal-protocol-diary-data.js", "municipal-decision-table-bootstrap.js"):
        text = re.sub(rf"({re.escape(filename)})(?:\?v=[^\"']+)?", rf"\1?v={build_id}", text)
    destination.write_text(text, encoding="utf-8", newline="\n")


def copy_backup(path: Path, backup_root: Path) -> None:
    if not path.exists():
        return
    relative = path.relative_to(ROOT)
    destination = backup_root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if path.is_dir():
        shutil.copytree(path, destination, dirs_exist_ok=True)
    else:
        shutil.copy2(path, destination)


def publish_staging(staging_data: Path, descriptors: Sequence[dict[str, Any]], build_id: str) -> Path:
    backup_root = ARCHIVE_ROOT / "parser" / "backups" / build_id
    protected = [
        PROTOCOL_BUNDLE,
        PROTOCOL_MANIFEST,
        PROTOCOL_DIARIES,
        DATA_DIR / "municipal-decision-table-index.ndjson.gz",
        DATA_DIR / "municipal-decision-table-bootstrap.js",
        DATA_DIR / "municipal-decision-meeting-details.js",
        DATA_DIR / "municipal-decision-table-index-parts",
        ROOT / "index.html",
    ]
    for path in protected:
        copy_backup(path, backup_root)
    try:
        staged_part_names = {Path(str(row["src"])).name for row in descriptors}
        for descriptor in descriptors:
            name = Path(str(descriptor["src"])).name
            os.replace(staging_data / name, DATA_DIR / name)
        for stale in DATA_DIR.glob("municipal-protocol-data-orebro-v2.part*.js"):
            if stale.name not in staged_part_names:
                stale.unlink()
        os.replace(staging_data / PROTOCOL_MANIFEST.name, PROTOCOL_MANIFEST)
        os.replace(staging_data / PROTOCOL_DIARIES.name, PROTOCOL_DIARIES)
        derived = staging_data / "derived"
        for name in (
            "municipal-decision-table-index.ndjson.gz",
            "municipal-decision-table-bootstrap.js",
            "municipal-decision-meeting-details.js",
        ):
            os.replace(derived / name, DATA_DIR / name)
        target_parts = DATA_DIR / "municipal-decision-table-index-parts"
        staged_parts = derived / "municipal-decision-table-index-parts"
        target_parts.mkdir(parents=True, exist_ok=True)
        staged_names = {path.name for path in staged_parts.glob("part-*.js")}
        for path in staged_parts.glob("part-*.js"):
            os.replace(path, target_parts / path.name)
        for stale in target_parts.glob("part-*.js"):
            if stale.name not in staged_names:
                stale.unlink()
        staged_index = staging_data / "index.html"
        os.replace(staged_index, ROOT / "index.html")
    except Exception:
        for relative in sorted((path for path in backup_root.rglob("*") if path.is_file()), key=lambda row: len(row.parts)):
            target = ROOT / relative.relative_to(backup_root)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(relative, target)
        raise
    return backup_root


def mark_imported(state: dict[str, Any], protocols: Sequence[ParsedProtocol], build_id: str) -> None:
    by_url = state["protocols"]
    for protocol in protocols:
        for url in protocol.source_urls or [protocol.url]:
            record = by_url.get(url)
            if not isinstance(record, dict):
                continue
            record["status"] = "imported"
            record["parser"] = {
                "build_id": build_id,
                "imported_at": utc_now(),
                "sha256": protocol.sha256,
                "documents": len(protocol.documents),
                "vote_rows": len(protocol.votes) // 6,
                "position_rows": len(protocol.positions) // 6,
                "member_rows": len(protocol.members) // 6,
            }
    state["updated_at"] = utc_now()
    atomic_write_json(ARCHIVE_STATE, state)


class PipelineLock:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.handle: int | None = None

    def __enter__(self) -> "PipelineLock":
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            self.handle = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError as error:
            raise RuntimeError(f"Another parser run may be active; lock exists: {self.path}") from error
        os.write(self.handle, f"pid={os.getpid()} started={utc_now()}\n".encode("utf-8"))
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        if self.handle is not None:
            os.close(self.handle)
        try:
            self.path.unlink()
        except FileNotFoundError:
            pass


def parser_run(args: argparse.Namespace) -> tuple[dict[str, Any], int]:
    build_id = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    report: dict[str, Any] = {
        "schema_version": 1,
        "build_id": build_id,
        "started_at": utc_now(),
        "finished_at": "",
        "stage_only": args.stage_only,
        "production_changed": False,
        "pending": 0,
        "selection_issues": [],
        "protocols": [],
        "pack_validation": [],
        "derived": {},
        "audit": {},
    }
    pack = load_protocol_pack(args.manifest)
    current_errors = validate_pack(pack)
    if current_errors:
        report["pack_validation"] = current_errors
        report["finished_at"] = utc_now()
        return report, 1
    if args.check_structure:
        report.update(
            {
                "finished_at": utc_now(),
                "documents": len(pack["d"]),
                "vote_rows": len(pack["r"]) // 6,
                "position_rows": len(pack["pr"]) // 6,
                "member_rows": len(pack["mr"]) // 6,
            }
        )
        return report, 0
    state = load_archive_state(args.state)
    meeting_manifest = load_meeting_manifest(args.meeting_manifest)
    records, selection_issues = pending_meeting_records(state, pack, meeting_manifest)
    report["selection_issues"] = selection_issues
    if args.max_protocols is not None:
        records = records[: args.max_protocols]
    report["pending"] = len(records)
    if args.list_pending:
        report["protocols"] = [
            {
                "url": row["url"],
                "source_urls": row.get("source_urls", []),
                "title": row.get("title", ""),
                "body": row.get("body", ""),
                "local_path": row.get("local_path", ""),
            }
            for row in records
        ]
        report["finished_at"] = utc_now()
        return report, 0
    if selection_issues:
        report["finished_at"] = utc_now()
        return report, 2
    if not records:
        report["finished_at"] = utc_now()
        return report, 0
    parsed = [parse_protocol_record(record) for record in records]
    report["protocols"] = [protocol.report() for protocol in parsed]
    if any(protocol.blocks_publish() for protocol in parsed):
        report["finished_at"] = utc_now()
        return report, 2
    merged = merge_protocols(pack, parsed)
    merged_errors = validate_pack(merged)
    report["pack_validation"] = merged_errors
    if merged_errors:
        report["finished_at"] = utc_now()
        return report, 1
    staging_root = ARCHIVE_ROOT / "parser" / "staging" / build_id
    staging_data = staging_root / "data"
    manifest_path, descriptors = write_pack_staging(merged, staging_data, build_id)
    diary_path = write_diary_staging(parsed, staging_data)
    report["data_parts"] = descriptors
    report["derived"] = run_derived_builder(staging_data, manifest_path, diary_path, build_id)
    report["audit"] = run_staged_audit(manifest_path, diary_path)
    update_index_versions(ROOT / "index.html", staging_data / "index.html", build_id)
    if not args.stage_only:
        backup = publish_staging(staging_data, descriptors, build_id)
        mark_imported(state, parsed, build_id)
        report["production_changed"] = True
        report["backup"] = str(backup.relative_to(ROOT).as_posix())
    report["staging"] = str(staging_root.relative_to(ROOT).as_posix())
    report["finished_at"] = utc_now()
    return report, 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage-only", action="store_true", help="Parse and build staging outputs without publishing")
    parser.add_argument("--check-structure", action="store_true", help="Validate the current compact pack without parsing PDFs")
    parser.add_argument("--list-pending", action="store_true", help="List archived URLs absent from the pack without parsing PDFs")
    parser.add_argument("--max-protocols", type=int, default=None, help="Limit selected pending protocols")
    parser.add_argument("--state", type=Path, default=ARCHIVE_STATE, help="Scraper archive state JSON")
    parser.add_argument("--meeting-manifest", type=Path, default=MEETING_MANIFEST, help="Canonical one-PDF-per-meeting manifest")
    parser.add_argument("--manifest", type=Path, default=PROTOCOL_MANIFEST, help="Current protocol data manifest")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    if args.max_protocols is not None and args.max_protocols < 0:
        raise SystemExit("--max-protocols must be zero or greater")
    try:
        with PipelineLock(ARCHIVE_ROOT / "parser" / ".parser.lock"):
            report, exit_code = parser_run(args)
    except KeyboardInterrupt:
        print("Parser interrupted", file=sys.stderr)
        return 130
    except Exception as error:
        report = {"fatal_error": str(error), "finished_at": utc_now(), "production_changed": False}
        exit_code = 1
    atomic_write_json(PARSER_REPORT, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
