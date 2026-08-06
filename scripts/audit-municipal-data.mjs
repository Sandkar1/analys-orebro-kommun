import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import https from 'node:https';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkRemote = process.argv.includes('--remote') || process.argv.includes('--source-text');
const checkSourceText = process.argv.includes('--source-text');
const samplesPerIssue = 8;
const issues = new Map();
const addIssue = (category, value) => {
  const entry = issues.get(category) || { count: 0, samples: [] };
  entry.count++;
  if (entry.samples.length < samplesPerIssue) entry.samples.push(value);
  issues.set(category, entry);
};
const canonicalOrgan = value => String(value || '').trim().replace(/\s+/g, ' ')
  .replace(/\s+20\d{2}.*20\d{2}$/, '')
  .replace(/hållbarhetssutskott/gi, 'hållbarhetsutskott')
  .trim();

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
  'data/municipal-protocol-data-orebro-v2.js',
  'data/municipal-protocol-diary-data.js',
  'js/app-core.js',
  'js/municipal-protocols-tab.js',
  'js/search-performance.js',
  'js/municipal-documents-tab.js'
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context, { filename: relative });
}
vm.runInContext('decisionPack=assembleMunicipalProtocolPackParts(); ensureDecisionData();', context);
const pack = vm.runInContext('decisionPack', context);
const runtimeRows = vm.runInContext('decisionAllPointRows', context);
const runtimeVoteRows = vm.runInContext('decisionRows', context);
const referenceQuery = process.argv.find(argument => argument.startsWith('--find-reference='))?.slice(17).trim() || '';
if (referenceQuery) {
  context.__referenceQuery = referenceQuery;
  const selected = vm.runInContext(String.raw`(()=>{
    const row=decisionAllPointRows.find(candidate=>decisionProposalKey(candidate)===__referenceQuery);
    if(!row)return null;
    decisionHydrateTextFieldsFinal(row);
    const labels=[...String(row.abstractText||'').matchAll(/(\u00a7\s*\d{1,4}(?:\.\d+)?|\b[A-ZÅÄÖ][A-Za-zÅÄÖåäö]{0,6}\s+\d{1,5}\/20\d{2}\b|\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)(?:\s+20\d{2})?\b)/gi)].map(match=>match[1]);
    return {
      row:{id:row.id,point:row.point,date:row.date,body:row.body,documentTitle:row.documentTitle,matterId:row.matterId},
      references:labels.map(label=>{
        const target=decisionReferenceResolveFinal(label,row);
        return {label,target:target?{kind:target.kind,id:target.row?.id,point:target.row?.point,isMeeting:!!target.row?.isMeeting,key:target.row?decisionProposalKey(target.row):''}:null};
      })
    };
  })()`, context);
  delete context.__referenceQuery;
  console.log(JSON.stringify(selected, null, 2));
  process.exit(0);
}
const diaryPack = context.window.municipalProtocolDiaryPack || {};
context.__voteMeaningFixture = {
  i: 'vote_meaning_fixture',
  p: { '1': 'Fixture' },
  pd: 'Votering begärs och verkställs. Ja-röst innebär bifall till förvaltningens förslag. Nej-röst innebär bifall till Anders Anderssons (X) m.fl. yrkande. Ja-röster lämnas av Anna Andersson (S). Nej-röster lämnas av Bertil Bengtsson (M). Ordförande finner med resultatet 1 ja-röster och 1 nej-röster.'
};
const voteMeaningFixture = vm.runInContext('decisionInferredVoteEventsFromTextFinal(__voteMeaningFixture)', context);
delete context.__voteMeaningFixture;
if (voteMeaningFixture.length !== 1 || voteMeaningFixture[0]?.noMeaning !== 'bifall till Anders Anderssons (X) m.fl. yrkande') {
  addIssue('vote_meaning_abbreviation_regression', { actual: voteMeaningFixture });
}
const findRecordQuery = process.argv.find(argument => argument.startsWith('--find-record='))?.slice(14).trim() || '';
if (findRecordQuery) {
  const normalizedQuery = findRecordQuery.toLocaleLowerCase('sv-SE');
  const selected = pack.d.filter(document => [document.i, document.t, document.ht, document.ad, document.bd]
    .some(value => String(value || '').toLocaleLowerCase('sv-SE').includes(normalizedQuery)))
    .map(document => ({
      id: document.i, date: document.dt, body: document.b, title: document.t, header: document.ht,
      points: document.p, pointMetadata: document.pm, voteMap: document.v, events: document.ve,
      proposition: document.pd, votation: document.vd, url: document.u
    }));
  console.log(JSON.stringify(selected, null, 2));
  process.exit(selected.length ? 0 : 1);
}
const inspectIds = process.argv.filter(argument => argument.startsWith('--record=')).flatMap(argument => argument.slice(9).split(','));
if (inspectIds.length) {
  const selected = pack.d.filter(document => inspectIds.includes(String(document.i || ''))).map(document => ({
    id: document.i, date: document.dt, body: document.b, title: document.t, header: document.ht,
    description: document.ad, decision: document.bd, points: document.p, pointMetadata: document.pm, url: document.u
  }));
  console.log(JSON.stringify(selected, null, 2));
  process.exit(selected.length === inspectIds.length ? 0 : 1);
}
const voteRowsId = process.argv.find(argument => argument.startsWith('--vote-rows='))?.slice(12) || '';
if (voteRowsId) {
  const docIndex = pack.d.findIndex(document => String(document.i || '') === voteRowsId);
  const rows = [];
  for (let index = 0; index < pack.r.length; index += 6) {
    if (Number(pack.r[index]) !== docIndex) continue;
    rows.push({ point: pack.r[index + 1], name: pack.r[index + 2], party: pack.r[index + 3], vote: pack.r[index + 4], participantId: pack.r[index + 5] });
  }
  console.log(JSON.stringify({ docIndex, events: pack.d[docIndex]?.ve || {}, rows }, null, 2));
  process.exit(docIndex >= 0 ? 0 : 1);
}
if (process.argv.includes('--vote-quality')) {
  const counts = new Map();
  for (let index = 0; index < pack.r.length; index += 6) {
    const docIndex = Number(pack.r[index]);
    const participantId = String(pack.r[index + 5] || '');
    const eventId = participantId.includes(':') ? participantId.split(':').slice(0, -1).join(':') : participantId;
    const key = `${docIndex}|${eventId}`;
    const count = counts.get(key) || { Ja: 0, Nej: 0, 'Avstår': 0, 'Frånvarande': 0 };
    const vote = String(pack.r[index + 4] || '');
    if (Object.hasOwn(count, vote)) count[vote]++;
    counts.set(key, count);
  }
  const suspicious = [];
  for (let docIndex = 0; docIndex < pack.d.length; docIndex++) {
    const document = pack.d[docIndex];
    for (const [eventId, event] of Object.entries(document.ve || {})) {
      const meanings = [['yes', event.yes_meaning], ['no', event.no_meaning]]
        .filter(([, value]) => /(?:\bm|\bm\.f|\bm\.fl|\b(?:och|samt|till|mot|respektive))$/iu.test(String(value || '').trim()));
      const count = counts.get(`${docIndex}|${eventId}`) || { Ja: 0, Nej: 0, 'Avstår': 0, 'Frånvarande': 0 };
      const missingNamed = {
        yes: Math.max(0, (Number(event.stated_yes) || 0) - count.Ja),
        no: Math.max(0, (Number(event.stated_no) || 0) - count.Nej),
        abstain: Math.max(0, (Number(event.stated_abstain) || 0) - count['Avstår']),
        absent: Math.max(0, (Number(event.stated_absent) || 0) - count['Frånvarande'])
      };
      if (meanings.length || Object.values(missingNamed).some(Boolean)) suspicious.push({
        id: document.i, date: document.dt, body: document.b, eventId,
        meanings: Object.fromEntries(meanings), named: count,
        stated: { yes: event.stated_yes, no: event.stated_no, abstain: event.stated_abstain, absent: event.stated_absent },
        missingNamed, proposition: document.pd, votation: document.vd, url: document.u
      });
    }
  }
  console.log(JSON.stringify(suspicious, null, 2));
  process.exit(0);
}

