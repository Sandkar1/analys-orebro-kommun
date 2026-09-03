const exportedAt=window.exportedAt;
const programVersion="";
const municipalWorkEnabled=true;
const historicPack=window.historicPack;
let decisionPack=window.municipalProtocolPack,documentPack=window.municipalDocumentPack,decisionPackPromise=null;
const stateFormatVersion=2;
const municipalProtocolDataManifest=window.municipalProtocolDataManifest||{
  version:'20260806-1',
  parts:[{src:'data/municipal-protocol-data-orebro-v2.js'}]
};
const municipalProtocolDataVersion=String(municipalProtocolDataManifest.version||'20260806-1');
const municipalProtocolPackSrcs=(municipalProtocolDataManifest.parts||[]).map(part=>
  `${part.src}?v=${municipalProtocolDataVersion}`
);
const municipalProtocolMetadataCorrections=new Map([
  ['https://www.orebro.se/download/18.e1b4aa019e62f4e33d2509/1780564233224/2026-05-08%20V%C3%A5rd-%20och%20omsorgsn%C3%A4mnden.pdf',{
    date:'2026-05-28',
    documentTitle:'2026-05-28 Vård- och omsorgsnämnden.pdf',
    previousDate:'2026-05-08',
    previousDocumentTitle:'2026-05-08 Vård- och omsorgsnämnden.pdf',
    body:'Vård- och omsorgsnämnden'
  }],
  ['https://www.orebro.se/download/18.2b28073219367d5df31240c/1733219081861/2024-09-16%20Socialn%C3%A4mnden.pdf',{
    date:'2024-09-26',
    documentTitle:'2024-09-26 Socialnämnden.pdf',
    previousDate:'2024-09-16',
    previousDocumentTitle:'2024-09-16 Socialnämnden.pdf',
    body:'Socialnämnden 2023–2024'
  }],
  ['https://www.orebro.se/download/18.37a1a24a18529b6cad52c095/1675699624736/2023-01-22%20Funktionsst%C3%B6dsn%C3%A4mnden.pdf',{
    date:'2023-01-12',
    documentTitle:'2023-01-12 Funktionsstödsnämnden.pdf',
    previousDate:'2023-01-22',
    previousDocumentTitle:'2023-01-22 Funktionsstödsnämnden.pdf',
    body:'Funktionsstödsnämnden'
  }],
  ['https://www.orebro.se/download/18.2eab5f2a1975d40bbca50b2/1750324212229/2024-06-16%20Kultur-%20och%20fritidsn%C3%A4mnden.pdf',{
    date:'2025-06-16',
    documentTitle:'2025-06-16 Kultur- och fritidsnämnden.pdf',
    previousDate:'2024-06-16',
    previousDocumentTitle:'2024-06-16 Kultur- och fritidsnämnden.pdf',
    body:'Kultur- och fritidsnämnden'
  }],
  ['https://www.orebro.se/download/18.51177871193dec95027bef9/1738921660153/2025-02-05%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden%20omedelbart%20justerat%20protokoll%20%C2%A7%2024.pdf',{
    date:'2025-02-06',
    documentTitle:'2025-02-06 Överförmyndarnämnden omedelbart justerat protokoll § 24.pdf',
    previousDate:'2025-02-05',
    previousDocumentTitle:'2025-02-05 Överförmyndarnämnden omedelbart justerat protokoll § 24.pdf',
    body:'Överförmyndarnämnden'
  }],
  ['https://www.orebro.se/download/18.3a8c6b3019eafce305b222/1781094481140/2025-05-25%20F%C3%B6rskolen%C3%A4mnden.pdf',{
    date:'2026-05-25',
    documentTitle:'2026-05-25 Förskolenämnden.pdf',
    previousDate:'2025-05-25',
    previousDocumentTitle:'2025-05-25 Förskolenämnden.pdf',
    body:'Förskolenämnden'
  }]
]);
const municipalProtocolRecordCorrections=new Map([
  ['https://www.orebro.se/download/18.2554fe1a19d24d9b7161500/1775034268527/2026-03-17%20Kommunstyrelsens%20h%C3%A5llbarhetsutskott.pdf',[
    {
      title:'Statusuppföljning av klimatstrategins aktivitetsplan',
      fields:{
        ht:'§ 7 Statusuppföljning av klimatstrategins aktivitetsplan',
        ad:'Kommunstyrelsens hållbarhetsutskott får på sammanträdet information om statusuppföljningen av Klimatstrategins aktivitetsplan.\nFör att få en mer sammanhållen styrning av gemensamma åtgärder tas en aktivitetsplan fram och beslutas årligen, som ett centralt verktyg i genomförandet av strategin. Aktivitetsplanen syftar till att fånga upp de aktiviteter som är koncernövergripande och som kräver gemensam handling eller effekt kopplat till strategin. Beslut om aktivitetsplanen fattas av Kommundirektören efter förankring i klimatstyrgruppen. Den första aktivitetsplanen godkändes av klimatstyrgruppen i mars 2025 och av KDLG i maj 2025. Alla aktiviteter ska integreras i förvaltningars och bolags ordinarie processer.'
      }
    }
  ]],
  ['https://www.orebro.se/download/18.4a0402b219e63064a70f39/1780046601132/2026-05-12%20Kommunstyrelsens%20h%C3%A5llbarhetsutskott.pdf',[
    {
      title:'Revidering av riktlinjer för laddinfrastruktur',
      fields:{
        ht:'§ 9 Revidering av riktlinjer för laddinfrastruktur',
        ad:'Kommundirektören fick den 17 april 2023 i uppdrag av Kommunstyrelsens hållbarhetsutskott att påbörja en revidering av riktlinjerna för laddinfrastruktur. Ett förslag remitterades för synpunkter den 3 oktober 2024. Utifrån inkomna synpunkter har riktlinjerna justerats och ett nytt förslag är nu redo för beslut.\nRiktlinjerna klargör Örebro kommunkoncerns agerande kring nyttjande och etablering av laddinfrastruktur för laddbara fordon. Riktlinjerna anger att kommunkoncernen ska säkerställa en effektiv och användarvänlig utbyggnad av laddinfrastruktur inom fastighetsbeståndet. Laddstationerna ska nyttjas effektivt, med delad användning och en koncerngemensam laddningsplattform som utgångspunkt. Kommunkoncernen ska även främja privata aktörers etablering av laddinfrastruktur.\nRiktlinjerna tydliggör även ansvar och roller inom kommunkoncernen. Bland annat anges att Kumbro Utveckling AB ska fungera som samordnande part och vägleda koncernen i utvecklingen av laddinfrastruktur.',
        bd:'Kommunstyrelsens hållbarhetsutskott beslutar:\n1. Upphäva Riktlinjer för laddinfrastruktur i Örebro kommun, beslutad av Kommunstyrelsens utskott för näringsliv och tillväxt, 18 april 2017, § 26\n2. Anta reviderade riktlinjer för laddinfrastruktur, 2026-04-01\nÄrendet ska vidare till Kommunfullmäktige för beslut.'
      }
    }
  ]],
  ['https://www.orebro.se/download/18.2755e3bf19a767c7ea74457/1764338360735/2025-11-13%20%C3%96verf%C3%B6rmyndarn%C3%A4mnden.pdf',[
    {
      title:'Tillsynsrapport 2025 - Beslut',
      fields:{
        ht:'§ 118 Tillsynsrapport 2025 - Beslut',
        ad:'I kommunallagen anges att nämnderna var och en inom sitt område ska se till att verksamheten bedrivs i enlighet med de mål och riktlinjer som fullmäktige har bestämt samt de föreskrifter som gäller för verksamheten. De ska också se till att den interna kontrollen är tillräcklig samt att verksamheten bedrivs på ett i övrigt tillfredsställande sätt.\nGrunden för den interna kontrollen är det dagliga arbetet som görs i verksamheterna med väl fungerande processer, medvetenhet om de risker som finns och åtgärder för att minska riskerna. Syftet med att planera, genomföra och följa upp de interna processerna i nämnderna är att inom respektive ansvarsområde säkerställa att verksamheten är ändamålsenlig, kostnadseffektiv samt följer tillämpliga lagar och rutiner. Överförmyndarnämnden har för 2025 upprättat en tillsynsplan som anger vilka områden som ska granskas inom ramen för interkontrollen under 2025.\nUnder 2025 har följande tillsyner genomförts:\n1. Beslut om arvoden (V1)\n2. Skanning av årsräkningar (V2)\n3. Anmälan av arbetsskador och tillbud (P)',
        bd:'Överförmyndarnämnden beslutar:\n1. Verksamhetschef får i uppdrag att säkerställa att de rekommenderade åtgärderna i tillsynsrapporten genomförs.\n2. Överförmyndarnämnden godkänner Tillsynsrapport 2025 och överlämnar den till Kommunstyrelsen.'
      }
    }
  ]],
  ['https://www.orebro.se/download/18.6641008c197a1e1ab089cd/1751011978235/2025-06-18%20och%202025-06-19%20Kommunfullm%C3%A4ktige%20%C2%A7%C2%A7%20171%E2%80%93187,%20%C2%A7%C2%A7%20189%E2%80%93210.pdf',[
    {
      title:'Reviderat investeringsprogram för 2025',
      fields:{
        ht:'§ 173 Reviderat investeringsprogram för 2025',
        ad:'2025 års investeringsprogram beslutades i samband med beslut om ÖSB 2025. Under innevarande år finns möjlighet att revidera investeringsprogrammet i juni respektive oktober. Kommunen beslutar då om ett reviderat investeringsprogram innehållande kommunens investeringsutgifter och driftkostnadskonsekvenser av samtliga investeringar i den kommunala verksamheten. Årets revideringar avser både utökning och minskning av investeringsbudgeten samt ombudgetering av redan beslutade medel mellan investeringsområden och nämnderna. Efter revidering uppgår kommunens investeringsbudget till 1 377 mnkr för år 2025, varav 781 mnkr avser skattefinansierade investeringar och 596 mnkr taxefinansierade investeringar.\nDen kommunövergripande lokalförsörjningsplanen för 2025 har reviderats och beräknade driftkostnadskonsekvenser uppgår, för 2025, till 55 mnkr, vilket innebär att driftkostnaderna har minskat med 2 mnkr jämfört med beslut om ÖSB 2025 i oktober.\nKommunstyrelsen hanterade ärendet den 10 juni 2025.',
        bd:'Kommunfullmäktige beslutar:\n1. Det reviderade investeringsprogrammet beslutas i enlighet med förslaget vilket innebär att kommunens totala investeringsutgifter 2025 uppgår till 1 377 mnkr.\n2. Revidering av 2025 års beräknade driftkostnadskonsekvenser till följd av kommunövergripande lokalförsörjningsplan beslutas i enlighet med förslaget och innebär att totala driftkostnadskonsekvenserna uppgår till 55 mnkr för 2025.'
      }
    }
  ]],
  ['https://www.orebro.se/download/18.73ec2f8918f0fbfea2a15c/1713962151029/2024-04-17%20Grundskolen%C3%A4mnden.pdf',[
    {
      title:'Skolinspektionen - Remiss Ansökan från Australian International Schools AB',
      fields:{bd:'Grundskolenämnden beslutar:\n- Ärendet utgår.'},
      points:{'65':'Grundskolenämnden beslutar: - Ärendet utgår.'}
    }
  ]],
  ['https://www.orebro.se/download/18.2b0980de1869c53d5f2b6b/1678109206816/2023-02-28%20F%C3%B6rskolen%C3%A4mnden.pdf',[
    {
      title:'Förvaltningsdirektörens information',
      fields:{bd:'Förskolenämnden beslutar:\n- Informationen läggs till handlingarna.'},
      points:{'23':'Förskolenämnden beslutar: - Informationen läggs till handlingarna.'}
    }
  ]],
  ['https://www.orebro.se/download/18.4e77256e19931d3c76135d8/1758805860661/2025-09-23%20F%C3%B6rskolen%C3%A4mnden.pdf',[
    {
      title:'Protokolljusterare',
      fields:{
        ht:'§ 117 Protokolljusterare',
        ad:'Nämnden utser protokolljusterare. Protokollet ska justeras senast 14 dagar efter nämndsammanträdet.',
        bd:'Förskolenämnden beslutar:\nOrdinarie: Louice Bäckman Johansson (L)\nErsättare: William Hedengren (ÖrP)\nProtokollet ska justeras senast 2025-10-07'
      }
    }
  ]],
  ['https://www.orebro.se/download/18.34f4c6361939015813e4860/1734514122578/2024-12-09%20Kultur-%20och%20fritidsn%C3%A4mnden.pdf',[
    {
      title:'Beslut - Örebroandan',
      fields:{t:'Beredning - Örebroandan'}
    }
  ]],
  ['https://www.orebro.se/download/18.5fbc9a851999e086aac2bd/1759324300930/2025-09-25%20Socialn%C3%A4mnden%20%C2%A7%C2%A7%20123-129,%20131-139.pdf',[
    {
      title:'Anmälan av handlingar',
      fields:{bd:'Socialnämnden beslutar:\n- Anmälan tas till protokollet.'}
    }
  ]]
]);
function applyMunicipalProtocolMetadataCorrections(documents,memberRows){
  for(const document of documents){
    const url=String(document?.u||''),correction=municipalProtocolMetadataCorrections.get(url);
    if(correction){
      document.dt=correction.date;
      document.doc=correction.documentTitle;
    }
    for(const record of municipalProtocolRecordCorrections.get(url)||[]){
      if(String(document?.t||'')!==record.title)continue;
      Object.assign(document,record.fields);
      if(record.points)Object.assign(document.p||={},record.points);
    }
  }
  for(let index=0;index<memberRows.length;index+=6){
    const date=String(memberRows[index]||''),body=String(memberRows[index+1]||''),title=String(memberRows[index+2]||'');
    for(const correction of municipalProtocolMetadataCorrections.values()){
      if(date!==correction.previousDate||body!==correction.body||title!==correction.previousDocumentTitle)continue;
      memberRows[index]=correction.date;
      memberRows[index+2]=correction.documentTitle;
      break;
    }
  }
}
function cleanMunicipalProtocolExtractedText(value){
  return String(value||'')
    .replace(/^[ \t]*\d{1,3}\s*\(\d{1,3}\)[ \t]*$/gm,'')
    .replace(/\bDigitalt (?:signerad|signerat|justerad|justerat)(?: protokoll)?\b/giu,'')
    .replace(/ÖREBRO\s+Protokoll\b/giu,'')
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .replace(/\s{2,}/g,match=>match.includes('\n')?match:' ')
    .trim();
}
function cleanMunicipalProtocolExtractedFields(documents){
  for(const document of documents){
    for(const field of ['ht','ad','bd'])if(document[field])document[field]=cleanMunicipalProtocolExtractedText(document[field]);
    for(const point of Object.keys(document.p||{}))document.p[point]=cleanMunicipalProtocolExtractedText(document.p[point]);
  }
}
function synchronizeMunicipalProtocolTitles(documents){
  for(const document of documents){
    const header=String(document.ht||'').replace(/\s+/g,' ').trim();
    const sourceTitle=header.match(/^§\s*\d{1,4}(?:\.\d+)?\s+(.+)$/u)?.[1]?.trim()||'';
    if(sourceTitle&&!/^[–—-]/u.test(sourceTitle))document.t=sourceTitle;
  }
}
function pruneUnmatchedMunicipalAttendanceRows(documents,memberRows){
  const protocolKeys=new Set(documents.map(document=>`${document.dt}|${document.b}|${document.doc}`));
  let write=0;
  for(let index=0;index<memberRows.length;index+=6){
    const key=`${memberRows[index]}|${memberRows[index+1]}|${memberRows[index+2]}`;
    if(!protocolKeys.has(key))continue;
    for(let offset=0;offset<6;offset++)memberRows[write++]=memberRows[index+offset];
  }
  memberRows.length=write;
}
function municipalAttendanceIdentity(value){
  return String(value||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('sv').replace(/[^a-z0-9åäö]+/giu,' ').trim();
}
function repairMunicipalPageBoundaryAttendance(documents,voteRows,memberRows){
  const protocolKey=document=>[document?.dt,document?.b,document?.doc].map(value=>String(value||'')).join('|');
  const voteNamesByProtocol=new Map();
  for(let index=0;index<voteRows.length;index+=6){
    const document=documents[Number(voteRows[index])],vote=String(voteRows[index+4]||''),name=String(voteRows[index+2]||'').trim(),party=String(voteRows[index+3]||'').trim();
    if(!document||!name||vote==='Frånvarande')continue;
    const key=protocolKey(document),identity=`${municipalAttendanceIdentity(name)}|${municipalAttendanceIdentity(party)}`;
    if(!voteNamesByProtocol.has(key))voteNamesByProtocol.set(key,new Set());
    voteNamesByProtocol.get(key).add(identity);
  }

  /* A continued attendance section can start on a new PDF page without its
     heading. PDF table extraction may then retain only a wrapped surname from
     the replacement column (for example "Muhammed") as a separate member.
     Remove that orphan only when the full same-party name is independently
     verified by a formal vote in the same protocol. */
  const parsed=[];
  for(let index=0;index<memberRows.length;index+=6){
    parsed.push({values:memberRows.slice(index,index+6),key:[memberRows[index],memberRows[index+1],memberRows[index+2]].map(value=>String(value||'')).join('|'),name:String(memberRows[index+3]||'').trim(),party:String(memberRows[index+4]||'').trim()});
  }
  const retained=parsed.filter(row=>{
    const normalizedName=municipalAttendanceIdentity(row.name),normalizedParty=municipalAttendanceIdentity(row.party);
    if(!normalizedName||normalizedName.includes(' '))return true;
    const duplicate=parsed.find(candidate=>candidate!==row&&candidate.key===row.key&&municipalAttendanceIdentity(candidate.party)===normalizedParty&&municipalAttendanceIdentity(candidate.name).endsWith(` ${normalizedName}`));
    if(!duplicate)return true;
    const verified=voteNamesByProtocol.get(row.key);
    return !verified?.has(`${municipalAttendanceIdentity(duplicate.name)}|${normalizedParty}`)||verified.has(`${normalizedName}|${normalizedParty}`);
  });
  memberRows.length=0;
  for(const row of retained)memberRows.push(...row.values);

  /* A named Ja/Nej/Avstår ballot is conclusive attendance evidence. Reconcile
     it with the protocol list so a lost page-continuation can never produce an
     attendance count below the named voters. Diacritics are ignored solely
     for identity matching; the source spelling already present is retained. */
  const identitiesByProtocol=new Map();
  for(let index=0;index<memberRows.length;index+=6){
    const key=[memberRows[index],memberRows[index+1],memberRows[index+2]].map(value=>String(value||'')).join('|');
    if(!identitiesByProtocol.has(key))identitiesByProtocol.set(key,new Set());
    identitiesByProtocol.get(key).add(`${municipalAttendanceIdentity(memberRows[index+3])}|${municipalAttendanceIdentity(memberRows[index+4])}`);
  }
  for(let index=0;index<voteRows.length;index+=6){
    const document=documents[Number(voteRows[index])],vote=String(voteRows[index+4]||''),name=String(voteRows[index+2]||'').trim(),party=String(voteRows[index+3]||'').trim();
    if(!document||!name||vote==='Frånvarande')continue;
    const key=protocolKey(document),identity=`${municipalAttendanceIdentity(name)}|${municipalAttendanceIdentity(party)}`;
    if(!identitiesByProtocol.has(key))identitiesByProtocol.set(key,new Set());
    if(identitiesByProtocol.get(key).has(identity))continue;
    memberRows.push(String(document.dt||''),String(document.b||''),String(document.doc||''),name,party,'närvaro verifierad genom votering');
    identitiesByProtocol.get(key).add(identity);
  }
}
function applyMunicipalAttendanceSourceRoleCorrections(memberRows){
  /* In the 2024-05-14 Kommunfullmäktige protocol, "Närvarande
     ledamöter" continues onto page 2 without repeating its heading. These
     twenty names were restored from the named roll call above; the source PDF
     establishes that their role is ledamot, not an unspecified vote-derived
     attendance role. Keep the correction source-specific and name-specific. */
  const protocolKey='2024-05-14|Kommunfullmäktige|2024-05-14 Kommunfullmäktige.pdf';
  const continuedCouncillors=new Set([
    'Carola Sunesson','Daniel Spiik','Bo Ammer','David Larsson','Sunil Jayasooriya',
    'Jaber Fawaz','Cristian Rehn Janowicz','Elisabeth Nilesol','Karolina Wallström',
    'Patrik Jämtvall','Willhelm Sundman','Johanna Reimfelt','Mats-Olof Liljegren',
    'Markus Allard','Peter Springare','Anna Lundberg','Tuomo Jänkälä',
    'Susanne Lindholm Henningsson','Anna Andersson','Lea Strandberg'
  ].map(municipalAttendanceIdentity));
  for(let index=0;index<memberRows.length;index+=6){
    const key=[memberRows[index],memberRows[index+1],memberRows[index+2]].map(value=>String(value||'')).join('|');
    if(key!==protocolKey||!continuedCouncillors.has(municipalAttendanceIdentity(memberRows[index+3])))continue;
    memberRows[index+5]='ledamot';
  }
}
function disambiguateMunicipalProtocolDocumentIds(documents){
  const seen=new Set();
  for(let index=0;index<documents.length;index++){
    const document=documents[index],base=String(document?.i||`d${index}`);
    if(!seen.has(base)){
      document.i=base;
      seen.add(base);
      continue;
    }
    let candidate=`${base}__source_${index}`;
    while(seen.has(candidate))candidate+='_';
    document.i=candidate;
    seen.add(candidate);
  }
}
function disambiguateMunicipalDecisionPointIds(documents){
  const seen=new Set();
  for(let docIndex=0;docIndex<documents.length;docIndex++){
    const metadata=documents[docIndex]?.pm||{};
    for(const [point,meta] of Object.entries(metadata)){
      const base=String(meta?.decision_point_id||'');
      if(!base)continue;
      if(!seen.has(base)){
        seen.add(base);
        continue;
      }
      let candidate=`${base}__source_${docIndex}_${String(point).replace(/[^a-z0-9]+/gi,'_')}`;
      while(seen.has(candidate))candidate+='_';
      meta.decision_point_id=candidate;
      seen.add(candidate);
    }
  }
}
function repairMunicipalVoteEvents(documents,voteRows){
  const url='https://www.orebro.se/download/18.2e67cb6418d8264e57615e/1707302972197/2024-01-25%20Socialn%C3%A4mnden.pdf';
  const docIndex=documents.findIndex(document=>String(document?.u||'')===url&&String(document?.t||'')==='Tillägg av ärende i delegationsordningen för Socialnämnden');
  if(docIndex<0)return;
  const document=documents[docIndex],firstId='vote_case_body_socialnamnden_2023_2024_2024_01_25_9_1',secondId=`${firstId}_round_2`;
  let secondRound=false;
  for(let index=0;index<voteRows.length;index+=6){
    if(Number(voteRows[index])!==docIndex||String(voteRows[index+1])!=='9'||!String(voteRows[index+5]||'').startsWith(`${firstId}:`))continue;
    if(String(voteRows[index+2])==='Carina Toro Hartman'&&String(voteRows[index+4])==='Ja')secondRound=true;
    if(secondRound)voteRows[index+5]=String(voteRows[index+5]).replace(`${firstId}:`,`${secondId}:`);
  }
  const original=document.ve?.[firstId]||{};
  document.ve[firstId]={...original,points:['9'],stated_yes:1,stated_no:3,stated_abstain:13,stated_absent:0};
  document.ve[secondId]={
    ...original,
    points:['9'],
    yes_meaning:'bifall till Socialförvaltningens förslag',
    no_meaning:'bifall till Pär Ljungvalls (SD) yrkande',
    stated_yes:12,stated_no:3,stated_abstain:2,stated_absent:0
  };
  document.v['9']=`${firstId},${secondId}`;
  Object.assign(document.pm?.['9']||{}, {stated_yes:13,stated_no:6,stated_abstain:15,stated_absent:0});
  voteRows.push(docIndex,'9','Ewa Lindén','V','Avstår',`${secondId}:source_repair_ewa_linden`);
}
function repairMunicipalTruncatedVoteMeanings(documents){
  const suspiciousEnding=/(?:\bm|\bm\.f|\bm\.fl|\b(?:och|samt|till|mot|respektive))$/iu;
  const escapeRegExp=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  for(const document of documents){
    const sourceText=[document.pd,document.yd,document.vd].filter(Boolean).join('\n').replace(/\s+/g,' ').trim();
    if(!sourceText)continue;
    for(const event of Object.values(document.ve||{})){
      for(const field of ['yes_meaning','no_meaning']){
        const meaning=String(event?.[field]||'').replace(/\s+/g,' ').trim();
        if(!suspiciousEnding.test(meaning))continue;
        const prefix=meaning.match(/^((?:bifall|avslag)\s+till\s+)/iu)?.[1]||'';
        const stem=meaning.slice(prefix.length).replace(/\s+m(?:\.f(?:l)?)?$/iu,'').trim();
        if(stem.length<8)continue;
        const sentenceBoundary='(?:Ordförand|Kommun|Nämnden|Styrelsen|Utskottet|Därefter|Beslut|Reservation|Proposition|Votering)';
        const match=sourceText.match(new RegExp(`${escapeRegExp(stem)}(.+?)(?=\\.\\s+${sentenceBoundary}|$)`,'iu'));
        if(!match)continue;
        const repaired=`${prefix}${stem}${match[1]}`.replace(/\s+/g,' ').replace(/[.;:,]+$/u,'').trim();
        if(repaired.length>meaning.length)event[field]=repaired;
      }
    }
  }
}
function markMunicipalVoteCountConflicts(documents,voteRows){
  const counts=new Map();
  for(let index=0;index<voteRows.length;index+=6){
    const docIndex=Number(voteRows[index]),point=String(voteRows[index+1]||''),vote=String(voteRows[index+4]||''),participant=String(voteRows[index+5]||'');
    const eventId=participant.includes(':')?participant.split(':').slice(0,-1).join(':'):participant;
    const key=`${docIndex}|${point}|${eventId}`;
    if(!counts.has(key))counts.set(key,{docIndex,eventId,Ja:0,Nej:0,'Avstår':0,'Frånvarande':0});
    const count=counts.get(key);
    if(Object.hasOwn(count,vote))count[vote]++;
  }
  const fields=[['Ja','stated_yes'],['Nej','stated_no'],['Avstår','stated_abstain'],['Frånvarande','stated_absent']];
  for(const count of counts.values()){
    const event=documents[count.docIndex]?.ve?.[count.eventId];
    if(!event)continue;
    const conflict=fields.some(([vote,field])=>Object.hasOwn(event,field)&&count[vote]>(Number(event[field])||0));
    if(!conflict)continue;
    event.count_conflict=true;
    for(const [vote,field] of fields)event[`source_${field}`]=Number(event[field])||0;
    const namedTotal=fields.reduce((total,[vote])=>total+count[vote],0);
    const statedTotal=fields.reduce((total,[,field])=>total+(Number(event[field])||0),0);
    if(namedTotal!==statedTotal)continue;
    event.count_reconciled_from_named_list=true;
    for(const [vote,field] of fields)event[field]=count[vote];
    const document=documents[count.docIndex];
    for(const point of event.points||[]){
      const eventIds=String(document.v?.[point]||'').split(',').map(value=>value.trim()).filter(Boolean);
      if(eventIds.length!==1||eventIds[0]!==count.eventId)continue;
      for(const [vote,field] of fields)if(document.pm?.[point])document.pm[point][field]=count[vote];
    }
  }
}
async function decodeHistoricPackText(value){if(typeof DecompressionStream!=='function')throw Error('Den komprimerade historikdatan kräver stöd för DecompressionStream.');const bin=atob(String(value||'').replace(/\s+/g,''));const bytes=Uint8Array.from(bin,ch=>ch.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));const out=await new Response(stream).arrayBuffer();return new TextDecoder().decode(out);}
async function inflateHistoricData(p){if(typeof p==='string'){const json=await decodeHistoricPackText(p.startsWith('gz:')?p.slice(3):p);p=JSON.parse(json);}else if(p&&typeof p==='object'&&p.f==='gz'&&typeof p.d==='string'){const json=await decodeHistoricPackText(p.d);p=JSON.parse(json);}const sc=new Set(p.sc||[]);return {schema_version:p.v,columns:p.c,rows:p.r.map(a=>{const o={};for(let i=0;i<p.c.length;i++){const v=a[i];o[p.c[i]]=sc.has(i)&&v!==null?p.s[v]:v;}return o;})};}
function loadScriptOnce(src){return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(s=>s.getAttribute('src')===src);if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}const script=document.createElement('script');script.src=src;script.defer=true;script.onload=resolve;script.onerror=()=>reject(Error(`Kunde inte ladda ${src}`));document.head.appendChild(script);});}
function assembleMunicipalProtocolPackParts(){
  const parts=window.municipalProtocolPackParts||{},ordered=Object.keys(parts).map(Number).filter(Number.isFinite).sort((a,b)=>a-b).map(key=>parts[key]),part1=ordered[0];
  if(!part1)return null;
  const documents=ordered.flatMap(part=>part.d||[]),voteRows=ordered.flatMap(part=>part.r||[]),positionRows=ordered.flatMap(part=>part.pr||[]),memberRows=ordered.flatMap(part=>part.mr||[]);
  applyMunicipalProtocolMetadataCorrections(documents,memberRows);
  cleanMunicipalProtocolExtractedFields(documents);
  synchronizeMunicipalProtocolTitles(documents);
  pruneUnmatchedMunicipalAttendanceRows(documents,memberRows);
  repairMunicipalPageBoundaryAttendance(documents,voteRows,memberRows);
  applyMunicipalAttendanceSourceRoleCorrections(memberRows);
  disambiguateMunicipalProtocolDocumentIds(documents);
  disambiguateMunicipalDecisionPointIds(documents);
  repairMunicipalVoteEvents(documents,voteRows);
  repairMunicipalTruncatedVoteMeanings(documents);
  markMunicipalVoteCountConflicts(documents,voteRows);
  return window.municipalProtocolPack={...part1,d:documents,r:voteRows,pr:positionRows,mr:memberRows};
}
async function ensureDecisionPackLoaded(){if(!municipalWorkEnabled)throw Error('Kommunvyn är avstängd.');if(decisionPack?.d?.length)return decisionPack;if(window.municipalProtocolPack?.d?.length&&window.municipalProtocolPack!==decisionPack){decisionPack=window.municipalProtocolPack;return decisionPack;}const assembled=assembleMunicipalProtocolPackParts();if(assembled?.d?.length){decisionPack=assembled;return decisionPack;}if(!decisionPackPromise)decisionPackPromise=Promise.all(municipalProtocolPackSrcs.map(loadScriptOnce)).then(()=>{decisionPack=assembleMunicipalProtocolPackParts()||window.municipalProtocolPack;if(!decisionPack?.d?.length)throw Error('Kommundatan kunde inte läsas in.');return decisionPack;});return decisionPackPromise;}

