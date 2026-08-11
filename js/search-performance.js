/* Final search overrides, loaded after the feature modules. */
const decisionPointSearchScoreCacheFinal=new WeakMap();
function decisionPointSearchRelevanceFinal(row,query=decisionSearchQuery){
  const q=decisionSearchNormalizeFinal(query);
  if(!q)return 0;
  const cached=decisionPointSearchScoreCacheFinal.get(row);
  if(cached?.query===q)return cached.score;
  const matterTitle=row?.isMeeting
    ?[row.title,row.protocolHeader,row.documentTitle].join(' ')
    :[
      typeof decisionMainMatterLabelFinal==='function'?decisionMainMatterLabelFinal(row):'',
      row.protocolHeader,row.pointTitle,row.title,row.documentTitle
    ].join(' ');
  const meetingText=row?.isMeeting&&typeof decisionMeetingSearchTextOnDemandFinal==='function'
    ?decisionMeetingSearchTextOnDemandFinal(row)
    :row.meetingSearchText;
  const score=fuzzySearchWeightedScore(q,[
    [matterTitle,12],
    [[row.point,row.diary,row.caseNumber].join(' '),7],
    [[row.body,row.result,row.proposalType].join(' '),4],
    [[row.description,row.abstractText].join(' '),2.5],
    [row.fullDecisionText,1.5],
    [meetingText,row?.isMeeting?1:1.5]
  ]);
  decisionPointSearchScoreCacheFinal.set(row,{query:q,score});
  return score;
}

decisionPointSearchMatches=function(row){
  const q=decisionSearchNormalizeFinal(decisionSearchQuery);
  if(!q)return true;
  if(row?.isMeeting&&typeof decisionMeetingSearchTextOnDemandFinal==='function'){
    const text=decisionMeetingSearchTextOnDemandFinal(row);
    return typeof fuzzySearchTextMatches==='function'?fuzzySearchTextMatches(text,q):text.includes(q);
  }
  let text=decisionPointSearchIndex.get(row);
  if(text===undefined){
    text=decisionSearchNormalizeFinal([
      row.title,row.point,row.description,row.body,row.diary,row.caseNumber,row.documentTitle,
      row.protocolHeader,row.abstractText,row.fullDecisionText,row.result,row.proposalType,row.meetingSearchText
    ].join(' '));
    decisionPointSearchIndex.set(row,text);
  }
  return fuzzySearchTextMatches(text,q);
};

function decisionReadableTextBlocks(value){
  const text=String(value||'').replace(/\r\n?/g,'\n').trim();
  if(!text)return [];
  const blocks=[];
  text.split(/\n{2,}/).map(block=>block.trim()).filter(Boolean).forEach(block=>{
    const lines=block.split(/\n+/).map(line=>line.trim()).filter(Boolean);
    if(lines.length>1){lines.forEach(line=>blocks.push(line));return;}
    const sentences=block.split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ0-9])/).map(line=>line.trim()).filter(Boolean);
    if(sentences.length>1&&block.length>420)sentences.forEach(sentence=>blocks.push(sentence));
    else blocks.push(block);
  });
  return blocks;
}

function decisionReadableBlockHtml(block,current){
  const numbered=block.match(/^(\d{1,2}[.)])\s+(.+)$/s);
  const bullet=block.match(/^[-–•]\s+(.+)$/s);
  const marker=numbered?.[1]||(bullet?'•':'');
  const content=numbered?.[2]||bullet?.[1]||block;
  return marker
    ?`<ul class="decision-text-list"><li data-marker="${esc(marker)}">${decisionTextWithReferenceLinksActive(content,current)}</li></ul>`
    :`<p>${decisionTextWithReferenceLinksActive(content,current)}</p>`;
}

decisionLinkedParagraphsHtmlActive=function(value,current){
  const rendered=[];
  for(const block of decisionReadableTextBlocks(value)){
    const html=decisionReadableBlockHtml(block,current);
    const previous=rendered[rendered.length-1];
    if(html.startsWith('<ul')&&previous?.startsWith('<ul')){
      rendered[rendered.length-1]=previous.slice(0,-5)+html.replace(/^<ul class="decision-text-list">/,'');
    }else rendered.push(html);
  }
  return rendered.join('');
};