const protocolByUrl = new Map();
const documentIds = new Set();
const decisionPointIds = new Set();
const extractionBoilerplate = /(?:Digitalt (?:signerad|signerat|justerad|justerat)(?: protokoll)?\s*(?:\n|$)|(?:^|\n)\s*ÖREBRO\s+Protokoll|(?:^|\n)\s*\d+\s*\(\d+\)\s*(?:\n|$))/imu;
let rawDecisionPointCount = 0;
let decisionPointsNotExtracted = 0;
const validPointByDocument = new Map();
for (let docIndex = 0; docIndex < pack.d.length; docIndex++) {
  const document = pack.d[docIndex];
  const summary = { docIndex, id: document.i, date: document.dt, body: document.b, title: document.doc };
  if (!document.i || documentIds.has(document.i)) addIssue('duplicate_or_missing_document_id', summary);
  documentIds.add(document.i);
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(document.dt || ''))) addIssue('invalid_document_date', summary);
  const titleDate = String(document.doc || '').match(/^(20\d{2}-\d{2}-\d{2})/i)?.[1];
  if (titleDate && titleDate !== document.dt) addIssue('document_title_date_mismatch', summary);
  try {
    const source = new URL(String(document.u || ''));
    if (source.protocol !== 'https:' || !/(^|\.)orebro\.se$/i.test(source.hostname)) addIssue('non_official_source_url', { ...summary, url: document.u });
  } catch {
    addIssue('invalid_source_url', { ...summary, url: document.u });
  }
  if (!protocolByUrl.has(document.u)) protocolByUrl.set(document.u, []);
  protocolByUrl.get(document.u).push(document);
  const points = Object.keys(document.p || {});
  for (const [field, value] of [['header', document.ht], ['description', document.ad], ['decision', document.bd]]) {
    if (extractionBoilerplate.test(String(value || ''))) addIssue('extraction_boilerplate', { ...summary, field });
  }
  validPointByDocument.set(docIndex, new Set(points));
  for (const point of points) {
    rawDecisionPointCount++;
    const meta = document.pm?.[point];
    const pointSummary = { ...summary, point };
    if (extractionBoilerplate.test(String(document.p[point] || ''))) addIssue('extraction_boilerplate', { ...pointSummary, field: 'point' });
    if (!String(document.p[point] || '').trim()) {
      if (meta?.extraction_status === 'decision_not_extracted') decisionPointsNotExtracted++;
      else addIssue('empty_decision_point', pointSummary);
    }
    if (!meta) {
      addIssue('missing_point_metadata', pointSummary);
      continue;
    }
    if (!Number.isInteger(Number(meta.source_page)) || Number(meta.source_page) < 1) addIssue('invalid_source_page', pointSummary);
    if (Number(meta.source_page_end || meta.source_page) < Number(meta.source_page)) addIssue('invalid_source_page_range', pointSummary);
    if (meta.source_url && meta.source_url !== document.u) addIssue('point_source_url_mismatch', { ...pointSummary, pointUrl: meta.source_url, protocolUrl: document.u });
    if (meta.decision_point_id) {
      if (decisionPointIds.has(meta.decision_point_id)) addIssue('duplicate_decision_point_id', { ...pointSummary, decisionPointId: meta.decision_point_id });
      decisionPointIds.add(meta.decision_point_id);
    }
    const headerPoint = String(document.ht || '').match(/§\s*(\d{1,4})/)?.[1];
    const pointBase = String(point).match(/^(\d{1,4})/)?.[1];
    if (headerPoint && pointBase && headerPoint !== pointBase) addIssue('header_point_mismatch', { ...pointSummary, header: document.ht });
  }
  for (const point of Object.keys(document.pm || {})) {
    if (!Object.hasOwn(document.p || {}, point)) addIssue('orphan_point_metadata', { ...summary, point });
  }
  for (const [point, eventIds] of Object.entries(document.v || {})) {
    if (!points.some(value => value === point || value.split('.')[0] === point.split('.')[0])) addIssue('vote_map_missing_point', { ...summary, point });
    for (const eventId of String(eventIds || '').split(',').map(value => value.trim()).filter(Boolean)) {
      if (!document.ve?.[eventId]) addIssue('vote_map_missing_event', { ...summary, point, eventId });
    }
  }
  for (const [eventId, event] of Object.entries(document.ve || {})) {
    for (const [field, value] of [['yes_meaning', event.yes_meaning], ['no_meaning', event.no_meaning]]) {
      if (/(?:\bm|\bm\.f|\bm\.fl|\b(?:och|samt|till|mot|respektive))$/iu.test(String(value || '').trim())) {
        addIssue('truncated_vote_meaning', { ...summary, eventId, field, value });
      }
    }
  }
}

