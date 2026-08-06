var decisionActivityRows=[];
var decisionActivityTabs=[{kind:'list',id:'activity-list',title:'Styrdokument',page:0}];
var decisionActivityActiveTab=0;
var decisionActivitySearchQuery='';
var decisionActivityDateRanges=[];
var decisionActivityDatePickerOpen=false;
var decisionActivityDateDraftFrom='';
var decisionActivityDateHover='';
var decisionActivityCalendarMonth='';
var decisionActivityFilters={type:[],party:[],politicalOwner:[],officialOwner:[]};
var decisionActivitySortColumn='date';
var decisionActivitySortDir='asc';
var municipalDocumentActivityRowsEnrichedCache=null;

const decisionActivityFilterClearValueFinal='__clear_activity_filter__';
const decisionActivityFilterPromptValueFinal='__add_activity_filter__';

function resetDecisionActivityPage(){
  decisionActivityTabs.forEach(tab=>{tab.page=0;});
}

function selectedActivityValues(key){
  return normalizeDecisionSelectionState(decisionActivityFilters[key]);
}

function decisionActivityTabState(){
  return decisionActivityTabs[Math.max(0,Math.min(decisionActivityActiveTab,decisionActivityTabs.length-1))];
}

function decisionActivityTypeLabel(type){
  return municipalText(type)||'Övrigt';
}

function decisionActivityDisplay(col,value){
  if(col==='type')return decisionActivityTypeLabel(value);
  if(col==='party')return municipalText(value)||'Okänt område';
  if(col==='politicalOwner'||col==='officialOwner')return municipalText(value)||'Ej angiven';
  return municipalText(value||'Alla');
}

function decisionActivitySourceUrl(row){
  return row?.url||row?.localPath||'';
}

function decisionActivityDateValue(row){
  return String(row?.dateSort||'');
}

function decisionActivityAvailableDates(){
  return [...new Set(decisionActivityRows.map(decisionActivityDateValue).filter(Boolean))].sort();
}

function decisionActivityDateMatches(row){
  const value=decisionActivityDateValue(row);
  return !decisionActivityDateRanges.length||!!value&&decisionActivityDateRanges.some(range=>value>=range.from&&value<=range.to);
}

function decisionActivityIncludedByDate(row){
  return decisionActivityDateMatches(row);
}

function decisionDocumentDateLabel(value){
  return value?decisionDateDisplay(value):'—';
}

function decisionActivityDateHtml(row){
  const label=row.date||row.dateSort||'';
  const basis={
    revision_date:'Senast reviderad',
    document_date:'Dokumentdatum',
    adoption_date:'Antagen',
    effective_date:'Gäller från',
    detected_in_title_year:'År i titel'
  }[row.dateBasis]||'';
  return label?`${esc(label)}${basis?`<span class="decision-activity-date-note">${esc(basis)}</span>`:''}`:'<span class="muted">Odaterat</span>';
}

function municipalDocumentActivityRowsEnrichedFinal(){
  if(municipalDocumentActivityRowsEnrichedCache)return municipalDocumentActivityRowsEnrichedCache;
  const rows=window.municipalDocumentPack?.d||documentPack?.d||[];
  municipalDocumentActivityRowsEnrichedCache=rows.map(row=>({
    id:String(row.id||row.sourceId||row.url||''),
    type:row.typeLabel||row.type||'Dokument',
    rawType:row.type||'other',
    decisionRole:row.statusLabel||row.status||'',
    date:row.date||'',
    dateSort:row.dateSort||'',
    dateBasis:row.dateBasis||'',
    documentDate:row.documentDate||'',
    adoptionDate:row.adoptionDate||'',
    effectiveDate:row.effectiveDate||'',
    revisionDate:row.revisionDate||'',
    expiryDate:row.expiryDate||'',
    dateEvidence:row.dateEvidence||{},
    title:row.title||'Dokument',
    subtitle:row.summary||'',
    summary:row.summary||'',
    importantPoints:Array.isArray(row.importantPoints)?row.importantPoints:[],
    headings:Array.isArray(row.headings)?row.headings:[],
    politicalOwner:row.politicalOwner||'',
    officialOwner:row.officialOwner||'',
    addressedTo:row.caseNumber||'',
    answeredBy:row.responsibleBody||row.adoptingBody||'',
    party:row.area||row.responsibleBody||row.adoptingBody||row.sourceSection||'',
    organ:row.area||row.responsibleBody||row.adoptingBody||row.sourceSection||'',
    url:row.url||row.localPath||'',
    localPath:row.localPath||'',
    caseNumber:row.caseNumber||'',
    paragraph:row.paragraph||'',
    pageCount:row.pageCount||row.textStats?.page_count||'',
    fileSize:row.fileSize||'',
    sha256:row.sha256||'',
    contentType:row.contentType||'',
    sourceId:row.sourceId||'',
    sourceSection:row.sourceSection||'',
    sourceTitle:row.sourceTitle||'',
    summaryMethod:row.summaryMethod||'',
    summaryLimitations:Array.isArray(row.summaryLimitations)?row.summaryLimitations:[],
    caseNumbersDetected:Array.isArray(row.caseNumbersDetected)?row.caseNumbersDetected:[],
    datesDetected:Array.isArray(row.datesDetected)?row.datesDetected:[],
    responsibilityLines:Array.isArray(row.responsibilityLines)?row.responsibilityLines:[],
    textStats:row.textStats||{}
  })).filter(row=>row.id||row.url||row.title);
  return municipalDocumentActivityRowsEnrichedCache;
}

