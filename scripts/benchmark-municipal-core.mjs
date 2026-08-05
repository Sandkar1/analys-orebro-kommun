import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const element = {
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
    getElementById: () => element,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ ...element })
  },
  console, performance, structuredClone, setTimeout, clearTimeout,
  requestAnimationFrame: callback => callback(), cancelAnimationFrame() {},
  TextDecoder, TextEncoder, Blob, Response, DecompressionStream, atob, btoa
};
vm.createContext(context);
vm.runInContext(`
  const $=id=>document.getElementById(id);
  const copy=value=>structuredClone(value);
  function esc(value){return String(value)}
  function fmtInt(value){return String(value)}
  function pageSlice(rows,page,size){return {rows,page,start:0,pages:1}}
  function fuzzySearchTextMatches(text,query){return String(text).includes(String(query))}
`, context);

for (const relative of [
  'data/municipal-protocol-data-orebro-v2.js',
  'data/municipal-protocol-diary-data.js',
  'js/app-core.js',
  'js/municipal-protocols-tab.js',
  'js/search-performance.js',
  'js/municipal-documents-tab.js'
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context, { filename: relative });
}

const report = vm.runInContext(`(()=>{
  const timed=callback=>{
    const started=performance.now();
    const value=callback();
    return {ms:performance.now()-started,value};
  };
  decisionPack=assembleMunicipalProtocolPackParts();
  const firstEnsure=timed(()=>ensureDecisionData());
  const repeatEnsure=timed(()=>{for(let index=0;index<100;index++)ensureDecisionData()});
  const filtered=timed(()=>filteredDecisionPointRows());
  const row=filtered.value
    .filter(candidate=>!candidate.isMeeting)
    .sort((a,b)=>String(b.abstractText||'').length-String(a.abstractText||'').length)[0]||filtered.value[0];
  const proposalKey=decisionProposalKey(row);
  const lookup=timed(()=>decisionProposalRowByKeyAnyFinal(proposalKey));
  const payload=timed(()=>decisionDetailPayload({
    id:row.id, point:row.point, sourcePoint:row.point, proposalKey
  }));
  const detailText=timed(()=>decisionDetailTextHtml(row));
  return {
    firstEnsureMs:firstEnsure.ms,
    repeatEnsure100Ms:repeatEnsure.ms,
    filteredPointsMs:filtered.ms,
    filteredCount:filtered.value.length,
    proposalLookupMs:lookup.ms,
    detailPayloadMs:payload.ms,
    detailTextMs:detailText.ms,
    detailHtmlLength:detailText.value.length,
    counts:{
      documents:decisionPack.d.length,
      points:decisionAllPointRows.length,
      votes:decisionRows.length,
      positions:decisionPositionRows.length,
      members:decisionMemberRows.length
    },
    sample:{id:row.id,point:row.point,textLength:String(row.abstractText||'').length}
  };
})()`, context);

console.log(JSON.stringify(report, null, 2));
if (report.repeatEnsure100Ms > 5 || report.proposalLookupMs > 10 || report.detailPayloadMs > 25) {
  process.exitCode = 1;
}
