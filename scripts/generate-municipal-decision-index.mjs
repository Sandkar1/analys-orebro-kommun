import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argumentValue = name => {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : '';
};
const outputDirectory = path.resolve(argumentValue('--output-dir') || path.join(root, 'data'));
const protocolManifestPath = path.resolve(argumentValue('--protocol-manifest') || path.join(root, 'data', 'municipal-protocol-data-manifest.js'));
const diaryInputPath = path.resolve(argumentValue('--diary-file') || path.join(root, 'data', 'municipal-protocol-diary-data.js'));
const outputPath = path.join(outputDirectory, 'municipal-decision-table-index.ndjson.gz');
const bootstrapOutputPath = path.join(outputDirectory, 'municipal-decision-table-bootstrap.js');
const meetingDetailsOutputPath = path.join(outputDirectory, 'municipal-decision-meeting-details.js');
const partsOutputDirectory = path.join(outputDirectory, 'municipal-decision-table-index-parts');
const indexVersion = argumentValue('--version') || '20260807-1';
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
const assignedJson = (file, marker) => {
  const text = fs.readFileSync(file, 'utf8'), markerIndex = text.indexOf(marker);
  if(markerIndex < 0)throw Error(`Invalid assigned JSON file: ${file}`);
  let json = text.slice(markerIndex + marker.length).trim();
  if(json.endsWith(';'))json = json.slice(0, -1);
  return JSON.parse(json);
};
const manifest = assignedJson(protocolManifestPath, 'window.municipalProtocolDataManifest=');
const protocolInputPaths = (manifest.parts || []).map((part, index) => {
  const source = String(part.src || '');
  const candidate = argumentValue('--protocol-manifest')
    ? path.join(path.dirname(protocolManifestPath), path.basename(source))
    : path.resolve(root, source);
  if(!fs.existsSync(candidate))throw Error(`Protocol data part ${index + 1} is missing: ${candidate}`);
  return candidate;
});
for (const absolute of [
  ...protocolInputPaths,
  diaryInputPath,
  path.join(root, 'js/app-core.js'),
  path.join(root, 'js/municipal-protocols-tab.js'),
  path.join(root, 'js/search-performance.js'),
  path.join(root, 'js/municipal-documents-tab.js')
]) vm.runInContext(fs.readFileSync(absolute, 'utf8'), context, { filename: path.relative(root, absolute) });

vm.runInContext('decisionPack=assembleMunicipalProtocolPackParts(); ensureDecisionData();', context);
const rows = vm.runInContext('decisionAllPointRows', context);
const diaryByUrl = context.window.municipalProtocolDiaryPack?.byUrl || {};
const documents = vm.runInContext('decisionPack.d', context);
const proposalKeys = vm.runInContext('decisionAllPointRows.map(decisionProposalKey)', context);
const filterOptions = vm.runInContext(`
  (()=>{
    const participantRows=[...decisionRows,...decisionPositionRows];
    const parties=uniqueDecisionValues([...participantRows.map(row=>row.party),...decisionMemberRows.map(row=>row.party)].filter(Boolean));
    const members=uniqueDecisionValues([
      ...participantRows.map(row=>decisionMemberKey(row.name,row.party,row.body)),
      ...decisionMemberRows.map(row=>row.memberKey||decisionMemberKey(row.name,row.party,row.body))
    ].filter(Boolean));
    const presentVotes=new Set(decisionRows.map(row=>row.vote).filter(Boolean));
    return {
      dates:uniqueDecisionValues(decisionAllPointRows.map(row=>row.date).filter(Boolean)),
      organs:uniqueDecisionOrganValues(decisionAllPointRows.map(row=>row.body).filter(Boolean)),
      types:uniqueDecisionValues(decisionAllPointRows.map(row=>row.proposalType).filter(Boolean)),
      parties,
      members,
      votes:['Ja','Nej','Avst\u00e5r','Fr\u00e5nvarande'].filter(value=>presentVotes.has(value)),
      results:decisionResultFilterValues(decisionAllPointRows)
    };
  })()
`, context);

/* A table row is clickable as soon as it reaches the browser. Generate its
   complete, unfiltered item view at the same boundary so opening one row never
   has to download and prepare the full municipal protocol pack first. */