const namedVotes = new Map();
const voteCountConflicts = [];
const voteCountConflictKeys = new Set();
const validVotes = new Set(['Ja', 'Nej', 'Avstår', 'Frånvarande']);
const runtimeVoteRowKeys = new Set(runtimeVoteRows.map(row => [row.docIndex, row.point, row.name, row.party, row.vote, row.intressentId].map(String).join('|')));
for (let index = 0; index < pack.r.length; index += 6) {
  const docIndex = Number(pack.r[index]), point = String(pack.r[index + 1] || '');
  const vote = String(pack.r[index + 4] || ''), participantId = String(pack.r[index + 5] || '');
  const document = pack.d[docIndex];
  if (!document) {
    addIssue('vote_row_invalid_document', { index: index / 6, docIndex, point });
    continue;
  }
  if (!validPointByDocument.get(docIndex)?.has(point)) addIssue('vote_row_missing_point', { index: index / 6, docIndex, point, id: document.i });
  if (!validVotes.has(vote)) addIssue('vote_row_invalid_value', { index: index / 6, docIndex, point, vote });
  const runtimeKey = [docIndex, point, pack.r[index + 2], pack.r[index + 3], vote, participantId].map(String).join('|');
  if (!runtimeVoteRowKeys.has(runtimeKey)) addIssue('vote_row_missing_from_runtime', { index: index / 6, docIndex, point, participantId });
  const eventId = participantId.includes(':') ? participantId.split(':').slice(0, -1).join(':') : participantId;
  if (!document.ve?.[eventId]) addIssue('vote_row_missing_event', { index: index / 6, docIndex, point, eventId });
  const key = `${docIndex}|${point}|${eventId}`;
  const count = namedVotes.get(key) || { Ja: 0, Nej: 0, 'Avstår': 0, 'Frånvarande': 0, document, eventId, point };
  if (validVotes.has(vote)) count[vote]++;
  namedVotes.set(key, count);
}
for (const count of namedVotes.values()) {
  const event = count.document.ve?.[count.eventId] || {};
  for (const [vote, field] of [['Ja', 'stated_yes'], ['Nej', 'stated_no'], ['Avstår', 'stated_abstain'], ['Frånvarande', 'stated_absent']]) {
    if (!Object.hasOwn(event, field)) continue;
    const stated = Number(event[field]) || 0;
    if (count[vote] > stated && !event.count_conflict) {
      addIssue('named_votes_exceed_protocol_total', { id: count.document.i, eventId: count.eventId, vote, named: count[vote], stated });
    }
  }
  const conflictKey = `${count.document.i}|${count.eventId}`;
  if (event.count_conflict && !voteCountConflictKeys.has(conflictKey)) {
    voteCountConflictKeys.add(conflictKey);
    voteCountConflicts.push({
    id: count.document.i, date: count.document.dt, body: count.document.b, point: count.point,
    eventId: count.eventId, url: count.document.u,
    named: { yes: count.Ja, no: count.Nej, abstain: count['Avstår'], absent: count['Frånvarande'] },
    stated: {
      yes: Number(event.source_stated_yes ?? event.stated_yes) || 0, no: Number(event.source_stated_no ?? event.stated_no) || 0,
      abstain: Number(event.source_stated_abstain ?? event.stated_abstain) || 0, absent: Number(event.source_stated_absent ?? event.stated_absent) || 0
    }
    });
  }
}
if (process.argv.includes('--vote-conflicts')) {
  console.log(JSON.stringify(voteCountConflicts, null, 2));
  process.exit(0);
}