function ensureMunicipalDocumentData(){
  ensureDecisionData();
  const documentRows=municipalDocumentActivityRowsEnrichedFinal();
  if(documentRows.length)decisionActivityRows=documentRows;
}

function setActivitySelectOptions(id,key,values,col){
  const sel=$(id);
  if(!sel)return;
  const available=new Set(values.map(String));
  decisionActivityFilters[key]=selectedActivityValues(key).filter(value=>available.has(String(value)));
  const locked=new Set(decisionActivityFilters[key].map(String));
  sel.dataset.activityKey=key;
  sel.dataset.col=col;
  const allOption=locked.size?`<option value="${decisionActivityFilterPromptValueFinal}" selected>Välj fler...</option><option value="${decisionActivityFilterClearValueFinal}">Alla</option>`:'<option value="">Alla</option>';
  sel.innerHTML=[allOption,...values.filter(value=>!locked.has(String(value))).map(value=>`<option value="${esc(value)}">${esc(decisionActivityDisplay(col,value))}</option>`)].join('');
  sel.value=locked.size?decisionActivityFilterPromptValueFinal:'';
}

function decisionActivityFilterLabelFinal(key,col,value){
  const prefix={type:'Dokumenttyp',party:'Organ',politicalOwner:'Politisk nivå',officialOwner:'Tjänstemannanivå'}[key]||'Filter';
  return `${prefix}: ${decisionActivityDisplay(col,value)}`;
}

function renderActivityFilterLocks(){
  const host=$('decisionActivityFilterLocks');
  if(!host)return;
  const filterIds=['decisionActivityType','decisionActivityParty','decisionActivityPoliticalOwner','decisionActivityOfficialOwner'];
  const chips=[];
  filterIds.forEach(id=>{
    const sel=$(id);
    if(!sel)return;
    const key=sel.dataset.activityKey;
    const col=sel.dataset.col;
    selectedActivityValues(key).forEach(value=>chips.push({key,col,value,label:decisionActivityFilterLabelFinal(key,col,value)}));
  });
  host.hidden=!chips.length;
  host.innerHTML=chips.map(chip=>`<span class="raw-filter-chip"><span>${esc(chip.label)}</span><button type="button" data-key="${esc(chip.key)}" data-value="${esc(chip.value)}" title="Rensa filter" aria-label="Rensa filter">×</button></span>`).join('');
  if(chips.length)host.insertAdjacentHTML('beforeend','<button type="button" class="filter-clear-all" data-clear-all-filters title="Rensa alla filter" aria-label="Rensa alla filter">× Rensa alla</button>');
  host.querySelectorAll('.raw-filter-chip button').forEach(btn=>{
    btn.onclick=()=>{
      const key=btn.dataset.key;
      decisionActivityFilters[key]=selectedActivityValues(key).filter(value=>value!==btn.dataset.value);
      decisionActivityActiveTab=0;
      resetDecisionActivityPage();
      renderDecisionActivityView();
    };
  });
  host.querySelector('[data-clear-all-filters]')?.addEventListener('click',()=>{
    filterIds.forEach(id=>{
      const key=$(id)?.dataset.activityKey;
      if(key)decisionActivityFilters[key]=[];
    });
    decisionActivityActiveTab=0;
    resetDecisionActivityPage();
    renderDecisionActivityView();
  });
}