const fastDetailBundle = vm.runInContext(`
  (()=>{
    const decisionsById=new Map(decisionDecisionRows.map(row=>[String(row.id||''),row]));
    const voteRowsByPoint=new Map();
    for(const voteRow of decisionRows){
      const key=String(voteRow.id||'')+'|'+String(voteRow.point||'');
      if(!voteRowsByPoint.has(key))voteRowsByPoint.set(key,[]);
      voteRowsByPoint.get(key).push(voteRow);
    }
    const meetingsByProtocol=new Map(decisionAllPointRows.filter(row=>row.isMeeting).map(row=>[row.meetingKey,row]));
    const attendanceByKey=new Map();
    const attendanceHtml=row=>{
      const key=String(row?.attendanceKey||row?.meetingKey||'');
      if(!attendanceByKey.has(key))attendanceByKey.set(key,decisionAttendancePanelHtmlFinal(row));
      return attendanceByKey.get(key)||'';
    };
    const meetingFor=row=>meetingsByProtocol.get(decisionMeetingProtocolKey(row))||meetingsByProtocol.get(decisionMeetingKey(row?.date,row?.body))||null;
    const meetingDetailCache=new Map();
    const meetingDetail=meeting=>{
      if(!meeting)return null;
      const key=decisionProposalKey(meeting);
      if(meetingDetailCache.has(key))return meetingDetailCache.get(key);
      const source=decisionProtocolFirstPageUrlFinal(meeting),protocolDiary=decisionProtocolDiaryNumberFinal(meeting);
      const meetingAttendance=attendanceHtml(meeting);
      const result={
        row:{
          id:meeting.id,point:meeting.point,date:meeting.date,title:meeting.title,pointTitle:meeting.pointTitle,
          protocolHeader:meeting.protocolHeader,body:meeting.body,documentTitle:meeting.documentTitle,
          diary:meeting.diary,protocolDiary,proposalType:meeting.proposalType,result:meeting.result,
          sourceUrl:meeting.sourceUrl,url:meeting.url,localPath:meeting.localPath,docIndex:meeting.docIndex,
          meetingKey:meeting.meetingKey,meetingDecisionCount:meeting.meetingDecisionCount,
          meetingMatterCount:meeting.meetingMatterCount,isMeeting:true
        },
        detail:{
          isMeeting:true,
          title:'Sammantr\u00e4de \u00b7 '+String(meeting.body||'')+' \u00b7 '+String(meeting.date||''),
          metaText:[meeting.documentTitle||'Protokoll',protocolDiary].filter(Boolean).join(' \u00b7 '),
          sourceUrl:source,
          sourceLabel:'\u00d6ppna hela protokollet',
          overviewHtml:
            '<div class="decision-hierarchy"><div class="decision-hierarchy-item primary"><span>Sammantr\u00e4de</span><strong>'+esc(meeting.body)+'</strong><small>'+esc(meeting.date)+'</small></div></div>'+
            '<div class="card"><span>Beslutspunkter</span><b>'+esc(fmtInt(meeting.meetingDecisionCount||0))+'</b></div>'+
            '<div class="card"><span>\u00c4renden</span><b>'+esc(fmtInt(meeting.meetingMatterCount||0))+'</b></div>',
          status:'Hela protokollet. '+fmtInt(meeting.meetingDecisionCount||0)+' beslutspunkter har registrerats f\u00f6r sammantr\u00e4det.',
          groupsHtml:
            '<article class="decision-point-card meeting-protocol-card"><h3>Protokoll</h3><p>'+esc(meeting.documentTitle||'Hela protokollet f\u00f6r sammantr\u00e4det.')+'</p>'+
            (source?'<a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">\u00d6ppna hela protokollet</a>':'')+'</article>'+meetingAttendance
        },
        attendanceHtml:meetingAttendance
      };
      meetingDetailCache.set(key,result);
      return result;
    };
    const details=decisionAllPointRows.map(sourceRow=>{
      const proposal=decisionHydrateTextFieldsFinal(sourceRow);
      if(proposal.isMeeting)return meetingDetail(proposal).detail;
      const proposalKey=decisionProposalKey(proposal);
      const proposalData=decisionProposalTabData(proposal);
      const tab={kind:'decision',id:proposal.id,...proposalData,proposalKey};
      const decision=decisionsById.get(String(proposal.id||''))||{id:proposal.id,date:proposal.date,title:proposal.title,url:proposal.url};
      const detailRows=voteRowsByPoint.get(String(proposal.id||'')+'|'+String(proposal.point||''))||[];
      const pointGroups=decisionPointPartyGroups(detailRows,proposal);
      const textHtml=decisionDetailTextHtml(proposal);
      const voteHtml=pointGroups.length
        ?pointGroups.map((group,index)=>decisionPointPartyHtmlCanonicalFinal(group,index,pointGroups.length,proposal)).join('')
        :'<div class="decision-vote-panel">Denna beslutspunkt saknar formell votering.</div>';
      const extractionNotice=proposal.extractionStatus==='decision_not_extracted'
        ?'<article class="decision-point-card decision-extraction-notice"><h3>Beslut</h3><p>Ingen formell beslutsrubrik kunde extraheras ur k\u00e4llprotokollet. \u00c4rendet visas \u00e4nd\u00e5 med sin k\u00e4lla och \u00f6vriga protokolluppgifter.</p></article>'
        :'';
      const descriptionUnavailable=!String(proposal.abstractText||proposal.description||'').trim();
      const textContent=(descriptionUnavailable?decisionDetailUnavailableTextFinal():'')+textHtml;
      const meeting=meetingFor(proposal);
      return {
        isMeeting:false,
        title:proposal.protocolHeader||proposal.pointTitle||proposal.title||'\u00c4rende',
        metaText:[proposal.body,decision.date,proposal.diary].filter(Boolean).join(' \u00b7 '),
        sourceUrl:decisionAnchoredSourceUrl(proposal,decision.url),
        sourceLabel:'\u00d6ppna k\u00e4llan',
        overviewHtml:decisionDetailHierarchyHtml(decision,proposal,tab)+decisionDetailCanonicalSummaryCardsFinal(detailRows,proposal),
        status:decisionDetailCanonicalStatusFinal(detailRows,proposal),
        groupsHtml:extractionNotice+(textContent||decisionDetailUnavailableTextFinal())+voteHtml,
        meetingKey:meeting?decisionProposalKey(meeting):''
      };
    });
    return {details,meetings:Object.fromEntries(meetingDetailCache)};
  })()
`, context);
const fastDetails = fastDetailBundle.details;
const fastMeetingDetails = fastDetailBundle.meetings;

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
  'meetingMatterCount', 'documentKey', 'attendanceKey', 'sourcePage', 'sourcePageEnd',
  'fastDetail'
];
const proposalPartByKey = new Map(proposalKeys.map((key,index)=>[key,Math.floor(index/partRowCount)+1]));
const annotateDetailTargets = detail => {
  if(!detail)return detail;
  const annotate = html => String(html||'').replace(/data-proposal-key="([^"]+)"/g,(match,key)=>{
    const part=proposalPartByKey.get(key);
    return part?`${match} data-index-part="${part}"`:match;
  });
  detail.groupsHtml=annotate(detail.groupsHtml);
  return detail;
};
const cleanRow = (row,index) => {
  const output = {};
  for (const field of keepFields) {
    const value = field==='fastDetail'?annotateDetailTargets(fastDetails[index]):row[field];
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
const bootstrapMeetingKeys = new Set(cleanRows.slice(0,bootstrapRowCount).map(row=>row.fastDetail?.meetingKey).filter(Boolean));
const bootstrapMeetingDetails = Object.fromEntries(Object.entries(fastMeetingDetails).filter(([key])=>bootstrapMeetingKeys.has(key)));
const lines = [JSON.stringify({ type: 'meta', version: indexVersion, total: rows.length, meetings: fastMeetingDetails }), ...cleanRows.map(JSON.stringify)];
const ndjson = `${lines.join('\n')}\n`;
fs.mkdirSync(outputDirectory, { recursive: true });
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
    `window.municipalDecisionTableIndexCompressedParts=window.municipalDecisionTableIndexCompressedParts||{};window.municipalDecisionTableIndexCompressedParts[${part + 1}]=${JSON.stringify(gzipSync(Buffer.from(JSON.stringify(compactRows)),{level:9}).toString('base64'))};\n`
  );
}
fs.writeFileSync(
  bootstrapOutputPath,
  `window.municipalDecisionTableBootstrap=${JSON.stringify({ version: indexVersion, total: rows.length, partCount, fields: keepFields, filterOptions, meetings: bootstrapMeetingDetails, rows: cleanRows.slice(0, bootstrapRowCount) })};\n`
);
fs.writeFileSync(
  meetingDetailsOutputPath,
  `window.municipalDecisionMeetingDetailsCompressed=${JSON.stringify(gzipSync(Buffer.from(JSON.stringify(fastMeetingDetails)),{level:9}).toString('base64'))};\n`
);
console.log(JSON.stringify({
  output: path.relative(root, outputPath),
  bootstrapOutput: path.relative(root, bootstrapOutputPath),
  meetingDetailsOutput: path.relative(root, meetingDetailsOutputPath),
  partsOutputDirectory: path.relative(root, partsOutputDirectory),
  partCount,
  rows: rows.length,
  bytes: fs.statSync(outputPath).size,
  bootstrapBytes: fs.statSync(bootstrapOutputPath).size,
  meetingDetailsBytes: fs.statSync(meetingDetailsOutputPath).size
}));