for (let index = 0; index < pack.pr.length; index += 6) {
  const docIndex = Number(pack.pr[index]), point = String(pack.pr[index + 1] || '');
  const document = pack.d[docIndex];
  if (!document) addIssue('position_row_invalid_document', { index: index / 6, docIndex, point });
  else if (!validPointByDocument.get(docIndex)?.has(point)) addIssue('position_row_missing_point', { index: index / 6, docIndex, point, id: document.i });
}

const protocolAttendanceKeys = new Set(pack.d.map(document => `${document.dt}|${document.b}|${document.doc}`));
const attendanceIdentity=value=>String(value||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('sv').replace(/[^a-z0-9åäö]+/giu,' ').trim();
const attendanceByProtocol=new Map();
for (let index = 0; index < pack.mr.length; index += 6) {
  const key = `${pack.mr[index]}|${pack.mr[index + 1]}|${pack.mr[index + 2]}`;
  if (!protocolAttendanceKeys.has(key)) addIssue('attendance_row_unmatched_protocol', { index: index / 6, key });
  if(!attendanceByProtocol.has(key))attendanceByProtocol.set(key,new Set());
  attendanceByProtocol.get(key).add(`${attendanceIdentity(pack.mr[index+3])}|${attendanceIdentity(pack.mr[index+4])}`);
}
for(let index=0;index<pack.r.length;index+=6){
  const document=pack.d[Number(pack.r[index])],vote=String(pack.r[index+4]||'');
  if(!document||vote==='Frånvarande')continue;
  const key=`${document.dt}|${document.b}|${document.doc}`,identity=`${attendanceIdentity(pack.r[index+2])}|${attendanceIdentity(pack.r[index+3])}`;
  if(!attendanceByProtocol.get(key)?.has(identity))addIssue('named_voter_missing_from_attendance',{docIndex:Number(pack.r[index]),point:String(pack.r[index+1]||''),name:String(pack.r[index+2]||''),party:String(pack.r[index+3]||''),key});
}
const may14AttendanceKey='2024-05-14|Kommunfullmäktige|2024-05-14 Kommunfullmäktige.pdf';
const may14Rows=[];
for(let index=0;index<pack.mr.length;index+=6)if(`${pack.mr[index]}|${pack.mr[index+1]}|${pack.mr[index+2]}`===may14AttendanceKey)may14Rows.push({name:String(pack.mr[index+3]||''),party:String(pack.mr[index+4]||''),role:String(pack.mr[index+5]||'')});
if(may14Rows.length!==82)addIssue('page_boundary_attendance_regression',{key:may14AttendanceKey,expected:82,actual:may14Rows.length});
if(may14Rows.some(row=>row.name==='Muhammed'))addIssue('page_boundary_attendance_fragment',{key:may14AttendanceKey,name:'Muhammed'});
const may14RoleCounts=may14Rows.reduce((counts,row)=>(counts[row.role]=(counts[row.role]||0)+1,counts),{});
for(const [role,expected] of [['ledamot',56],['tjänstgörande ersättare',17],['ersättare',9]]){
  const actual=may14RoleCounts[role]||0;
  if(actual!==expected)addIssue('page_boundary_attendance_role_regression',{key:may14AttendanceKey,role,expected,actual});
}
if(Object.keys(may14RoleCounts).some(role=>!['ledamot','tjänstgörande ersättare','ersättare'].includes(role)))addIssue('page_boundary_attendance_unclassified_role',{key:may14AttendanceKey,roles:may14RoleCounts});

let meetingRows = 0;
for (const row of runtimeRows) {
  if (row.isMeeting) {
    meetingRows++;
    const document = pack.d[row.docIndex] || {};
    const expectedDiary = diaryPack.byUrl?.[document.u] || '';
    if (String(row.protocolDiary || row.diary || '') !== expectedDiary) {
      addIssue('meeting_protocol_diary_mismatch', { url: document.u, expected: expectedDiary, actual: row.protocolDiary || row.diary || '' });
    }
    continue;
  }
  const document = pack.d[row.docIndex];
  if (!document) {
    addIssue('runtime_row_invalid_document', { id: row.id, point: row.point, docIndex: row.docIndex });
    continue;
  }
  const expected = {
    id: String(document.i), date: String(document.dt), body: canonicalOrgan(document.b),
    documentTitle: String(document.doc), protocolHeader: String(document.ht),
    abstractText: String(document.ad), fullDecisionText: String(document.bd),
    description: String(document.p?.[String(row.point)] || '')
  };
  for (const [field, value] of Object.entries(expected)) {
    if (String(row[field] || '') !== value) addIssue('runtime_field_mismatch', { id: row.id, point: row.point, field, expected: value.slice(0, 120), actual: String(row[field] || '').slice(0, 120) });
  }
}

const linkAudit = vm.runInContext(String.raw`(()=>{
  const report={texts:0,candidates:0,internal:0,source:0,noTargetPlainText:0,invalidOutput:0,selfInternal:0,selfSamples:[],samples:[],dates:{candidates:0,internal:0,source:0,plainText:0,selfInternal:0,sameCurrentMeeting:0,sameCurrentOtherItem:0,sourceSamples:[]}};
  const candidatePattern=/(§\s*\d{1,4}(?:\.\d+)?|(?<![A-Za-zÅÄÖåäö])[A-ZÅÄÖ][A-Za-zÅÄÖåäö]{0,6}\s+\d{1,5}\/20\d{2}(?![A-Za-zÅÄÖåäö])|\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:[Jj]anuari|[Ff]ebruari|[Mm]ars|[Aa]pril|[Mm]aj|[Jj]uni|[Jj]uli|[Aa]ugusti|[Ss]eptember|[Oo]ktober|[Nn]ovember|[Dd]ecember)(?:\s+20\d{2})?\b)/g;
  for(const row of decisionAllPointRows){
    if(row.isMeeting)continue;
    decisionHydrateTextFieldsFinal(row);
    for(const value of [row.abstractText,row.description,row.yrkandeText,row.propositionText,row.fullDecisionText]){
      const text=String(value||'');
      if(!text)continue;
      report.texts++;
      candidatePattern.lastIndex=0;
      let match;
      while((match=candidatePattern.exec(text))){
        report.candidates++;
        const label=match[1];
        const resolveLabel=/^\d{1,2}\s+(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)$/i.test(label)
          ?decisionInferDateLabelYearFinal(text,match.index,label,row):label;
        const resolved=decisionReferenceResolveFinal(resolveLabel,row);
        const resolvesToSelf=resolved?.kind==='internal'&&resolved.row&&decisionProposalKey(resolved.row)===decisionProposalKey(row);
        if(resolvesToSelf){
          report.selfInternal++;
          if(report.selfSamples.length<12)report.selfSamples.push({id:row.id,point:row.point,label:resolveLabel,targetPoint:resolved.row.point,targetMeeting:!!resolved.row.isMeeting,currentKey:decisionProposalKey(row),targetKey:decisionProposalKey(resolved.row)});
        }
        const isDate=/^20\d{2}-\d{2}-\d{2}$/.test(resolveLabel)||/^\d{1,2}\s+(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+20\d{2}$/i.test(resolveLabel);
        if(isDate){
          report.dates.candidates++;
          if(resolved?.kind==='internal'&&resolved.row)report.dates.internal++;
          else if(resolved?.kind==='source'&&resolved.row){
            report.dates.source++;
            if(report.dates.sourceSamples.length<12)report.dates.sourceSamples.push({id:row.id,point:row.point,label,targetId:resolved.row.id,targetBody:resolved.row.body});
          }else report.dates.plainText++;
          if(resolvesToSelf)report.dates.selfInternal++;
          const resolvedDate=/^20\d{2}-\d{2}-\d{2}$/.test(resolveLabel)?resolveLabel:decisionSwedishDateToIsoFinal(resolveLabel);
          if(resolvedDate===row.date&&resolved?.kind==='internal'){
            if(resolved.row?.isMeeting)report.dates.sameCurrentMeeting++;
            else report.dates.sameCurrentOtherItem++;
          }
        }
        if(resolved?.kind==='internal'&&resolved.row)report.internal++;
        else if(resolved?.kind==='source'&&decisionProtocolFirstPageUrlFinal(resolved.row))report.source++;
        else{
          report.noTargetPlainText++;
          if(report.samples.length<12)report.samples.push({id:row.id,point:row.point,label});
        }
      }
      const output=decisionTextWithReferenceLinksActive(text,row);
      for(const button of output.matchAll(/class="decision-text-ref"[^>]*data-id="([^"]*)"[^>]*data-proposal-key="([^"]*)"/g)){
        if(!button[1]||!decisionRuntimeIndexesFinal?.proposalByKey.has(button[2]))report.invalidOutput++;
      }
      for(const anchor of output.matchAll(/class="decision-text-source-ref"[^>]*href="([^"]*)"/g)){
        try{const url=new URL(anchor[1]);if(url.protocol!=='https:')report.invalidOutput++;}catch{report.invalidOutput++;}
      }
    }
  }
  return report;
})()`, context);

function request(url, method = 'HEAD', redirects = 0) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === 'http:' ? http : https;
    const req = client.request(target, {
      method,
      headers: { 'user-agent': 'MunicipalProtocolIntegrityAudit/1.0', accept: 'application/pdf,*/*;q=0.1' },
      timeout: 45000
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode || 0) && response.headers.location && redirects < 8) {
        response.resume();
        request(new URL(response.headers.location, target).toString(), method, redirects + 1).then(resolve, reject);
        return;
      }
      resolve({ status: response.statusCode || 0, headers: response.headers, response, url: target.toString() });
    });
    req.on('timeout', () => req.destroy(new Error(`Timeout for ${url}`)));
    req.on('error', reject);
    req.end();
  });
}

