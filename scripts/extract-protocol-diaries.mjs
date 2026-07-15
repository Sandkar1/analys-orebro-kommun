import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = process.cwd();
const cacheDir = path.join(os.tmpdir(), 'orebro-protocol-diary-cache');
fs.mkdirSync(cacheDir, { recursive: true });

const manualProtocolDiaryByUrl = {
  "https://www.orebro.se/download/18.37a1a24a18529b6cad523e3b/1674567954298/2023-01-19%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 9/2023",
  "https://www.orebro.se/download/18.2b0980de1869c53d5f23d3/1677769024661/2023-02-16%20%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 21/2023",
  "https://www.orebro.se/download/18.72f1b9ae18722d2df734ba/1679986312965/2023-03-23%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 22/2023",
  "https://www.orebro.se/download/18.34b9a46187742095fe4d3a/1682675336105/2023-04-20%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 23/2023",
  "https://www.orebro.se/download/18.15b82e2b1884c6c058f8ae3/1685963149793/2023-05-25%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 24/2023",
  "https://www.orebro.se/download/18.5abfca7518a8d341c984174/1695891634227/2023-09-21%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 25/2023",
  "https://www.orebro.se/download/18.2c9df83a18b001ec55a769/1696853328708/2023-10-05%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 26/2023",
  "https://www.orebro.se/download/18.3b7d2e8618bcc49f96a3dc/1700033011559/2023-11-09%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 27/2023",
  "https://www.orebro.se/download/18.42f849df18c629e88512e56/1702886887772/2023-12-07%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 28/2023",
  "https://www.orebro.se/download/18.5270978318d54c04e08f68/1706797709184/2024-01-18%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 11/2024",
  "https://www.orebro.se/download/18.2e67cb6418d8264e5761ee2/1707923266718/2024-02-08%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 12/2024",
  "https://www.orebro.se/download/18.45e37b6318e5a7b16a213aa/1711373516205/2024-03-14%20%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 13/2024",
  "https://www.orebro.se/download/18.3ee527018f3782c66028d/1714643028114/2024-04-18%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 14/2024",
  "https://www.orebro.se/download/18.5ac8a79218f9ed2d44eac97/1717075732878/2024-05-23%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 15/2024",
  "https://www.orebro.se/download/18.2888281a191734c2d40f1f/1724673304211/2024-08-22%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 16/2024",
  "https://www.orebro.se/download/18.3ed7b4801924bc2c8f5668/1727961420821/2024-09-19%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden%20%C2%A7%2079.pdf": "\u00d6n 17/2024",
  "https://www.orebro.se/download/18.3ed7b4801924bc2c8f5667/1727961419008/2024-09-19%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 17/2024",
  "https://www.orebro.se/download/18.34845f44192b793f4ee5aa6/1730713447338/2024-10-17%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 18/2024",
  "https://www.orebro.se/download/18.b0e0e6c1932456576031b2/1732276575309/2024-11-21%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 19/2024",
  "https://www.orebro.se/download/18.199688021939024f144349b/1734081539147/2024-12-12%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 20/2024",
  "https://www.orebro.se/download/18.407c6fc3193defbcd38891a/1738309329855/2025-01-16%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 19/2025",
  "https://www.orebro.se/download/18.51177871193dec95027bef9/1738921660153/2025-02-05%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden%20omedelbart%20justerat%20protokoll%20%C2%A7%2024.pdf": "\u00d6n 20/2025",
  "https://www.orebro.se/download/18.157793ad194fc3773f22498/1740144247987/2025-02-06%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 20/2025",
  "https://www.orebro.se/download/18.e2c086119540c65de01155d/1742288965740/2025-03-13%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 21/2025",
  "https://www.orebro.se/download/18.7e6f347819618e1adfd1263f/1745413780437/2025-04-10%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 22/2025",
  "https://www.orebro.se/download/18.37d0cbed196f11b70bba392/1749110859666/2025-05-22%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 23/2025",
  "https://www.orebro.se/download/18.6e9ec3f198c5c89a0312f4/1756130906779/2025-08-21%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 24/2025",
  "https://www.orebro.se/download/18.7c23397219931e08dd13e55/1758876023288/2025-09-23%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden%20%C2%A7%2083-90%20och%2092-100.pdf": "\u00d6n 25/2025",
  "https://www.orebro.se/download/18.1261093c1993221cf683320/1758719301573/2025-09-23%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden%20omedelbart%20justerat%20protokoll%20%C2%A7%2091.pdf": "\u00d6n 25/2025",
  "https://www.orebro.se/download/18.b9ea2a6199c8e481ec1b94/1760971234934/2025-10-16%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 26/2025",
  "https://www.orebro.se/download/18.2755e3bf19a767c7ea74457/1764338360735/2025-11-13%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 27/2025",
  "https://www.orebro.se/download/18.6888ebfe19b2bdfbd245c6/1766063425932/2025-12-04%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 28/2025",
  "https://www.orebro.se/download/18.61617f1419b2c0522ec55b4/1769005163715/2026-01-15%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 24/2026",
  "https://www.orebro.se/download/18.787763c919c47a61453a24/1770970627791/2026-02-05%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 25/2026",
  "https://www.orebro.se/download/18.7d5d1aa219c934a544f4eef/1773675181256/2026-03-12%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 26/2026",
  "https://www.orebro.se/download/18.6a706a3119d9a6c46a7b25/1776859361449/2026-04-16%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 27/2026",
  "https://www.orebro.se/download/18.523ac55219e631884d61b78/1780469218551/2026-05-26%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf": "\u00d6n 28/2026"
};