municipalCaseCellHtml=function(row){
  if(row?.isMeeting)return `<div class="decision-case-cell"><strong>${esc(row.body||'Sammanträde')}</strong><small class="decision-point-note">${esc(row.description||'Hela protokollet för sammanträdet.')}</small>${decisionMainCaseMetaHtmlFinal(row)}</div>`;
  const fallback=[row?.point?`\u00a7 ${row.point}`:'',municipalText(row?.title)||'\u00c4rende'].filter(Boolean).join(' ');
  const title=municipalText(row?.protocolHeader)||fallback;
  const point=String(row?.point||'');
  return `<div class="decision-case-cell"><strong>${point?`<span class="decision-point-label">${esc(point)}</span>`:''}${esc(title)}</strong>${decisionMainCaseMetaHtmlFinal(row)}</div>`;
};

decisionDetailPositionsHtml=function(proposal){
  const rows=Array.isArray(decisionPositionRows)?decisionPositionRows.filter(row=>row.id===proposal?.id&&String(row.point)===String(proposal?.point)):[];
  const protocolText=String(proposal?.yrkandeText||'').replace(/\r\n?/g,'\n').trim();
  const lines=protocolText.split('\n').map(line=>line.trim()).filter(Boolean);
  const starts=[];
  lines.forEach((line,index)=>{
    if(rows.some(row=>{
      const name=String(row.name||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const party=String(row.party||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      return name&&party&&new RegExp(`^${name} \\(${party}\\)`).test(line);
    }))starts.push(index);
  });
  if(starts.length){
    return starts.map((start,index)=>{
      const end=index+1<starts.length?starts[index+1]:lines.length;
      const statement=lines.slice(start,end).join(' ').replace(/\s+/g,' ').trim();
      return `<section class="decision-position-item"><p>${decisionTextWithReferenceLinksActive(statement,proposal)}</p></section>`;
    }).join('');
  }
  if(!rows.length)return '';
  const groups=new Map();
  rows.forEach(row=>{
    const kind=row.vote||'Yrkande';
    if(!groups.has(kind))groups.set(kind,new Map());
    groups.get(kind).set(`${row.name}|${row.party}`,row);
  });
  const html=[...groups.entries()]
    .sort((a,b)=>decisionPositionSortRankFinal(a[0])-decisionPositionSortRankFinal(b[0])||String(a[0]).localeCompare(String(b[0]),'sv'))
    .map(([kind,people])=>{
      const names=[...people.values()]
        .sort((a,b)=>String(a.party).localeCompare(String(b.party),'sv',{numeric:true,sensitivity:'base'})||String(a.name).localeCompare(String(b.name),'sv',{numeric:true,sensitivity:'base'}))
        .map(row=>`<span class="decision-position-name">${esc(row.name)}${row.party?` (${esc(decisionDisplay('party',row.party))})`:''}</span>`)
        .join('');
      return `<section class="decision-position-group"><h4>${esc(kind)} <strong>${fmtInt(people.size)}</strong></h4><div class="decision-position-names">${names}</div></section>`;
    }).join('');
  return `<div class="decision-position-groups">${html}</div>`;
};

const decisionHydrateTextFieldsBeforeNoDuplicateVote=decisionHydrateTextFieldsFinal;
decisionHydrateTextFieldsFinal=function(row){
  decisionHydrateTextFieldsBeforeNoDuplicateVote(row);
  if(row)row.votationText='';
  return row;
};

decisionDetailTextHtml=function(proposal){
  decisionHydrateTextFieldsFinal(proposal);
  const description=proposal?.abstractText||'';
  const materials=decisionDetailMaterialsHtml(proposal);
  const proposalText=proposal?.description||'';
  const positionYrkanden=decisionDetailPositionsHtml(proposal);
  const fallbackYrkanden=!positionYrkanden&&proposal?.yrkandeText
    ?decisionLinkedParagraphsHtmlActive(proposal.yrkandeText,proposal)
    :'';
  const yrkanden=positionYrkanden||fallbackYrkanden;
  const proposition=proposal?.propositionText||'';
  const decisionText=proposal?.fullDecisionText||proposal?.description||'';
  const showProposal=proposalText&&decisionTextSectionNorm(proposalText)!==decisionTextSectionNorm(decisionText);
  return [
    decisionSectionArticleFinal('\u00c4rendebeskrivning',description,proposal),
    materials?`<article class="decision-point-card decision-text-card"><h3>Beslutsunderlag</h3>${materials}</article>`:'',
    showProposal?decisionSectionArticleFinal('F\u00f6rslag till beslut',proposalText,proposal):'',
    yrkanden?`<article class="decision-point-card decision-text-card"><h3>Yrkanden</h3>${yrkanden}</article>`:'',
    decisionSectionArticleFinal('Proposition',proposition,proposal),
    decisionSectionArticleFinal('Beslut',decisionText,proposal)
  ].join('');
};

/* Final paragraph reflow and plain decision-point labels. */
decisionReadableTextBlocks=function(value){
  const text=String(value||'').replace(/\r\n?/g,'\n').trim();
  if(!text)return [];
  const blocks=[];
  const flush=parts=>{
    const block=parts.join(' ').replace(/\s+/g,' ').trim();
    if(block)blocks.push(block);
    parts.length=0;
  };
  text.split(/\n{2,}/).map(group=>group.trim()).filter(Boolean).forEach(group=>{
    const lines=group.split(/\n+/).map(line=>line.trim()).filter(Boolean);
    const paragraph=[];
    let previous='';
    lines.forEach(line=>{
      const listItem=/^(?:\d{1,2}[.)]|[-\u2013\u2022\uF0B7])\s+/.test(line);
      if(listItem){
        flush(paragraph);
        blocks.push(line);
        previous='';
        return;
      }
      if(!paragraph.length&&blocks.length&&/^(?:\d{1,2}[.)]|[-\u2013\u2022\uF0B7])\s+/.test(blocks[blocks.length-1])){
        blocks[blocks.length-1]+=` ${line}`;
        previous=line;
        return;
      }
      const startsNewParagraph=
        paragraph.length>0&&
        paragraph.join(' ').length>=70&&
        /[.!?][\u201d"')\]]?$/.test(previous)&&
        /^[A-Z\u00c5\u00c4\u00d6]/.test(line);
      if(startsNewParagraph)flush(paragraph);
      paragraph.push(line);
      previous=line;
    });
    flush(paragraph);
  });
  return blocks;
};

municipalCaseCellHtml=function(row){
  if(row?.isMeeting)return `<div class="decision-case-cell"><strong>${esc(row.body||'Sammanträde')}</strong><small class="decision-point-note">${esc(row.description||'Hela protokollet för sammanträdet.')}</small>${decisionMainCaseMetaHtmlFinal(row)}</div>`;
  const point=String(row?.point||'');
  const fallback=[point?`\u00a7 ${point}`:'',municipalText(row?.title)||'\u00c4rende'].filter(Boolean).join(' ');
  let title=municipalText(row?.protocolHeader)||fallback;
  if(point.includes('.')){
    title=/^\s*\u00a7\s*\d{1,4}(?:\.\d+)?\b/.test(title)
      ?title.replace(/^\s*\u00a7\s*\d{1,4}(?:\.\d+)?\b/,`\u00a7 ${point}`)
      :`\u00a7 ${point} ${title}`;
  }
  const preview=decisionPlainPreview(row?.description||row?.fullDecisionText||row?.title||'');
  return `<div class="decision-case-cell"><strong>${esc(title)}</strong>${preview?`<small class="decision-point-note" title="${esc(preview)}">${esc(preview)}</small>`:''}${decisionMainCaseMetaHtmlFinal(row)}</div>`;
};

/* Runtime indexes and stable caches for the municipal decision view. The source
   data is immutable after a pack has been prepared, so repeated detail renders
   must not rerun the full decoration pipeline or scan every protocol row. */
let decisionRuntimePreparedPackFinal=null;
let decisionRuntimeIndexesFinal=null;
let decisionFilteredPointCacheFinal=null;
let decisionDetailPayloadCacheFinal=null;
let decisionDetailRowsCacheFinal=null;
let decisionFilterUiKeyFinal='';

function decisionRuntimeNormalizeReferenceFinal(value){
  return String(value||'').normalize('NFC').toLocaleLowerCase('sv-SE').replace(/\s+/g,' ').trim();
}

function decisionRuntimePushIndexFinal(map,key,row){
  if(!key)return;
  if(!map.has(key))map.set(key,[]);
  map.get(key).push(row);
}

function decisionBuildRuntimeIndexesFinal(){
  const proposalByKey=new Map(),decisionById=new Map(),pointRows=new Map(),diaryRows=new Map(),dateRows=new Map();
  for(const row of decisionAllPointRows){
    proposalByKey.set(decisionProposalKey(row),row);
    decisionRuntimePushIndexFinal(pointRows,decisionReferencePointBaseActive(row.point),row);
    decisionRuntimePushIndexFinal(diaryRows,decisionRuntimeNormalizeReferenceFinal(row.diary),row);
    decisionRuntimePushIndexFinal(dateRows,String(row.date||''),row);
  }
  for(const row of decisionDecisionRows)decisionById.set(String(row.id||''),row);
  decisionRuntimeIndexesFinal={proposalByKey,decisionById,pointRows,diaryRows,dateRows};
  decisionFilteredPointCacheFinal=null;
  decisionDetailPayloadCacheFinal=null;
  decisionDetailRowsCacheFinal=null;
}

const ensureDecisionDataBeforeRuntimeIndexesFinal=ensureDecisionData;
ensureDecisionData=function(){
  if(decisionReady&&decisionRuntimePreparedPackFinal===decisionPack)return;
  ensureDecisionDataBeforeRuntimeIndexesFinal();
  if(!decisionReady)return;
  decisionBuildRuntimeIndexesFinal();
  decisionRuntimePreparedPackFinal=decisionPack;
};

function decisionRuntimeFilterStateKeyFinal(){
  return JSON.stringify([
    decisionDateRanges.map(range=>[range.from,range.to]),
    decisionSearchQuery,
    decisionFilterIds.map(id=>[id,...selectedDecisionValues(id)])
  ]);
}

const filteredDecisionPointRowsBeforeRuntimeCacheFinal=filteredDecisionPointRows;
filteredDecisionPointRows=function(){
  ensureDecisionData();
  const key=decisionRuntimeFilterStateKeyFinal();
  if(decisionFilteredPointCacheFinal?.key===key)return decisionFilteredPointCacheFinal.rows;
  const rows=filteredDecisionPointRowsBeforeRuntimeCacheFinal();
  const proposalByKey=new Map(rows.map(row=>[decisionProposalKey(row),row]));
  decisionFilteredPointCacheFinal={key,rows,proposalByKey};
  decisionDetailPayloadCacheFinal=null;
  decisionDetailRowsCacheFinal=null;
  return rows;
};

decisionProposalRowByKeyAnyFinal=function(key){
  const text=String(key||'');
  const rows=filteredDecisionPointRows();
  const row=decisionFilteredPointCacheFinal?.proposalByKey.get(text)||
    decisionRuntimeIndexesFinal?.proposalByKey.get(text)||
    decisionAllPointRows.find(candidate=>decisionProposalKey(candidate)===text)||null;
  return decisionHydrateTextFieldsFinal(row);
};
decisionProposalRowByKey=function(key){return decisionProposalRowByKeyAnyFinal(key);};

const decisionDetailRowsBeforeRuntimeCacheFinal=decisionDetailRows;
decisionDetailRows=function(tab){
  const stateKey=decisionRuntimeFilterStateKeyFinal();
  const tabKey=typeof tab==='object'
    ?JSON.stringify([tab.id,tab.point,tab.sourcePoint,tab.sourcePoints])
    :String(tab||'');
  const key=`${stateKey}|${tabKey}`;
  if(decisionDetailRowsCacheFinal?.key===key)return decisionDetailRowsCacheFinal.rows;
  const rows=decisionDetailRowsBeforeRuntimeCacheFinal(tab);
  decisionDetailRowsCacheFinal={key,rows};
  return rows;
};

const decisionDetailPayloadBeforeRuntimeCacheFinal=decisionDetailPayload;
decisionDetailPayload=function(tabOrId,proposalKey=''){
  const tab=typeof tabOrId==='object'?tabOrId:{id:String(tabOrId||''),proposalKey:String(proposalKey||'')};
  const key=`${decisionRuntimeFilterStateKeyFinal()}|${JSON.stringify([tab.id,tab.point,tab.sourcePoint,tab.sourcePoints,tab.proposalKey,proposalKey])}`;
  if(decisionDetailPayloadCacheFinal?.key===key)return decisionDetailPayloadCacheFinal.payload;
  const payload=decisionDetailPayloadBeforeRuntimeCacheFinal(tabOrId,proposalKey);
  decisionDetailPayloadCacheFinal={key,payload};
  return payload;
};

const buildDecisionFiltersBeforeRuntimeCacheFinal=buildDecisionFilters;
buildDecisionFilters=function(){
  if(!decisionReady)return buildDecisionFiltersBeforeRuntimeCacheFinal();
  const key=JSON.stringify([
    decisionDateRanges.map(range=>[range.from,range.to]),
    decisionFilterIds.map(id=>[id,...selectedDecisionValues(id)])
  ]);
  if(key===decisionFilterUiKeyFinal){
    syncDecisionDateRangeControls();
    syncDecisionSearchControl();
    return;
  }
  buildDecisionFiltersBeforeRuntimeCacheFinal();
  decisionFilterUiKeyFinal=key;
};

decisionReferencePointTargetFinal=function(current,label){
  ensureDecisionData();
  const base=decisionReferencePointBaseActive(label);
  if(!base)return null;
  const matches=decisionRuntimeIndexesFinal?.pointRows.get(base)||[];
  if(!matches.length)return null;
  const sameDoc=matches.filter(row=>row.documentTitle&&current?.documentTitle&&row.documentTitle===current.documentTitle);
  const sameMeeting=matches.filter(row=>row.date===current?.date&&row.body===current?.body);
  const sameBody=matches.filter(row=>row.body===current?.body);
  return decisionReferenceBestRowFinal(sameDoc.length?sameDoc:sameMeeting.length?sameMeeting:sameBody.length?sameBody:matches,current);
};

decisionReferenceDiaryTargetFinal=function(current,label){
  ensureDecisionData();
  const matches=decisionRuntimeIndexesFinal?.diaryRows.get(decisionRuntimeNormalizeReferenceFinal(label))||[];
  if(!matches.length)return null;
  const sameProtocol=matches.filter(row=>row.documentTitle&&current?.documentTitle&&row.documentTitle===current.documentTitle);
  const sameMeeting=matches.filter(row=>row.date===current?.date&&row.body===current?.body);
  return decisionReferenceBestRowFinal(sameProtocol.length?sameProtocol:sameMeeting.length?sameMeeting:matches,current);
};

decisionReferenceDateTargetFinal=function(current,label){
  ensureDecisionData();
  const iso=/^20\d{2}-\d{2}-\d{2}$/.test(label)?label:decisionSwedishDateToIsoFinal(label);
  if(!iso)return null;
  const rows=decisionRuntimeIndexesFinal?.dateRows.get(iso)||[];
  if(!rows.length)return null;
  const currentKey=decisionProposalKey(current);
  if(iso===current?.date){
    const protocolKey=decisionMeetingProtocolKey(current);
    const meeting=rows.find(row=>row.isMeeting&&row.meetingKey===protocolKey)||
      rows.find(row=>row.isMeeting&&row.date===current?.date&&decisionOrganMatches([current?.body],row.body));
    if(meeting&&decisionProposalKey(meeting)!==currentKey)return {kind:'internal',row:meeting};
  }
  const sameMatter=rows.filter(row=>!row.isMeeting&&row.matterId&&current?.matterId&&row.matterId===current.matterId&&decisionProposalKey(row)!==currentKey);
  if(sameMatter.length)return {kind:'internal',row:decisionReferenceBestRowFinal(sameMatter,current)};
  /* The date index can contain unrelated meetings held on the same day. Keep
     ambiguous date mentions as text unless matter identity verifies the link,
     or the date refers to the current protocol's own meeting. */
  return null;
};

function decisionBindReferenceNavigationFinal(){
  const host=$('decisionDetailGroups');
  if(!host||host.dataset.referenceNavigationBound==='1')return;
  host.dataset.referenceNavigationBound='1';
  host.addEventListener('click',event=>{
    const button=event.target.closest?.('.decision-text-ref');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    openDecisionDetail(button.dataset.id,button.dataset.proposalKey);
  });
}

const renderDecisionDetailViewBeforeRuntimeLinksFinal=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeRuntimeLinksFinal(tab);
  decisionBindReferenceNavigationFinal();
};

