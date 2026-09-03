#!/usr/bin/env python3
"""Archive public Örebro municipal meeting protocols incrementally.

The scraper compares live official protocol URLs with its local archive state
and downloads only URLs that have not already been archived. It separately
reports URLs absent from the checked-in UI bundle. Each PDF is accompanied by
a protocol-level diary number extracted exclusively from the first-page
protocol header. Image-only first pages use OCR when the local Poppler and
Tesseract tools are available.

This script intentionally does not rebuild the decision database.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
from dataclasses import asdict, dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urljoin, urlparse, urlunparse
from urllib.request import Request, build_opener


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "data" / "Protokoll"
CURRENT_PROTOCOL_BUNDLE = ROOT / "data" / "municipal-protocol-data-orebro-v2.js"
CURRENT_DIARY_BUNDLE = ROOT / "data" / "municipal-protocol-diary-data.js"
NORMALIZER_SCRIPT = ROOT / "scripts" / "normalize_protocol_pdfs.py"
BASE_URL = "https://www.orebro.se"
NAMNDER_URL = f"{BASE_URL}/kommun--politik/politik--beslut/namnder.html"
START_PAGES = [
    ("Kommunstyrelsen", f"{BASE_URL}/kommun--politik/politik--beslut/kommunstyrelsen.html"),
    ("Kommunfullmäktige", f"{BASE_URL}/kommun--politik/politik--beslut/kommunfullmaktige.html"),
]
USER_AGENT = "orebro-protocol-incremental-scraper/1.0 (public municipal documents)"
KNOWN_METADATA_CORRECTIONS = {
    "https://www.orebro.se/download/18.3cf685561a0420a5c3a100e/1787919008211/2026-08-20%20%20Bygg-%20och%20milj%C3%B6n%C3%A4mnden.pdf": {
        "title": "2026-08-20 Bygg- och miljönämnden.pdf",
        "body": "Bygg- och miljönämnden",
    },
    "https://www.orebro.se/download/18.42a36c0d1a01f733c2d37a3/1787663658932/2026-08-20%20V%C3%A5rd-%20och%20omsorgsn%C3%A4mnden%20$%20113-122%20och%20124-131.pdf": {
        "title": "2026-08-20 Vård- och omsorgsnämnden §§ 113–122 och 124–131.pdf",
        "body": "Vård- och omsorgsnämnden",
    },
    "https://www.orebro.se/download/18.e1b4aa019e62f4e33d2509/1780564233224/2026-05-08%20V%C3%A5rd-%20och%20omsorgsn%C3%A4mnden.pdf": {
        "title": "2026-05-28 Vård- och omsorgsnämnden.pdf",
        "body": "Vård- och omsorgsnämnden",
    },
    "https://www.orebro.se/download/18.2b28073219367d5df31240c/1733219081861/2024-09-16%20Socialn%C3%A4mnden.pdf": {
        "title": "2024-09-26 Socialnämnden.pdf",
        "body": "Socialnämnden 2023–2024",
    },
    "https://www.orebro.se/download/18.37a1a24a18529b6cad52c095/1675699624736/2023-01-22%20Funktionsst%C3%B6dsn%C3%A4mnden.pdf": {
        "title": "2023-01-12 Funktionsstödsnämnden.pdf",
        "body": "Funktionsstödsnämnden",
    },
    "https://www.orebro.se/download/18.2eab5f2a1975d40bbca50b2/1750324212229/2024-06-16%20Kultur-%20och%20fritidsn%C3%A4mnden.pdf": {
        "title": "2025-06-16 Kultur- och fritidsnämnden.pdf",
        "body": "Kultur- och fritidsnämnden",
    },
    "https://www.orebro.se/download/18.51177871193dec95027bef9/1738921660153/2025-02-05%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden%20omedelbart%20justerat%20protokoll%20%C2%A7%2024.pdf": {
        "title": "2025-02-06 Överförmyndarnämnden omedelbart justerat protokoll § 24.pdf",
        "body": "Överförmyndarnämnden",
    },
    "https://www.orebro.se/download/18.3a8c6b3019eafce305b222/1781094481140/2025-05-25%20F%C3%B6rskolen%C3%A4mnden.pdf": {
        "title": "2026-05-25 Förskolenämnden.pdf",
        "body": "Förskolenämnden",
    },
}
DIARY_PATTERN = re.compile(
    r"(?<![A-Za-zÅÄÖåäö])[A-ZÅÄÖ][A-Za-zÅÄÖåäö]{0,7}\s+\d{1,6}/20\d{2}"
    r"(?![A-Za-zÅÄÖåäö])"
)
DATE_PATTERN = re.compile(r"\b(20\d{2})-(\d{2})-(\d{2})\b")
PROTOCOL_SECTION_BODY = re.compile(
    r"Protokoll\s+för\s+(.+?)(?:,\s*20\d{2}|\s+20\d{2}[–-]|$)", re.IGNORECASE
)


def now_utc() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def canonical_url(value: str) -> str:
    parsed = urlparse(str(value or "").strip())
    return urlunparse(parsed._replace(fragment=""))


def normalized_space(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def strip_markup(value: str) -> str:
    return normalized_space(html.unescape(re.sub(r"<[^>]+>", " ", value or "")))


def slugify(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "")
    ascii_value = "".join(character for character in decomposed if not unicodedata.combining(character))
    return re.sub(r"[^A-Za-z0-9]+", "-", ascii_value).strip("-").lower() or "unknown-body"


def safe_filename(value: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", value or "").strip(" .")
    return cleaned or "protocol.pdf"


def corrected_link(link: "ProtocolLink") -> "ProtocolLink":
    correction = KNOWN_METADATA_CORRECTIONS.get(canonical_url(link.url))
    if not correction:
        return link
    return ProtocolLink(
        title=str(correction.get("title") or link.title),
        body=str(correction.get("body") or link.body),
        section=link.section,
        url=link.url,
        listing_page=link.listing_page,
        source_file_id=link.source_file_id,
        source_file_size=link.source_file_size,
    )


def atomic_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(prefix=path.name, suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as output:
            json.dump(payload, output, ensure_ascii=False, indent=2, sort_keys=True)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary_name, path)
    except Exception:
        try:
            os.unlink(temporary_name)
        except OSError:
            pass
        raise


class AnchorCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.anchors: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attributes = dict(attrs)
        self._href = attributes.get("href")
        self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "a" or self._href is None:
            return
        self.anchors.append((self._href, normalized_space(" ".join(self._text))))
        self._href = None
        self._text = []


def collect_anchors(html_text: str) -> list[tuple[str, str]]:
    parser = AnchorCollector()
    parser.feed(html_text)
    return parser.anchors


def extract_balanced_object(text: str, start: int) -> str | None:
    object_start = text.find("{", start)
    if object_start < 0:
        return None
    depth = 0
    in_string = False
    escaped = False
    quote = ""
    for index in range(object_start, len(text)):
        character = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                in_string = False
            continue
        if character in {'"', "'"}:
            in_string = True
            quote = character
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                return text[object_start : index + 1]
    return None


def extract_initial_states(html_text: str) -> list[dict[str, Any]]:
    states: list[dict[str, Any]] = []
    pattern = re.compile(r"AppRegistry\.registerInitialState\(\s*['\"]([^'\"]+)['\"]\s*,")
    for match in pattern.finditer(html_text):
        raw = extract_balanced_object(html_text, match.end())
        if not raw:
            continue
        try:
            state = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(state, dict):
            state["_component_id"] = match.group(1)
            state["_offset"] = match.start()
            states.append(state)
    return states


def nearest_section_label(html_text: str, offset: int) -> str:
    window = html_text[max(0, offset - 8_000) : offset]
    candidates: list[tuple[int, str]] = []
    patterns = [
        r'<span[^>]*class=["\'][^"\']*or-expandable-box__title[^"\']*["\'][^>]*>(.+?)</span>',
        r"<h[1-4][^>]*>(.+?)</h[1-4]>",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, window, flags=re.IGNORECASE | re.DOTALL):
            label = strip_markup(match.group(1))
            if label:
                candidates.append((match.start(), label))
    return max(candidates, default=(-1, ""), key=lambda item: item[0])[1]


def iter_state_files(state: dict[str, Any], inherited_folder: str = "") -> Iterable[tuple[dict[str, Any], str]]:
    for item in state.get("files") or []:
        if isinstance(item, dict):
            yield item, inherited_folder
    for folder in state.get("folders") or []:
        if not isinstance(folder, dict):
            continue
        label = str(folder.get("name") or folder.get("displayName") or inherited_folder)
        yield from iter_state_files(folder, label)


def is_protocol_pdf(title: str, section_label: str = "") -> bool:
    value = f"{title} {section_label}".casefold()
    if not title.casefold().endswith(".pdf"):
        return False
    excluded = [
        "ärendelista",
        "arendelista",
        "föredragningslista",
        "kallelse",
        "reglemente",
        "arbetsordning",
        "budget",
        "rapport",
    ]
    if any(term in value for term in excluded) and "protokoll" not in value:
        return False
    return "protokoll" in value or bool(re.match(r"^20\d{2}-\d{2}-\d{2}\s+", title, flags=re.IGNORECASE))


def page_heading(html_text: str, fallback: str) -> str:
    match = re.search(r"<h1[^>]*>(.+?)</h1>", html_text, flags=re.IGNORECASE | re.DOTALL)
    return strip_markup(match.group(1)) if match else fallback


@dataclass(frozen=True)
class ProtocolLink:
    title: str
    body: str
    section: str
    url: str
    listing_page: str
    source_file_id: str = ""
    source_file_size: str = ""


class HttpClient:
    def __init__(self, delay_seconds: float = 0.2, timeout_seconds: float = 45.0) -> None:
        self.delay_seconds = max(0.0, delay_seconds)
        self.timeout_seconds = timeout_seconds
        self.opener = build_opener()
        self._last_request = 0.0

    def _throttle(self) -> None:
        remaining = self.delay_seconds - (time.monotonic() - self._last_request)
        if remaining > 0:
            time.sleep(remaining)

    def get(self, url: str, accept: str, maximum_bytes: int | None = None) -> tuple[bytes, str, dict[str, str]]:
        last_error: Exception | None = None
        for attempt in range(4):
            self._throttle()
            request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
            try:
                with self.opener.open(request, timeout=self.timeout_seconds) as response:
                    chunks: list[bytes] = []
                    size = 0
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        size += len(chunk)
                        if maximum_bytes is not None and size > maximum_bytes:
                            raise RuntimeError(f"Response exceeded {maximum_bytes} bytes: {url}")
                        chunks.append(chunk)
                    self._last_request = time.monotonic()
                    headers = {key.casefold(): value for key, value in response.headers.items()}
                    return b"".join(chunks), canonical_url(response.geturl()), headers
            except HTTPError as error:
                self._last_request = time.monotonic()
                last_error = error
                if error.code not in {408, 425, 429, 500, 502, 503, 504}:
                    raise
                retry_after = error.headers.get("Retry-After") if error.headers else None
                delay = min(60.0, float(retry_after)) if retry_after and retry_after.isdigit() else 1.5 * (2**attempt)
                time.sleep(delay)
            except (URLError, TimeoutError, OSError) as error:
                self._last_request = time.monotonic()
                last_error = error
                time.sleep(1.5 * (2**attempt))
        raise RuntimeError(f"GET failed after retries for {url}: {last_error}")

    def get_text(self, url: str) -> tuple[str, str]:
        data, final_url, headers = self.get(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1", 20_000_000)
        content_type = headers.get("content-type", "")
        charset_match = re.search(r"charset=([^;\s]+)", content_type, flags=re.IGNORECASE)
        charset = charset_match.group(1).strip('"\'') if charset_match else "utf-8"
        try:
            return data.decode(charset), final_url
        except (LookupError, UnicodeDecodeError):
            return data.decode("utf-8", errors="replace"), final_url


def discover_listing_pages(client: HttpClient) -> tuple[list[tuple[str, str]], list[dict[str, Any]]]:
    index_html, final_url = client.get_text(NAMNDER_URL)
    pages = list(START_PAGES)
    seen = {canonical_url(url) for _, url in pages}
    for href, label in collect_anchors(index_html):
        full_url = canonical_url(urljoin(final_url, href))
        if "/kommun--politik/politik--beslut/namnder/" not in full_url or full_url in seen:
            continue
        seen.add(full_url)
        pages.append((label or "Nämnd", full_url))
    return pages, [{"url": final_url, "purpose": "nämnd index"}]


def discover_protocols(client: HttpClient) -> tuple[list[ProtocolLink], list[dict[str, Any]], list[dict[str, str]]]:
    pages, checked_pages = discover_listing_pages(client)
    discovered: dict[str, ProtocolLink] = {}
    failures: list[dict[str, str]] = []
    for fallback_body, page_url in pages:
        try:
            html_text, final_page_url = client.get_text(page_url)
        except Exception as error:
            failures.append({"stage": "listing_page", "url": page_url, "error": str(error)})
            continue
        body = page_heading(html_text, fallback_body)
        checked_pages.append({"url": final_page_url, "body": body, "purpose": "protocol listing"})
        for state in extract_initial_states(html_text):
            section = nearest_section_label(html_text, int(state.get("_offset") or 0))
            if "protokoll" not in section.casefold():
                continue
            section_body_match = PROTOCOL_SECTION_BODY.search(section)
            effective_body = normalized_space(section_body_match.group(1)) if section_body_match else body
            for item, folder in iter_state_files(state, section):
                title = str(item.get("name") or item.get("displayName") or "").strip()
                effective_section = normalized_space(folder or section)
                if not is_protocol_pdf(title, effective_section):
                    continue
                href = str(item.get("url") or item.get("uri") or "").strip()
                if not href:
                    continue
                url = canonical_url(urljoin(BASE_URL, href))
                discovered[url] = ProtocolLink(
                    title=title,
                    body=effective_body,
                    section=effective_section,
                    url=url,
                    listing_page=final_page_url,
                    source_file_id=str(item.get("id") or ""),
                    source_file_size=str(item.get("fileSize") or ""),
                )
        # Fallback for ordinary PDF anchors if Sitevision changes its state markup.
        for href, title in collect_anchors(html_text):
            url = canonical_url(urljoin(final_page_url, href))
            decoded_name = Path(unquote(urlparse(url).path)).name
            candidate_title = title or decoded_name
            if url in discovered or not is_protocol_pdf(candidate_title):
                continue
            discovered[url] = ProtocolLink(candidate_title, body, "anchor fallback", url, final_page_url)
    links = sorted(discovered.values(), key=lambda row: (row.title, row.body, row.url))
    return links, checked_pages, failures


def known_bundle_urls(path: Path = CURRENT_PROTOCOL_BUNDLE) -> set[str]:
    if not path.exists():
        return set()
    source = path.read_text(encoding="utf-8")
    urls: set[str] = set()
    assignment = re.compile(r"municipalProtocolPackParts\[\d+\]\s*=")
    for match in assignment.finditer(source):
        raw = extract_balanced_object(source, match.end())
        if not raw:
            continue
        try:
            part = json.loads(raw)
        except json.JSONDecodeError:
            continue
        for document in part.get("d") or []:
            if isinstance(document, dict) and document.get("u"):
                urls.add(canonical_url(str(document["u"])))
    return urls


def known_protocol_diaries(path: Path = CURRENT_DIARY_BUNDLE) -> dict[str, str]:
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    marker = re.search(r"window\.municipalProtocolDiaryPack\s*=", text)
    if not marker:
        return {}
    start = marker.end()
    while start < len(text) and text[start].isspace():
        start += 1
    try:
        payload, _ = json.JSONDecoder().raw_decode(text[start:])
    except json.JSONDecodeError:
        return {}
    by_url = payload.get("byUrl", {}) if isinstance(payload, dict) else {}
    return {
        canonical_url(str(url)): normalized_space(str(diary))
        for url, diary in by_url.items()
        if canonical_url(str(url)) and normalized_space(str(diary))
    }


def extract_protocol_diary(first_page_text: str) -> tuple[str, str]:
    lines = [normalized_space(line) for line in (first_page_text or "").splitlines()]
    lines = [line for line in lines if line]
    for line in lines[:20]:
        if re.search(r"\bProtokoll\b", line, flags=re.IGNORECASE):
            matches = DIARY_PATTERN.findall(line)
            if matches:
                return matches[-1], line
    top_matches: list[tuple[str, str]] = []
    for line in lines[:12]:
        top_matches.extend((match, line) for match in DIARY_PATTERN.findall(line))
    if len({match for match, _ in top_matches}) == 1:
        return top_matches[0]
    return "", ""


def find_executable(name: str, extra_candidates: Iterable[Path] = ()) -> str | None:
    discovered = shutil.which(name)
    if discovered:
        return discovered
    for candidate in extra_candidates:
        if candidate.exists():
            return str(candidate)
    return None


def first_page_text_native(pdf_path: Path) -> tuple[str, str]:
    pdftotext = find_executable("pdftotext")
    if not pdftotext:
        return "", "pdftotext unavailable"
    result = subprocess.run(
        [pdftotext, "-f", "1", "-l", "1", "-layout", str(pdf_path), "-"],
        capture_output=True,
        check=False,
        timeout=60,
    )
    if result.returncode != 0:
        return "", result.stderr.decode("utf-8", errors="replace").strip() or "pdftotext failed"
    return result.stdout.decode("utf-8", errors="replace"), ""


def first_page_text_ocr(pdf_path: Path, tessdata_dir: Path | None = None) -> tuple[str, str, str]:
    pdftoppm = find_executable("pdftoppm")
    tesseract = find_executable(
        "tesseract",
        [Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"), Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe")],
    )
    if not pdftoppm or not tesseract:
        return "", "", "pdftoppm or tesseract unavailable"
    configured_tessdata = tessdata_dir if tessdata_dir and tessdata_dir.exists() else None
    if configured_tessdata is None:
        installed = Path(tesseract).parent / "tessdata"
        configured_tessdata = installed if installed.exists() else None
    language = "swe" if configured_tessdata and (configured_tessdata / "swe.traineddata").exists() else "eng"
    with tempfile.TemporaryDirectory(prefix="orebro-protocol-ocr-") as temporary:
        prefix = Path(temporary) / "first-page"
        render = subprocess.run(
            [pdftoppm, "-f", "1", "-l", "1", "-singlefile", "-png", "-r", "300", str(pdf_path), str(prefix)],
            capture_output=True,
            check=False,
            timeout=120,
        )
        image_path = prefix.with_suffix(".png")
        if render.returncode != 0 or not image_path.exists():
            error = render.stderr.decode("utf-8", errors="replace").strip() or "pdftoppm failed"
            return "", language, error
        command = [tesseract, str(image_path), "stdout", "-l", language, "--psm", "6"]
        environment = os.environ.copy()
        if configured_tessdata:
            environment["TESSDATA_PREFIX"] = str(configured_tessdata)
        ocr = subprocess.run(command, capture_output=True, check=False, timeout=180, env=environment)
        if ocr.returncode != 0:
            return "", language, ocr.stderr.decode("utf-8", errors="replace").strip() or "tesseract failed"
        return ocr.stdout.decode("utf-8", errors="replace"), language, ""


def extract_first_page_metadata(pdf_path: Path, tessdata_dir: Path | None = None) -> dict[str, str]:
    native_text, native_error = first_page_text_native(pdf_path)
    diary, evidence = extract_protocol_diary(native_text)
    if diary:
        return {"diary_number": diary, "diary_evidence": evidence, "diary_method": "first_page_pdftotext", "metadata_error": ""}
    ocr_text, language, ocr_error = first_page_text_ocr(pdf_path, tessdata_dir)
    diary, evidence = extract_protocol_diary(ocr_text)
    if diary:
        return {
            "diary_number": diary,
            "diary_evidence": evidence,
            "diary_method": f"first_page_ocr_{language}",
            "metadata_error": "",
        }
    errors = "; ".join(error for error in [native_error, ocr_error] if error)
    return {
        "diary_number": "",
        "diary_evidence": "",
        "diary_method": "unresolved",
        "metadata_error": errors or "No unambiguous protocol-level Diarienummer found on the first page",
    }


def protocol_destination(output: Path, link: ProtocolLink, used_paths: set[str]) -> Path:
    date_match = DATE_PATTERN.search(link.title)
    year = date_match.group(1) if date_match else "unknown-year"
    filename = safe_filename(link.title)
    relative = Path(year) / slugify(link.body) / filename
    if relative.as_posix().casefold() in used_paths:
        stem, suffix = Path(filename).stem, Path(filename).suffix or ".pdf"
        filename = f"{stem}-{hashlib.sha256(link.url.encode('utf-8')).hexdigest()[:10]}{suffix}"
        relative = Path(year) / slugify(link.body) / filename
    used_paths.add(relative.as_posix().casefold())
    return output / relative


def reconcile_corrected_archive_records(output: Path, stored_protocols: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    migrations: list[dict[str, str]] = []
    for url, correction in KNOWN_METADATA_CORRECTIONS.items():
        record = stored_protocols.get(canonical_url(url))
        if not record or not record.get("local_path"):
            continue
        corrected_title = str(correction.get("title") or record.get("title") or "")
        corrected_body = str(correction.get("body") or record.get("body") or "")
        record["official_title"] = str(record.get("official_title") or record.get("title") or "")
        record["title"] = corrected_title
        record["body"] = corrected_body
        # A normalized record may share one canonical meeting PDF with other
        # official URLs. Metadata corrections must never move that shared PDF
        # back to a source-specific filename.
        if record.get("meeting_path"):
            continue
        date_match = DATE_PATTERN.search(corrected_title)
        year = date_match.group(1) if date_match else "unknown-year"
        destination_relative = Path(year) / slugify(corrected_body) / safe_filename(corrected_title)
        source_relative = Path(str(record["local_path"]))
        source, destination = output / source_relative, output / destination_relative
        if source.resolve() != destination.resolve():
            destination.parent.mkdir(parents=True, exist_ok=True)
            if destination.exists():
                if hashlib.sha256(destination.read_bytes()).hexdigest() != str(record.get("sha256") or ""):
                    raise RuntimeError(f"Corrected archive destination collision: {destination}")
                if source.exists():
                    source.unlink()
            elif source.exists():
                os.replace(source, destination)
            else:
                raise RuntimeError(f"Cannot migrate missing archived PDF: {source}")
            migrations.append({"url": url, "from": source_relative.as_posix(), "to": destination_relative.as_posix()})
        record["local_path"] = destination_relative.as_posix()
    return migrations


def archive_needs_normalization(output: Path, stored_protocols: dict[str, dict[str, Any]], changed: bool) -> bool:
    if changed or not (output / "meetings.json").exists():
        return True
    return any(
        record.get("local_path") and record.get("meeting_path") != record.get("local_path")
        for record in stored_protocols.values()
        if isinstance(record, dict)
    )


def normalize_archive(output: Path, state_path: Path) -> dict[str, Any]:
    report_path = output / "normalization-report.json"
    source_archive = output.parent / f"{output.name}-kallfiler"
    command = [
        sys.executable,
        str(NORMALIZER_SCRIPT),
        "--apply",
        "--archive",
        str(output),
        "--source-archive",
        str(source_archive),
        "--state",
        str(state_path),
        "--manifest",
        str(output / "meetings.json"),
        "--report",
        str(report_path),
    ]
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if result.returncode:
        details = result.stderr.strip() or result.stdout.strip() or f"exit code {result.returncode}"
        raise RuntimeError(f"Canonical PDF normalization failed: {details}")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    validation = report.get("validation", {})
    pdfs = validation.get("pdfs") if isinstance(validation, dict) else None
    meetings = validation.get("meetings") if isinstance(validation, dict) else None
    if not isinstance(pdfs, int) or not isinstance(meetings, int) or pdfs != meetings:
        raise RuntimeError("Canonical PDF normalization did not produce exactly one PDF per meeting")
    return report


def download_protocol(
    client: HttpClient,
    output: Path,
    link: ProtocolLink,
    used_paths: set[str],
    tessdata_dir: Path | None,
    maximum_pdf_bytes: int,
    verified_diary: str = "",
) -> dict[str, Any]:
    destination = protocol_destination(output, link, used_paths)
    data, final_url, headers = client.get(link.url, "application/pdf,*/*;q=0.1", maximum_pdf_bytes)
    if not data.startswith(b"%PDF"):
        raise RuntimeError(f"Response is not a PDF: {link.url} ({headers.get('content-type', 'unknown content type')})")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + ".part")
    temporary.write_bytes(data)
    os.replace(temporary, destination)
    metadata = (
        {
            "diary_number": verified_diary,
            "diary_evidence": "Previously extracted from this URL's first-page protocol header",
            "diary_method": "existing-first-page-diary-pack",
            "metadata_error": "",
        }
        if verified_diary
        else extract_first_page_metadata(destination, tessdata_dir)
    )
    relative_path = destination.relative_to(output).as_posix()
    return {
        **asdict(link),
        "final_url": final_url,
        "local_path": relative_path,
        "downloaded_at": now_utc(),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "content_type": headers.get("content-type", ""),
        "last_modified": headers.get("last-modified", ""),
        **metadata,
        "status": "downloaded" if metadata["diary_number"] else "needs_review",
    }


class RunLock:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.handle: int | None = None

    def __enter__(self) -> "RunLock":
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            self.handle = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError as error:
            raise RuntimeError(f"Another scraper run may be active; lock exists: {self.path}") from error
        os.write(self.handle, f"pid={os.getpid()} started={now_utc()}\n".encode("utf-8"))
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        if self.handle is not None:
            os.close(self.handle)
        try:
            self.path.unlink()
        except FileNotFoundError:
            pass


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"schema_version": 1, "updated_at": "", "protocols": {}}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("protocols"), dict):
        raise RuntimeError(f"Invalid scraper state: {path}")
    return payload


def run(args: argparse.Namespace) -> tuple[dict[str, Any], int]:
    started_at = now_utc()
    output = args.output.resolve()
    state_path = args.state.resolve() if args.state else output / "state.json"
    latest_report_path = output / "latest-run.json"
    client = HttpClient(args.delay, args.timeout)
    known_in_database = known_bundle_urls(args.bundle)
    verified_diaries = known_protocol_diaries(args.diary_bundle)
    state = load_state(state_path)
    stored_protocols: dict[str, dict[str, Any]] = state["protocols"]
    live_links, listing_pages, discovery_failures = discover_protocols(client)
    live_links = [corrected_link(link) for link in live_links]
    live_by_url = {canonical_url(link.url): link for link in live_links}
    downloaded_urls = {canonical_url(url) for url in stored_protocols}
    new_links = [link for url, link in live_by_url.items() if url not in downloaded_urls]
    missing_from_database = [link for url, link in live_by_url.items() if url not in known_in_database]
    new_links.sort(key=lambda row: (DATE_PATTERN.search(row.title).group(0) if DATE_PATTERN.search(row.title) else "", row.body, row.title))
    missing_from_database.sort(
        key=lambda row: (DATE_PATTERN.search(row.title).group(0) if DATE_PATTERN.search(row.title) else "", row.body, row.title)
    )
    if args.max_new is not None:
        new_links = new_links[: args.max_new]

    report: dict[str, Any] = {
        "schema_version": 1,
        "started_at": started_at,
        "finished_at": "",
        "dry_run": args.dry_run,
        "known_protocol_urls_in_database": len(known_in_database),
        "known_first_page_diaries": len(verified_diaries),
        "known_protocol_urls_in_scraper_state": len(downloaded_urls),
        "live_protocol_urls": len(live_by_url),
        "protocol_urls_missing_from_database": len(missing_from_database),
        "missing_from_database": [asdict(link) for link in missing_from_database],
        "unarchived_protocol_urls": len(new_links),
        "new_protocol_urls": len(new_links),
        "listing_pages_checked": listing_pages,
        "discovery_failures": discovery_failures,
        "new_protocols": [asdict(link) for link in new_links],
        "downloads": [],
        "review_retries": [],
        "archive_migrations": [],
        "normalization": {"ran": False},
        "failures": [],
    }
    if args.dry_run:
        report["finished_at"] = now_utc()
        return report, 1 if discovery_failures else 0

    output.mkdir(parents=True, exist_ok=True)
    report["archive_migrations"] = reconcile_corrected_archive_records(output, stored_protocols)
    used_paths = {
        str(row.get("local_path") or "").casefold() for row in stored_protocols.values() if row.get("local_path")
    }
    for link in new_links:
        try:
            record = download_protocol(
                client,
                output,
                link,
                used_paths,
                args.tessdata_dir,
                args.maximum_pdf_bytes,
                verified_diaries.get(canonical_url(link.url), ""),
            )
            stored_protocols[canonical_url(link.url)] = record
            report["downloads"].append(record)
        except Exception as error:
            report["failures"].append({"stage": "download", "url": link.url, "title": link.title, "error": str(error)})

    # Retry first-page metadata for previously downloaded files that still need review.
    for url, record in stored_protocols.items():
        if record.get("status") != "needs_review" or not record.get("local_path"):
            continue
        path = output / str(record["local_path"])
        if not path.exists():
            report["failures"].append({"stage": "review_retry", "url": url, "error": f"Missing local file: {path}"})
            continue
        metadata = extract_first_page_metadata(path, args.tessdata_dir)
        record.update(metadata)
        if metadata["diary_number"]:
            record["status"] = "downloaded"
        elif canonical_url(url) in known_in_database:
            record["status"] = "archived_existing_database"
        else:
            record["status"] = "needs_review"
        report["review_retries"].append({"url": url, "local_path": record["local_path"], **metadata, "status": record["status"]})

    state["updated_at"] = now_utc()
    state["protocols"] = stored_protocols
    atomic_write_json(state_path, state)
    if archive_needs_normalization(
        output,
        stored_protocols,
        bool(report["downloads"] or report["archive_migrations"]),
    ):
        try:
            normalization = normalize_archive(output, state_path)
            report["normalization"] = {
                "ran": True,
                "meetings_detected": normalization.get("meetings_detected", 0),
                "meetings_changed": normalization.get("meetings_changed", 0),
                "validation": normalization.get("validation", {}),
            }
            state = load_state(state_path)
            stored_protocols = state["protocols"]
        except Exception as error:
            report["failures"].append({"stage": "normalization", "error": str(error)})
    report["finished_at"] = now_utc()
    atomic_write_json(latest_report_path, report)
    unresolved = [record for record in stored_protocols.values() if record.get("status") == "needs_review"]
    if discovery_failures or report["failures"]:
        return report, 1
    return report, 2 if unresolved else 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Discover and compare without downloading or writing state")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help=f"Download/state directory (default: {DEFAULT_OUTPUT})")
    parser.add_argument("--state", type=Path, default=None, help="State JSON path (default: <output>/state.json)")
    parser.add_argument("--bundle", type=Path, default=CURRENT_PROTOCOL_BUNDLE, help="Existing municipal protocol UI bundle")
    parser.add_argument("--diary-bundle", type=Path, default=CURRENT_DIARY_BUNDLE, help="Existing first-page protocol diary bundle")
    parser.add_argument("--max-new", type=int, default=None, help="Process at most this many new URLs (useful for smoke tests)")
    parser.add_argument("--delay", type=float, default=0.2, help="Minimum delay between HTTP requests")
    parser.add_argument("--timeout", type=float, default=45.0, help="Per-request timeout in seconds")
    parser.add_argument("--maximum-pdf-bytes", type=int, default=100_000_000, help="Reject unexpectedly large PDF responses")
    parser.add_argument("--tessdata-dir", type=Path, default=None, help="Optional directory containing swe.traineddata")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.max_new is not None and args.max_new < 0:
        raise SystemExit("--max-new must be zero or greater")
    lock_path = args.output.resolve() / ".scraper.lock"
    try:
        if args.dry_run:
            report, exit_code = run(args)
        else:
            with RunLock(lock_path):
                report, exit_code = run(args)
    except KeyboardInterrupt:
        print("Scraper interrupted", file=sys.stderr)
        return 130
    except Exception as error:
        print(json.dumps({"fatal_error": str(error)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