function loadPack() {
  const context = { window: {} };
  vm.createContext(context);
  for (const file of [
    'data/municipal-protocol-data-orebro-v2.part1.js',
    'data/municipal-protocol-data-orebro-v2.part2.js'
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  }
  const parts = context.window.municipalProtocolPackParts || {};
  return {
    ...parts[1],
    d: [...(parts[1]?.d || []), ...(parts[2]?.d || [])],
    r: parts[2]?.r || [],
    pr: parts[2]?.pr || [],
    mr: parts[2]?.mr || []
  };
}

function request(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('http://') ? 'http' : 'https';
    import(`node:${client}`).then(({ get }) => {
      get(url, response => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode || 0) && response.headers.location) {
          const next = new URL(response.headers.location, url).toString();
          response.resume();
          request(next).then(resolve, reject);
          return;
        }
        if ((response.statusCode || 0) >= 400) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    }, reject);
  });
}

async function download(url) {
  const name = createHash('sha256').update(url).digest('hex').slice(0, 24) + '.pdf';
  const file = path.join(cacheDir, name);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  const body = await request(url);
  fs.writeFileSync(file, body);
  return file;
}

function firstPageText(pdfPath) {
  const result = spawnSync('pdftotext', ['-f', '1', '-l', '1', '-layout', pdfPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });
  return result.stdout || '';
}

function extractDiary(text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const diaryPattern = /(?<![A-Za-zÅÄÖåäö])[A-ZÅÄÖ][A-Za-zÅÄÖåäö]{0,7}\s+\d{1,6}\/20\d{2}(?![A-Za-zÅÄÖåäö])/g;
  const protocolLine = lines.find(line => /^Protokoll\b/i.test(line) && diaryPattern.test(line));
  if (protocolLine) {
    diaryPattern.lastIndex = 0;
    const matches = [...protocolLine.matchAll(diaryPattern)].map(match => match[0]);
    if (matches.length) return matches.at(-1);
  }
  for (const line of lines.slice(0, 16)) {
    diaryPattern.lastIndex = 0;
    const matches = [...line.matchAll(diaryPattern)].map(match => match[0]);
    if (matches.length) return matches.at(-1);
  }
  return '';
}

function uniqueProtocols(pack) {
  const map = new Map();
  for (const doc of pack.d || []) {
    const url = String(doc.u || '').trim();
    const title = String(doc.doc || '').trim();
    if (!url || !title || map.has(url)) continue;
    map.set(url, { url, title });
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, 'sv'));
}

const pack = loadPack();
const protocols = uniqueProtocols(pack);
const byUrl = {};
const byTitle = {};
const missing = [];

for (let index = 0; index < protocols.length; index++) {
  const protocol = protocols[index];
  try {
    const pdf = await download(protocol.url);
    const diary = extractDiary(firstPageText(pdf)) || manualProtocolDiaryByUrl[protocol.url] || '';
    if (diary) {
      byUrl[protocol.url] = diary;
      byTitle[protocol.title] = diary;
    } else {
      missing.push(protocol);
    }
    if ((index + 1) % 25 === 0) console.log(`Processed ${index + 1}/${protocols.length}`);
  } catch (error) {
    missing.push({ ...protocol, error: error.message });
    console.warn(`Failed ${protocol.title}: ${error.message}`);
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  source: 'first-page top-right protocol header extracted from public PDF source URLs',
  byUrl,
  byTitle,
  missing
};

const js = `window.municipalProtocolDiaryPack=${JSON.stringify(output)};\n`;
fs.writeFileSync(path.join(root, 'data/municipal-protocol-diary-data.js'), js, 'utf8');
console.log(`Wrote ${Object.keys(byUrl).length} protocol diary numbers; missing ${missing.length}.`);
