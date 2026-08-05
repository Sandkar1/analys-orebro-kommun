import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'data', 'municipal-decision-table-index.ndjson.gz');
const bootstrapOutputPath = path.join(root, 'data', 'municipal-decision-table-bootstrap.js');
const partsOutputDirectory = path.join(root, 'data', 'municipal-decision-table-index-parts');
const indexVersion = '20260805-2';
const bootstrapRowCount = 8;
const partRowCount = 128;
const domElement = {
  textContent: '', innerHTML: '', hidden: false, disabled: false, value: '',
  style: {}, dataset: {}, options: [],
  classList: { add() {}, remove() {}, toggle() {} },
  setAttribute() {}, removeAttribute() {}, appendChild() {}, addEventListener() {},
  insertAdjacentHTML() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  closest() { return null; }
};
const context = {
  window: { municipalDocumentPack: {}, matchMedia: () => ({ matches: true }) },
  document: {
    getElementById: () => domElement,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ ...domElement })
  },
  console, performance, structuredClone, setTimeout, clearTimeout,
  requestAnimationFrame: callback => callback(), cancelAnimationFrame() {},
  TextDecoder, TextEncoder, Blob, Response, DecompressionStream, URL, atob, btoa
};
vm.createContext(context);
vm.runInContext(`
  const $=id=>document.getElementById(id);
  const copy=value=>structuredClone(value);
  function esc(value){return String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]))}
  function fmtInt(value){return String(value)}
  function pageSlice(rows,page,size){return {rows,page,start:0,pages:1}}
  function fuzzySearchTextMatches(text,query){return String(text).includes(String(query))}
`, context);
for (const relative of [
  'data/municipal-protocol-data-orebro-v2.part1.js',
  'data/municipal-protocol-data-orebro-v2.part2.js',
  'data/municipal-protocol-diary-data.js',
  'js/app-core.js',
  'js/municipal-protocols-tab.js',
  'js/search-performance.js',
  'js/municipal-documents-tab.js'
]) vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context, { filename: relative });

vm.runInContext('decisionPack=assembleMunicipalProtocolPackParts(); ensureDecisionData();', context);
const rows = vm.runInContext('decisionAllPointRows', context);
const diaryByUrl = context.window.municipalProtocolDiaryPack?.byUrl || {};
const documents = vm.runInContext('decisionPack.d', context);

if (process.argv.includes('--inspect')) {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))].sort();
  console.log(JSON.stringify({ count: rows.length, keys, first: rows[0], meeting: rows.find(row => row.isMeeting) }, null, 2));
  process.exit(0);
}

const keepFields = [
  'id', 'point', 'date', 'title', 'pointTitle', 'description', 'proposalType',
  'url', 'sourceUrl', 'localPath', 'docIndex', 'voteId', 'voteIds', 'body',
  'bodyType', 'documentTitle', 'diary', 'protocolDiary', 'caseNumber', 'result',
  'voteRoundCount', 'voteCount', 'yes', 'no', 'abstain', 'absent',
  'fullVoteRoundCount', 'fullVoteCount', 'fullYes', 'fullNo', 'fullAbstain',
  'fullAbsent', 'statedYes', 'statedNo', 'statedAbstain', 'statedAbsent',
  'isMeeting', 'meetingKey', 'matterId', 'protocolHeader', 'canonicalMatterHeader',
  'abstractText', 'fullDecisionText', 'meetingSearchText', 'meetingDecisionCount',
  'meetingMatterCount', 'documentKey', 'attendanceKey', 'sourcePage', 'sourcePageEnd'
];
const cleanRow = row => {
  const output = {};
  for (const field of keepFields) {
    const value = row[field];
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (Array.isArray(value) && !value.length) continue;
    output[field] = value;
  }
  if (row.isMeeting) {
    const document = documents[row.docIndex] || {};
    const diary = row.protocolDiary || diaryByUrl[row.sourceUrl] || diaryByUrl[row.url] || diaryByUrl[document.u] || '';
    if (diary) output.protocolDiary = diary;
  }
  return output;
};

const cleanRows = rows.map(cleanRow);
const lines = [JSON.stringify({ type: 'meta', version: indexVersion, total: rows.length }), ...cleanRows.map(JSON.stringify)];
const ndjson = `${lines.join('\n')}\n`;
fs.writeFileSync(outputPath, gzipSync(ndjson, { level: 9 }));
fs.mkdirSync(partsOutputDirectory, { recursive: true });
for (const file of fs.readdirSync(partsOutputDirectory)) {
  if (/^part-\d+\.js$/.test(file)) fs.unlinkSync(path.join(partsOutputDirectory, file));
}
const partCount = Math.ceil(cleanRows.length / partRowCount);
for (let part = 0; part < partCount; part++) {
  const partRows = cleanRows.slice(part * partRowCount, (part + 1) * partRowCount);
  const compactRows = partRows.map(row => {
    const values = keepFields.map(field => row[field] ?? null);
    while (values.length && values.at(-1) === null) values.pop();
    return values;
  });
  const partName = `part-${String(part + 1).padStart(3, '0')}.js`;
  fs.writeFileSync(
    path.join(partsOutputDirectory, partName),
    `window.municipalDecisionTableIndexParts=window.municipalDecisionTableIndexParts||{};window.municipalDecisionTableIndexParts[${part + 1}]=${JSON.stringify(compactRows)};\n`
  );
}
fs.writeFileSync(
  bootstrapOutputPath,
  `window.municipalDecisionTableBootstrap=${JSON.stringify({ version: indexVersion, total: rows.length, partCount, fields: keepFields, rows: cleanRows.slice(0, bootstrapRowCount) })};\n`
);
console.log(JSON.stringify({
  output: path.relative(root, outputPath),
  bootstrapOutput: path.relative(root, bootstrapOutputPath),
  partsOutputDirectory: path.relative(root, partsOutputDirectory),
  partCount,
  rows: rows.length,
  bytes: fs.statSync(outputPath).size,
  bootstrapBytes: fs.statSync(bootstrapOutputPath).size
}));