function buildDecisionActivityFilters(){
  ensureMunicipalDocumentData();
  syncDecisionActivityDateControls();
  const rows=decisionActivityRows.filter(decisionActivityIncludedByDate);
  const types=uniqueDecisionValues(rows.map(row=>row.type).filter(Boolean));
  const parties=uniqueDecisionValues(rows.map(row=>row.party).filter(Boolean));
  const politicalOwners=uniqueDecisionValues(rows.map(row=>row.politicalOwner).filter(Boolean));
  const officialOwners=uniqueDecisionValues(rows.map(row=>row.officialOwner).filter(Boolean));
  setActivitySelectOptions('decisionActivityType','type',types,'type');
  setActivitySelectOptions('decisionActivityParty','party',parties,'party');
  setActivitySelectOptions('decisionActivityPoliticalOwner','politicalOwner',politicalOwners,'politicalOwner');
  setActivitySelectOptions('decisionActivityOfficialOwner','officialOwner',officialOwners,'officialOwner');
  renderActivityFilterLocks();
  if($('decisionActivitySearch'))$('decisionActivitySearch').value=decisionActivitySearchQuery;
}

function handleDecisionActivityFilterChange(id){
  const sel=$(id);
  const key=sel?.dataset.activityKey;
  const value=sel?.value;
  if(key){
    if(value===decisionActivityFilterPromptValueFinal)return;
    if(value===decisionActivityFilterClearValueFinal)decisionActivityFilters[key]=[];
    else if(value){
      if(!selectedActivityValues(key).includes(value))decisionActivityFilters[key]=[...selectedActivityValues(key),value];
    }else decisionActivityFilters[key]=[];
  }
  decisionActivityActiveTab=0;
  resetDecisionActivityPage();
  renderDecisionActivityView();
}

const decisionActivitySearchScoreCacheFinal=new WeakMap();
function decisionActivitySearchRelevanceFinal(row,query=decisionActivitySearchQuery){
  const q=decisionSearchNormalizeFinal(query);
  if(!q)return 0;
  const cached=decisionActivitySearchScoreCacheFinal.get(row);
  if(cached?.query===q)return cached.score;
  const score=fuzzySearchWeightedScore(q,[
    [row.title,12],
    [row.sourceTitle,10],
    [(row.headings||[]).join(' '),7],
    [[row.id,row.caseNumber,...(row.caseNumbersDetected||[])].join(' '),6],
    [[row.type,decisionActivityTypeLabel(row.type),row.party,row.organ,row.politicalOwner,row.officialOwner,row.answeredBy,row.sourceSection].join(' '),4],
    [row.summary,2.5],
    [(row.importantPoints||[]).join(' '),2],
    [(row.responsibilityLines||[]).join(' '),1.5],
    [(row.datesDetected||[]).join(' '),1]
  ]);
  decisionActivitySearchScoreCacheFinal.set(row,{query:q,score});
  return score;
}

function filteredDecisionActivityRows(){
  ensureMunicipalDocumentData();
  const q=decisionSearchNormalizeFinal(decisionActivitySearchQuery);
  const types=selectedActivityValues('type');
  const parties=selectedActivityValues('party');
  const politicalOwners=selectedActivityValues('politicalOwner');
  const officialOwners=selectedActivityValues('officialOwner');
  return decisionActivityRows.filter(row=>{
    if(!decisionActivityIncludedByDate(row)||types.length&&!types.includes(row.type)||parties.length&&!parties.includes(row.party)||politicalOwners.length&&!politicalOwners.includes(row.politicalOwner)||officialOwners.length&&!officialOwners.includes(row.officialOwner))return false;
    if(!q)return true;
    return decisionActivitySearchRelevanceFinal(row,q)>0;
  });
}

function decisionActivitySortValue(row,col){
  if(col==='type')return decisionActivityTypeLabel(row.type);
  if(col==='summary')return row.summary||'';
  if(col==='points')return (row.importantPoints||[]).join(' ');
  if(col==='party')return row.party||'';
  if(col==='title')return row.title||'';
  return row.dateSort||row.date||'';
}