async function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 100 && fs.readFileSync(file, { encoding: null, flag: 'r' }).subarray(0, 5).toString() === '%PDF-') return;
  const result = await request(url, 'GET');
  if (result.status < 200 || result.status >= 300) {
    result.response.resume();
    throw new Error(`HTTP ${result.status}`);
  }
  const chunks = [];
  for await (const chunk of result.response) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  if (body.subarray(0, 5).toString() !== '%PDF-') throw new Error(`Not a PDF (${result.headers['content-type'] || 'unknown type'})`);
  fs.writeFileSync(file, body);
}

async function mapLimit(values, limit, callback) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      await callback(values[index], index);
    }
  });
  await Promise.all(workers);
}

const remote = { checked: 0, ok: 0, failures: [], sourceText: null };
if (checkRemote) {
  const protocols = [...protocolByUrl.entries()].map(([url, documents]) => ({ url, documents }));
  if (!checkSourceText) {
    await mapLimit(protocols, 12, async protocol => {
      remote.checked++;
      try {
        let result = await request(protocol.url, 'HEAD');
        if ([405, 501].includes(result.status)) result = await request(protocol.url, 'GET');
        result.response.resume();
        if (result.status >= 200 && result.status < 400) remote.ok++;
        else remote.failures.push({ url: protocol.url, status: result.status });
      } catch (error) {
        remote.failures.push({ url: protocol.url, error: error.message });
      }
    });
  } else {
    const cache = path.join(os.tmpdir(), 'orebro-protocol-source-audit-v1');
    fs.mkdirSync(cache, { recursive: true });
    await mapLimit(protocols, 6, async (protocol, index) => {
      const name = createHash('sha256').update(protocol.url).digest('hex');
      protocol.pdf = path.join(cache, `${name}.pdf`);
      protocol.text = path.join(cache, `${name}.txt`);
      remote.checked++;
      try {
        await download(protocol.url, protocol.pdf);
        remote.ok++;
      } catch (error) {
        remote.failures.push({ url: protocol.url, error: error.message });
      }
      if ((index + 1) % 50 === 0) console.error(`Downloaded ${index + 1}/${protocols.length} protocols`);
    });
    const mismatch = () => ({ count: 0, samples: [] });
    const noteMismatch = (entry, value) => {
      entry.count++;
      if (entry.samples.length < 12) entry.samples.push(value);
    };
    const source = {
      protocols: 0, documents: 0, decisionPointsChecked: 0,
      dateMismatches: [], diaryMismatches: [],
      missingTitles: mismatch(), missingHeaders: mismatch(), missingDescriptions: mismatch(), missingDecisions: mismatch(),
      pointTextMismatches: mismatch(), invalidPages: mismatch()
    };
    const tokens = value => String(value || '')
      .normalize('NFC')
      .toLocaleLowerCase('sv-SE')
      .replace(/([\p{L}])-\s+(?=[\p{L}])/gu, '$1')
      .match(/[\p{L}\p{N}]+/gu) || [];
    const compact = value => tokens(value).join('');
    const tokenText = value => ` ${tokens(value).join(' ')} `;
    const sourceTextMatches = (value, available) => {
      const wanted = tokens(value);
      if (!wanted.length) return true;
      const whole = ` ${wanted.join(' ')} `;
      if (available.includes(whole)) return true;
      const windowSize = Math.min(12, Math.max(3, Math.floor(wanted.length / 4)));
      if (wanted.length <= windowSize) return available.includes(whole);
      const offsets = [...new Set([0, Math.floor((wanted.length - windowSize) / 3), Math.floor((wanted.length - windowSize) * 2 / 3), wanted.length - windowSize])];
      const matches = offsets.filter(offset => available.includes(` ${wanted.slice(offset, offset + windowSize).join(' ')} `)).length;
      if (matches >= Math.max(2, Math.ceil(offsets.length / 2))) return true;
      if (wanted.length <= 12) {
        const edgeSize = Math.min(3, Math.max(2, Math.floor(wanted.length / 2)));
        return available.includes(` ${wanted.slice(0, 2).join(' ')} `) && available.includes(` ${wanted.slice(-edgeSize).join(' ')} `);
      }
      return false;
    };
    for (let index = 0; index < protocols.length; index++) {
      const protocol = protocols[index];
      if (!protocol.pdf || !fs.existsSync(protocol.pdf)) continue;
      if (!fs.existsSync(protocol.text)) {
        const result = spawnSync('pdftotext', ['-layout', protocol.pdf, protocol.text], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 4 });
        if (result.status !== 0) {
          remote.failures.push({ url: protocol.url, error: String(result.stderr || 'pdftotext failed').trim() });
          continue;
        }
      }
      const text = fs.readFileSync(protocol.text, 'utf8');
      const pages = text.split('\f');
      const firstPage = pages[0] || '';
      const sourceDate = firstPage.match(/Datum:\s*(20\d{2}-\d{2}-\d{2})/i)?.[1] || '';
      const expectedDate = String(protocol.documents[0]?.dt || '');
      if (sourceDate && sourceDate !== expectedDate && source.dateMismatches.length < 50) source.dateMismatches.push({ url: protocol.url, expectedDate, sourceDate });
      const extractedDiary = firstPage.match(/(?<![A-Za-zÅÄÖåäö])[A-ZÅÄÖ][A-Za-zÅÄÖåäö]{0,7}\s+\d{1,6}\/20\d{2}(?![A-Za-zÅÄÖåäö])/g)?.at(-1) || '';
      const expectedDiary = diaryPack.byUrl?.[protocol.url] || '';
      if (extractedDiary !== expectedDiary && source.diaryMismatches.length < 50) source.diaryMismatches.push({ url: protocol.url, expectedDiary, extractedDiary });
      const fullTokenText = tokenText(text), pageTokenText = new Map();
      source.protocols++;
      for (const document of protocol.documents) {
        source.documents++;
        const base = { id: document.i, date: document.dt, body: document.b, url: protocol.url };
        if (compact(document.t).length > 12 && !sourceTextMatches(document.t, fullTokenText)) noteMismatch(source.missingTitles, base);
        if (compact(document.ht).length > 12 && !sourceTextMatches(document.ht, fullTokenText)) noteMismatch(source.missingHeaders, base);
        if (compact(document.ad).length > 30 && !sourceTextMatches(document.ad, fullTokenText)) noteMismatch(source.missingDescriptions, base);
        if (compact(document.bd).length > 20 && !sourceTextMatches(document.bd, fullTokenText)) noteMismatch(source.missingDecisions, base);
        for (const [point, meta] of Object.entries(document.pm || {})) {
          const from = Number(meta.source_page), to = Number(meta.source_page_end || from);
          if (from < 1 || to < from || to > pages.length) {
            noteMismatch(source.invalidPages, { ...base, point, from, to, pageCount: pages.length });
            continue;
          }
          const rangeKey = `${from}-${to}`;
          if (!pageTokenText.has(rangeKey)) pageTokenText.set(rangeKey, tokenText(pages.slice(from - 1, to).join('\n')));
          const pageText = pageTokenText.get(rangeKey);
          const header = compact(document.ht), decision = compact(document.p?.[point]);
          if (header.length > 12 && !sourceTextMatches(document.ht, pageText)) noteMismatch(source.invalidPages, { ...base, point, from, to, reason: 'header not found on declared pages' });
          if (decision.length > 20) {
            source.decisionPointsChecked++;
            if (!sourceTextMatches(document.p?.[point], pageText)) noteMismatch(source.pointTextMismatches, { ...base, point, from, to });
          }
        }
      }
      if ((index + 1) % 50 === 0) console.error(`Validated source text ${index + 1}/${protocols.length}`);
    }
    remote.sourceText = source;
  }
}