const tableSearchJobs=new Map();
const prefersReducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
function animateUiRegion(target){
  const element=typeof target==='string'?$(target):target;
  if(!element||prefersReducedMotion?.matches)return;
  element.classList.remove('content-entering');
  void element.offsetWidth;
  element.classList.add('content-entering');
  element.addEventListener('animationend',()=>element.classList.remove('content-entering'),{once:true});
}
function setUiRegionBusy(target,busy){
  const element=typeof target==='string'?$(target):target;
  if(!element)return;
  element.classList.toggle('is-view-loading',busy);
  element.setAttribute('aria-busy',busy?'true':'false');
}
function setTableSearchBusy(inputId,tableIds,busy){
  const input=$(inputId),box=input?.closest('.decision-search-box,.table-search-box');
  if(box)box.classList.toggle('is-searching',busy);
  if(input)input.setAttribute('aria-busy',busy?'true':'false');
  tableIds.forEach(id=>$(id)?.closest('.raw-table-wrap')?.classList.toggle('table-results-updating',busy));
}
function scheduleTableSearch(key,inputId,tableIds,render){
  const previous=tableSearchJobs.get(key);
  if(previous){
    previous.cancelled=true;
    cancelAnimationFrame(previous.frame);
  }
  setTableSearchBusy(inputId,tableIds,true);
  const job={cancelled:false,frame:0};
  job.frame=requestAnimationFrame(()=>{
    if(job.cancelled)return;
    job.frame=requestAnimationFrame(()=>{
      if(job.cancelled)return;
      tableSearchJobs.delete(key);
      render();
      requestAnimationFrame(()=>{
        if(job.cancelled)return;
        setTableSearchBusy(inputId,tableIds,false);
        tableIds.forEach(id=>{
          const wrap=$(id)?.closest('.raw-table-wrap');
          if(!wrap)return;
          wrap.classList.remove('table-results-refreshed');
          void wrap.offsetWidth;
          wrap.classList.add('table-results-refreshed');
        });
      });
    });
  });
  tableSearchJobs.set(key,job);
}