function decisionActivitySortCompare(a,b,col=decisionActivitySortColumn){
  let cmp=String(decisionActivitySortValue(a,col)).localeCompare(String(decisionActivitySortValue(b,col)),'sv',{numeric:true,sensitivity:'base'});
  if(cmp===0)cmp=String(a.dateSort||a.date).localeCompare(String(b.dateSort||b.date),'sv',{numeric:true})||String(a.title).localeCompare(String(b.title),'sv',{numeric:true,sensitivity:'base'});
  return decisionActivitySortDir==='desc'?-cmp:cmp;
}

function sortedDecisionActivityRows(rows=filteredDecisionActivityRows()){
  const q=decisionSearchNormalizeFinal(decisionActivitySearchQuery);
  return [...rows].sort((a,b)=>{
    if(q){
      const relevance=decisionActivitySearchRelevanceFinal(b,q)-decisionActivitySearchRelevanceFinal(a,q);
      if(relevance)return relevance;
    }
    return decisionActivitySortCompare(a,b);
  });
}

function decisionActivitySortIndicator(col){
  return decisionActivitySortColumn===col?(decisionActivitySortDir==='asc'?' ▲':' ▼'):'';
}

function decisionActivitySortableHeader(col,label){
  return `<th data-activity-sort="${esc(col)}" class="decision-sortable" role="button" tabindex="0">${esc(label+decisionActivitySortIndicator(col))}</th>`;
}

function setDecisionActivitySort(col){
  if(decisionActivitySortColumn===col)decisionActivitySortDir=decisionActivitySortDir==='asc'?'desc':'asc';
  else{
    decisionActivitySortColumn=col;
    decisionActivitySortDir='asc';
  }
  renderDecisionActivityView();
}

function decisionActivityById(id){
  ensureMunicipalDocumentData();
  return decisionActivityRows.find(row=>row.id===String(id||''))||null;
}

function closeDecisionActivityTabFinal(index){
  const tab=decisionActivityTabs[index];
  if(!tab||tab.kind==='list')return;
  decisionActivityTabs.splice(index,1);
  decisionActivityActiveTab=Math.max(0,Math.min(decisionActivityActiveTab,decisionActivityTabs.length-1));
  renderDecisionActivityView();
}

function renderDecisionActivityTabs(){
  const box=$('decisionActivityTabs');
  if(!box)return;
  box.innerHTML=decisionActivityTabs.map((tab,index)=>{
    const close=tab.kind==='list'?'':`<span class="decision-tab-close" role="button" tabindex="0" aria-label="Stäng dokumentflik">×</span>`;
    return `<button class="decision-tab ${index===decisionActivityActiveTab?'active':''}" data-activity-i="${index}" type="button"><span class="decision-tab-label">${esc(tab.title)}</span>${close}</button>`;
  }).join('');
  box.querySelectorAll('[data-activity-i]').forEach(btn=>{
    btn.onclick=event=>{
      if(event.target.closest('.decision-tab-close')){
        closeDecisionActivityTabFinal(Number(btn.dataset.activityI));
        return;
      }
      decisionActivityActiveTab=Number(btn.dataset.activityI);
      renderDecisionActivityView();
      animateUiRegion(decisionActivityTabState()?.kind==='activity'?$('decisionActivityDetailPane'):$('decisionActivityListPane'));
    };
  });
  box.querySelectorAll('.decision-tab-close').forEach(el=>{
    el.onclick=event=>{
      event.stopPropagation();
      closeDecisionActivityTabFinal(Number(el.closest('[data-activity-i]').dataset.activityI));
    };
    el.onkeydown=event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        event.stopPropagation();
        closeDecisionActivityTabFinal(Number(el.closest('[data-activity-i]').dataset.activityI));
      }
    };
  });
}

function openDecisionActivityDetail(id){
  const row=decisionActivityById(id);
  if(!row)return;
  const tabId=`activity:${row.id}`;
  const existing=decisionActivityTabs.findIndex(tab=>tab.kind==='activity'&&tab.id===tabId);
  if(existing>=0){
    decisionActivityActiveTab=existing;
    renderDecisionActivityView();
    return;
  }
  decisionActivityTabs.push({kind:'activity',id:tabId,activityId:row.id,title:row.title||'Styrdokument',page:0});
  decisionActivityActiveTab=decisionActivityTabs.length-1;
  renderDecisionActivityView();
}