/* Swedish letters are not JavaScript ASCII word characters. Avoid \b before a
   diary prefix so references such as "Ön 20/2025" are detected, while keeping
   ordinary lower-case phrases such as "läsåret 2024/2025" as plain text. */
decisionTextWithReferenceLinksActive=function(value,current){
  const text=String(value||'');
  const re=/(§\s*\d{1,4}(?:\.\d+)?|(?<![A-Za-zÅÄÖåäö])[A-ZÅÄÖ][A-Za-zÅÄÖåäö]{0,6}\s+\d{1,5}\/20\d{2}(?![A-Za-zÅÄÖåäö])|\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:[Jj]anuari|[Ff]ebruari|[Mm]ars|[Aa]pril|[Mm]aj|[Jj]uni|[Jj]uli|[Aa]ugusti|[Ss]eptember|[Oo]ktober|[Nn]ovember|[Dd]ecember)(?:\s+20\d{2})?\b)/g;
  let out='',last=0,match;
  while((match=re.exec(text))){
    const label=match[1];
    const resolveLabel=/^\d{1,2}\s+(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)$/i.test(label)
      ?decisionInferDateLabelYearFinal(text,match.index,label,current)
      :label;
    const resolved=decisionReferenceResolveFinal(resolveLabel,current);
    out+=esc(text.slice(last,match.index));
    if(resolved?.kind==='internal'&&resolved.row)out+=decisionReferenceInternalHtmlFinal(label,resolved.row);
    else if(resolved?.kind==='source'&&resolved.row)out+=decisionReferenceSourceHtmlFinal(label,resolved.row);
    else out+=esc(label);
    last=re.lastIndex;
  }
  out+=esc(text.slice(last));
  return out.replace(/\n/g,'<br>');
};