function fuzzySearchNormalize(value){
  return String(value??'').toLocaleLowerCase('sv-SE').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9åäö]+/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function fuzzySearchDistanceWithin(a,b,max){
  if(Math.abs(a.length-b.length)>max)return false;
  const previous=Array(b.length+1).fill(0).map((_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let left=i,diag=i-1,rowMin=left;
    for(let j=1;j<=b.length;j++){
      const up=previous[j]+1;
      const ins=left+1;
      const sub=diag+(a[i-1]===b[j-1]?0:1);
      diag=previous[j];
      left=Math.min(up,ins,sub);
      previous[j]=left;
      if(left<rowMin)rowMin=left;
    }
    if(rowMin>max)return false;
  }
  return previous[b.length]<=max;
}
function fuzzySearchTokenMatches(queryToken,textToken){
  if(textToken.includes(queryToken))return true;
  if(queryToken.length<4||textToken.length<4)return false;
  if(queryToken.length>=6&&textToken.length>=6){
    const stem=Math.min(queryToken.length,textToken.length)>=10?6:5;
    if(queryToken.slice(0,stem)===textToken.slice(0,stem))return true;
  }
  const max=queryToken.length>=8?2:1;
  if(Math.abs(queryToken.length-textToken.length)>max)return false;
  if(queryToken[0]!==textToken[0]&&queryToken[queryToken.length-1]!==textToken[textToken.length-1])return false;
  return fuzzySearchDistanceWithin(queryToken,textToken,max);
}
function fuzzySearchTextMatches(text,query){
  const q=fuzzySearchNormalize(query);
  if(!q)return true;
  const t=fuzzySearchNormalize(text);
  if(t.includes(q))return true;
  const queryTokens=q.split(' ').filter(token=>token.length>=3);
  if(!queryTokens.length||queryTokens.length>6)return false;
  const textTokens=[...new Set(t.split(' ').filter(token=>token.length>=3))];
  return queryTokens.every(queryToken=>textTokens.some(textToken=>fuzzySearchTokenMatches(queryToken,textToken)));
}

function fuzzySearchFieldScore(text,query){
  const q=fuzzySearchNormalize(query),t=fuzzySearchNormalize(text);
  if(!q||!t)return 0;
  if(t===q)return 1000;
  const queryTokens=q.split(' ').filter(Boolean);
  if(!queryTokens.length||queryTokens.length>6)return t.includes(q)?700:0;
  const textTokens=[...new Set(t.split(' ').filter(Boolean))];
  const phraseIndex=t.indexOf(q);
  let score=phraseIndex===0?900:phraseIndex>0?Math.max(620,780-Math.min(phraseIndex,160)):0;
  let tokenScore=0;
  for(const queryToken of queryTokens){
    let best=0;
    for(const textToken of textTokens){
      if(textToken===queryToken)best=Math.max(best,180);
      else if(textToken.startsWith(queryToken))best=Math.max(best,155);
      else if(queryToken.length>=5&&queryToken.startsWith(textToken)&&queryToken.length-textToken.length<=2)best=Math.max(best,125);
      else if(queryToken.length>=4&&textToken.length>=4&&Math.abs(queryToken.length-textToken.length)<=(queryToken.length>=8?2:1)&&fuzzySearchDistanceWithin(queryToken,textToken,queryToken.length>=8?2:1))best=Math.max(best,105);
      else if(fuzzySearchTokenMatches(queryToken,textToken))best=Math.max(best,55);
    }
    if(!best)return score;
    tokenScore+=best;
  }
  return Math.max(score,220+tokenScore);
}

function fuzzySearchWeightedScore(query,fields){
  let best=0,support=0;
  (fields||[]).forEach(field=>{
    const value=Array.isArray(field)?field[0]:field;
    const weight=Array.isArray(field)?Number(field[1])||1:1;
    const weighted=fuzzySearchFieldScore(value,query)*weight;
    if(weighted>best){support+=best;best=weighted;}
    else support+=weighted;
  });
  return best+Math.min(support*.08,250);
}