function decisionDocumentPointsPreviewFinal(row){
  const points=(row.importantPoints||[]).slice(0,2);
  return points.length?`<ul class="document-points-mini">${points.map(point=>`<li>${esc(point)}</li>`).join('')}</ul>`:'<span class="muted">Saknas</span>';
}

function decisionDocumentSummaryCellFinal(row){
  return row.summary?`<p class="document-summary-cell">${esc(row.summary)}</p>`:'<span class="muted">Saknas</span>';
}

function decisionDocumentDetailListFinal(items){
  return items.filter(Boolean).length?`<ul>${items.filter(Boolean).map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:'<p class="muted">Saknas</p>';
}

function renderDecisionActivityDetail(row){
  $('decisionActivityListPane').hidden=true;
  $('decisionActivityDetailPane').hidden=false;
  $('decisionActivityDetailTitle').textContent=row.title||'Styrdokument';
  const source=decisionActivitySourceUrl(row);
  $('decisionActivityDetailMeta').innerHTML=`<span>${esc([row.type,row.party].filter(Boolean).join(' · '))}</span>${source?` <a class="decision-official-link" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna källa</a>`:''}`;
  $('decisionActivityDetailOverview').innerHTML=[
    ['Dokumenttyp',row.type||'Dokument'],
    ['Aktuellt datum',decisionDocumentDateLabel(row.dateSort)],
    ['Dokumentdatum',decisionDocumentDateLabel(row.documentDate)],
    ['Antagen',decisionDocumentDateLabel(row.adoptionDate)],
    ['Gäller från',decisionDocumentDateLabel(row.effectiveDate)],
    ['Senast reviderad',decisionDocumentDateLabel(row.revisionDate)],
    ['Gäller till',decisionDocumentDateLabel(row.expiryDate)]
  ].map(([k,v])=>`<div class="card"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('');
  const sourceLinks=[row.url?`<a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">Öppna hos Örebro kommun</a>`:'',row.localPath?`<span>${esc(row.localPath)}</span>`:''].filter(Boolean).join('<br>');
  $('decisionActivityDetailBody').innerHTML=[
    `<article class="decision-point-card document-detail-summary"><h3>Sammanfattning</h3><p>${esc(row.summary||'Sammanfattning saknas.')}</p></article>`,
    `<article class="decision-point-card"><h3>Viktigaste punkter</h3>${decisionDocumentDetailListFinal(row.importantPoints||[])}</article>`,
    `<article class="decision-point-card"><h3>Dokumentinformation</h3><dl class="document-meta-list"><dt>Område/organ</dt><dd>${esc(row.party||'—')}</dd><dt>Politisk nivå</dt><dd>${esc(row.politicalOwner||'—')}</dd><dt>Tjänstemannanivå</dt><dd>${esc(row.officialOwner||'—')}</dd><dt>Diarienummer</dt><dd>${esc(row.caseNumber||row.caseNumbersDetected?.[0]||'—')}</dd><dt>Källa</dt><dd>${sourceLinks||'—'}</dd></dl></article>`,
    row.headings?.length?`<article class="decision-point-card"><h3>Identifierade rubriker</h3>${decisionDocumentDetailListFinal(row.headings.slice(0,12))}</article>`:'',
    row.responsibilityLines?.length?`<article class="decision-point-card"><h3>Beslut och ansvar</h3>${decisionDocumentDetailListFinal(row.responsibilityLines.slice(0,8))}</article>`:'',
    row.summaryLimitations?.length?`<article class="decision-point-card"><h3>Begränsningar</h3>${decisionDocumentDetailListFinal(row.summaryLimitations)}</article>`:''
  ].filter(Boolean).join('');
  decisionDecorateDetailPdfLinksFinal();
}

