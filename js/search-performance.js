/* Final search overrides, loaded after the feature modules. */
decisionPointSearchMatches=function(row){
  const q=decisionSearchNormalizeFinal(decisionSearchQuery);
  if(!q)return true;
  let text=decisionPointSearchIndex.get(row);
  if(text===undefined){
    text=decisionSearchNormalizeFinal([
      row.title,row.point,row.description,row.body,row.diary,row.caseNumber,row.documentTitle,
      row.protocolHeader,row.abstractText,row.fullDecisionText,row.result,row.proposalType
    ].join(' '));
    decisionPointSearchIndex.set(row,text);
  }
  return fuzzySearchTextMatches(text,q);
};

filteredDecisionActivityRows=function(){
  const q=decisionSearchNormalizeFinal(decisionActivitySearchQuery),types=selectedActivityValues('type'),parties=selectedActivityValues('party'),politicalOwners=selectedActivityValues('politicalOwner'),officialOwners=selectedActivityValues('officialOwner');
  return decisionActivityRows.filter(r=>{
    if(!decisionActivityIncludedByDate(r)||types.length&&!types.includes(r.type)||parties.length&&!parties.includes(r.party)||politicalOwners.length&&!politicalOwners.includes(r.politicalOwner)||officialOwners.length&&!officialOwners.includes(r.officialOwner))return false;
    if(!q)return true;
    let text=decisionActivitySearchIndex.get(r);
    if(text===undefined){
      text=decisionSearchNormalizeFinal([r.type,r.title,r.summary,...(r.importantPoints||[]),r.politicalOwner,r.officialOwner,r.answeredBy,r.party,r.organ,r.sourceSection,r.sourceTitle,r.id,r.caseNumber,...(r.headings||[]),...(r.caseNumbersDetected||[]),...(r.datesDetected||[]),...(r.responsibilityLines||[])].join(' '));
      decisionActivitySearchIndex.set(r,text);
    }
    return fuzzySearchTextMatches(text,q);
  });
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

function decisionDocumentDateLabel(value){
  return value?decisionDateDisplay(value):'\u2014';
}

decisionActivityDateHtml=function(row){
  const label=row.date||row.dateSort||'';
  const basis={
    revision_date:'Senast reviderad',
    document_date:'Dokumentdatum',
    adoption_date:'Antagen',
    effective_date:'G\u00e4ller fr\u00e5n',
    detected_in_title_year:'\u00c5r i titel'
  }[row.dateBasis]||'';
  return label?`${esc(label)}${basis?`<span class="decision-activity-date-note">${esc(basis)}</span>`:''}`:'<span class="muted">Odaterat</span>';
};

renderDecisionActivityDetail=function(row){
  $('decisionActivityListPane').hidden=true;
  $('decisionActivityDetailPane').hidden=false;
  $('decisionActivityDetailTitle').textContent=row.title||'Styrdokument';
  const source=row.url||row.localPath||'';
  $('decisionActivityDetailMeta').innerHTML=`<span>${esc([row.type,row.party].filter(Boolean).join(' \u00b7 '))}</span>${source?` <a class="decision-official-link" href="${esc(source)}" target="_blank" rel="noopener noreferrer">\u00d6ppna k\u00e4lla</a>`:''}`;
  $('decisionActivityDetailOverview').innerHTML=[
    ['Dokumenttyp',row.type||'Dokument'],
    ['Aktuellt datum',decisionDocumentDateLabel(row.dateSort)],
    ['Dokumentdatum',decisionDocumentDateLabel(row.documentDate)],
    ['Antagen',decisionDocumentDateLabel(row.adoptionDate)],
    ['G\u00e4ller fr\u00e5n',decisionDocumentDateLabel(row.effectiveDate)],
    ['Senast reviderad',decisionDocumentDateLabel(row.revisionDate)],
    ['G\u00e4ller till',decisionDocumentDateLabel(row.expiryDate)]
  ].map(([k,v])=>`<div class="card"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('');
  const sourceLinks=[row.url?`<a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">\u00d6ppna hos \u00d6rebro kommun</a>`:'',row.localPath?`<span>${esc(row.localPath)}</span>`:''].filter(Boolean).join('<br>');
  $('decisionActivityDetailBody').innerHTML=[
    `<article class="decision-point-card document-detail-summary"><h3>Sammanfattning</h3><p>${esc(row.summary||'Sammanfattning saknas.')}</p></article>`,
    `<article class="decision-point-card"><h3>Viktigaste punkter</h3>${decisionDocumentDetailListFinal(row.importantPoints||[])}</article>`,
    `<article class="decision-point-card"><h3>Dokumentinformation</h3><dl class="document-meta-list"><dt>Omr\u00e5de/organ</dt><dd>${esc(row.party||'\u2014')}</dd><dt>Politisk niv\u00e5</dt><dd>${esc(row.politicalOwner||'\u2014')}</dd><dt>Tj\u00e4nstemanniv\u00e5</dt><dd>${esc(row.officialOwner||'\u2014')}</dd><dt>Diarienummer</dt><dd>${esc(row.caseNumber||row.caseNumbersDetected?.[0]||'\u2014')}</dd><dt>K\u00e4lla</dt><dd>${sourceLinks||'\u2014'}</dd></dl></article>`,
    row.headings?.length?`<article class="decision-point-card"><h3>Identifierade rubriker</h3>${decisionDocumentDetailListFinal(row.headings.slice(0,12))}</article>`:'',
    row.responsibilityLines?.length?`<article class="decision-point-card"><h3>Beslut och ansvar</h3>${decisionDocumentDetailListFinal(row.responsibilityLines.slice(0,8))}</article>`:'',
    row.summaryLimitations?.length?`<article class="decision-point-card"><h3>Begr\u00e4nsningar</h3>${decisionDocumentDetailListFinal(row.summaryLimitations)}</article>`:''
  ].filter(Boolean).join('');
};