const issueObject = Object.fromEntries([...issues.entries()].sort((a, b) => a[0].localeCompare(b[0])));
const report = {
  generatedAt: new Date().toISOString(),
  counts: {
    protocols: protocolByUrl.size,
    documents: pack.d.length,
    rawDecisionPoints: rawDecisionPointCount,
    decisionPointsNotExtracted,
    renderedRows: runtimeRows.length,
    meetingRows,
    voteRows: pack.r.length / 6,
    voteCountConflicts: voteCountConflicts.length,
    positionRows: pack.pr.length / 6,
    attendanceRows: pack.mr.length / 6,
    protocolDiaries: Object.keys(diaryPack.byUrl || {}).length,
    unresolvedProtocolDiaries: (diaryPack.missing || []).length
  },
  issues: issueObject,
  links: linkAudit,
  remote: checkRemote ? remote : undefined
};
console.log(JSON.stringify(report, null, 2));

const hardFailures = [
  'duplicate_or_missing_document_id', 'invalid_document_date', 'document_title_date_mismatch',
  'invalid_source_url', 'non_official_source_url', 'missing_point_metadata',
  'duplicate_decision_point_id', 'runtime_row_invalid_document', 'runtime_field_mismatch',
  'meeting_protocol_diary_mismatch', 'empty_decision_point', 'extraction_boilerplate',
  'named_voter_missing_from_attendance', 'page_boundary_attendance_regression',
  'page_boundary_attendance_fragment', 'page_boundary_attendance_role_regression',
  'page_boundary_attendance_unclassified_role'
].reduce((total, category) => total + (issues.get(category)?.count || 0), 0);
const sourceFailures = checkSourceText && remote.sourceText
  ? remote.sourceText.dateMismatches.length + remote.sourceText.diaryMismatches.length
    + ['missingTitles', 'missingHeaders', 'missingDescriptions', 'missingDecisions', 'pointTextMismatches', 'invalidPages']
      .reduce((total, category) => total + (remote.sourceText[category]?.count || 0), 0)
  : 0;
if (hardFailures || linkAudit.invalidOutput || linkAudit.selfInternal || linkAudit.dates.sameCurrentOtherItem || linkAudit.dates.source || remote.failures.length || sourceFailures) process.exitCode = 1;