function renderDecisionActivityView(activeRow=null){
  const pane=$('decisionActivityPane');
  if(!pane)return;
  ensureMunicipalDocumentData();
  renderDecisionActivityTabs();
  if(activeRow){
    renderDecisionActivityDetail(activeRow);
    return;
  }
  const tab=decisionActivityTabState();
  if(tab?.kind==='activity'){
    const row=decisionActivityById(tab.activityId);
    if(row){
      renderDecisionActivityDetail(row);
      return;
    }
    decisionActivityActiveTab=0;
  }
  decisionBindInfiniteScrollFinal('decisionActivityBody',()=>{
    const listTab=decisionActivityTabs[0]||{page:0};
    const rows=sortedDecisionActivityRows(filteredDecisionActivityRows());
    if(decisionVisibleCount(listTab.page||0,rows.length)>=rows.length)return;
    listTab.page=(listTab.page||0)+1;
    renderDecisionActivityView();
  });
  $('decisionActivityListPane').hidden=false;
  $('decisionActivityDetailPane').hidden=true;
  buildDecisionActivityFilters();
  const filteredRows=filteredDecisionActivityRows();
  const rows=sortedDecisionActivityRows(filteredRows);
  const listTab=decisionActivityTabs[0]||{page:0};
  const visibleRows=rows.slice(0,decisionVisibleCount(listTab.page||0,rows.length));
  const types=new Set(filteredRows.map(row=>row.type).filter(Boolean));
  const dated=filteredRows.filter(row=>row.dateSort).length;
  const withSummary=filteredRows.filter(row=>row.summary).length;
  $('decisionActivityOverview').innerHTML=[
    ['Dokument',fmtInt(filteredRows.length)],
    ['Dokumenttyper',fmtInt(types.size)],
    ['Daterade',fmtInt(dated)],
    ['Med sammanfattning',fmtInt(withSummary)]
  ].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
  $('decisionActivityStatus').textContent=rows.length?`Visar ${fmtInt(visibleRows.length)} av ${fmtInt(rows.length)} styrdokument.`:'Inga styrdokument matchar de aktiva filtren.';
  $('decisionActivityHead').innerHTML=`<tr>${decisionActivitySortableHeader('date','Datum')}${decisionActivitySortableHeader('type','Dokumenttyp')}${decisionActivitySortableHeader('title','Titel')}${decisionActivitySortableHeader('summary','Sammanfattning')}${decisionActivitySortableHeader('points','Viktigt')}${decisionActivitySortableHeader('party','Område/organ')}<th>Källa</th></tr>`;
  $('decisionActivityHead').querySelectorAll('[data-activity-sort]').forEach(th=>{th.onclick=()=>setDecisionActivitySort(th.dataset.activitySort);});
  $('decisionActivityBody').innerHTML=visibleRows.map(row=>{
    const source=decisionActivitySourceUrl(row);
    return `<tr class="decision-selectable-row" data-activity-id="${esc(row.id)}"><td>${decisionActivityDateHtml(row)}</td><td><strong class="decision-activity-type">${esc(decisionActivityTypeLabel(row.type))}</strong></td><td><strong>${esc(row.title)}</strong></td><td>${decisionDocumentSummaryCellFinal(row)}</td><td>${decisionDocumentPointsPreviewFinal(row)}</td><td>${esc(row.party||'')}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'—'}</td></tr>`;
  }).join('');
  $('decisionActivityBody').querySelectorAll('[data-activity-id]').forEach(row=>row.onclick=event=>{
    if(event.target.closest('a'))return;
    openDecisionActivityDetail(row.dataset.activityId);
  });
  decisionDecorateMainPdfLinksFinal();
}

function syncDecisionActivityDateControls(){
  const dates=decisionActivityAvailableDates();
  const min=dates[0]||'';
  const max=dates[dates.length-1]||'';
  const toggle=$('decisionActivityDateToggle');
  const rangeLabel=decisionActivityDateRanges.length?decisionActivityDateRanges.map(decisionDateRangeLabelFor).join(', '):'Alla datum';
  if(toggle){
    toggle.setAttribute('aria-expanded',decisionActivityDatePickerOpen?'true':'false');
    toggle.setAttribute('aria-label',`Datum: ${rangeLabel}`);
    toggle.title=rangeLabel;
  }
  renderDecisionActivityDateLocks();
  if(!decisionActivityCalendarMonth)decisionActivityCalendarMonth=decisionMonthKey(decisionActivityDateRanges[0]?.from||min||max);
  if(decisionActivityDatePickerOpen)renderDecisionActivityCalendar();
}

function renderDecisionActivityDateLocks(){
  const lock=$('decisionActivityDateLocks');
  if(!lock)return;
  lock.hidden=!decisionActivityDateRanges.length;
  if(!decisionActivityDateRanges.length){
    lock.innerHTML='';
    return;
  }
  lock.innerHTML=decisionActivityDateRanges.map((range,index)=>`<span class="raw-filter-chip decision-date-chip"><span><span>${esc(decisionDateDisplay(range.from))}</span><span>${esc(decisionDateDisplay(range.to))}</span></span><button type="button" data-index="${index}" title="Rensa låst filter" aria-label="Rensa låst filter">×</button></span>`).join('');
  lock.querySelectorAll('button').forEach(btn=>btn.onclick=event=>{
    event.stopPropagation();
    decisionActivityDateRanges.splice(Number(btn.dataset.index),1);
    resetDecisionActivityPage();
    closeDecisionActivityDatePicker();
    renderDecisionActivityView();
  });
}

function renderDecisionActivityCalendar(){
  const host=$('decisionActivityDateCalendar');
  if(!host)return;
  const dates=decisionActivityAvailableDates();
  const min=dates[0]||'';
  const max=dates[dates.length-1]||'';
  if(!decisionActivityCalendarMonth)decisionActivityCalendarMonth=decisionMonthKey(decisionActivityDateRanges[0]?.from||min||max);
  const [year,month]=decisionActivityCalendarMonth.split('-').map(Number);
  if(!year||!month){
    host.innerHTML='<div class="date-calendar-hint">Inga datum tillgängliga.</div>';
    return;
  }
  const first=new Date(year,month-1,1);
  const days=new Date(year,month,0).getDate();
  const start=(first.getDay()+6)%7;
  const prev=decisionAddMonths(decisionActivityCalendarMonth,-1);
  const next=decisionAddMonths(decisionActivityCalendarMonth,1);
  const minMonth=decisionMonthKey(min);
  const maxMonth=decisionMonthKey(max);
  const weekdays=['M','T','O','T','F','L','S'];
  let cells=weekdays.map(day=>`<div class="date-calendar-weekday">${day}</div>`).join('');
  for(let i=0;i<start;i++)cells+='<span></span>';
  for(let day=1;day<=days;day++){
    const iso=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const disabled=(min&&iso<min)||(max&&iso>max);
    const selected=decisionActivityDateRanges.some(range=>iso===range.from||iso===range.to);
    const inRange=decisionActivityDateRanges.some(range=>iso>range.from&&iso<range.to);
    cells+=`<button type="button" class="date-calendar-day ${selected?'selected':''} ${inRange?'in-range':''}" data-date="${iso}" ${disabled?'disabled':''}>${day}</button>`;
  }
  host.hidden=!decisionActivityDatePickerOpen;
  host.innerHTML=`<div class="date-calendar-head"><button type="button" class="secondary date-calendar-nav" data-nav="-1" ${minMonth&&prev<minMonth?'disabled':''}>‹</button><div class="date-calendar-title">${decisionCalendarMonthSelectHtml(decisionActivityCalendarMonth)}${decisionCalendarYearSelectHtml(min,max,decisionActivityCalendarMonth)}</div><button type="button" class="secondary date-calendar-nav" data-nav="1" ${maxMonth&&next>maxMonth?'disabled':''}>›</button></div><div class="date-calendar-grid">${cells}</div><div class="date-calendar-footer"><div class="date-calendar-hint">${decisionActivityDateDraftFrom?'Välj slutdatum.':'Välj start- och slutdatum.'}</div><button type="button" class="secondary date-calendar-reset" data-reset-activity-date>Rensa datum</button></div>`;
  host.querySelectorAll('[data-nav]').forEach(btn=>btn.onclick=event=>{
    event.stopPropagation();
    decisionActivityCalendarMonth=decisionAddMonths(decisionActivityCalendarMonth,Number(btn.dataset.nav));
    renderDecisionActivityCalendar();
  });
  const monthSelect=host.querySelector('.date-calendar-month');
  const yearSelect=host.querySelector('.date-calendar-year');
  const setVisibleMonth=()=>{
    decisionActivityCalendarMonth=`${yearSelect.value}-${monthSelect.value}`;
    renderDecisionActivityCalendar();
  };
  monthSelect?.addEventListener('change',event=>{
    event.stopPropagation();
    setVisibleMonth();
  });
  yearSelect?.addEventListener('change',event=>{
    event.stopPropagation();
    setVisibleMonth();
  });
  host.querySelector('[data-reset-activity-date]')?.addEventListener('click',event=>{
    event.stopPropagation();
    resetDecisionActivityDateRange();
  });
  host.querySelectorAll('[data-date]').forEach(btn=>btn.onclick=event=>{
    event.stopPropagation();
    selectDecisionActivityCalendarDate(btn.dataset.date);
  });
}

function openDecisionActivityDatePicker(){
  decisionActivityDatePickerOpen=true;
  decisionActivityCalendarMonth=decisionMonthKey(decisionActivityDateRanges[0]?.from||decisionActivityAvailableDates()[0]||'');
  const cal=$('decisionActivityDateCalendar');
  if(cal)cal.hidden=false;
  syncDecisionActivityDateControls();
}

function closeDecisionActivityDatePicker(){
  decisionActivityDatePickerOpen=false;
  decisionActivityDateDraftFrom='';
  decisionActivityDateHover='';
  const host=$('decisionActivityDateCalendar');
  if(host)host.hidden=true;
  syncDecisionActivityDateControls();
}

function toggleDecisionActivityDatePicker(){
  decisionActivityDatePickerOpen?closeDecisionActivityDatePicker():openDecisionActivityDatePicker();
}

function resetDecisionActivityDateRange(){
  decisionActivityDateRanges=[];
  decisionActivityDateDraftFrom='';
  decisionActivityDateHover='';
  resetDecisionActivityPage();
  closeDecisionActivityDatePicker();
  renderDecisionActivityView();
}

function selectDecisionActivityCalendarDate(date){
  if(!decisionActivityDateDraftFrom){
    decisionActivityDateDraftFrom=date;
    renderDecisionActivityCalendar();
    return;
  }
  const range=normalizeDecisionDateRanges([[decisionActivityDateDraftFrom,date]])[0];
  if(range&&!decisionActivityDateRanges.some(saved=>saved.from===range.from&&saved.to===range.to))decisionActivityDateRanges=normalizeDecisionDateRanges([...decisionActivityDateRanges,range]);
  decisionActivityDateDraftFrom='';
  resetDecisionActivityPage();
  closeDecisionActivityDatePicker();
  renderDecisionActivityView();
}

async function exportDecisionActivityXlsx(){
  ensureMunicipalDocumentData();
  buildDecisionActivityFilters();
  const rows=sortedDecisionActivityRows(filteredDecisionActivityRows());
  if(!rows.length){
    $('decisionActivityStatus').textContent='Det finns inga styrdokument att exportera.';
    return;
  }
  const sheetRows=[['Datum','Dokumenttyp','Titel','Sammanfattning','Viktiga punkter','Område/organ','Politisk nivå','Tjänstemannanivå','Diarienummer','Källa'],...rows.map(row=>[row.date||row.dateSort||'',decisionActivityTypeLabel(row.type),row.title||'',row.summary||'',(row.importantPoints||[]).join(' | '),row.party||'',row.politicalOwner||'',row.officialOwner||'',row.caseNumber||row.caseNumbersDetected?.[0]||'',decisionActivitySourceUrl(row)||''])];
  const files=[
    {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
    {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Styrdokument" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/styles.xml',data:stylesXml()},
    {name:'xl/worksheets/sheet1.xml',data:sheetXml(sheetRows)}
  ];
  const blob=zip(files);
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download='orebro_kommuns_styrdokument.xlsx';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

function bindMunicipalDocumentsTabControls(){
  $('decisionActivityType').onchange=()=>handleDecisionActivityFilterChange('decisionActivityType');
  $('decisionActivityParty').onchange=()=>handleDecisionActivityFilterChange('decisionActivityParty');
  $('decisionActivityPoliticalOwner').onchange=()=>handleDecisionActivityFilterChange('decisionActivityPoliticalOwner');
  $('decisionActivityOfficialOwner').onchange=()=>handleDecisionActivityFilterChange('decisionActivityOfficialOwner');
  $('decisionActivitySearch').oninput=event=>{
    decisionActivitySearchQuery=event.target.value;
    resetDecisionActivityPage();
    scheduleTableSearch('decision-activity','decisionActivitySearch',['decisionActivityBody'],()=>renderDecisionActivityView());
  };
  $('decisionActivityBack').onclick=()=>{
    decisionActivityActiveTab=0;
    renderDecisionActivityView();
  };
  $('decisionActivityDateToggle').onclick=event=>{
    event.stopPropagation();
    toggleDecisionActivityDatePicker();
  };
  document.addEventListener('click',event=>{
    if(decisionActivityDatePickerOpen&&!event.target.closest('#decisionActivityView .date-range'))closeDecisionActivityDatePicker();
  });
}
