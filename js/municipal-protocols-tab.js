let decisionRows=[],decisionDecisionRows=[],decisionAllPointRows=[],decisionReady=false,decisionPageSizeValue=250,decisionTabs=[{kind:'list',id:'list',title:'Ärendelista',page:0}],decisionActiveTab=0,decisionDateRanges=[],decisionDatePickerOpen=false,decisionDateFrom='',decisionDateTo='',decisionDateDraftFrom='',decisionDateHover='',decisionCalendarMonth='',decisionSearchQuery='',decisionFilterLocks={decisionProposalType:[],decisionOrgan:[],decisionParty:[],decisionMember:[],decisionVote:[],decisionResult:[]};
let decisionSortColumn='date',decisionSortDir='asc',decisionFilterMatchMode='or';
const decisionFilterIds=['decisionOrgan','decisionProposalType','decisionParty','decisionMember','decisionVote','decisionResult'];

function municipalText(value){return String(value??'');}
function municipalNorm(value){return municipalText(value).trim();}
function municipalTitle(){return decisionPack?.title||decisionPack?.municipality||'Kommunens protokoll';}
function municipalResultLabel(value){const text=municipalText(value);return {beslut:'Beslut',arende:'Ärende','ärende':'Ärende',avslag:'Avslag',aterremiss:'Återremiss','återremiss':'Återremiss',bordlaggning:'Bordläggning','bordläggning':'Bordläggning',besvarad:'Besvarad',overlamnad:'?verlämnad','överlämnad':'?verlämnad',noterad:'Noterad',approved:'Bifall',approved_acclamation:'Bifall (acklamation)',rejected:'Avslag',considered_answered:'Besvarad',remitted_back:'Återremiss',tabled:'Bordläggning',forwarded:'?verlämnad',noted:'Noterad'}[text]||text||'Beslut';}
function municipalTypeLabel(value){const text=municipalText(value);return text?text.charAt(0).toUpperCase()+text.slice(1):'Beslut';}
function municipalPersonName(value){return municipalText(value).replace(/^\s*\d{4}-\d{2}-\d{2}\s+/,'').replace(/\s+/g,' ').trim();}
function municipalMemberLabel(value){const parts=municipalText(value).split('|'),name=municipalPersonName(parts[0]),party=municipalNorm(parts[1]);return party?`${name} (${party})`:name;}
function decisionDisplay(col,value){if(col==='organ')return municipalText(value)||'Okänt organ';if(col==='party')return municipalText(value)||'Okänt parti';if(col==='member')return municipalMemberLabel(value);if(col==='vote')return municipalText(value)||'Votering saknas';if(col==='proposalType')return municipalTypeLabel(value);if(col==='result')return municipalResultLabel(value);return municipalText(value);}
function decisionTitle(){return municipalTitle();}
function decisionPointLabel(doc,point){return (doc?.p&&doc.p[String(point)])||doc?.p?.[point]||`§ ${point}`;}
function decisionProposalTypeForPoint(doc,point){return String(doc?.mt||doc?.pm?.[String(point)]?.matter_type||'beslut');}
function decisionMemberKey(name,party){const clean=municipalPersonName(name),partyKey=municipalNorm(party);return partyKey?`${clean}|${partyKey}`:clean;}
function selectedDecisionValues(id){return decisionFilterLocks[id]||[];}
function normalizeDecisionSelectionState(value){if(Array.isArray(value))return value.map(String).filter(Boolean);if(value===null||value===undefined||value==='')return[];return [String(value)];}
function exportDecisionState(){return {r:3,f:{dr:decisionDateRanges.map(r=>[r.from,r.to]),q:decisionSearchQuery,sc:decisionSortColumn,sd:decisionSortDir,res:selectedDecisionValues('decisionResult'),pt:selectedDecisionValues('decisionProposalType'),o:selectedDecisionValues('decisionOrgan'),p:selectedDecisionValues('decisionParty'),m:selectedDecisionValues('decisionMember'),v:selectedDecisionValues('decisionVote')},af:{dr:decisionActivityDateRanges.map(r=>[r.from,r.to]),q:decisionActivitySearchQuery,sc:decisionActivitySortColumn,sd:decisionActivitySortDir,t:selectedActivityValues('type'),p:selectedActivityValues('party'),po:selectedActivityValues('politicalOwner'),oo:selectedActivityValues('officialOwner')},tabs:decisionTabs.map(t=>copy(t)),a:decisionActiveTab,atabs:decisionActivityTabs.map(t=>copy(t)),aa:decisionActivityActiveTab};}
function applyDecisionState(state){if(!state)return;const isV2=Number(state?.r)>=2,activityState=state?.af||{};decisionDateRanges=normalizeDecisionDateRanges(state?.f?.dr);decisionSearchQuery=String(state?.f?.q||'');decisionSortColumn=['date','title','pointTitle','result','voteCount','yes','no','abstain','absent'].includes(state?.f?.sc)?state.f.sc:'date';decisionSortDir=state?.f?.sd==='desc'?'desc':'asc';decisionFilterLocks={decisionProposalType:normalizeDecisionSelectionState(state?.f?.pt),decisionOrgan:normalizeDecisionSelectionState(isV2?state?.f?.o:(state?.f?.o||state?.f?.p)),decisionParty:normalizeDecisionSelectionState(isV2?state?.f?.p:[]),decisionMember:normalizeDecisionSelectionState(state?.f?.m),decisionVote:normalizeDecisionSelectionState(state?.f?.v),decisionResult:normalizeDecisionSelectionState(state?.f?.res)};decisionActivityDateRanges=normalizeDecisionDateRanges(activityState.dr);decisionActivitySearchQuery=String(activityState.q||'');decisionActivitySortColumn=['date','type','title','summary','points','party'].includes(activityState.sc)?activityState.sc:'date';decisionActivitySortDir=activityState.sd==='desc'?'desc':'asc';decisionActivityFilters={type:normalizeDecisionSelectionState(activityState.t),party:normalizeDecisionSelectionState(activityState.p),politicalOwner:normalizeDecisionSelectionState(activityState.po),officialOwner:normalizeDecisionSelectionState(activityState.oo)};decisionTabs=Array.isArray(state.tabs)&&state.tabs.length?state.tabs.map((t,i)=>({kind:t.kind==='decision'?'decision':'list',id:t.id||'list',proposalKey:t.proposalKey||'',point:t.point||'',sourcePoint:t.sourcePoint||'',sourcePoints:Array.isArray(t.sourcePoints)?t.sourcePoints:normalizeDecisionSelectionState(t.sourcePoints),title:t.title||(t.kind==='decision'?`Ärende ${i}`:'Ärendelista'),page:Number(t.page)||0})):[{kind:'list',id:'list',title:'Ärendelista',page:0}];decisionActiveTab=Math.max(0,Math.min(Number(state.a)||0,decisionTabs.length-1));decisionActivityTabs=Array.isArray(state.atabs)&&state.atabs.length?state.atabs.map((t,i)=>({kind:t.kind==='activity'?'activity':'list',id:t.id||'activity-list',activityId:t.activityId||'',title:t.title||(t.kind==='activity'?`Styrdokument ${i}`:'Styrdokument'),page:Number(t.page)||0})):[{kind:'list',id:'activity-list',title:'Styrdokument'}];decisionActivityActiveTab=Math.max(0,Math.min(Number(state.aa)||0,decisionActivityTabs.length-1));}

function ensureDecisionData(){if(decisionReady)return;const pack=decisionPack;if(!pack||!Array.isArray(pack.d)||!Array.isArray(pack.r)){decisionRows=[];decisionDecisionRows=[];decisionAllPointRows=[];decisionActivityRows=[];decisionReady=false;$('decisionStatus').textContent='Ingen kommunal protokolldata är inläst.';return;}const docs=pack.d.map((d,i)=>({...d,_idx:i})),voteRows=[],decisionIds=new Set(),dates=new Set(),points=new Set(),byDecision=new Map(),allPointRows=[],pointTotals=new Map();decisionActivityRows=Array.isArray(pack.a)?pack.a:[];docs.forEach(doc=>{const id=String(doc.i||`d${doc._idx}`),date=String(doc.dt||''),title=String(doc.t||''),url=String(doc.u||doc.lp||''),pointMap=doc.p||{},voteMap=doc.v||{},pointMeta=doc.pm||{},body=String(doc.b||''),bodyType=String(doc.bt||''),documentTitle=String(doc.doc||''),documentKey=documentTitle?`${documentTitle}|${id}`:'',diary=String(doc.dn||''),caseNumber=String(doc.cn||'');decisionIds.add(id);if(date)dates.add(date);Object.entries(pointMap).forEach(([point,description])=>{const meta=pointMeta[String(point)]||{},voteId=String(voteMap[String(point)]||voteMap[point]||''),proposalType=decisionProposalTypeForPoint(doc,point);points.add(`${id}|${point}`);allPointRows.push({id,point:String(point),date,title,pointTitle:`${point}. ${title||description||'Ärende'}`,description:String(description||''),proposalType,url,docIndex:doc._idx,voteId,voteIds:voteId?[voteId]:[],body,bodyType,documentTitle,documentKey,diary,caseNumber,result:String(meta.result||'beslut'),sourceUrl:String(meta.source_url||url||''),localPath:String(meta.local_path||doc.lp||''),voteCount:0,yes:0,no:0,abstain:0,absent:0,fullVoteCount:0,fullYes:0,fullNo:0,fullAbstain:0,fullAbsent:0});});if(!byDecision.has(id))byDecision.set(id,{id,date,title,url,docIndex:doc._idx,pointMap,voteRows:[]});});for(let i=0;i<pack.r.length;i+=6){const docIndex=Number(pack.r[i]),point=String(pack.r[i+1]??''),name=String(pack.r[i+2]??''),party=String(pack.r[i+3]??''),vote=String(pack.r[i+4]??''),intressentId=String(pack.r[i+5]??''),doc=docs[docIndex]||{},date=String(doc.dt||''),id=String(doc.i||`d${docIndex}`),title=String(doc.t||''),url=String(doc.u||doc.lp||''),description=decisionPointLabel(doc,point),row={docIndex,id,date,title,point,description,proposalType:decisionProposalTypeForPoint(doc,point),name,party,vote,intressentId,url,order:i/6};voteRows.push(row);decisionIds.add(id);if(date)dates.add(date);points.add(`${id}|${point}`);if(!byDecision.has(id))byDecision.set(id,{id,date,title,url,docIndex,pointMap:(docs[docIndex]||{}).p||{},voteRows:[]});byDecision.get(id).voteRows.push(row);const key=`${id}|${point}`;if(!pointTotals.has(key))pointTotals.set(key,{fullVoteCount:0,fullYes:0,fullNo:0,fullAbstain:0,fullAbsent:0});const total=pointTotals.get(key);total.fullVoteCount++;if(vote==='Ja')total.fullYes++;else if(vote==='Nej')total.fullNo++;else if(vote==='Avstår')total.fullAbstain++;else if(vote==='Frånvarande')total.fullAbsent++;}allPointRows.forEach(r=>Object.assign(r,pointTotals.get(`${r.id}|${r.point}`)||{}));decisionRows=voteRows;decisionDecisionRows=[...byDecision.values()].map(d=>({id:d.id,date:d.date,title:d.title,url:d.url,docIndex:d.docIndex,pointCount:Object.keys(d.pointMap||{}).length,voteCount:d.voteRows.length,yes:0,no:0,abstain:0,absent:0}));decisionAllPointRows=allPointRows;decisionReady=true;}

function decisionLoadingStatus(current,total,label,showCount=true){
  const status=$('decisionStatus');
  if(!status)return;
  if(!showCount){
    status.innerHTML=`<span class="decision-load-spinner" aria-hidden="true"></span><span>${esc(label)}...</span>`;
    return;
  }
  const percentage=total?Math.min(100,Math.round(current/total*100)):0;
  status.innerHTML=`<span class="decision-load-spinner" aria-hidden="true"></span><span>${esc(label)} ${fmtInt(current)} av ${fmtInt(total)} (${percentage} %)</span>`;
}
function decisionLoadYield(){return new Promise(resolve=>setTimeout(resolve,0));}
async function ensureDecisionDataProgressively(){
  if(decisionReady)return;
  const pack=decisionPack;
  if(!pack||!Array.isArray(pack.d)||!Array.isArray(pack.r)){ensureDecisionData();return;}
  const docs=[],voteRows=[],byDecision=new Map(),allPointRows=[],pointTotals=new Map();
  for(let start=0;start<pack.d.length;start+=40){
    const end=Math.min(pack.d.length,start+40);
    for(let i=start;i<end;i++)docs.push({...pack.d[i],_idx:i});
    if(typeof decisionUpdateInitialProgressFinal==='function')decisionUpdateInitialProgressFinal(52+(pack.d.length?end/pack.d.length*2:2));
    await decisionLoadYield();
  }
  decisionActivityRows=Array.isArray(pack.a)?pack.a:[];
  for(let start=0;start<docs.length;start+=20){
    const end=Math.min(docs.length,start+20);
    for(let i=start;i<end;i++){
      const doc=docs[i],id=String(doc.i||`d${doc._idx}`),date=String(doc.dt||''),title=String(doc.t||''),url=String(doc.u||doc.lp||''),pointMap=doc.p||{},voteMap=doc.v||{},pointMeta=doc.pm||{},body=String(doc.b||''),bodyType=String(doc.bt||''),documentTitle=String(doc.doc||''),documentKey=documentTitle?`${documentTitle}|${id}`:'',diary=String(doc.dn||''),caseNumber=String(doc.cn||'');
      Object.entries(pointMap).forEach(([point,description])=>{const meta=pointMeta[String(point)]||{},voteId=String(voteMap[String(point)]||voteMap[point]||''),proposalType=decisionProposalTypeForPoint(doc,point);allPointRows.push({id,point:String(point),date,title,pointTitle:`${point}. ${title||description||'Ärende'}`,description:String(description||''),proposalType,url,docIndex:doc._idx,voteId,voteIds:voteId?[voteId]:[],body,bodyType,documentTitle,documentKey,diary,caseNumber,result:String(meta.result||'beslut'),sourceUrl:String(meta.source_url||url||''),localPath:String(meta.local_path||doc.lp||''),voteCount:0,yes:0,no:0,abstain:0,absent:0,fullVoteCount:0,fullYes:0,fullNo:0,fullAbstain:0,fullAbsent:0});});
      if(!byDecision.has(id))byDecision.set(id,{id,date,title,url,docIndex:doc._idx,pointMap,voteRows:[]});
    }
    if(typeof decisionUpdateInitialProgressFinal==='function')decisionUpdateInitialProgressFinal(54+(docs.length?end/docs.length*8:8));
    decisionLoadingStatus(end,docs.length,'Laddar information',false);
    await decisionLoadYield();
  }
  const voteTotal=Math.ceil(pack.r.length/6);
  for(let start=0;start<pack.r.length;start+=1200){
    const end=Math.min(pack.r.length,start+1200);
    for(let i=start;i<end;i+=6){const docIndex=Number(pack.r[i]),point=String(pack.r[i+1]??''),name=String(pack.r[i+2]??''),party=String(pack.r[i+3]??''),vote=String(pack.r[i+4]??''),intressentId=String(pack.r[i+5]??''),doc=docs[docIndex]||{},date=String(doc.dt||''),id=String(doc.i||`d${docIndex}`),title=String(doc.t||''),url=String(doc.u||doc.lp||''),description=decisionPointLabel(doc,point),row={docIndex,id,date,title,point,description,proposalType:decisionProposalTypeForPoint(doc,point),name,party,vote,intressentId,url,order:i/6};voteRows.push(row);if(!byDecision.has(id))byDecision.set(id,{id,date,title,url,docIndex,pointMap:doc.p||{},voteRows:[]});byDecision.get(id).voteRows.push(row);const key=`${id}|${point}`;if(!pointTotals.has(key))pointTotals.set(key,{fullVoteCount:0,fullYes:0,fullNo:0,fullAbstain:0,fullAbsent:0});const total=pointTotals.get(key);total.fullVoteCount++;if(vote==='Ja')total.fullYes++;else if(vote==='Nej')total.fullNo++;else if(vote==='Avstår')total.fullAbstain++;else if(vote==='Frånvarande')total.fullAbsent++;}
    if(typeof decisionUpdateInitialProgressFinal==='function')decisionUpdateInitialProgressFinal(62+(pack.r.length?end/pack.r.length*8:8));
    decisionLoadingStatus(Math.ceil(end/6),voteTotal,'Laddar information',false);
    await decisionLoadYield();
  }
  for(let start=0;start<allPointRows.length;start+=200){
    const end=Math.min(allPointRows.length,start+200);
    for(let i=start;i<end;i++){const row=allPointRows[i];Object.assign(row,pointTotals.get(`${row.id}|${row.point}`)||{});}
    if(typeof decisionUpdateInitialProgressFinal==='function')decisionUpdateInitialProgressFinal(70+(allPointRows.length?end/allPointRows.length*2:2));
    await decisionLoadYield();
  }
  decisionRows=voteRows;
  decisionDecisionRows=[...byDecision.values()].map(d=>({id:d.id,date:d.date,title:d.title,url:d.url,docIndex:d.docIndex,pointCount:Object.keys(d.pointMap||{}).length,voteCount:d.voteRows.length,yes:0,no:0,abstain:0,absent:0}));
  decisionAllPointRows=allPointRows;
  decisionReady=true;
}
function decisionAvailableDates(){return [...new Set(decisionAllPointRows.map(r=>r.date).filter(Boolean))].sort();}
function decisionDateDisplay(value){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:'dd/mm/yyyy';}
function normalizeDecisionDateRanges(value){const ranges=Array.isArray(value)?value:[],seen=new Set();return ranges.map(r=>Array.isArray(r)?{from:String(r[0]||''),to:String(r[1]||r[0]||'')}:{from:String(r?.from||''),to:String(r?.to||r?.from||'')}).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.from)&&/^\d{4}-\d{2}-\d{2}$/.test(r.to)).map(r=>r.from<=r.to?r:{from:r.to,to:r.from}).filter(r=>{const key=`${r.from}|${r.to}`;if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to));}
function decisionMonthKey(value){const m=String(value||'').match(/^(\d{4})-(\d{2})/);return m?`${m[1]}-${m[2]}`:'';}
function decisionAddMonths(monthKey,delta){const [y,m]=String(monthKey||'').split('-').map(Number);if(!y||!m)return'';const d=new Date(y,m-1+delta,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function decisionMonthLabel(monthKey){const [y,m]=String(monthKey||'').split('-').map(Number);if(!y||!m)return'';return new Date(y,m-1,1).toLocaleDateString('sv-SE',{month:'long',year:'numeric'});}
function decisionCalendarMonthSelectHtml(monthKey){const selected=Number(String(monthKey||'').split('-')[1])||1,cap=s=>s?String(s).charAt(0).toUpperCase()+String(s).slice(1):'';return `<select class="date-calendar-month" aria-label="Månad">${Array.from({length:12},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}" ${i+1===selected?'selected':''}>${esc(cap(new Date(2000,i,1).toLocaleDateString('sv-SE',{month:'long'})))}</option>`).join('')}</select>`;}
function decisionCalendarYearSelectHtml(min,max,monthKey){const currentYear=Number(String(monthKey||'').split('-')[0])||new Date().getFullYear(),minYear=Number(String(min||monthKey||'').slice(0,4))||currentYear,maxYear=Number(String(max||monthKey||'').slice(0,4))||currentYear,from=Math.min(minYear,currentYear),to=Math.max(maxYear,currentYear);let html='<select class="date-calendar-year" aria-label="År">';for(let year=from;year<=to;year++)html+=`<option value="${year}" ${year===currentYear?'selected':''}>${year}</option>`;return html+'</select>';}
function decisionDateRangeLabelFor(range){return `${decisionDateDisplay(range.from)} - ${decisionDateDisplay(range.to)}`;}
function decisionDateMatches(date){const value=String(date||'');return !decisionDateRanges.length||decisionDateRanges.some(r=>value>=r.from&&value<=r.to);}
function syncDecisionDateRangeControls(){const dates=decisionAvailableDates(),min=dates[0]||'',max=dates[dates.length-1]||'',from=$('decisionDateFrom'),to=$('decisionDateTo'),toggle=$('decisionDateToggle'),rangeLabel=decisionDateRanges.length?decisionDateRanges.map(decisionDateRangeLabelFor).join(', '):'Alla datum';if(from)from.value=decisionDateFrom;if(to)to.value=decisionDateTo;if(toggle){toggle.setAttribute('aria-expanded',decisionDatePickerOpen?'true':'false');toggle.setAttribute('aria-label',`Datum: ${rangeLabel}`);toggle.title=rangeLabel;}renderDecisionDateLocks();if(!decisionCalendarMonth)decisionCalendarMonth=decisionMonthKey(decisionDateFrom||decisionDateRanges[0]?.from||min||max);if(decisionDatePickerOpen)renderDecisionCalendar();}
function updateDecisionCalendarPreview(){const host=$('decisionDateCalendar');if(!host)return;const previewStart=decisionDateDraftFrom&&decisionDateHover?(decisionDateDraftFrom<decisionDateHover?decisionDateDraftFrom:decisionDateHover):'',previewEnd=decisionDateDraftFrom&&decisionDateHover?(decisionDateDraftFrom<decisionDateHover?decisionDateHover:decisionDateDraftFrom):'';host.querySelectorAll('[data-date]').forEach(btn=>{const iso=btn.dataset.date,selected=iso===decisionDateFrom||decisionDateRanges.some(r=>iso===r.from||iso===r.to),savedRange=decisionDateRanges.some(r=>iso>r.from&&iso<r.to);btn.classList.toggle('selected',selected);btn.classList.toggle('in-range',savedRange);btn.classList.toggle('preview-range',!!previewStart&&iso>=previewStart&&iso<=previewEnd&&!selected);});}
function renderDecisionDateLocks(){const lock=$('decisionDateLocks');if(!lock)return;lock.hidden=!decisionDateRanges.length;if(!decisionDateRanges.length){lock.innerHTML='';return;}lock.innerHTML=decisionDateRanges.map((r,i)=>`<span class="raw-filter-chip decision-date-chip"><span><span>${esc(decisionDateDisplay(r.from))}</span><span>${esc(decisionDateDisplay(r.to))}</span></span><button type="button" data-index="${i}" title="Rensa låst filter" aria-label="Rensa låst filter">×</button></span>`).join('');lock.querySelectorAll('button').forEach(btn=>btn.onclick=e=>{e.stopPropagation();decisionDateRanges.splice(Number(btn.dataset.index),1);resetDecisionPage();buildDecisionFilters();renderDecisionView();});}
function resetDecisionDateRange(){decisionDateFrom='';decisionDateTo='';decisionDateRanges=[];decisionDateDraftFrom='';decisionDateHover='';resetDecisionPage();closeDecisionDatePicker();renderDecisionView();}
function renderDecisionCalendar(){
  const host=$('decisionDateCalendar');
  if(!host)return;
  const dates=decisionAvailableDates(),min=dates[0]||'',max=dates[dates.length-1]||'';
  if(!decisionCalendarMonth)decisionCalendarMonth=decisionMonthKey(decisionDateFrom||decisionDateRanges[0]?.from||min||max);
  const [year,month]=decisionCalendarMonth.split('-').map(Number);
  if(!year||!month){host.innerHTML='<div class="date-calendar-hint">Inga datum tillgängliga.</div>';return;}
  const first=new Date(year,month-1,1),days=new Date(year,month,0).getDate(),start=(first.getDay()+6)%7,prev=decisionAddMonths(decisionCalendarMonth,-1),next=decisionAddMonths(decisionCalendarMonth,1),minMonth=decisionMonthKey(min),maxMonth=decisionMonthKey(max),weekdays=['M','T','O','T','F','L','S'];
  let cells=weekdays.map(d=>`<div class="date-calendar-weekday">${d}</div>`).join('');
  for(let i=0;i<start;i++)cells+='<span></span>';
  for(let day=1;day<=days;day++){
    const iso=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const disabled=(min&&iso<min)||(max&&iso>max),selected=iso===decisionDateFrom||decisionDateRanges.some(r=>iso===r.from||iso===r.to),inRange=decisionDateRanges.some(r=>iso>r.from&&iso<r.to);
    cells+=`<button type="button" class="date-calendar-day ${selected?'selected':''} ${inRange?'in-range':''}" data-date="${iso}" ${disabled?'disabled':''}>${day}</button>`;
  }
  host.hidden=!decisionDatePickerOpen;
  host.innerHTML=`<div class="date-calendar-head"><button type="button" class="secondary date-calendar-nav" data-nav="-1" ${minMonth&&prev<minMonth?'disabled':''}>‹</button><div class="date-calendar-title">${decisionCalendarMonthSelectHtml(decisionCalendarMonth)}${decisionCalendarYearSelectHtml(min,max,decisionCalendarMonth)}</div><button type="button" class="secondary date-calendar-nav" data-nav="1" ${maxMonth&&next>maxMonth?'disabled':''}>›</button></div><div class="date-calendar-grid">${cells}</div><div class="date-calendar-footer"><div class="date-calendar-hint">${decisionDateDraftFrom?'Välj slutdatum.':'Välj start- och slutdatum.'}</div><button type="button" class="secondary date-calendar-reset" data-reset-date>Rensa datum</button></div>`;
  host.querySelectorAll('[data-nav]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();decisionCalendarMonth=decisionAddMonths(decisionCalendarMonth,Number(btn.dataset.nav));renderDecisionCalendar();});
  const monthSelect=host.querySelector('.date-calendar-month'),yearSelect=host.querySelector('.date-calendar-year');
  const setVisibleMonth=()=>{decisionCalendarMonth=`${yearSelect.value}-${monthSelect.value}`;renderDecisionCalendar();};
  monthSelect?.addEventListener('change',e=>{e.stopPropagation();setVisibleMonth();});
  yearSelect?.addEventListener('change',e=>{e.stopPropagation();setVisibleMonth();});
  host.querySelector('[data-reset-date]')?.addEventListener('click',e=>{e.stopPropagation();resetDecisionDateRange();});
  host.querySelectorAll('[data-date]').forEach(btn=>{btn.onclick=e=>{e.stopPropagation();selectDecisionCalendarDate(btn.dataset.date);};btn.onmouseenter=()=>{if(decisionDateDraftFrom){decisionDateHover=btn.dataset.date;updateDecisionCalendarPreview();}};});
  host.querySelector('.date-calendar-grid')?.addEventListener('mouseleave',()=>{if(decisionDateHover){decisionDateHover='';updateDecisionCalendarPreview();}});
  updateDecisionCalendarPreview();
}
function openDecisionDatePicker(){decisionDatePickerOpen=true;decisionCalendarMonth=decisionMonthKey(decisionDateFrom||decisionDateRanges[0]?.from||decisionAvailableDates()[0]||'');const cal=$('decisionDateCalendar');if(cal)cal.hidden=false;syncDecisionDateRangeControls();}
function closeDecisionDatePicker(){decisionDatePickerOpen=false;decisionDateDraftFrom='';decisionDateHover='';const host=$('decisionDateCalendar');if(host)host.hidden=true;syncDecisionDateRangeControls();}
function toggleDecisionDatePicker(){decisionDatePickerOpen?closeDecisionDatePicker():openDecisionDatePicker();}
function selectDecisionCalendarDate(date){if(!decisionDateDraftFrom){decisionDateDraftFrom=date;decisionDateHover='';decisionDateFrom=date;decisionDateTo='';resetDecisionPage();renderDecisionView();return;}const range=normalizeDecisionDateRanges([[decisionDateDraftFrom,date]])[0];if(range&&!decisionDateRanges.some(r=>r.from===range.from&&r.to===range.to))decisionDateRanges=normalizeDecisionDateRanges([...decisionDateRanges,range]);decisionDateFrom='';decisionDateTo='';decisionDateDraftFrom='';decisionDateHover='';resetDecisionPage();closeDecisionDatePicker();renderDecisionView();}

function setDecisionSelectOptions(id,values,selected=[],col='',allLabel='Alla'){const sel=$(id);if(!sel)return;const normalized=normalizeDecisionSelectionState(selected).filter(v=>values.map(String).includes(String(v)));decisionFilterLocks[id]=normalized;const locked=new Set(normalized.map(String));sel.dataset.col=col;sel.innerHTML=[`<option value="">${esc(allLabel)}</option>`,...values.filter(v=>!locked.has(String(v))).map(v=>`<option value="${esc(v)}">${esc(decisionDisplay(col,v))}</option>`)].join('');sel.value='';}
function renderDecisionFilterLocks(){decisionFilterIds.forEach(id=>{const sel=$(id);if(!sel)return;let lock=sel.parentElement.querySelector('.raw-filter-lock');const values=selectedDecisionValues(id);if(!values.length){if(lock)lock.remove();return;}if(!lock){lock=document.createElement('div');lock.className='raw-filter-lock';sel.insertAdjacentElement('afterend',lock);}const col=sel.dataset.col;lock.innerHTML=values.map(v=>`<span class="raw-filter-chip"><span>${esc(decisionDisplay(col,v))}</span><button type="button" data-value="${esc(v)}" title="Rensa låst filter" aria-label="Rensa låst filter">×</button></span>`).join('');lock.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{decisionFilterLocks[id]=selectedDecisionValues(id).filter(v=>v!==btn.dataset.value);handleDecisionFilterChange(id);});});}
function syncDecisionSearchControl(){const input=$('decisionDecisionSearch');if(input&&input.value!==decisionSearchQuery)input.value=decisionSearchQuery;}
function uniqueDecisionValues(values){const seen=new Set(),out=[];values.forEach(value=>{const text=municipalNorm(value);if(!text)return;const key=text.toLocaleLowerCase('sv-SE');if(seen.has(key))return;seen.add(key);out.push(text);});return out.sort((a,b)=>a.localeCompare(b,'sv',{numeric:true,sensitivity:'base'}));}
function buildDecisionFilters(){if(!decisionReady)return;syncDecisionDateRangeControls();syncDecisionSearchControl();const pointRows=decisionAllPointRows.filter(r=>decisionDateMatches(r.date)),dateVoteRows=decisionRows.filter(r=>decisionDateMatches(r.date)),types=uniqueDecisionValues(pointRows.map(r=>r.proposalType)),organs=uniqueDecisionValues(pointRows.map(r=>r.body)),selectedParties=selectedDecisionValues('decisionParty'),parties=uniqueDecisionValues(dateVoteRows.map(r=>r.party)),memberRows=selectedParties.length?dateVoteRows.filter(r=>selectedParties.includes(municipalNorm(r.party))):dateVoteRows,members=uniqueDecisionValues(memberRows.filter(r=>r.name).map(r=>decisionMemberKey(r.name,r.party))),votes=['Ja','Nej','Avstår','Frånvarande'].filter(v=>dateVoteRows.some(r=>r.vote===v)),results=uniqueDecisionValues(pointRows.map(r=>r.result||'beslut'));setDecisionSelectOptions('decisionOrgan',organs,decisionFilterLocks.decisionOrgan,'organ');setDecisionSelectOptions('decisionProposalType',types,decisionFilterLocks.decisionProposalType,'proposalType');setDecisionSelectOptions('decisionParty',parties,decisionFilterLocks.decisionParty,'party');setDecisionSelectOptions('decisionMember',members,decisionFilterLocks.decisionMember,'member');setDecisionSelectOptions('decisionVote',votes,decisionFilterLocks.decisionVote,'vote');setDecisionSelectOptions('decisionResult',results,decisionFilterLocks.decisionResult,'result');renderDecisionFilterLocks();}
function handleDecisionFilterChange(id){const sel=$(id),value=sel?.value;if(value&&!selectedDecisionValues(id).includes(value))decisionFilterLocks[id]=[...selectedDecisionValues(id),value];resetDecisionPage();buildDecisionFilters();renderDecisionView();}
function decisionPointSearchMatches(row){const q=decisionSearchQuery.trim().toLowerCase();if(!q)return true;return [row.title,row.point,row.description,row.body,row.diary,row.documentTitle,row.result,row.proposalType].some(v=>String(v||'').toLowerCase().includes(q));}
function filteredDecisionRows(){const parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote');return decisionRows.filter(r=>decisionDateMatches(r.date)&&(!parties.length||parties.includes(municipalNorm(r.party)))&&(!members.length||members.includes(decisionMemberKey(r.name,r.party)))&&(!votes.length||votes.includes(String(r.vote))));}
function filteredDecisionPointRows(){const organs=selectedDecisionValues('decisionOrgan'),parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote'),results=selectedDecisionValues('decisionResult'),types=selectedDecisionValues('decisionProposalType'),requiresVoteMatch=parties.length||members.length||votes.length,counts=new Map();filteredDecisionRows().forEach(r=>{const key=`${r.id}|${r.point}`;if(!counts.has(key))counts.set(key,{voteCount:0,yes:0,no:0,abstain:0,absent:0});const d=counts.get(key);d.voteCount++;if(r.vote==='Ja')d.yes++;else if(r.vote==='Nej')d.no++;else if(r.vote==='Avstår')d.abstain++;else if(r.vote==='Frånvarande')d.absent++;});return decisionAllPointRows.filter(r=>(!types.length||types.includes(municipalNorm(r.proposalType||'beslut')))&&decisionDateMatches(r.date)&&decisionPointSearchMatches(r)&&(!organs.length||organs.includes(municipalNorm(r.body)))&&(!results.length||results.includes(municipalNorm(r.result||'beslut')))&&(!requiresVoteMatch||counts.has(`${r.id}|${r.point}`))).map(r=>({...r,...(counts.get(`${r.id}|${r.point}`)||{voteCount:0,yes:0,no:0,abstain:0,absent:0})}));}
function decisionPointCompare(a,b){const an=Number(a),bn=Number(b);if(Number.isFinite(an)&&Number.isFinite(bn)&&an!==bn)return an-bn;return String(a).localeCompare(String(b),'sv',{numeric:true,sensitivity:'base'});}
function decisionSortValue(row,col){if(['voteCount','yes','no','abstain','absent'].includes(col))return Number(row[col])||0;if(col==='result')return decisionDisplay('result',row.result);if(col==='title')return row.body||row.title||'';if(col==='pointTitle')return row.pointTitle||'';return row.date||'';}
function decisionSortCompare(a,b,col=decisionSortColumn){const av=decisionSortValue(a,col),bv=decisionSortValue(b,col);let cmp=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'sv',{numeric:true,sensitivity:'base'});if(cmp===0)cmp=String(a.date).localeCompare(String(b.date),'sv',{numeric:true})||String(a.body).localeCompare(String(b.body),'sv',{numeric:true,sensitivity:'base'})||String(a.title).localeCompare(String(b.title),'sv',{numeric:true,sensitivity:'base'})||decisionPointCompare(a.point,b.point)||a.docIndex-b.docIndex;return decisionSortDir==='desc'?-cmp:cmp;}
function sortedDecisionPointRows(rows=filteredDecisionPointRows()){
  const q=typeof decisionSearchNormalizeFinal==='function'?decisionSearchNormalizeFinal(decisionSearchQuery):fuzzySearchNormalize(decisionSearchQuery);
  return [...rows].sort((a,b)=>{
    const manualSort=typeof decisionManualSortActiveFinal==='function'&&decisionManualSortActiveFinal();
    if(q&&!manualSort&&typeof decisionPointSearchRelevanceFinal==='function'){
      const relevance=decisionPointSearchRelevanceFinal(b,q)-decisionPointSearchRelevanceFinal(a,q);
      if(relevance)return relevance;
    }
    return decisionSortCompare(a,b);
  });
}
function decisionSortIndicator(col){const columnSort=typeof decisionManualSortActiveFinal!=='function'||!decisionSearchQuery||decisionManualSortActiveFinal();return columnSort&&decisionSortColumn===col?(decisionSortDir==='asc'?' \u25b2':' \u25bc'):'';}
function decisionSortableHeader(col,label){const columnSort=typeof decisionManualSortActiveFinal!=='function'||!decisionSearchQuery||decisionManualSortActiveFinal(),active=columnSort&&decisionSortColumn===col;return `<th data-decision-sort="${esc(col)}" class="decision-sortable" role="button" tabindex="0" aria-sort="${active?(decisionSortDir==='asc'?'ascending':'descending'):'none'}">${esc(label+decisionSortIndicator(col))}</th>`;}
function setDecisionSort(col){if(decisionSortColumn===col)decisionSortDir=decisionSortDir==='asc'?'desc':'asc';else{decisionSortColumn=col;decisionSortDir=['voteCount','yes','no','abstain','absent'].includes(col)?'desc':'asc';}resetDecisionPage();renderDecisionView();}

function decisionProposalKey(row){return `${String(row?.id||'')}|p|${String(row?.point||'')}`;}
function decisionProposalTabData(row){const sourcePoints=[row?.point].map(String).filter(Boolean);return {proposalKey:decisionProposalKey(row),point:String(row?.point||''),sourcePoint:String(sourcePoints[0]||row?.point||''),sourcePoints};}
function decisionProposalRowByKey(key){return filteredDecisionPointRows().find(r=>decisionProposalKey(r)===String(key||''))||null;}
function decisionActiveTabState(){return decisionTabs[Math.max(0,Math.min(decisionActiveTab,decisionTabs.length-1))];}
function decisionListTab(){return decisionTabs[0];}
function decisionTabTitleFor(row){return `${row.date} · ${row.pointTitle||row.title}`.slice(0,80);}
function renderDecisionTabs(){const box=$('decisionTabs');if(!box)return;box.innerHTML=decisionTabs.map((t,i)=>{const close=t.kind==='list'?'':`<span class="decision-tab-close" role="button" tabindex="0" aria-label="Stäng ärendeflik">×</span>`;return `<button class="decision-tab ${i===decisionActiveTab?'active':''}" data-i="${i}" type="button"><span class="decision-tab-label">${esc(t.title)}</span>${close}</button>`;}).join('');box.querySelectorAll('.decision-tab').forEach(btn=>{btn.onclick=e=>{if(e.target.closest('.decision-tab-close')){closeDecisionTab(Number(btn.dataset.i));return;}decisionActiveTab=Number(btn.dataset.i);renderDecisionView();animateUiRegion(decisionActiveTabState()?.kind==='decision'?$('decisionDetailPane'):$('decisionMasterPane'));};});box.querySelectorAll('.decision-tab-close').forEach(el=>el.onclick=e=>{e.stopPropagation();closeDecisionTab(Number(el.closest('.decision-tab').dataset.i));});}
function closeDecisionTab(index){const tab=decisionTabs[index];if(!tab||tab.kind==='list')return;decisionTabs.splice(index,1);decisionActiveTab=Math.max(0,Math.min(decisionActiveTab,decisionTabs.length-1));renderDecisionView();}
function openDecisionDetail(id,proposalKey=''){const proposal=proposalKey?decisionProposalRowByKey(proposalKey):null,decision=decisionDecisionRows.find(r=>r.id===String(id||proposal?.id||''));if(!decision)return;const proposalData=proposal?decisionProposalTabData(proposal):{},key=proposalData.proposalKey||'';const existing=decisionTabs.findIndex(t=>t.kind==='decision'&&t.id===decision.id&&String(t.proposalKey||'')===key);if(existing>=0){decisionActiveTab=existing;renderDecisionView();return;}decisionTabs.push({kind:'decision',id:decision.id,...proposalData,title:proposal?decisionTabTitleFor(proposal):decisionTabTitleFor(decision),page:0});decisionActiveTab=decisionTabs.length-1;renderDecisionView();}
function decisionDetailRows(tab){const id=typeof tab==='object'?tab.id:tab,sourcePoints=typeof tab==='object'?normalizeDecisionSelectionState(tab.sourcePoints):[];let rows=filteredDecisionRows().filter(r=>r.id===id);if(sourcePoints.length)rows=rows.filter(r=>sourcePoints.includes(String(r.point)));else if(typeof tab==='object'&&(tab.sourcePoint||tab.point))rows=rows.filter(r=>String(r.point)===String(tab.sourcePoint||tab.point));return rows;}
function decisionPointPassed(row){return !['avslag','rejected'].includes(String(row?.result||'').toLowerCase());}
function decisionPointResultLabel(row){return decisionDisplay('result',row?.result||'beslut');}
function decisionResultLabelHtml(label){return esc(label);}
function decisionPointResultHtml(row){return `<span class="decision-status-pill ${decisionPointPassed(row)?'vote':'zero'}">${decisionResultLabelHtml(decisionPointResultLabel(row))}</span>`;}
function decisionPointRowClass(){return 'decision-selectable-row';}
function decisionMasterSummaryCards(rows=filteredDecisionRows(),pointRows=filteredDecisionPointRows()){const cases=new Set(pointRows.map(r=>r.id).filter(Boolean)),votes=new Set(pointRows.filter(r=>r.voteCount).map(r=>r.voteId||`${r.id}|${r.point}`)),decisions=pointRows.filter(r=>String(r.result||'')==='beslut').length;return [['Ärenden',fmtInt(cases.size)],['Beslutspunkter',fmtInt(pointRows.length)],['Voteringar',fmtInt(votes.size)],['Beslut',fmtInt(decisions)],['Övrig hantering',fmtInt(pointRows.length-decisions)]].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');}
function municipalCaseCellHtml(row){const title=municipalText(row.title)||'Ärende',description=municipalText(row.description),sameDescription=!description||municipalNorm(description)===municipalNorm(title),pointLabel=row.point?`§ ${row.point}`:'',heading=sameDescription&&pointLabel?`${pointLabel} ${title}`:title,decisionPoint=!sameDescription?`Punkt${pointLabel?` ${pointLabel}`:''}: ${description}`:'';return `<div class="decision-case-cell"><strong>${esc(heading)}</strong>${decisionPoint?`<small class="decision-point-note" title="${esc(decisionPoint)}">${esc(decisionPoint)}</small>`:''}${row.diary?`<small>${esc(row.diary)}</small>`:''}</div>`;}
function renderDecisionMasterView(){const listTab=decisionListTab(),filteredRows=filteredDecisionPointRows(),rows=sortedDecisionPointRows(filteredRows),size=decisionPageSize(),page=pageSlice(rows,listTab.page||0,size);listTab.page=page.page;$('decisionOverview').innerHTML=decisionMasterSummaryCards(undefined,filteredRows);$('decisionStatus').textContent=rows.length?`Visar ${fmtInt(page.start+1)}-${fmtInt(page.start+page.rows.length)} av ${fmtInt(rows.length)} kommunala ärenden för ${decisionTitle()}. Klicka en rad för att öppna ärendet i en egen flik.`:'Inga kommunala ärenden matchar de aktiva filtren.';$('decisionPage').textContent=`Sida ${fmtInt(page.page+1)} av ${fmtInt(page.pages)}`;$('decisionPrev').disabled=page.page<=0;$('decisionNext').disabled=page.page>=page.pages-1;$('decisionHead').innerHTML=`<tr>${decisionSortableHeader('date','Datum')}${decisionSortableHeader('title','Organ')}${decisionSortableHeader('pointTitle','Ärende')}${decisionSortableHeader('result','Status')}${decisionSortableHeader('voteCount','Röster')}${decisionSortableHeader('yes','Ja')}${decisionSortableHeader('no','Nej')}${decisionSortableHeader('abstain','Avstår')}${decisionSortableHeader('absent','Frånvarande')}<th>Källa</th></tr>`;$('decisionHead').querySelectorAll('[data-decision-sort]').forEach(th=>{th.onclick=()=>setDecisionSort(th.dataset.decisionSort);th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDecisionSort(th.dataset.decisionSort);}};});$('decisionBody').innerHTML=page.rows.map(r=>{const source=r.sourceUrl||r.url||r.localPath||'';return `<tr class="${decisionPointRowClass(r)}" data-id="${esc(r.id)}" data-proposal-key="${esc(decisionProposalKey(r))}"><td>${esc(r.date)}</td><td>${esc(r.body||'')}</td><td>${municipalCaseCellHtml(r)}</td><td>${decisionPointResultHtml(r)}</td><td class="num">${fmtInt(r.voteCount)}</td><td class="num">${fmtInt(r.yes)}</td><td class="num">${fmtInt(r.no)}</td><td class="num">${fmtInt(r.abstain)}</td><td class="num">${fmtInt(r.absent)}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'—'}</td></tr>`;}).join('');$('decisionBody').querySelectorAll('.decision-selectable-row').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionDetail(row.dataset.id,row.dataset.proposalKey);});$('decisionMasterPane').hidden=false;$('decisionDetailPane').hidden=true;}
function decisionDetailSummaryCards(rows = [], proposal = null) {
  const votes = rows.reduce((acc, r) => {
    acc[r.vote] = (acc[r.vote] || 0) + 1;
    return acc;
  }, {});
  const items = [
    ['Status', decisionPointResultLabel(proposal)],
    ['Röster', fmtInt(rows.length)],
    ['Ja', fmtInt(votes.Ja || 0)],
    ['Nej', fmtInt(votes.Nej || 0)],
    ['Avstår', fmtInt(votes.Avstår || 0)],
    ['Frånvarande', fmtInt(votes['Frånvarande'] || 0)],
  ];
  return items
    .map(([k, v]) => `<div class="card${k === 'Status' ? ' decision-result-card' : ''}">${esc(k)}<b>${esc(String(v))}</b></div>`)
    .join('');
}
function decisionDetailHierarchyHtml(decision,proposal,tab){if(!proposal&&!tab?.proposalKey)return'';const pointLabel=normalizeDecisionSelectionState(tab.sourcePoints).join(', ')||tab.sourcePoint||tab.point||'',type=decisionDisplay('proposalType',proposal?.proposalType||'beslut'),result=decisionPointResultLabel(proposal);return `<div class="decision-hierarchy"><div class="decision-hierarchy-item"><span>Organ</span><strong>${esc(proposal?.body||'Kommun')}</strong><small>${esc(decision.date)}</small></div><div class="decision-hierarchy-arrow">›</div><div class="decision-hierarchy-item primary"><span>Ärende</span><strong>${esc(proposal?.title||decision.title||'Ärende')}</strong><small>${esc([type,proposal?.diary,pointLabel?`§ ${pointLabel}`:''].filter(Boolean).join(' · '))}</small><span class="decision-detail-result ${decisionPointPassed(proposal)?'vote':'zero'}">Status: ${esc(result)}</span></div></div>`;}
function decisionPointPartyGroups(rows,proposal=null){const map=new Map();rows.forEach(r=>{const eventId=decisionVoteEventBase(r.intressentId)||`point:${r.point}`;if(!map.has(eventId))map.set(eventId,{eventId,point:String(r.point),description:r.description,rows:[],meta:proposal?.voteEvents?.[eventId]||{}});map.get(eventId).rows.push(r);});Object.entries(proposal?.voteEvents||{}).forEach(([eventId,meta])=>{if(!map.has(eventId))map.set(eventId,{eventId,point:String(proposal?.point||''),description:proposal?.description||'',rows:[],meta});});return [...map.values()].sort((a,b)=>String(a.eventId).localeCompare(String(b.eventId),'sv',{numeric:true,sensitivity:'base'}));}
function decisionVoteNames(rows){return rows.sort((a,b)=>String(a.name).localeCompare(String(b.name),'sv',{numeric:true,sensitivity:'base'})).map(r=>`<li>${esc(r.name)}</li>`).join('');}
function decisionVotesAreFiltered(){return !!(selectedDecisionValues('decisionParty').length||selectedDecisionValues('decisionMember').length||selectedDecisionValues('decisionVote').length);}
function decisionVoteTypeCount(meta,vote,namedCount){if(decisionVotesAreFiltered())return namedCount;const field={Ja:'stated_yes',Nej:'stated_no','Avstår':'stated_abstain','Frånvarande':'stated_absent'}[vote];const stated=Number(meta?.[field])||0;return stated||namedCount||0;}
function decisionPointPartyHtml(group,index,total){const filtered=decisionVotesAreFiltered(),isPosition=group.meta?.source_kind==='yrkande',voteTypes=['Ja','Nej','Avstår','Frånvarande'],voteHtml=voteTypes.map(vote=>{const voteRows=group.rows.filter(r=>r.vote===vote),count=decisionVoteTypeCount(group.meta,vote,voteRows.length);if(!count)return'';const parties=new Map();voteRows.forEach(r=>{const key=r.party||'—';if(!parties.has(key))parties.set(key,[]);parties.get(key).push(r);});const partyHtml=[...parties.entries()].sort((a,b)=>decisionDisplay('party',a[0]).localeCompare(decisionDisplay('party',b[0]),'sv',{numeric:true,sensitivity:'base'})).map(([party,rows])=>`<section class="decision-point-party"><h5>${esc(decisionDisplay('party',party))} · ${fmtInt(rows.length)}</h5><ul>${decisionVoteNames(rows)}</ul></section>`).join(''),missing=count-voteRows.length,missingHtml=!filtered&&missing>0?`<p class="decision-vote-missing">Protokollet anger ${fmtInt(count)} ${esc(vote.toLowerCase())}, men ${fmtInt(voteRows.length)} är namngivna.</p>`:'';return `<section class="decision-vote-type"><h4>${esc(vote)} <strong>${fmtInt(count)}</strong></h4>${partyHtml?`<div class="decision-point-party-list">${partyHtml}</div>`:''}${missingHtml}</section>`;}).join(''),conflict=!filtered&&group.meta?.count_conflict?'<div class="decision-vote-conflict">Källkonflikt: protokollets tryckta totalsiffra avviker från den uttryckliga namnlistan. Visade personer och partisummor räknas från namnlistan.</div>':'';const heading=isPosition?'Namngivna yrkanden':total>1?`Votering ${fmtInt(index+1)}`:'Votering';return `<article class="decision-point-card"><h3>${heading}</h3>${conflict}${voteHtml}</article>`;}
function decisionDetailSummaryCards(rows = [], proposal = null) {
  const events =
    Object.keys(proposal?.voteEvents || {}).length ||
    new Set(rows.map(r => decisionVoteEventBase(r.intressentId)).filter(Boolean)).size;
  const items = [
    ['Status', decisionPointResultLabel(proposal)],
    ['Voteringar', fmtInt(events)],
    ['Namngivna röster', fmtInt(rows.length)],
  ];
  return items
    .map(([k, v]) => `<div class="card${k === 'Status' ? ' decision-result-card' : ''}">${esc(k)}<b>${esc(String(v))}</b></div>`)
    .join('');
}

function decisionOrganCanonical(value){
  let text=municipalNorm(value).replace(/\s+/g,' ');
  text=text.replace(/\s+20\d{2}.*20\d{2}$/,'');
  text=text.replace(/h?llbarhetssutskott/gi,'h?llbarhetsutskott');
  text=text.replace(/hållbarhetssutskott/gi,'hållbarhetsutskott');
  return text;
}
function decisionOrganMatches(selected,value){
  const canonical=decisionOrganCanonical(value);
  return selected.includes(canonical)||selected.includes(municipalNorm(value));
}
const decisionDisplayBeforeOrganCanonical=decisionDisplay;
decisionDisplay=function(col,value){
  if(col==='organ')return decisionOrganCanonical(value)||'Okänt organ';
  return decisionDisplayBeforeOrganCanonical(col,value);
};

function uniqueDecisionOrganValues(values){
  return uniqueDecisionValues(values.map(decisionOrganCanonical));
}
const setDecisionSelectOptionsBeforeOrganCanonical=setDecisionSelectOptions;
setDecisionSelectOptions=function(id,values,selected=[],col='',allLabel='Alla'){
  if(id==='decisionOrgan'){
    return setDecisionSelectOptionsBeforeOrganCanonical(id,uniqueDecisionOrganValues(values),normalizeDecisionSelectionState(selected).map(decisionOrganCanonical),col,allLabel);
  }
  return setDecisionSelectOptionsBeforeOrganCanonical(id,values,selected,col,allLabel);
};
decisionFilteredAttendanceRows=function(){
  const organs=selectedDecisionValues('decisionOrgan'),parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember');
  return decisionMemberRows.filter(r=>decisionDateMatches(r.date)&&(!organs.length||decisionOrganMatches(organs,r.body))&&(!parties.length||parties.includes(municipalNorm(r.party)))&&(!members.length||members.includes(r.memberKey)));
};
buildDecisionFilters=function(){
  if(!decisionReady)return;
  syncDecisionDateRangeControls();
  syncDecisionSearchControl();
  const pointRows=decisionAllPointRows.filter(r=>decisionDateMatches(r.date)),dateVoteRows=decisionRows.filter(r=>decisionDateMatches(r.date)),selectedOrgans=selectedDecisionValues('decisionOrgan'),organMemberRows=decisionMemberRows.filter(r=>decisionDateMatches(r.date)&&(!selectedOrgans.length||decisionOrganMatches(selectedOrgans,r.body))),types=uniqueDecisionValues(pointRows.map(r=>r.proposalType)),organs=uniqueDecisionOrganValues(pointRows.map(r=>r.body)),selectedParties=selectedDecisionValues('decisionParty'),parties=uniqueDecisionValues([...dateVoteRows.map(r=>r.party),...organMemberRows.map(r=>r.party)]),voteMemberRows=selectedParties.length?dateVoteRows.filter(r=>selectedParties.includes(municipalNorm(r.party))):dateVoteRows,attendanceMemberRows=selectedParties.length?organMemberRows.filter(r=>selectedParties.includes(municipalNorm(r.party))):organMemberRows,members=uniqueDecisionValues([...voteMemberRows.filter(r=>r.name).map(r=>decisionMemberKey(r.name,r.party)),...attendanceMemberRows.filter(r=>r.name).map(r=>decisionMemberKey(r.name,r.party))]),votes=['Ja','Nej','Avstår','Frånvarande'].filter(v=>dateVoteRows.some(r=>r.vote===v)),results=uniqueDecisionValues(pointRows.map(r=>r.result||'beslut'));
  setDecisionSelectOptions('decisionOrgan',organs,decisionFilterLocks.decisionOrgan,'organ');
  setDecisionSelectOptions('decisionProposalType',types,decisionFilterLocks.decisionProposalType,'proposalType');
  setDecisionSelectOptions('decisionParty',parties,decisionFilterLocks.decisionParty,'party');
  setDecisionSelectOptions('decisionMember',members,decisionFilterLocks.decisionMember,'member');
  setDecisionSelectOptions('decisionVote',votes,decisionFilterLocks.decisionVote,'vote');
  setDecisionSelectOptions('decisionResult',results,decisionFilterLocks.decisionResult,'result');
  renderDecisionFilterLocks();
};
filteredDecisionPointRows=function(){
  const organs=selectedDecisionValues('decisionOrgan'),parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote'),results=selectedDecisionValues('decisionResult'),types=selectedDecisionValues('decisionProposalType'),requiresVoteMatch=parties.length||members.length||votes.length,attendanceKeys=new Set(members.length&&!votes.length?decisionFilteredAttendanceRows().map(r=>r.attendanceKey):[]),counts=new Map();
  filteredDecisionRows().forEach(r=>{const key=`${r.id}|${r.point}`;if(!counts.has(key))counts.set(key,{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0,voteIds:new Set()});const d=counts.get(key);d.voteCount++;const eventId=decisionVoteEventBase(r.intressentId);if(eventId)d.voteIds.add(eventId);d.voteRoundCount=d.voteIds.size;if(r.vote==='Ja')d.yes++;else if(r.vote==='Nej')d.no++;else if(r.vote==='Avstår')d.abstain++;else if(r.vote==='Frånvarande')d.absent++;});
  return decisionAllPointRows.filter(r=>(!types.length||types.includes(municipalNorm(r.proposalType||'beslut')))&&decisionDateMatches(r.date)&&decisionPointSearchMatches(r)&&(!organs.length||decisionOrganMatches(organs,r.body))&&(!results.length||results.includes(municipalNorm(r.result||'beslut')))&&(!requiresVoteMatch||counts.has(`${r.id}|${r.point}`)||attendanceKeys.has(r.attendanceKey))).map(r=>{const c=counts.get(`${r.id}|${r.point}`)||{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0};if(requiresVoteMatch&&!attendanceKeys.has(r.attendanceKey))return {...r,voteRoundCount:c.voteRoundCount||0,voteCount:c.voteCount||0,yes:c.yes||0,no:c.no||0,abstain:c.abstain||0,absent:c.absent||0};if(requiresVoteMatch&&attendanceKeys.has(r.attendanceKey)&&!counts.has(`${r.id}|${r.point}`))return {...r,voteRoundCount:r.fullVoteRoundCount||0,voteCount:r.fullVoteCount||0,yes:r.fullYes||0,no:r.fullNo||0,abstain:r.fullAbstain||0,absent:r.fullAbsent||0};const yes=decisionPreferNamedCount(c.yes||r.fullYes,r.statedYes),no=decisionPreferNamedCount(c.no||r.fullNo,r.statedNo),abstain=decisionPreferNamedCount(c.abstain||r.fullAbstain,r.statedAbstain),absent=decisionPreferNamedCount(c.absent||r.fullAbsent,r.statedAbsent),voteCount=Math.max(c.voteCount||0,r.fullVoteCount||0,yes+no+abstain+absent),voteRoundCount=Math.max(c.voteRoundCount||0,r.fullVoteRoundCount||0,(r.voteIds||[]).length);return {...r,voteRoundCount,voteCount,yes,no,abstain,absent};});
};
/* Final source anchors and representative detail-card overrides. Keep at EOF. */
const ensureDecisionDataBeforeFinalSourceMeta=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeFinalSourceMeta();
  if(!decisionReady||decisionPack?._finalSourceMetaReady)return;
  const docs=decisionPack.d||[];
  decisionAllPointRows.forEach(row=>{
    const doc=docs[row.docIndex]||{},meta=doc.pm?.[String(row.point)]||{};
    row.decisionLevel=String(meta.decision_level||'');
    row.matterOutcome=String(meta.matter_outcome||doc.mo||'');
    row.confidence=String(meta.confidence||doc.cf||'');
    row.matterId=String(meta.matter_id||doc.mi||'');
    row.sourcePage=Number(meta.source_page)||0;
    row.sourcePageEnd=Number(meta.source_page_end)||0;
    row.sourceTop=Number(meta.source_top??meta.source_y??meta.target_top??meta.target_y);
    if(meta.source_url)row.sourceUrl=String(meta.source_url);
    if(meta.local_path)row.localPath=String(meta.local_path);
  });
  decisionPack._finalSourceMetaReady=true;
};
function decisionDetailSummaryCards(rows = [], proposal = null) {
  const votes = rows.reduce((acc, r) => {
    acc[r.vote] = (acc[r.vote] || 0) + 1;
    return acc;
  }, {});
  const items = [
    ['Status', decisionPointResultLabel(proposal)],
    ['Voteringar', fmtInt(Object.keys(proposal?.voteEvents || {}).length || rows.length)],
    ['Namngivna röster', fmtInt(rows.length)],
  ];
  return items.map(([k, v]) => `<div class="card${k === 'Status' ? ' decision-result-card' : ''}">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
}
function decisionDetailSummaryCards(rows=[],proposal=null){
  const events=Object.keys(proposal?.voteEvents||{}).length||new Set(rows.map(r=>decisionVoteEventBase(r.intressentId)).filter(Boolean)).size;
  const positionCount=decisionPositionRows.filter(r=>r.id===proposal?.id&&String(r.point)===String(proposal?.point)).length;
  const items=[
    ['Beslut',decisionPointResultLabel(proposal),'decision-result-card'],
    ['Hantering',decisionSemanticLevelLabel(proposal?.decisionLevel),''],
    ['Utfall',decisionSemanticOutcomeLabel(proposal?.matterOutcome),''],
    ['Voteringar',events?fmtInt(events):'Ingen formell votering',''],
    ['Namngivna röster',rows.length?fmtInt(rows.length):'Saknas',''],
    ['Yrkanden',positionCount?fmtInt(positionCount):'Inga namngivna','']
  ];
  return items.map(([k,v,cls])=>`<div class="card ${esc(cls||'')}"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('');
}

/* Effective final in-text reference links. Keep at EOF. */
function decisionReferencePointBaseFinal(value){
  const match=String(value||'').match(/\d+/);
  return match?match[0]:'';
}
function decisionReferenceTargetFinal(current,pointText){
  const base=decisionReferencePointBaseFinal(pointText);
  if(!base)return null;
  const matches=decisionAllPointRows.filter(r=>decisionReferencePointBaseFinal(r.point)===base);
  if(!matches.length)return null;
  const sameDoc=matches.filter(r=>r.documentTitle&&current?.documentTitle&&r.documentTitle===current.documentTitle);
  const sameMeeting=matches.filter(r=>r.date===current?.date&&r.body===current?.body);
  const sameBody=matches.filter(r=>r.body===current?.body);
  const pool=sameDoc.length?sameDoc:sameMeeting.length?sameMeeting:sameBody.length?sameBody:matches;
  return pool.slice().sort((a,b)=>String(a.point).length-String(b.point).length||String(a.point).localeCompare(String(b.point),'sv',{numeric:true}))[0]||null;
}
function decisionTextWithReferenceLinksFinal(value,current){
  const text=String(value||''),re=/(§\s*\d{1,4}(?:\.\d+)?)/g;
  let out='',last=0,match;
  while((match=re.exec(text))){
    const target=decisionReferenceTargetFinal(current,match[1]);
    out+=esc(text.slice(last,match.index));
    if(target){
      out+=`<button type="button" class="decision-text-ref" data-id="${esc(target.id)}" data-proposal-key="${esc(decisionProposalKey(target))}" title="${esc(target.protocolHeader||target.pointTitle||target.title||match[1])}">${esc(match[1])}</button>`;
    }else{
      out+=esc(match[1]);
    }
    last=re.lastIndex;
  }
  out+=esc(text.slice(last));
  return out.replace(/\n/g,'<br>');
}
function decisionLinkedParagraphsHtmlFinal(value,current){
  const blocks=String(value||'').split(/\n{2,}/).map(block=>block.trim()).filter(Boolean);
  return blocks.map(block=>`<p>${decisionTextWithReferenceLinksFinal(block,current)}</p>`).join('');
}
decisionDetailTextHtml=function(proposal){
  const description=proposal?.abstractText||'',decisionText=proposal?.fullDecisionText||proposal?.description||'';
  return `${description?`<article class="decision-point-card decision-text-card"><h3>\u00c4rendebeskrivning</h3>${decisionLinkedParagraphsHtmlFinal(description,proposal)}</article>`:''}${decisionText?`<article class="decision-point-card decision-text-card"><h3>Beslut</h3>${decisionLinkedParagraphsHtmlFinal(decisionText,proposal)}</article>`:''}`;
};
const renderDecisionDetailViewBeforeReferenceLinksFinal=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeReferenceLinksFinal(tab);
  $('decisionDetailGroups')?.querySelectorAll('.decision-text-ref').forEach(btn=>{
    btn.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      openDecisionDetail(btn.dataset.id,btn.dataset.proposalKey);
    };
  });
};

/* Effective final in-text reference links. Keep at EOF. */
function decisionReferencePointBase(value){
  const match=String(value||'').match(/\d+/);
  return match?match[0]:'';
}
function decisionReferenceTarget(current,pointText){
  const base=decisionReferencePointBase(pointText);
  if(!base)return null;
  const matches=decisionAllPointRows.filter(r=>decisionReferencePointBase(r.point)===base);
  if(!matches.length)return null;
  const sameDoc=matches.filter(r=>r.documentTitle&&current?.documentTitle&&r.documentTitle===current.documentTitle);
  const sameMeeting=matches.filter(r=>r.date===current?.date&&r.body===current?.body);
  const pool=sameDoc.length?sameDoc:sameMeeting.length?sameMeeting:matches;
  return pool.slice().sort((a,b)=>String(a.point).length-String(b.point).length||String(a.point).localeCompare(String(b.point),'sv',{numeric:true}))[0]||null;
}
function decisionTextWithReferenceLinks(value,current){
  const text=String(value||''),re=/(§\s*\d{1,4}(?:\.\d+)?)/g;
  let out='',last=0,match;
  while((match=re.exec(text))){
    const target=decisionReferenceTarget(current,match[1]);
    out+=esc(text.slice(last,match.index));
    if(target){
      out+=`<button type="button" class="decision-text-ref" data-id="${esc(target.id)}" data-proposal-key="${esc(decisionProposalKey(target))}" title="${esc(target.protocolHeader||target.pointTitle||target.title||match[1])}">${esc(match[1])}</button>`;
    }else{
      out+=esc(match[1]);
    }
    last=re.lastIndex;
  }
  out+=esc(text.slice(last));
  return out.replace(/\n/g,'<br>');
}
function decisionLinkedParagraphsHtml(value,current){
  const blocks=String(value||'').split(/\n{2,}/).map(block=>block.trim()).filter(Boolean);
  return blocks.map(block=>`<p>${decisionTextWithReferenceLinks(block,current)}</p>`).join('');
}
decisionDetailTextHtml=function(proposal){
  const description=proposal?.abstractText||'',decisionText=proposal?.fullDecisionText||proposal?.description||'';
  return `${description?`<article class="decision-point-card decision-text-card"><h3>\u00c4rendebeskrivning</h3>${decisionLinkedParagraphsHtml(description,proposal)}</article>`:''}${decisionText?`<article class="decision-point-card decision-text-card"><h3>Beslut</h3>${decisionLinkedParagraphsHtml(decisionText,proposal)}</article>`:''}`;
};
const renderDecisionDetailViewBeforeTextReferenceLinks=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeTextReferenceLinks(tab);
  $('decisionDetailGroups')?.querySelectorAll('.decision-text-ref').forEach(btn=>{
    btn.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      openDecisionDetail(btn.dataset.id,btn.dataset.proposalKey);
    };
  });
};
renderDecisionMasterView=function(){
  const listTab=decisionListTab(),filteredRows=filteredDecisionPointRows(),rows=sortedDecisionPointRows(filteredRows),size=decisionPageSize(),page=pageSlice(rows,listTab.page||0,size);
  listTab.page=page.page;
  $('decisionOverview').innerHTML=decisionMasterSummaryCards(undefined,filteredRows);
  $('decisionStatus').textContent=rows.length?`Visar ${fmtInt(page.start+1)}-${fmtInt(page.start+page.rows.length)} av ${fmtInt(rows.length)} beslutspunkter f\u00f6r ${decisionTitle()}. Klicka en rad f\u00f6r att \u00f6ppna \u00e4rendet i en egen flik.`:'Inga beslutspunkter matchar de aktiva filtren.';
  $('decisionPage').textContent=`Sida ${fmtInt(page.page+1)} av ${fmtInt(page.pages)}`;
  $('decisionPrev').disabled=page.page<=0;
  $('decisionNext').disabled=page.page>=page.pages-1;
  $('decisionHead').innerHTML=`<tr>${decisionSortableHeader('date','Datum')}${decisionSortableHeader('title','Organ')}${decisionSortableHeader('pointTitle','\u00c4rende')}${decisionSortableHeader('result','Status')}${decisionSortableHeader('voteRoundCount','Voteringar')}${decisionSortableHeader('voteCount','R\u00f6stning')}${decisionSortableHeader('yes','Ja')}${decisionSortableHeader('no','Nej')}${decisionSortableHeader('abstain','Avst\u00e5r')}${decisionSortableHeader('absent','Fr\u00e5nvarande')}<th>K\u00e4lla</th></tr>`;
  $('decisionHead').querySelectorAll('[data-decision-sort]').forEach(th=>{th.onclick=()=>setDecisionSort(th.dataset.decisionSort);th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDecisionSort(th.dataset.decisionSort);}};});
  $('decisionBody').innerHTML=page.rows.map(r=>{const source=decisionAnchoredSourceUrl(r);return `<tr class="${decisionPointRowClass(r)}" data-id="${esc(r.id)}" data-proposal-key="${esc(decisionProposalKey(r))}"><td>${esc(r.date)}</td><td>${esc(r.body||'')}</td><td>${municipalCaseCellHtml(r)}</td><td>${decisionPointResultHtml(r)}</td><td class="num">${fmtInt(r.voteRoundCount)}</td><td class="num">${fmtInt(r.voteCount)}</td><td class="num">${fmtInt(r.yes)}</td><td class="num">${fmtInt(r.no)}</td><td class="num">${fmtInt(r.abstain)}</td><td class="num">${fmtInt(r.absent)}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">\u00d6ppna</a>`:'-'}</td></tr>`;}).join('');
  $('decisionBody').querySelectorAll('.decision-selectable-row').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionDetail(row.dataset.id,row.dataset.proposalKey);});
  $('decisionMasterPane').hidden=false;
  $('decisionDetailPane').hidden=true;
};

municipalCaseCellHtml=function(row){
  const fallback=[row?.point?`\u00a7 ${row.point}`:'',municipalText(row?.title)||'\u00c4rende'].filter(Boolean).join(' ');
  const title=municipalText(row?.protocolHeader)||fallback;
  const preview=decisionPlainPreview(row?.abstractText||row?.description||title);
  return `<div class="decision-case-cell"><strong>${esc(title)}</strong>${preview?`<small class="decision-point-note" title="${esc(preview)}">${esc(preview)}</small>`:''}</div>`;
};
const renderDecisionDetailViewBeforeFinalProtocolHeaderLast=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeFinalProtocolHeaderLast(tab);
  const proposal=decisionProposalRowByKey(tab.proposalKey);
  if(proposal?.protocolHeader){
    $('decisionDetailTitle').textContent=proposal.protocolHeader;
    const hierarchyTitle=document.querySelector('.decision-hierarchy-item.primary strong');
    if(hierarchyTitle)hierarchyTitle.textContent=proposal.protocolHeader;
  }
};

municipalCaseCellHtml=function(row){
  const fallback=[row?.point?`\u00a7 ${row.point}`:'',municipalText(row?.title)||'\u00c4rende'].filter(Boolean).join(' ');
  const title=municipalText(row?.protocolHeader)||fallback;
  const preview=decisionPlainPreview(row?.abstractText||row?.description||title);
  return `<div class="decision-case-cell"><strong>${esc(title)}</strong>${preview?`<small class="decision-point-note" title="${esc(preview)}">${esc(preview)}</small>`:''}</div>`;
};
const renderDecisionDetailViewBeforeFinalProtocolHeaderEof=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeFinalProtocolHeaderEof(tab);
  const proposal=decisionProposalRowByKey(tab.proposalKey);
  if(proposal?.protocolHeader){
    $('decisionDetailTitle').textContent=proposal.protocolHeader;
    const hierarchyTitle=document.querySelector('.decision-hierarchy-item.primary strong');
    if(hierarchyTitle)hierarchyTitle.textContent=proposal.protocolHeader;
  }
};

municipalCaseCellHtml=function(row){
  const fallback=[row?.point?`\u00a7 ${row.point}`:'',municipalText(row?.title)||'\u00c4rende'].filter(Boolean).join(' ');
  const title=municipalText(row?.protocolHeader)||fallback;
  const preview=decisionPlainPreview(row?.abstractText||row?.description||title);
  return `<div class="decision-case-cell"><strong>${esc(title)}</strong>${preview?`<small class="decision-point-note" title="${esc(preview)}">${esc(preview)}</small>`:''}</div>`;
};
const renderDecisionDetailViewBeforeFinalProtocolHeader=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeFinalProtocolHeader(tab);
  const proposal=decisionProposalRowByKey(tab.proposalKey);
  if(proposal?.protocolHeader){
    $('decisionDetailTitle').textContent=proposal.protocolHeader;
    const hierarchyTitle=document.querySelector('.decision-hierarchy-item.primary strong');
    if(hierarchyTitle)hierarchyTitle.textContent=proposal.protocolHeader;
  }
};

/* v2 municipal semantic pack adapter. Formal votes and named yrkanden stay distinct. */
var decisionPositionRows=[];
const decisionEnsureDataV1=ensureDecisionData;
const decisionRenderDetailV1=renderDecisionDetailView;
municipalResultLabel=function(value){const text=municipalText(value);return {approve:'Bifall',reject:'Avslag',reject_counterproposal:'Motyrkande avslogs',partially_approve:'Delvis bifall',consider_answered:'Besvarad',return:'Återremiss',postpone:'Bordläggning',refer:'Remiss/överlämnande',adopt:'Antaget',confirm:'Bekräftat',revoke:'Upphävt',assign:'Uppdrag',acknowledge:'Noterat',file:'Till handlingarna',appoint:'Val/utseende',other:'Annat beslut',beslut:'Beslut',arende:'Ärende','ärende':'Ärende',avslag:'Avslag',approved:'Bifall',approved_acclamation:'Bifall (acklamation)',rejected:'Avslag'}[text]||text||'Beslut';};
municipalTypeLabel=function(value){const text=municipalText(value),labels={administrative_matter:'Administrativt ärende',document_matter:'Styrdokument/dokumentärende',motion:'Motion',citizen_proposal:'Medborgarförslag',member_initiative:'Ledamots-/nämndinitiativ',interpellation:'Interpellation',question:'Fråga',budget_matter:'Budgetärende',financial_report:'Ekonomisk rapport',appointment:'Valärende',referral_response:'Remissvar',planning_matter:'Planärende',fee_or_tax_matter:'Taxa/avgift',delegation_matter:'Delegationsärende',information_matter:'Informationsärende',report:'Rapport'};return labels[text]||text.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase())||'Beslut';};
decisionDisplay=function(col,value){if(col==='organ')return municipalText(value)||'Okänt organ';if(col==='party')return municipalText(value)||'Okänt parti';if(col==='member')return municipalMemberLabel(value);if(col==='vote')return municipalText(value)||'Votering/yrkande saknas';if(col==='proposalType')return municipalTypeLabel(value);if(col==='result')return municipalResultLabel(value);return municipalText(value);};
const municipalTypeLabelV2=municipalTypeLabel;
municipalTypeLabel=function(value){return municipalText(value)==='unclassified'?'Ej klassificerad':municipalTypeLabelV2(value);};
ensureDecisionData=function(){decisionEnsureDataV1();if(!decisionReady||decisionPack?._v2PositionsReady)return;decisionMemberRows=decisionPackMemberRows(decisionPack);decisionPositionRows=[];const docs=decisionPack.d||[],rows=Array.isArray(decisionPack.pr)?decisionPack.pr:[];for(let i=0;i<rows.length;i+=6){const docIndex=Number(rows[i]),point=String(rows[i+1]??''),name=String(rows[i+2]??''),party=String(rows[i+3]??''),vote=String(rows[i+4]??''),proposalId=String(rows[i+5]??''),doc=docs[docIndex]||{};decisionPositionRows.push({docIndex,id:String(doc.i||`d${docIndex}`),date:String(doc.dt||''),title:String(doc.t||''),point,name,party,vote,intressentId:proposalId,url:String(doc.u||''),body:String(doc.b||''),documentTitle:String(doc.doc||''),attendanceKey:decisionAttendanceKey(doc.dt,doc.b,doc.doc),sourceKind:'yrkande'});}decisionAllPointRows.forEach(row=>{const doc=docs[row.docIndex]||{},meta=doc.pm?.[String(row.point)]||{};row.decisionLevel=String(meta.decision_level||'');row.matterOutcome=String(meta.matter_outcome||doc.mo||'');row.confidence=String(meta.confidence||doc.cf||'');row.matterId=String(meta.matter_id||doc.mi||'');row.sourcePage=Number(meta.source_page)||0;row.sourcePageEnd=Number(meta.source_page_end)||0;});decisionPack._v2PositionsReady=true;};
function filteredDecisionPositionRows(){const parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote');return decisionPositionRows.filter(r=>decisionDateMatches(r.date)&&(!parties.length||parties.includes(municipalNorm(r.party)))&&(!members.length||members.includes(decisionMemberKey(r.name,r.party)))&&(!votes.length||votes.includes(String(r.vote))));}
buildDecisionFilters=function(){if(!decisionReady)return;syncDecisionDateRangeControls();syncDecisionSearchControl();const pointRows=decisionAllPointRows.filter(r=>decisionDateMatches(r.date)),formalRows=decisionRows.filter(r=>decisionDateMatches(r.date)),positionRows=decisionPositionRows.filter(r=>decisionDateMatches(r.date)),selectedOrgans=selectedDecisionValues('decisionOrgan'),organMemberRows=decisionMemberRows.filter(r=>decisionDateMatches(r.date)&&(!selectedOrgans.length||selectedOrgans.includes(municipalNorm(r.body)))),types=uniqueDecisionValues(pointRows.map(r=>r.proposalType)),organs=uniqueDecisionValues(pointRows.map(r=>r.body)),selectedParties=selectedDecisionValues('decisionParty'),parties=uniqueDecisionValues([...formalRows.map(r=>r.party),...positionRows.map(r=>r.party),...organMemberRows.map(r=>r.party)]),participantRows=[...formalRows,...positionRows],selectedPartyRows=selectedParties.length?participantRows.filter(r=>selectedParties.includes(municipalNorm(r.party))):participantRows,attendanceMemberRows=selectedParties.length?organMemberRows.filter(r=>selectedParties.includes(municipalNorm(r.party))):organMemberRows,members=uniqueDecisionValues([...selectedPartyRows.filter(r=>r.name).map(r=>decisionMemberKey(r.name,r.party)),...attendanceMemberRows.filter(r=>r.name).map(r=>decisionMemberKey(r.name,r.party))]),votes=uniqueDecisionValues([...formalRows.map(r=>r.vote),...positionRows.map(r=>r.vote)]),results=uniqueDecisionValues(pointRows.map(r=>r.result||'other'));setDecisionSelectOptions('decisionOrgan',organs,decisionFilterLocks.decisionOrgan,'organ');setDecisionSelectOptions('decisionProposalType',types,decisionFilterLocks.decisionProposalType,'proposalType');setDecisionSelectOptions('decisionParty',parties,decisionFilterLocks.decisionParty,'party');setDecisionSelectOptions('decisionMember',members,decisionFilterLocks.decisionMember,'member');setDecisionSelectOptions('decisionVote',votes,decisionFilterLocks.decisionVote,'vote');setDecisionSelectOptions('decisionResult',results,decisionFilterLocks.decisionResult,'result');renderDecisionFilterLocks();};
filteredDecisionPointRows=function(){const organs=selectedDecisionValues('decisionOrgan'),parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote'),results=selectedDecisionValues('decisionResult'),types=selectedDecisionValues('decisionProposalType'),requiresParticipantMatch=parties.length||members.length||votes.length,attendanceKeys=new Set(members.length&&!votes.length?decisionFilteredAttendanceRows().map(r=>r.attendanceKey):[]),formalCounts=new Map(),matchedKeys=new Set();filteredDecisionRows().forEach(r=>{const key=`${r.id}|${r.point}`;matchedKeys.add(key);if(!formalCounts.has(key))formalCounts.set(key,{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0,voteIds:new Set()});const d=formalCounts.get(key);d.voteCount++;const eventId=decisionVoteEventBase(r.intressentId);if(eventId)d.voteIds.add(eventId);d.voteRoundCount=d.voteIds.size;if(r.vote==='Ja')d.yes++;else if(r.vote==='Nej')d.no++;else if(r.vote==='Avstår')d.abstain++;else if(r.vote==='Frånvarande')d.absent++;});filteredDecisionPositionRows().forEach(r=>matchedKeys.add(`${r.id}|${r.point}`));return decisionAllPointRows.filter(r=>(!types.length||types.includes(municipalNorm(r.proposalType||'administrative_matter')))&&decisionDateMatches(r.date)&&decisionPointSearchMatches(r)&&(!organs.length||organs.includes(municipalNorm(r.body)))&&(!results.length||results.includes(municipalNorm(r.result||'other')))&&(!requiresParticipantMatch||matchedKeys.has(`${r.id}|${r.point}`)||attendanceKeys.has(r.attendanceKey))).map(r=>{const c=formalCounts.get(`${r.id}|${r.point}`)||{};if(requiresParticipantMatch)return {...r,voteRoundCount:Number(c.voteRoundCount)||0,voteCount:Number(c.voteCount)||0,yes:Number(c.yes)||0,no:Number(c.no)||0,abstain:Number(c.abstain)||0,absent:Number(c.absent)||0};return r;});};
decisionMasterSummaryCards=function(rows=filteredDecisionRows(),pointRows=filteredDecisionPointRows()){const matters=new Set(pointRows.map(r=>r.matterId||r.id).filter(Boolean)),voteIds=new Set(pointRows.flatMap(r=>r.voteIds||[])),recommendations=pointRows.filter(r=>r.decisionLevel==='recommendation_to_next_body'||r.decisionLevel==='preparatory_decision').length;return [['Ärenden',fmtInt(matters.size)],['Beslutspunkter',fmtInt(pointRows.length)],['Formella voteringar',fmtInt(voteIds.size)],['Slutliga beslut',fmtInt(pointRows.length-recommendations)]].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');};
renderDecisionDetailView=function(tab){decisionRenderDetailV1(tab);const proposal=decisionProposalRowByKey(tab.proposalKey),points=normalizeDecisionSelectionState(tab.sourcePoints).length?normalizeDecisionSelectionState(tab.sourcePoints):[tab.sourcePoint||tab.point].filter(Boolean),parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote'),positions=decisionPositionRows.filter(r=>r.id===tab.id&&(!points.length||points.includes(String(r.point)))&&(!parties.length||parties.includes(municipalNorm(r.party)))&&(!members.length||members.includes(decisionMemberKey(r.name,r.party)))&&(!votes.length||votes.includes(r.vote))),groups=new Map();positions.forEach(r=>{if(!groups.has(r.vote))groups.set(r.vote,[]);groups.get(r.vote).push(r);});if(groups.size){const html=`<article class="decision-point-card"><h3>Namngivna yrkanden</h3>${[...groups.entries()].map(([label,rows])=>`<section class="decision-vote-type"><h4>${esc(label)} <strong>${fmtInt(rows.length)}</strong></h4><div class="decision-point-party-list">${[...new Map(rows.map(r=>[r.party,rows.filter(x=>x.party===r.party)])).entries()].map(([party,partyRows])=>`<section class="decision-point-party"><h5>${esc(decisionDisplay('party',party))} · ${fmtInt(partyRows.length)}</h5><ul>${decisionVoteNames(partyRows)}</ul></section>`).join('')}</div></section>`).join('')}</article>`;$('decisionDetailGroups').insertAdjacentHTML('beforeend',html);}if(proposal?.decisionLevel==='recommendation_to_next_body')$('decisionDetailStatus').textContent='Beredande beslut eller rekommendation till nästa beslutande organ. '+$('decisionDetailStatus').textContent;};
function decisionVoteVerification(rows,proposal){const events=Object.values(proposal?.voteEvents||{}),filtered=selectedDecisionValues('decisionParty').length||selectedDecisionValues('decisionMember').length||selectedDecisionValues('decisionVote').length,conflicts=events.filter(e=>e.count_conflict),unnamed=events.some(e=>['yes','no','abstain','absent'].some(v=>(Number(e[`stated_${v}`])||0)>(Number(e[`named_${v}`])||0)));return {filtered,conflicts,unnamed};}
function renderDecisionDetailView(tab){const rows=decisionDetailRows(tab),decision=decisionDecisionRows.find(r=>r.id===tab.id);if(!decision){closeDecisionTab(decisionActiveTab);return;}const proposal=decisionProposalRowByKey(tab.proposalKey);$('decisionDetailTitle').textContent=proposal?.pointTitle||tab.title||decision.title;const source=proposal?.sourceUrl||decision.url||'';$('decisionDetailMeta').innerHTML=`<span>${esc([proposal?.body,decision.date,proposal?.diary].filter(Boolean).join(' · '))}</span>${source?` <a class="decision-official-link" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna källan</a>`:''}`;$('decisionDetailOverview').innerHTML=decisionDetailHierarchyHtml(decision,proposal,tab)+decisionDetailSummaryCards(rows,proposal);const verification=decisionVoteVerification(rows,proposal);$('decisionDetailStatus').textContent=verification.filtered?'Visar den filtrerade delmängden. Varje votering redovisas separat, först per rösttyp och därefter per parti och person.':verification.conflicts.length?'Källkonflikt finns i en eller flera voteringar. Namnlistan räknas exakt och avvikelsen mot protokollets tryckta totalsiffra redovisas öppet.':verification.unnamed?'Rösträkningen följer protokollet. Där protokollet endast anger ett antal utan namn redovisas detta uttryckligen.':'Kontrollerad rösträkning: namnlistor och protokollets totalsiffror stämmer för samtliga voteringar i denna beslutspunkt.';$('decisionPrev').disabled=true;$('decisionNext').disabled=true;$('decisionPage').textContent='';const pointGroups=decisionPointPartyGroups(rows,proposal);$('decisionDetailGroups').innerHTML=pointGroups.length?pointGroups.map((group,index)=>decisionPointPartyHtml(group,index,pointGroups.length)).join(''):'<div class="decision-vote-panel">Denna beslutspunkt saknar votering.</div>';$('decisionMasterPane').hidden=true;$('decisionDetailPane').hidden=false;}
function renderDecisionView(){ensureDecisionData();renderDecisionPageSizeControls();buildDecisionFilters();renderDecisionTabs();if(!decisionReady||!decisionAllPointRows.length){$('decisionOverview').innerHTML='';$('decisionHead').innerHTML='';$('decisionBody').innerHTML='';$('decisionStatus').textContent='Kommunala protokoll laddas eller saknas.';$('decisionPage').textContent='';$('decisionPrev').disabled=true;$('decisionNext').disabled=true;$('decisionMasterPane').hidden=false;$('decisionDetailPane').hidden=true;return;}const tab=decisionActiveTabState();if(!tab||tab.kind==='list')renderDecisionMasterView();else renderDecisionDetailView(tab);}
function decisionSourceSearchText(row){
  return municipalNorm([
    row?.protocolHeader,
    row?.paragraph,
    row?.pointTitle,
    row?.description,
    row?.title
  ].filter(Boolean).find(text=>String(text).trim().length>=8)||'').slice(0,140);
}
function decisionPdfTopOffset(row){
  const value=row?.sourceTop??row?.source_top??row?.sourceY??row?.source_y??row?.targetTop??row?.target_top;
  const n=Number(value);
  return Number.isFinite(n)&&n>=0?Math.round(n):null;
}
function decisionPdfPageNumber(row){
  const page=Number(row?.sourcePage||row?.source_page||row?.page||row?.pageNumber||row?.page_number)||0;
  return page>0?Math.round(page):0;
}
function decisionPdfFragmentParams(row){
  const params=[],page=decisionPdfPageNumber(row),top=decisionPdfTopOffset(row),search=decisionSourceSearchText(row);
  if(page)params.push(['page',String(page)]);
  if(top!==null){
    params.push(['zoom',`100,0,${top}`]);
    params.push(['view',`FitH,${top}`]);
  }else if(page){
    params.push(['view','FitH,0']);
  }
  if(search)params.push(['search',search]);
  return params.map(([key,value])=>`${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
}
function decisionAnchoredSourceUrl(row, fallback=''){
  const raw=municipalNorm(row?.sourceUrl||row?.url||row?.localPath||fallback);
  if(!raw)return '';
  if(row?.isMeeting)return raw.split('#')[0];
  const hash=decisionPdfFragmentParams(row);
  return raw.split('#')[0]+(hash?`#${hash}`:'');
}
function decisionActivitySourceUrl(row){
  const raw=municipalNorm(row?.url||row?.localPath||'');
  if(!raw)return '';
  const hash=decisionPdfFragmentParams(row);
  return raw.split('#')[0]+(hash?`#${hash}`:'');
}
function decisionSemanticLevelLabel(value){
  const labels={
    final_decision:'Slutligt beslut',
    information_only:'Informationsärende',
    procedural_decision:'Procedurfråga',
    recommendation_to_next_body:'Rekommendation',
    preparatory_decision:'Beredande beslut',
    referral_decision:'Remiss/överlämnande',
    appointment:'Val/utseende',
    budget_allocation:'Budget/anslag',
    delegation_decision:'Delegation',
    supervisory_decision:'Tillsyn/sanktion',
    implementation_decision:'Genomförande'
  };
  return labels[municipalText(value)]||municipalTypeLabel(value)||'Beslut';
}
function decisionSemanticOutcomeLabel(value){
  const labels={
    information_only:'Information/anmälan',
    fully_approved:'Bifallet',
    fully_rejected:'Avslaget',
    partially_approved:'Delvis bifallet',
    answered:'Besvarat',
    returned:'Återremitterat',
    postponed:'Bordlagt',
    mixed_outcome:'Blandat utfall',
    other:'Annat utfall'
  };
  return labels[municipalText(value)]||municipalResultLabel(value)||'Annat utfall';
}
function decisionDetailSummaryCards(rows = [], proposal = null) {
  const votes = rows.reduce((acc, r) => {
    acc[r.vote] = (acc[r.vote] || 0) + 1;
    return acc;
  }, {});
  const items = [
    ['Status', decisionPointResultLabel(proposal)],
    ['Voteringar', fmtInt(Object.keys(proposal?.voteEvents || {}).length || rows.length)],
    ['Namngivna röster', fmtInt(rows.length)],
  ];
  return items.map(([k, v]) => `<div class="card${k === 'Status' ? ' decision-result-card' : ''}">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
}
function decisionDetailSummaryCards(rows=[],proposal=null){
  const events=Object.keys(proposal?.voteEvents||{}).length||new Set(rows.map(r=>decisionVoteEventBase(r.intressentId)).filter(Boolean)).size;
  const positionCount=decisionPositionRows.filter(r=>r.id===proposal?.id&&String(r.point)===String(proposal?.point)).length;
  const items=[
    ['Beslut',decisionPointResultLabel(proposal),'decision-result-card'],
    ['Hantering',decisionSemanticLevelLabel(proposal?.decisionLevel),''],
    ['Utfall',decisionSemanticOutcomeLabel(proposal?.matterOutcome),''],
    ['Voteringar',events?fmtInt(events):'Ingen formell votering',''],
    ['Namngivna röster',rows.length?fmtInt(rows.length):'Saknas',''],
    ['Yrkanden',positionCount?fmtInt(positionCount):'Inga namngivna','']
  ];
  return items.map(([k,v,cls])=>`<div class="card ${esc(cls||'')}"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('');
}
renderDecisionMasterView=function(){
  const listTab=decisionListTab(),filteredRows=filteredDecisionPointRows(),rows=sortedDecisionPointRows(filteredRows),size=decisionPageSize(),page=pageSlice(rows,listTab.page||0,size);
  listTab.page=page.page;
  $('decisionOverview').innerHTML=decisionMasterSummaryCards(undefined,filteredRows);
  $('decisionStatus').textContent=rows.length?`Visar ${fmtInt(page.start+1)}-${fmtInt(page.start+page.rows.length)} av ${fmtInt(rows.length)} beslutspunkter för ${decisionTitle()}. Klicka en rad för att öppna ärendet i en egen flik.`:'Inga beslutspunkter matchar de aktiva filtren.';
  $('decisionPage').textContent=`Sida ${fmtInt(page.page+1)} av ${fmtInt(page.pages)}`;
  $('decisionPrev').disabled=page.page<=0;
  $('decisionNext').disabled=page.page>=page.pages-1;
  $('decisionHead').innerHTML=`<tr>${decisionSortableHeader('date','Datum')}${decisionSortableHeader('title','Organ')}${decisionSortableHeader('pointTitle','Ärende')}${decisionSortableHeader('result','Status')}${decisionSortableHeader('voteRoundCount','Voteringar')}${decisionSortableHeader('voteCount','Yrkande')}${decisionSortableHeader('yes','Ja')}${decisionSortableHeader('no','Nej')}${decisionSortableHeader('abstain','Avstår')}${decisionSortableHeader('absent','Frånvarande')}<th>Källa</th></tr>`;
  $('decisionHead').querySelectorAll('[data-decision-sort]').forEach(th=>{th.onclick=()=>setDecisionSort(th.dataset.decisionSort);th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDecisionSort(th.dataset.decisionSort);}};});
  $('decisionBody').innerHTML=page.rows.map(r=>{const source=decisionAnchoredSourceUrl(r);return `<tr class="${decisionPointRowClass(r)}" data-id="${esc(r.id)}" data-proposal-key="${esc(decisionProposalKey(r))}"><td>${esc(r.date)}</td><td>${esc(r.body||'')}</td><td>${municipalCaseCellHtml(r)}</td><td>${decisionPointResultHtml(r)}</td><td class="num">${fmtInt(r.voteRoundCount)}</td><td class="num">${fmtInt(r.voteCount)}</td><td class="num">${fmtInt(r.yes)}</td><td class="num">${fmtInt(r.no)}</td><td class="num">${fmtInt(r.abstain)}</td><td class="num">${fmtInt(r.absent)}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'—'}</td></tr>`;}).join('');
  $('decisionBody').querySelectorAll('.decision-selectable-row').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionDetail(row.dataset.id,row.dataset.proposalKey);});
  $('decisionMasterPane').hidden=false;
  $('decisionDetailPane').hidden=true;
};
renderDecisionDetailView=function(tab){
  const rows=decisionDetailRows(tab),decision=decisionDecisionRows.find(r=>r.id===tab.id);
  if(!decision){closeDecisionTab(decisionActiveTab);return;}
  const proposal=decisionProposalRowByKey(tab.proposalKey);
  $('decisionDetailTitle').textContent=proposal?.pointTitle||tab.title||decision.title;
  const source=decisionAnchoredSourceUrl(proposal,decision.url);
  $('decisionDetailMeta').innerHTML=`<span>${esc([proposal?.body,decision.date,proposal?.diary].filter(Boolean).join(' · '))}</span>${source?` <a class="decision-official-link" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna källan</a>`:''}`;
  $('decisionDetailOverview').innerHTML=decisionDetailHierarchyHtml(decision,proposal,tab)+decisionDetailSummaryCards(rows,proposal);
  const verification=decisionVoteVerification(rows,proposal);
  $('decisionDetailStatus').textContent=verification.filtered?'Visar den filtrerade delmängden. Varje votering redovisas separat, först per rösttyp och därefter per parti och person.':verification.conflicts.length?'Källkonflikt finns i en eller flera voteringar. Namnlistan räknas exakt och avvikelsen mot protokollets tryckta totalsiffra redovisas öppet.':verification.unnamed?'Rösträkningen följer protokollet. Där protokollet endast anger ett antal utan namn redovisas detta uttryckligen.':(rows.length?'Kontrollerad rösträkning: namnlistor och protokollets totalsiffror stämmer för samtliga voteringar i denna beslutspunkt.':'Beslutspunkten saknar formell votering i datan; status och utfall baseras på protokollets beslutstext.');
  $('decisionPrev').disabled=true;
  $('decisionNext').disabled=true;
  $('decisionPage').textContent='';
  const pointGroups=decisionPointPartyGroups(rows,proposal);
  $('decisionDetailGroups').innerHTML=pointGroups.length?pointGroups.map((group,index)=>decisionPointPartyHtml(group,index,pointGroups.length)).join(''):'<div class="decision-vote-panel">Denna beslutspunkt saknar votering.</div>';
  $('decisionMasterPane').hidden=true;
  $('decisionDetailPane').hidden=false;
};
function decisionPageSize(){return decisionPageSizeValue||250;}
function setDecisionPageSize(size){decisionPageSizeValue=[100,250,500,1000,2500].includes(Number(size))?Number(size):250;renderDecisionPageSizeControls();resetDecisionPage();renderDecisionView();}
function renderDecisionPageSizeControls(){const value=decisionPageSize();document.querySelectorAll('.decision-page-size-option').forEach(btn=>{const active=Number(btn.dataset.size)===value;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',active?'true':'false');});}
function resetDecisionPage(){decisionTabs.forEach(t=>{t.page=0;});if(typeof resetDecisionActivityPage==='function')resetDecisionActivityPage();}

function selectedActivityValues(key){return normalizeDecisionSelectionState(decisionActivityFilters[key]);}
function decisionActivityTabState(){return decisionActivityTabs[Math.max(0,Math.min(decisionActivityActiveTab,decisionActivityTabs.length-1))];}
function renderDecisionActivityTabs(){const box=$('decisionActivityTabs');if(!box)return;box.innerHTML=decisionActivityTabs.map((t,i)=>`<button class="decision-tab ${i===decisionActivityActiveTab?'active':''}" data-activity-i="${i}" type="button"><span class="decision-tab-label">${esc(t.title)}</span></button>`).join('');box.querySelectorAll('[data-activity-i]').forEach(btn=>btn.onclick=()=>{decisionActivityActiveTab=Number(btn.dataset.activityI);renderDecisionView();});}
function decisionActivityTypeLabel(type){return municipalText(type)||'Övrigt';}
function decisionRoleLabel(value){return municipalText(value)||'—';}
function decisionActivityDisplay(col,value){if(col==='type')return decisionActivityTypeLabel(value);if(col==='role')return decisionRoleLabel(value);if(col==='party')return decisionDisplay('party',value);return municipalText(value||'Alla');}
function decisionActivityIncludedByDate(row){return decisionDateMatches(row?.date||row?.questionDate||'');}
function decisionActivityDateHtml(row){return esc(row.date||'');}
function decisionActivityCombinedStatus(row){return row?.status||row?.organ||'';}
function setActivitySelectOptions(id,key,values,col){const sel=$(id);if(!sel)return;const available=new Set(values.map(String));decisionActivityFilters[key]=selectedActivityValues(key).filter(v=>available.has(String(v)));const locked=new Set(decisionActivityFilters[key].map(String));sel.dataset.activityKey=key;sel.dataset.col=col;const allOption=locked.size?`<option value="" disabled selected>Välj fler...</option><option value="${decisionActivityFilterClearValueFinal}">Alla</option>`:'<option value="">Alla</option>';sel.innerHTML=[allOption,...values.map(v=>{const chosen=locked.has(String(v)),label=decisionActivityDisplay(col,v);return `<option value="${esc(v)}" ${chosen?'disabled data-filter-selected="1"':''}>${esc(chosen?`✓ ${label} (valt)`:label)}</option>`;})].join('');sel.value='';}
function renderActivityFilterLocks(){['decisionActivityType','decisionActivityRole','decisionActivityParty','decisionActivityPerson'].forEach(id=>{const sel=$(id);if(!sel)return;let lock=sel.parentElement.querySelector('.raw-filter-lock');const key=sel.dataset.activityKey,values=selectedActivityValues(key);if(!values.length){if(lock)lock.remove();return;}if(!lock){lock=document.createElement('div');lock.className='raw-filter-lock';sel.insertAdjacentElement('afterend',lock);}const col=sel.dataset.col;lock.innerHTML=values.map(v=>`<span class="raw-filter-chip"><span>${esc(decisionActivityDisplay(col,v))}</span><button type="button" data-value="${esc(v)}">×</button></span>`).join('');lock.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{decisionActivityFilters[key]=selectedActivityValues(key).filter(v=>v!==btn.dataset.value);renderDecisionView();});});}
function buildDecisionActivityFilters(){const rows=decisionActivityRows.filter(decisionActivityIncludedByDate),types=[...new Set(rows.map(r=>r.type).filter(Boolean))].sort(),roles=[...new Set(rows.map(r=>r.decisionRole).filter(Boolean))].sort(),parties=[...new Set(rows.map(r=>r.party).filter(Boolean))].sort(),people=[...new Set(rows.flatMap(r=>[r.questioner,r.addressedTo,r.answeredBy,r.person]).filter(Boolean))].sort();setActivitySelectOptions('decisionActivityType','type',types,'type');setActivitySelectOptions('decisionActivityRole','role',roles,'role');setActivitySelectOptions('decisionActivityParty','party',parties,'party');setActivitySelectOptions('decisionActivityPerson','person',people,'person');renderActivityFilterLocks();if($('decisionActivitySearch'))$('decisionActivitySearch').value=decisionActivitySearchQuery;}
function handleDecisionActivityFilterChange(id){const sel=$(id),key=sel?.dataset.activityKey,value=sel?.value;if(key){if(value===decisionActivityFilterClearValueFinal)decisionActivityFilters[key]=[];else if(value){if(!selectedActivityValues(key).includes(value))decisionActivityFilters[key]=[...selectedActivityValues(key),value];}else decisionActivityFilters[key]=[];}decisionActivityActiveTab=0;renderDecisionView();}
function filteredDecisionActivityRows(){const q=decisionActivitySearchQuery.trim().toLowerCase(),mainTables=selectedActivityValues('mainTable'),types=selectedActivityValues('type'),roles=selectedActivityValues('role'),parties=selectedActivityValues('party'),people=selectedActivityValues('person');return decisionActivityRows.filter(r=>decisionActivityIncludedByDate(r)&&(!mainTables.length||mainTables.includes(r.mainTable))&&(!types.length||types.includes(r.type))&&(!roles.length||roles.includes(r.decisionRole))&&(!parties.length||parties.includes(r.party))&&(!people.length||[r.questioner,r.addressedTo,r.answeredBy,r.person].some(p=>people.includes(p)))&&(!q||[r.mainTable,r.type,r.decisionRole,r.title,r.subtitle,r.person,r.questioner,r.addressedTo,r.answeredBy,r.party,r.organ,r.status,r.id].some(v=>String(v||'').toLowerCase().includes(q))));}
function decisionActivitySortValue(row,col){if(col==='type')return decisionActivityTypeLabel(row.type);if(col==='questioner')return row.questioner||row.person||'';if(col==='addressedTo')return row.addressedTo||'';if(col==='answeredBy')return row.answeredBy||'';if(col==='party')return decisionDisplay('party',row.party);if(col==='status')return decisionActivityCombinedStatus(row)||row.organ||'';if(col==='title')return row.title||'';return row.date||'';}
function decisionActivitySortCompare(a,b,col=decisionActivitySortColumn){let cmp=String(decisionActivitySortValue(a,col)).localeCompare(String(decisionActivitySortValue(b,col)),'sv',{numeric:true,sensitivity:'base'});if(cmp===0)cmp=String(a.date).localeCompare(String(b.date),'sv',{numeric:true})||String(a.title).localeCompare(String(b.title),'sv',{numeric:true,sensitivity:'base'});return decisionActivitySortDir==='desc'?-cmp:cmp;}
function sortedDecisionActivityRows(rows=filteredDecisionActivityRows()){return [...rows].sort((a,b)=>decisionActivitySortCompare(a,b));}
function decisionActivitySortIndicator(col){return decisionActivitySortColumn===col?(decisionActivitySortDir==='asc'?' \u25b2':' \u25bc'):'';}
function decisionActivitySortableHeader(col,label){return `<th data-activity-sort="${esc(col)}" class="decision-sortable" role="button" tabindex="0">${esc(label+decisionActivitySortIndicator(col))}</th>`;}
function setDecisionActivitySort(col){if(decisionActivitySortColumn===col)decisionActivitySortDir=decisionActivitySortDir==='asc'?'desc':'asc';else{decisionActivitySortColumn=col;decisionActivitySortDir='asc';}renderDecisionActivityView();}
function decisionActivityById(id){return decisionActivityRows.find(r=>r.id===String(id||''))||null;}
function openDecisionActivityDetail(id){const row=decisionActivityById(id);if(!row)return;decisionActivityTabs.push({kind:'activity',id:`activity:${row.id}`,activityId:row.id,title:row.title||'Kommunalt ärende',page:0});decisionActivityActiveTab=decisionActivityTabs.length-1;renderDecisionView();}
function renderDecisionActivityDetail(row){$('decisionActivityListPane').hidden=true;$('decisionActivityDetailPane').hidden=false;$('decisionActivityDetailTitle').textContent=row.title||decisionActivityTypeLabel(row.type);$('decisionActivityDetailMeta').textContent=[row.date,decisionActivityTypeLabel(row.type),decisionActivityCombinedStatus(row)].filter(Boolean).join(' · ');$('decisionActivityDetailOverview').innerHTML=[['Dokumenttyp',decisionActivityTypeLabel(row.type)],['Status',decisionActivityCombinedStatus(row)||'—'],['Datum',row.date||'—'],['Organ',row.organ||'—']].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');$('decisionActivityDetailBody').innerHTML=`<article class="decision-point-card"><h3>${esc(row.title||'Kommunalt ärende')}</h3><p>${esc(row.subtitle||'')}</p></article>`;}
function renderDecisionActivityView(activeRow=null){const pane=$('decisionActivityPane');if(!pane)return;if(activeRow){renderDecisionActivityDetail(activeRow);return;}$('decisionActivityListPane').hidden=false;$('decisionActivityDetailPane').hidden=true;buildDecisionActivityFilters();const filteredRows=filteredDecisionActivityRows(),rows=sortedDecisionActivityRows(filteredRows);$('decisionActivityOverview').innerHTML=[['Rader',fmtInt(filteredRows.length)],['Underlag',fmtInt(filteredRows.filter(r=>r.type==='underlag').length)],['Remisser',fmtInt(filteredRows.filter(r=>r.type==='remiss').length)],['Övrigt',fmtInt(filteredRows.filter(r=>!['underlag','remiss'].includes(r.type)).length)]].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');$('decisionActivityStatus').textContent=rows.length?`Visar ${fmtInt(rows.length)} kommunala rader i den andra huvudtabellen.`:'Den andra kommunala huvudtabellen är inte kopplad till data ännu.';$('decisionActivityHead').innerHTML=`<tr>${decisionActivitySortableHeader('date','Datum')}${decisionActivitySortableHeader('type','Dokumenttyp')}${decisionActivitySortableHeader('title','Titel/ämne')}${decisionActivitySortableHeader('questioner','Person/funktion')}${decisionActivitySortableHeader('addressedTo','Mottagare')}${decisionActivitySortableHeader('answeredBy','Ansvarig')}${decisionActivitySortableHeader('party','Organ')}${decisionActivitySortableHeader('status','Status')}<th>Källa</th></tr>`;$('decisionActivityHead').querySelectorAll('[data-activity-sort]').forEach(th=>{th.onclick=()=>setDecisionActivitySort(th.dataset.activitySort);});$('decisionActivityBody').innerHTML=rows.map(r=>`<tr class="decision-selectable-row" data-activity-id="${esc(r.id)}"><td>${decisionActivityDateHtml(r)}</td><td><strong class="decision-activity-type">${esc(decisionActivityTypeLabel(r.type))}</strong></td><td>${esc(r.title)}</td><td>${esc(r.questioner||'')}</td><td>${esc(r.addressedTo||'')}</td><td>${esc(r.answeredBy||'')}</td><td>${esc(decisionDisplay('party',r.party))}</td><td>${esc(decisionActivityCombinedStatus(r))}</td><td>${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'—'}</td></tr>`).join('');$('decisionActivityBody').querySelectorAll('[data-activity-id]').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionActivityDetail(row.dataset.activityId);});}

async function exportDecisionXlsx(){ensureDecisionData();const active=decisionActiveTabState(),pointRows=sortedDecisionPointRows();if(!pointRows.length){$('decisionStatus').textContent='Det finns inga kommunala ärenden att exportera.';return;}const isDetail=active&&active.kind==='decision',rows=isDetail?[['Datum','Organ','Paragraf','Ärende','Namn','Roll/organ','Röst','Källa'],...decisionDetailRows(active).map(r=>[r.date,r.title,r.point,r.description,r.name,decisionDisplay('party',r.party),r.vote,r.url])]:[['Datum','Organ','Ärende','Status','Röster','Ja','Nej','Avstår','Frånvarande','Källa'],...pointRows.map(r=>[r.date,r.body,r.title,decisionPointResultLabel(r),r.voteCount,r.yes,r.no,r.abstain,r.absent,r.sourceUrl||r.url])];const files=[{name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},{name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Örebro kommuns beslut" sheetId="1" r:id="rId1"/></sheets></workbook>'},{name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},{name:'xl/styles.xml',data:stylesXml()},{name:'xl/worksheets/sheet1.xml',data:sheetXml(rows)}];const blob=zip(files),a=document.createElement('a');a.download=isDetail?'kommunalt_arende.xlsx':'kommunens_protokollforda_beslut.xlsx';a.href=URL.createObjectURL(blob);a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function exportDecisionActivityXlsx(){ensureDecisionData();buildDecisionActivityFilters();const rows=sortedDecisionActivityRows(filteredDecisionActivityRows());if(!rows.length){$('decisionActivityStatus').textContent='Det finns inga styrdokument att exportera.';return;}const sheetRows=[['Datum','Dokumenttyp','Titel','Sammanfattning','Viktiga punkter','Område/organ','Politisk nivå','Tjänstemannanivå','Diarienummer','Källa'],...rows.map(row=>[row.date||row.dateSort||'',decisionActivityTypeLabel(row.type),row.title||'',row.summary||'',(row.importantPoints||[]).join(' | '),row.party||'',row.politicalOwner||'',row.officialOwner||'',row.caseNumber||row.caseNumbersDetected?.[0]||'',decisionActivitySourceUrl(row)||''])];const files=[{name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},{name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Styrdokument" sheetId="1" r:id="rId1"/></sheets></workbook>'},{name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},{name:'xl/styles.xml',data:stylesXml()},{name:'xl/worksheets/sheet1.xml',data:sheetXml(sheetRows)}];const blob=zip(files),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='orebro_kommuns_styrdokument.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function decisionVoteEventBase(intressentId){const value=String(intressentId||'');return value.includes(':')?value.split(':').slice(0,-1).join(':'):value;}
function decisionSplitVoteIds(value){return String(value||'').split(',').map(v=>v.trim()).filter(Boolean);}
function decisionPreferNamedCount(named,stated){named=Number(named)||0;stated=Number(stated)||0;return stated||named;}
function ensureDecisionData(){if(decisionReady)return;const pack=decisionPack;if(!pack||!Array.isArray(pack.d)||!Array.isArray(pack.r)){decisionRows=[];decisionDecisionRows=[];decisionAllPointRows=[];decisionActivityRows=[];decisionReady=false;$('decisionStatus').textContent='Ingen kommunal protokolldata är inläst.';return;}const docs=pack.d.map((d,i)=>({...d,_idx:i})),voteRows=[],decisionIds=new Set(),dates=new Set(),points=new Set(),byDecision=new Map(),allPointRows=[],pointTotals=new Map();decisionActivityRows=Array.isArray(pack.a)?pack.a:[];docs.forEach(doc=>{const id=String(doc.i||`d${doc._idx}`),date=String(doc.dt||''),title=String(doc.t||''),url=String(doc.u||doc.lp||''),pointMap=doc.p||{},voteMap=doc.v||{},pointMeta=doc.pm||{},body=String(doc.b||''),bodyType=String(doc.bt||''),documentTitle=String(doc.doc||''),documentKey=documentTitle?`${documentTitle}|${id}`:'',diary=String(doc.dn||''),caseNumber=String(doc.cn||'');decisionIds.add(id);if(date)dates.add(date);Object.entries(pointMap).forEach(([point,description])=>{const meta=pointMeta[String(point)]||{},voteId=String(voteMap[String(point)]||voteMap[point]||''),voteIds=decisionSplitVoteIds(voteId),proposalType=decisionProposalTypeForPoint(doc,point);points.add(`${id}|${point}`);allPointRows.push({id,point:String(point),date,title,pointTitle:`${point}. ${title||description||'Ärende'}`,description:String(description||''),proposalType,url,docIndex:doc._idx,voteId,voteIds,body,bodyType,documentTitle,documentKey,diary,caseNumber,result:String(meta.result||'beslut'),sourceUrl:String(meta.source_url||url||''),localPath:String(meta.local_path||doc.lp||''),statedYes:Number(meta.stated_yes)||0,statedNo:Number(meta.stated_no)||0,statedAbstain:Number(meta.stated_abstain)||0,statedAbsent:Number(meta.stated_absent)||0,voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0,fullVoteRoundCount:0,fullVoteCount:0,fullYes:0,fullNo:0,fullAbstain:0,fullAbsent:0});});if(!byDecision.has(id))byDecision.set(id,{id,date,title,url,docIndex:doc._idx,pointMap,voteRows:[]});});for(let i=0;i<pack.r.length;i+=6){const docIndex=Number(pack.r[i]),point=String(pack.r[i+1]??''),name=String(pack.r[i+2]??''),party=String(pack.r[i+3]??''),vote=String(pack.r[i+4]??''),intressentId=String(pack.r[i+5]??''),doc=docs[docIndex]||{},date=String(doc.dt||''),id=String(doc.i||`d${docIndex}`),title=String(doc.t||''),url=String(doc.u||doc.lp||''),description=decisionPointLabel(doc,point),row={docIndex,id,date,title,point,description,proposalType:decisionProposalTypeForPoint(doc,point),name,party,vote,intressentId,url,order:i/6};voteRows.push(row);decisionIds.add(id);if(date)dates.add(date);points.add(`${id}|${point}`);if(!byDecision.has(id))byDecision.set(id,{id,date,title,url,docIndex,pointMap:(docs[docIndex]||{}).p||{},voteRows:[]});byDecision.get(id).voteRows.push(row);const key=`${id}|${point}`;if(!pointTotals.has(key))pointTotals.set(key,{fullVoteCount:0,fullYes:0,fullNo:0,fullAbstain:0,fullAbsent:0,voteIds:new Set()});const total=pointTotals.get(key);total.fullVoteCount++;const eventId=decisionVoteEventBase(intressentId);if(eventId)total.voteIds.add(eventId);if(vote==='Ja')total.fullYes++;else if(vote==='Nej')total.fullNo++;else if(vote==='Avstår')total.fullAbstain++;else if(vote==='Frånvarande')total.fullAbsent++;}allPointRows.forEach(r=>{const total=pointTotals.get(`${r.id}|${r.point}`)||{};r.fullVoteRoundCount=Math.max(Number(total.voteIds?.size)||0,r.voteIds.length);r.fullYes=decisionPreferNamedCount(total.fullYes,r.statedYes);r.fullNo=decisionPreferNamedCount(total.fullNo,r.statedNo);r.fullAbstain=decisionPreferNamedCount(total.fullAbstain,r.statedAbstain);r.fullAbsent=decisionPreferNamedCount(total.fullAbsent,r.statedAbsent);r.fullVoteCount=Math.max(Number(total.fullVoteCount)||0,r.fullYes+r.fullNo+r.fullAbstain+r.fullAbsent);r.voteRoundCount=r.fullVoteRoundCount;r.yes=r.fullYes;r.no=r.fullNo;r.abstain=r.fullAbstain;r.absent=r.fullAbsent;r.voteCount=r.fullVoteCount;});decisionRows=voteRows;decisionDecisionRows=[...byDecision.values()].map(d=>({id:d.id,date:d.date,title:d.title,url:d.url,docIndex:d.docIndex,pointCount:Object.keys(d.pointMap||{}).length,voteCount:d.voteRows.length,yes:0,no:0,abstain:0,absent:0}));decisionAllPointRows=allPointRows;decisionReady=true;}
function filteredDecisionPointRows(){const organs=selectedDecisionValues('decisionOrgan'),parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote'),results=selectedDecisionValues('decisionResult'),types=selectedDecisionValues('decisionProposalType'),requiresVoteMatch=parties.length||members.length||votes.length,counts=new Map();filteredDecisionRows().forEach(r=>{const key=`${r.id}|${r.point}`;if(!counts.has(key))counts.set(key,{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0,voteIds:new Set()});const d=counts.get(key);d.voteCount++;const eventId=decisionVoteEventBase(r.intressentId);if(eventId)d.voteIds.add(eventId);d.voteRoundCount=d.voteIds.size;if(r.vote==='Ja')d.yes++;else if(r.vote==='Nej')d.no++;else if(r.vote==='Avstår')d.abstain++;else if(r.vote==='Frånvarande')d.absent++;});return decisionAllPointRows.filter(r=>(!types.length||types.includes(municipalNorm(r.proposalType||'beslut')))&&decisionDateMatches(r.date)&&decisionPointSearchMatches(r)&&(!organs.length||organs.includes(municipalNorm(r.body)))&&(!results.length||results.includes(municipalNorm(r.result||'beslut')))&&(!requiresVoteMatch||counts.has(`${r.id}|${r.point}`))).map(r=>{const c=counts.get(`${r.id}|${r.point}`)||{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0};if(requiresVoteMatch)return {...r,voteRoundCount:c.voteRoundCount||0,voteCount:c.voteCount||0,yes:c.yes||0,no:c.no||0,abstain:c.abstain||0,absent:c.absent||0};const yes=decisionPreferNamedCount(c.yes||r.fullYes,r.statedYes),no=decisionPreferNamedCount(c.no||r.fullNo,r.statedNo),abstain=decisionPreferNamedCount(c.abstain||r.fullAbstain,r.statedAbstain),absent=decisionPreferNamedCount(c.absent||r.fullAbsent,r.statedAbsent),voteCount=Math.max(c.voteCount||0,r.fullVoteCount||0,yes+no+abstain+absent),voteRoundCount=Math.max(c.voteRoundCount||0,r.fullVoteRoundCount||0,(r.voteIds||[]).length);return {...r,voteRoundCount,voteCount,yes,no,abstain,absent};});}
function decisionSortValue(row,col){if(['voteRoundCount','voteCount','yes','no','abstain','absent'].includes(col))return Number(row[col])||0;if(col==='result')return decisionDisplay('result',row.result);if(col==='title')return row.body||row.title||'';if(col==='pointTitle')return row.pointTitle||'';return row.date||'';}
function setDecisionSort(col){if(decisionSortColumn===col)decisionSortDir=decisionSortDir==='asc'?'desc':'asc';else{decisionSortColumn=col;decisionSortDir=['voteRoundCount','voteCount','yes','no','abstain','absent'].includes(col)?'desc':'asc';}resetDecisionPage();renderDecisionView();}
function decisionMasterSummaryCards(rows=filteredDecisionRows(),pointRows=filteredDecisionPointRows()){const cases=new Set(pointRows.map(r=>r.id).filter(Boolean)),voteIds=new Set(pointRows.flatMap(r=>r.voteIds||[])),decisions=pointRows.filter(r=>String(r.result||'')==='beslut').length;return [['Ärenden',fmtInt(cases.size)],['Beslutspunkter',fmtInt(pointRows.length)],['Voteringar',fmtInt(voteIds.size)],['Beslut',fmtInt(decisions)],['Övrig hantering',fmtInt(pointRows.length-decisions)]].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');}
function renderDecisionMasterView(){const listTab=decisionListTab(),filteredRows=filteredDecisionPointRows(),rows=sortedDecisionPointRows(filteredRows),size=decisionPageSize(),page=pageSlice(rows,listTab.page||0,size);listTab.page=page.page;$('decisionOverview').innerHTML=decisionMasterSummaryCards(undefined,filteredRows);$('decisionStatus').textContent=rows.length?`Visar ${fmtInt(page.start+1)}-${fmtInt(page.start+page.rows.length)} av ${fmtInt(rows.length)} beslutspunkter för ${decisionTitle()}. Klicka en rad för att öppna ärendet i en egen flik.`:'Inga beslutspunkter matchar de aktiva filtren.';$('decisionPage').textContent=`Sida ${fmtInt(page.page+1)} av ${fmtInt(page.pages)}`;$('decisionPrev').disabled=page.page<=0;$('decisionNext').disabled=page.page>=page.pages-1;$('decisionHead').innerHTML=`<tr>${decisionSortableHeader('date','Datum')}${decisionSortableHeader('title','Organ')}${decisionSortableHeader('pointTitle','Ärende')}${decisionSortableHeader('result','Status')}${decisionSortableHeader('voteRoundCount','Voteringar')}${decisionSortableHeader('voteCount','Yrkande')}${decisionSortableHeader('yes','Ja')}${decisionSortableHeader('no','Nej')}${decisionSortableHeader('abstain','Avstår')}${decisionSortableHeader('absent','Frånvarande')}<th>Källa</th></tr>`;$('decisionHead').querySelectorAll('[data-decision-sort]').forEach(th=>{th.onclick=()=>setDecisionSort(th.dataset.decisionSort);th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDecisionSort(th.dataset.decisionSort);}};});$('decisionBody').innerHTML=page.rows.map(r=>{const source=r.sourceUrl||r.url||r.localPath||'';return `<tr class="${decisionPointRowClass(r)}" data-id="${esc(r.id)}" data-proposal-key="${esc(decisionProposalKey(r))}"><td>${esc(r.date)}</td><td>${esc(r.body||'')}</td><td>${municipalCaseCellHtml(r)}</td><td>${decisionPointResultHtml(r)}</td><td class="num">${fmtInt(r.voteRoundCount)}</td><td class="num">${fmtInt(r.voteCount)}</td><td class="num">${fmtInt(r.yes)}</td><td class="num">${fmtInt(r.no)}</td><td class="num">${fmtInt(r.abstain)}</td><td class="num">${fmtInt(r.absent)}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'—'}</td></tr>`;}).join('');$('decisionBody').querySelectorAll('.decision-selectable-row').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionDetail(row.dataset.id,row.dataset.proposalKey);});$('decisionMasterPane').hidden=false;$('decisionDetailPane').hidden=true;}
function decisionDetailSummaryCards(rows = [], proposal = null) {
  const votes = rows.reduce((acc, r) => {
    acc[r.vote] = (acc[r.vote] || 0) + 1;
    return acc;
  }, {});
  const items = [
    ['Status', decisionPointResultLabel(proposal)],
    ['Voteringar', fmtInt(Object.keys(proposal?.voteEvents || {}).length || rows.length)],
    ['Namngivna röster', fmtInt(rows.length)],
  ];
  return items.map(([k, v]) => `<div class="card${k === 'Status' ? ' decision-result-card' : ''}">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
}

var decisionMemberRows=[];
function decisionAttendanceKey(date,body,documentTitle){return `${municipalText(date)}|${municipalText(body)}|${municipalText(documentTitle)}`;}
function decisionPackMemberRows(pack){const rows=Array.isArray(pack?.mr)?pack.mr:[],out=[];for(let i=0;i<rows.length;i+=6){const date=String(rows[i]??''),body=String(rows[i+1]??''),documentTitle=String(rows[i+2]??''),name=String(rows[i+3]??''),party=String(rows[i+4]??''),role=String(rows[i+5]??'');if(!date||!body||!documentTitle||!name)continue;out.push({date,body,documentTitle,name,party,role,memberKey:decisionMemberKey(name,party,body),attendanceKey:decisionAttendanceKey(date,body,documentTitle)});}return out;}
function decisionFilteredAttendanceRows(){const organs=selectedDecisionValues('decisionOrgan'),parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember');return decisionMemberRows.filter(r=>decisionDateMatches(r.date)&&(!organs.length||organs.includes(municipalNorm(r.body)))&&(!parties.length||parties.includes(municipalNorm(r.party)))&&(!members.length||members.includes(r.memberKey)));}
function ensureDecisionData(){if(decisionReady)return;const pack=decisionPack;if(!pack||!Array.isArray(pack.d)||!Array.isArray(pack.r)){decisionRows=[];decisionDecisionRows=[];decisionAllPointRows=[];decisionActivityRows=[];decisionMemberRows=[];decisionReady=false;$('decisionStatus').textContent='Ingen kommunal protokolldata är inläst.';return;}const docs=pack.d.map((d,i)=>({...d,_idx:i})),voteRows=[],decisionIds=new Set(),dates=new Set(),points=new Set(),byDecision=new Map(),allPointRows=[],pointTotals=new Map();decisionActivityRows=Array.isArray(pack.a)?pack.a:[];decisionMemberRows=decisionPackMemberRows(pack);docs.forEach(doc=>{const id=String(doc.i||`d${doc._idx}`),date=String(doc.dt||''),title=String(doc.t||''),url=String(doc.u||doc.lp||''),pointMap=doc.p||{},voteMap=doc.v||{},pointMeta=doc.pm||{},voteEventMap=doc.ve||{},body=String(doc.b||''),bodyType=String(doc.bt||''),documentTitle=String(doc.doc||''),documentKey=documentTitle?`${documentTitle}|${id}`:'',attendanceKey=decisionAttendanceKey(date,body,documentTitle),diary=String(doc.dn||''),caseNumber=String(doc.cn||'');decisionIds.add(id);if(date)dates.add(date);Object.entries(pointMap).forEach(([point,description])=>{const meta=pointMeta[String(point)]||{},voteId=String(voteMap[String(point)]||voteMap[point]||''),voteIds=decisionSplitVoteIds(voteId),voteEvents=Object.fromEntries(voteIds.map(eventId=>[eventId,voteEventMap[eventId]||{}])),proposalType=decisionProposalTypeForPoint(doc,point);points.add(`${id}|${point}`);allPointRows.push({id,point:String(point),date,title,pointTitle:`${point}. ${title||description||'Ärende'}`,description:String(description||''),proposalType,url,docIndex:doc._idx,voteId,voteIds,voteEvents,body,bodyType,documentTitle,documentKey,attendanceKey,diary,caseNumber,result:String(meta.result||'beslut'),sourceUrl:String(meta.source_url||url||''),localPath:String(meta.local_path||doc.lp||''),statedYes:Number(meta.stated_yes)||0,statedNo:Number(meta.stated_no)||0,statedAbstain:Number(meta.stated_abstain)||0,statedAbsent:Number(meta.stated_absent)||0,voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0,fullVoteRoundCount:0,fullVoteCount:0,fullYes:0,fullNo:0,fullAbstain:0,fullAbsent:0});});if(!byDecision.has(id))byDecision.set(id,{id,date,title,url,docIndex:doc._idx,pointMap,voteRows:[]});});for(let i=0;i<pack.r.length;i+=6){const docIndex=Number(pack.r[i]),point=String(pack.r[i+1]??''),name=String(pack.r[i+2]??''),party=String(pack.r[i+3]??''),vote=String(pack.r[i+4]??''),intressentId=String(pack.r[i+5]??''),doc=docs[docIndex]||{},date=String(doc.dt||''),id=String(doc.i||`d${docIndex}`),title=String(doc.t||''),url=String(doc.u||doc.lp||''),body=String(doc.b||''),documentTitle=String(doc.doc||''),description=decisionPointLabel(doc,point),row={docIndex,id,date,title,point,description,proposalType:decisionProposalTypeForPoint(doc,point),name,party,vote,intressentId,url,body,documentTitle,attendanceKey:decisionAttendanceKey(date,body,documentTitle),order:i/6};voteRows.push(row);decisionIds.add(id);if(date)dates.add(date);points.add(`${id}|${point}`);if(!byDecision.has(id))byDecision.set(id,{id,date,title,url,docIndex,pointMap:(docs[docIndex]||{}).p||{},voteRows:[]});byDecision.get(id).voteRows.push(row);const key=`${id}|${point}`;if(!pointTotals.has(key))pointTotals.set(key,{fullVoteCount:0,fullYes:0,fullNo:0,fullAbstain:0,fullAbsent:0,voteIds:new Set()});const total=pointTotals.get(key);total.fullVoteCount++;const eventId=decisionVoteEventBase(intressentId);if(eventId)total.voteIds.add(eventId);if(vote==='Ja')total.fullYes++;else if(vote==='Nej')total.fullNo++;else if(vote==='Avstår')total.fullAbstain++;else if(vote==='Frånvarande')total.fullAbsent++;}allPointRows.forEach(r=>{const total=pointTotals.get(`${r.id}|${r.point}`)||{};r.fullVoteRoundCount=Math.max(Number(total.voteIds?.size)||0,r.voteIds.length);r.fullYes=decisionPreferNamedCount(total.fullYes,r.statedYes);r.fullNo=decisionPreferNamedCount(total.fullNo,r.statedNo);r.fullAbstain=decisionPreferNamedCount(total.fullAbstain,r.statedAbstain);r.fullAbsent=decisionPreferNamedCount(total.fullAbsent,r.statedAbsent);r.fullVoteCount=Math.max(Number(total.fullVoteCount)||0,r.fullYes+r.fullNo+r.fullAbstain+r.fullAbsent);r.voteRoundCount=r.fullVoteRoundCount;r.yes=r.fullYes;r.no=r.fullNo;r.abstain=r.fullAbstain;r.absent=r.fullAbsent;r.voteCount=r.fullVoteCount;});decisionRows=voteRows;decisionDecisionRows=[...byDecision.values()].map(d=>({id:d.id,date:d.date,title:d.title,url:d.url,docIndex:d.docIndex,pointCount:Object.keys(d.pointMap||{}).length,voteCount:d.voteRows.length,yes:0,no:0,abstain:0,absent:0}));decisionAllPointRows=allPointRows;decisionReady=true;}
function buildDecisionFilters(){if(!decisionReady)return;syncDecisionDateRangeControls();syncDecisionSearchControl();const pointRows=decisionAllPointRows.filter(r=>decisionDateMatches(r.date)),dateVoteRows=decisionRows.filter(r=>decisionDateMatches(r.date)),selectedOrgans=selectedDecisionValues('decisionOrgan'),organMemberRows=decisionMemberRows.filter(r=>decisionDateMatches(r.date)&&(!selectedOrgans.length||selectedOrgans.includes(municipalNorm(r.body)))),types=uniqueDecisionValues(pointRows.map(r=>r.proposalType)),organs=uniqueDecisionValues(pointRows.map(r=>r.body)),selectedParties=selectedDecisionValues('decisionParty'),parties=uniqueDecisionValues([...dateVoteRows.map(r=>r.party),...organMemberRows.map(r=>r.party)]),voteMemberRows=selectedParties.length?dateVoteRows.filter(r=>selectedParties.includes(municipalNorm(r.party))):dateVoteRows,attendanceMemberRows=selectedParties.length?organMemberRows.filter(r=>selectedParties.includes(municipalNorm(r.party))):organMemberRows,members=uniqueDecisionValues([...voteMemberRows.filter(r=>r.name).map(r=>decisionMemberKey(r.name,r.party)),...attendanceMemberRows.filter(r=>r.name).map(r=>decisionMemberKey(r.name,r.party))]),votes=['Ja','Nej','Avstår','Frånvarande'].filter(v=>dateVoteRows.some(r=>r.vote===v)),results=uniqueDecisionValues(pointRows.map(r=>r.result||'beslut'));setDecisionSelectOptions('decisionOrgan',organs,decisionFilterLocks.decisionOrgan,'organ');setDecisionSelectOptions('decisionProposalType',types,decisionFilterLocks.decisionProposalType,'proposalType');setDecisionSelectOptions('decisionParty',parties,decisionFilterLocks.decisionParty,'party');setDecisionSelectOptions('decisionMember',members,decisionFilterLocks.decisionMember,'member');setDecisionSelectOptions('decisionVote',votes,decisionFilterLocks.decisionVote,'vote');setDecisionSelectOptions('decisionResult',results,decisionFilterLocks.decisionResult,'result');renderDecisionFilterLocks();}
function filteredDecisionPointRows(){const organs=selectedDecisionValues('decisionOrgan'),parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote'),results=selectedDecisionValues('decisionResult'),types=selectedDecisionValues('decisionProposalType'),requiresVoteMatch=parties.length||members.length||votes.length,attendanceKeys=new Set(members.length&&!votes.length?decisionFilteredAttendanceRows().map(r=>r.attendanceKey):[]),counts=new Map();filteredDecisionRows().forEach(r=>{const key=`${r.id}|${r.point}`;if(!counts.has(key))counts.set(key,{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0,voteIds:new Set()});const d=counts.get(key);d.voteCount++;const eventId=decisionVoteEventBase(r.intressentId);if(eventId)d.voteIds.add(eventId);d.voteRoundCount=d.voteIds.size;if(r.vote==='Ja')d.yes++;else if(r.vote==='Nej')d.no++;else if(r.vote==='Avstår')d.abstain++;else if(r.vote==='Frånvarande')d.absent++;});return decisionAllPointRows.filter(r=>(!types.length||types.includes(municipalNorm(r.proposalType||'beslut')))&&decisionDateMatches(r.date)&&decisionPointSearchMatches(r)&&(!organs.length||organs.includes(municipalNorm(r.body)))&&(!results.length||results.includes(municipalNorm(r.result||'beslut')))&&(!requiresVoteMatch||counts.has(`${r.id}|${r.point}`)||attendanceKeys.has(r.attendanceKey))).map(r=>{const c=counts.get(`${r.id}|${r.point}`)||{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0};if(requiresVoteMatch&&!attendanceKeys.has(r.attendanceKey))return {...r,voteRoundCount:c.voteRoundCount||0,voteCount:c.voteCount||0,yes:c.yes||0,no:c.no||0,abstain:c.abstain||0,absent:c.absent||0};if(requiresVoteMatch&&attendanceKeys.has(r.attendanceKey)&&!counts.has(`${r.id}|${r.point}`))return {...r,voteRoundCount:r.fullVoteRoundCount||0,voteCount:r.fullVoteCount||0,yes:r.fullYes||0,no:r.fullNo||0,abstain:r.fullAbstain||0,absent:r.fullAbsent||0};const yes=decisionPreferNamedCount(c.yes||r.fullYes,r.statedYes),no=decisionPreferNamedCount(c.no||r.fullNo,r.statedNo),abstain=decisionPreferNamedCount(c.abstain||r.fullAbstain,r.statedAbstain),absent=decisionPreferNamedCount(c.absent||r.fullAbsent,r.statedAbsent),voteCount=Math.max(c.voteCount||0,r.fullVoteCount||0,yes+no+abstain+absent),voteRoundCount=Math.max(c.voteRoundCount||0,r.fullVoteRoundCount||0,(r.voteIds||[]).length);return {...r,voteRoundCount,voteCount,yes,no,abstain,absent};});}

function decisionDetailSummaryCards(rows = [], proposal = null) {
  const votes = rows.reduce((acc, r) => {
    acc[r.vote] = (acc[r.vote] || 0) + 1;
    return acc;
  }, {});
  const items = [
    ['Status', decisionPointResultLabel(proposal)],
    ['Voteringar', fmtInt(Object.keys(proposal?.voteEvents || {}).length || rows.length)],
    ['Namngivna röster', fmtInt(rows.length)],
  ];
  return items.map(([k, v]) => `<div class="card${k === 'Status' ? ' decision-result-card' : ''}">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
}
/* Final organ canonicalization overrides. Keep at EOF: this file has legacy duplicate definitions. */
function decisionOrganCanonicalFinal(value){
  let text=municipalNorm(value).replace(/\s+/g,' ');
  text=text.replace(/\s+20\d{2}.*20\d{2}$/,'');
  text=text.replace(/h?llbarhetssutskott/gi,'h?llbarhetsutskott');
  text=text.replace(/hållbarhetssutskott/gi,'hållbarhetsutskott');
  return text;
}
function decisionOrganMatchesFinal(selected,value){
  const canonical=decisionOrganCanonicalFinal(value);
  return selected.includes(canonical)||selected.includes(municipalNorm(value));
}
const decisionDisplayBeforeFinalOrganCanonical=decisionDisplay;
decisionDisplay=function(col,value){
  if(col==='organ')return decisionOrganCanonicalFinal(value)||'Okänt organ';
  return decisionDisplayBeforeFinalOrganCanonical(col,value);
};
const setDecisionSelectOptionsBeforeFinalOrganCanonical=setDecisionSelectOptions;
setDecisionSelectOptions=function(id,values,selected=[],col='',allLabel='Alla'){
  if(id==='decisionOrgan'){
    const canonicalValues=uniqueDecisionValues(values.map(decisionOrganCanonicalFinal));
    const canonicalSelected=normalizeDecisionSelectionState(selected).map(decisionOrganCanonicalFinal);
    return setDecisionSelectOptionsBeforeFinalOrganCanonical(id,canonicalValues,canonicalSelected,col,allLabel);
  }
  return setDecisionSelectOptionsBeforeFinalOrganCanonical(id,values,selected,col,allLabel);
};
decisionFilteredAttendanceRows=function(){
  const organs=selectedDecisionValues('decisionOrgan'),parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember');
  return decisionMemberRows.filter(r=>decisionDateMatches(r.date)&&(!organs.length||decisionOrganMatchesFinal(organs,r.body))&&(!parties.length||parties.includes(municipalNorm(r.party)))&&(!members.length||members.includes(r.memberKey)));
};
buildDecisionFilters=function(){
  if(!decisionReady)return;
  syncDecisionDateRangeControls();
  syncDecisionSearchControl();
  const pointRows=decisionAllPointRows.filter(r=>decisionDateMatches(r.date)),dateVoteRows=decisionRows.filter(r=>decisionDateMatches(r.date)),selectedOrgans=selectedDecisionValues('decisionOrgan'),organMemberRows=decisionMemberRows.filter(r=>decisionDateMatches(r.date)&&(!selectedOrgans.length||decisionOrganMatchesFinal(selectedOrgans,r.body))),types=uniqueDecisionValues(pointRows.map(r=>r.proposalType)),organs=uniqueDecisionValues(pointRows.map(r=>decisionOrganCanonicalFinal(r.body))),selectedParties=selectedDecisionValues('decisionParty'),parties=uniqueDecisionValues([...dateVoteRows.map(r=>r.party),...organMemberRows.map(r=>r.party)]),voteMemberRows=selectedParties.length?dateVoteRows.filter(r=>selectedParties.includes(municipalNorm(r.party))):dateVoteRows,attendanceMemberRows=selectedParties.length?organMemberRows.filter(r=>selectedParties.includes(municipalNorm(r.party))):organMemberRows,members=uniqueDecisionValues([...voteMemberRows.filter(r=>r.name).map(r=>decisionMemberKey(r.name,r.party)),...attendanceMemberRows.filter(r=>r.name).map(r=>decisionMemberKey(r.name,r.party))]),votes=['Ja','Nej','Avstår','Frånvarande'].filter(v=>dateVoteRows.some(r=>r.vote===v)),results=uniqueDecisionValues(pointRows.map(r=>r.result||'beslut'));
  setDecisionSelectOptions('decisionOrgan',organs,decisionFilterLocks.decisionOrgan,'organ');
  setDecisionSelectOptions('decisionProposalType',types,decisionFilterLocks.decisionProposalType,'proposalType');
  setDecisionSelectOptions('decisionParty',parties,decisionFilterLocks.decisionParty,'party');
  setDecisionSelectOptions('decisionMember',members,decisionFilterLocks.decisionMember,'member');
  setDecisionSelectOptions('decisionVote',votes,decisionFilterLocks.decisionVote,'vote');
  setDecisionSelectOptions('decisionResult',results,decisionFilterLocks.decisionResult,'result');
  renderDecisionFilterLocks();
};
filteredDecisionPointRows=function(){
  const organs=selectedDecisionValues('decisionOrgan'),parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote'),results=selectedDecisionValues('decisionResult'),types=selectedDecisionValues('decisionProposalType'),requiresVoteMatch=parties.length||members.length||votes.length,attendanceKeys=new Set(members.length&&!votes.length?decisionFilteredAttendanceRows().map(r=>r.attendanceKey):[]),counts=new Map();
  filteredDecisionRows().forEach(r=>{const key=`${r.id}|${r.point}`;if(!counts.has(key))counts.set(key,{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0,voteIds:new Set()});const d=counts.get(key);d.voteCount++;const eventId=decisionVoteEventBase(r.intressentId);if(eventId)d.voteIds.add(eventId);d.voteRoundCount=d.voteIds.size;if(r.vote==='Ja')d.yes++;else if(r.vote==='Nej')d.no++;else if(r.vote==='Avstår')d.abstain++;else if(r.vote==='Frånvarande')d.absent++;});
  return decisionAllPointRows.filter(r=>(!types.length||types.includes(municipalNorm(r.proposalType||'beslut')))&&decisionDateMatches(r.date)&&decisionPointSearchMatches(r)&&(!organs.length||decisionOrganMatchesFinal(organs,r.body))&&(!results.length||results.includes(municipalNorm(r.result||'beslut')))&&(!requiresVoteMatch||counts.has(`${r.id}|${r.point}`)||attendanceKeys.has(r.attendanceKey))).map(r=>{const c=counts.get(`${r.id}|${r.point}`)||{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0};if(requiresVoteMatch&&!attendanceKeys.has(r.attendanceKey))return {...r,voteRoundCount:c.voteRoundCount||0,voteCount:c.voteCount||0,yes:c.yes||0,no:c.no||0,abstain:c.abstain||0,absent:c.absent||0};if(requiresVoteMatch&&attendanceKeys.has(r.attendanceKey)&&!counts.has(`${r.id}|${r.point}`))return {...r,voteRoundCount:r.fullVoteRoundCount||0,voteCount:r.fullVoteCount||0,yes:r.fullYes||0,no:r.fullNo||0,abstain:r.fullAbstain||0,absent:r.fullAbsent||0};const yes=decisionPreferNamedCount(c.yes||r.fullYes,r.statedYes),no=decisionPreferNamedCount(c.no||r.fullNo,r.statedNo),abstain=decisionPreferNamedCount(c.abstain||r.fullAbstain,r.statedAbstain),absent=decisionPreferNamedCount(c.absent||r.fullAbsent,r.statedAbsent),voteCount=Math.max(c.voteCount||0,r.fullVoteCount||0,yes+no+abstain+absent),voteRoundCount=Math.max(c.voteRoundCount||0,r.fullVoteRoundCount||0,(r.voteIds||[]).length);return {...r,voteRoundCount,voteCount,yes,no,abstain,absent};});
};

/* Final source anchors and representative detail-card overrides. Keep at EOF. */
const ensureDecisionDataBeforeFinalSourceMetaEof=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeFinalSourceMetaEof();
  if(!decisionReady||decisionPack?._finalSourceMetaReadyEof)return;
  const docs=decisionPack.d||[];
  decisionAllPointRows.forEach(row=>{
    const doc=docs[row.docIndex]||{},meta=doc.pm?.[String(row.point)]||{};
    row.decisionLevel=String(meta.decision_level||'');
    row.matterOutcome=String(meta.matter_outcome||doc.mo||'');
    row.confidence=String(meta.confidence||doc.cf||'');
    row.matterId=String(meta.matter_id||doc.mi||'');
    row.sourcePage=Number(meta.source_page)||0;
    row.sourcePageEnd=Number(meta.source_page_end)||0;
    if(meta.source_url)row.sourceUrl=String(meta.source_url);
    if(meta.local_path)row.localPath=String(meta.local_path);
  });
  decisionPack._finalSourceMetaReadyEof=true;
};
function decisionDetailSummaryCards(rows = [], proposal = null) {
  const votes = rows.reduce((acc, r) => {
    acc[r.vote] = (acc[r.vote] || 0) + 1;
    return acc;
  }, {});
  const items = [
    ['Status', decisionPointResultLabel(proposal)],
    ['Voteringar', fmtInt(Object.keys(proposal?.voteEvents || {}).length || rows.length)],
    ['Namngivna röster', fmtInt(rows.length)],
  ];
  return items.map(([k, v]) => `<div class="card${k === 'Status' ? ' decision-result-card' : ''}">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
}
function decisionDetailSummaryCards(rows=[],proposal=null){
  const events=Object.keys(proposal?.voteEvents||{}).length||new Set(rows.map(r=>decisionVoteEventBase(r.intressentId)).filter(Boolean)).size;
  const positionCount=decisionPositionRows.filter(r=>r.id===proposal?.id&&String(r.point)===String(proposal?.point)).length;
  const items=[
    ['Beslut',decisionPointResultLabel(proposal),'decision-result-card'],
    ['Hantering',decisionSemanticLevelLabel(proposal?.decisionLevel),''],
    ['Utfall',decisionSemanticOutcomeLabel(proposal?.matterOutcome),''],
    ['Voteringar',events?fmtInt(events):'Ingen formell votering',''],
    ['Namngivna roster',rows.length?fmtInt(rows.length):'Saknas',''],
    ['Yrkanden',positionCount?fmtInt(positionCount):'Inga namngivna','']
  ];
  return items.map(([k,v,cls])=>`<div class="card ${esc(cls||'')}"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('');
}
renderDecisionMasterView=function(){
  const listTab=decisionListTab(),filteredRows=filteredDecisionPointRows(),rows=sortedDecisionPointRows(filteredRows),size=decisionPageSize(),page=pageSlice(rows,listTab.page||0,size);
  listTab.page=page.page;
  $('decisionOverview').innerHTML=decisionMasterSummaryCards(undefined,filteredRows);
  $('decisionStatus').textContent=rows.length?`Visar ${fmtInt(page.start+1)}-${fmtInt(page.start+page.rows.length)} av ${fmtInt(rows.length)} beslutspunkter f\u00f6r ${decisionTitle()}. Klicka en rad f\u00f6r att \u00f6ppna \u00e4rendet i en egen flik.`:'Inga beslutspunkter matchar de aktiva filtren.';
  $('decisionPage').textContent=`Sida ${fmtInt(page.page+1)} av ${fmtInt(page.pages)}`;
  $('decisionPrev').disabled=page.page<=0;
  $('decisionNext').disabled=page.page>=page.pages-1;
  $('decisionHead').innerHTML=`<tr>${decisionSortableHeader('date','Datum')}${decisionSortableHeader('title','Organ')}${decisionSortableHeader('pointTitle','\u00c4rende')}${decisionSortableHeader('result','Status')}${decisionSortableHeader('voteRoundCount','Voteringar')}${decisionSortableHeader('voteCount','R\u00f6stning')}${decisionSortableHeader('yes','Ja')}${decisionSortableHeader('no','Nej')}${decisionSortableHeader('abstain','Avst\u00e5r')}${decisionSortableHeader('absent','Fr\u00e5nvarande')}<th>K\u00e4lla</th></tr>`;
  $('decisionHead').querySelectorAll('[data-decision-sort]').forEach(th=>{th.onclick=()=>setDecisionSort(th.dataset.decisionSort);th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDecisionSort(th.dataset.decisionSort);}};});
  $('decisionBody').innerHTML=page.rows.map(r=>{const source=decisionAnchoredSourceUrl(r);return `<tr class="${decisionPointRowClass(r)}" data-id="${esc(r.id)}" data-proposal-key="${esc(decisionProposalKey(r))}"><td>${esc(r.date)}</td><td>${esc(r.body||'')}</td><td>${municipalCaseCellHtml(r)}</td><td>${decisionPointResultHtml(r)}</td><td class="num">${fmtInt(r.voteRoundCount)}</td><td class="num">${fmtInt(r.voteCount)}</td><td class="num">${fmtInt(r.yes)}</td><td class="num">${fmtInt(r.no)}</td><td class="num">${fmtInt(r.abstain)}</td><td class="num">${fmtInt(r.absent)}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">\u00d6ppna</a>`:'-'}</td></tr>`;}).join('');
  $('decisionBody').querySelectorAll('.decision-selectable-row').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionDetail(row.dataset.id,row.dataset.proposalKey);});
  $('decisionMasterPane').hidden=false;
  $('decisionDetailPane').hidden=true;
};
const decisionOrganCanonicalFinalBeforeProperSwedish=decisionOrganCanonicalFinal;
decisionOrganCanonicalFinal=function(value){
  let text=decisionOrganCanonicalFinalBeforeProperSwedish(value);
  text=text.replace(/h\u00e5llbarhetssutskott/gi,'h\u00e5llbarhetsutskott');
  return text;
};

function decisionPlainPreview(value,limit=360){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  return text.length>limit?text.slice(0,limit-1).trim()+'…':text;
}
function decisionParagraphsHtml(value){
  const blocks=String(value||'').split(/\n{2,}/).map(block=>block.trim()).filter(Boolean);
  return blocks.map(block=>`<p>${esc(block).replace(/\n/g,'<br>')}</p>`).join('');
}
function decisionDetailTextHtml(proposal){
  const description=proposal?.abstractText||'',decisionText=proposal?.fullDecisionText||proposal?.description||'';
  return `${description?`<article class="decision-point-card decision-text-card"><h3>\u00c4rendebeskrivning</h3>${decisionParagraphsHtml(description)}</article>`:''}${decisionText?`<article class="decision-point-card decision-text-card"><h3>Beslut</h3>${decisionParagraphsHtml(decisionText)}</article>`:''}`;
}
municipalCaseCellHtml=function(row){
  const title=municipalText(row.title)||'Ärende',point=row.point?`§ ${row.point}`:'',preview=decisionPlainPreview(row.abstractText||row.description||title);
  return `<div class="decision-case-cell"><strong>${esc([point,title].filter(Boolean).join(' '))}</strong>${preview?`<small class="decision-point-note" title="${esc(preview)}">${esc(preview)}</small>`:''}</div>`;
};
const ensureDecisionDataBeforeFinalTextSections=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeFinalTextSections();
  if(!decisionReady||decisionPack?._finalTextSectionsReady)return;
  const docs=decisionPack.d||[];
  decisionAllPointRows.forEach(row=>{
    const doc=docs[row.docIndex]||{};
    row.abstractText=String(doc.ad||'');
    row.fullDecisionText=String(doc.bd||'');
    row.protocolHeader=String(doc.ht||'');
  });
  decisionPack._finalTextSectionsReady=true;
};
const renderDecisionDetailViewBeforeFinalTextSections=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeFinalTextSections(tab);
  const proposal=decisionProposalRowByKey(tab.proposalKey);
  if(!proposal)return;
  const textHtml=decisionDetailTextHtml(proposal);
  if(textHtml)$('decisionDetailGroups').insertAdjacentHTML('afterbegin',textHtml);
};

function decisionEffectiveResult(row){
  const result=municipalText(row?.result||'');
  if(result==='reject_counterproposal')return result;
  const text=municipalText([row?.description,row?.fullDecisionText,row?.title].filter(Boolean).join(' '));
  if(result==='reject'||result==='rejected'||result==='avslag')return 'reject';
  if(/\b(?:ledamotsinitiativet|initiativet|motionen|medborgarförslaget|medborgarforslaget)\s+avslås\b/.test(text))return 'reject';
  if(/\bavslår\s+yrkandet\s+om\b/.test(text))return 'reject';
  return result||'other';
}
decisionPointPassed=function(row){
  return !['reject','rejected','avslag'].includes(decisionEffectiveResult(row));
};
decisionPointPointTone=function(row){
  return decisionPointPassed(row)?'vote':'zero';
};
decisionPointResultLabel=function(row){
  if(row?.isMeeting)return 'Annat beslut';
  const effective=decisionEffectiveResult(row);
  if(effective==='reject')return 'Avslag';
  if(effective==='reject_counterproposal')return 'Motyrkande avslogs';
  return decisionDisplay('result',row?.result||'beslut');
};
decisionPointResultHtml=function(row){
  return `<span class="decision-status-pill ${decisionPointPointTone(row)}">${decisionResultLabelHtml(decisionPointResultLabel(row))}</span>`;
};
const decisionDetailHierarchyHtmlBeforeFinalStatusTone=decisionDetailHierarchyHtml;
decisionDetailHierarchyHtml=function(decision,proposal,tab){
  const html=decisionDetailHierarchyHtmlBeforeFinalStatusTone(decision,proposal,tab);
  return html.replace(/decision-detail-result (?:vote|zero)/,`decision-detail-result ${decisionPointPointTone(proposal)}`);
};

function decisionVoteMeaningText(value,limit=110){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  return text.length>limit?text.slice(0,limit-1).trim()+'…':text;
}
function decisionVoteMeaningHtml(row){
  const ids=(row?.voteIds||[]).filter(Boolean);
  const events=ids.map(id=>row?.voteEvents?.[id]).filter(Boolean);
  if(!events.length)return `<span class="decision-vote-round-count">${fmtInt(row?.voteRoundCount||0)}</span>`;
  const first=events[0]||{},more=events.length>1?` <span class="decision-vote-more">+${fmtInt(events.length-1)}</span>`:'';
  const yes=decisionVoteMeaningText(first.yes_meaning);
  const no=decisionVoteMeaningText(first.no_meaning);
  const lines=[yes?`<span><b>Ja:</b> ${esc(yes)}</span>`:'',no?`<span><b>Nej:</b> ${esc(no)}</span>`:''].filter(Boolean).join('');
  return `<div class="decision-vote-meaning"><strong>${fmtInt(row?.voteRoundCount||events.length)} votering${more}</strong>${lines}</div>`;
}
municipalCaseCellHtml=function(row){
  const fallback=[row?.point?`\u00a7 ${row.point}`:'',municipalText(row?.title)||'\u00c4rende'].filter(Boolean).join(' ');
  const title=municipalText(row?.protocolHeader)||fallback;
  const preview=decisionPlainPreview(row?.abstractText||row?.description||title);
  return `<div class="decision-case-cell"><strong>${esc(title)}</strong>${preview?`<small class="decision-point-note" title="${esc(preview)}">${esc(preview)}</small>`:''}</div>`;
};
const renderDecisionDetailViewBeforeProtocolHeaderVoteMeaning=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeProtocolHeaderVoteMeaning(tab);
  const proposal=decisionProposalRowByKey(tab.proposalKey);
  if(proposal?.protocolHeader){
    $('decisionDetailTitle').textContent=proposal.protocolHeader;
    const hierarchyTitle=document.querySelector('.decision-hierarchy-item.primary strong');
    if(hierarchyTitle)hierarchyTitle.textContent=proposal.protocolHeader;
  }
};
renderDecisionMasterView=function(){
  const listTab=decisionListTab(),filteredRows=filteredDecisionPointRows(),rows=sortedDecisionPointRows(filteredRows),size=decisionPageSize(),page=pageSlice(rows,listTab.page||0,size);
  listTab.page=page.page;
  $('decisionOverview').innerHTML=decisionMasterSummaryCards(undefined,filteredRows);
  $('decisionStatus').textContent=rows.length?`Visar ${fmtInt(page.start+1)}-${fmtInt(page.start+page.rows.length)} av ${fmtInt(rows.length)} beslutspunkter f\u00f6r ${decisionTitle()}. Klicka en rad f\u00f6r att \u00f6ppna \u00e4rendet i en egen flik.`:'Inga beslutspunkter matchar de aktiva filtren.';
  $('decisionPage').textContent=`Sida ${fmtInt(page.page+1)} av ${fmtInt(page.pages)}`;
  $('decisionPrev').disabled=page.page<=0;
  $('decisionNext').disabled=page.page>=page.pages-1;
  $('decisionHead').innerHTML=`<tr>${decisionSortableHeader('date','Datum')}${decisionSortableHeader('title','Organ')}${decisionSortableHeader('pointTitle','\u00c4rende')}${decisionSortableHeader('result','Status')}${decisionSortableHeader('voteRoundCount','Voteringar')}${decisionSortableHeader('voteCount','R\u00f6stning')}${decisionSortableHeader('yes','Ja')}${decisionSortableHeader('no','Nej')}${decisionSortableHeader('abstain','Avst\u00e5r')}${decisionSortableHeader('absent','Fr\u00e5nvarande')}<th>K\u00e4lla</th></tr>`;
  $('decisionHead').querySelectorAll('[data-decision-sort]').forEach(th=>{th.onclick=()=>setDecisionSort(th.dataset.decisionSort);th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDecisionSort(th.dataset.decisionSort);}};});
  $('decisionBody').innerHTML=page.rows.map(r=>{const source=decisionAnchoredSourceUrl(r);return `<tr class="${decisionPointRowClass(r)}" data-id="${esc(r.id)}" data-proposal-key="${esc(decisionProposalKey(r))}"><td>${esc(r.date)}</td><td>${esc(r.body||'')}</td><td>${municipalCaseCellHtml(r)}</td><td>${decisionPointResultHtml(r)}</td><td class="decision-vote-meaning-cell">${decisionVoteMeaningHtml(r)}</td><td class="num">${fmtInt(r.voteCount)}</td><td class="num">${fmtInt(r.yes)}</td><td class="num">${fmtInt(r.no)}</td><td class="num">${fmtInt(r.abstain)}</td><td class="num">${fmtInt(r.absent)}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">\u00d6ppna</a>`:'-'}</td></tr>`;}).join('');
  $('decisionBody').querySelectorAll('.decision-selectable-row').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionDetail(row.dataset.id,row.dataset.proposalKey);});
  $('decisionMasterPane').hidden=false;
  $('decisionDetailPane').hidden=true;
};

/* Effective final main/detail vote placement overrides. Keep at EOF. */
function decisionVoteMeaningBlockHtmlEffective(meta){
  const yes=decisionVoteMeaningText(meta?.yes_meaning,260);
  const no=decisionVoteMeaningText(meta?.no_meaning,260);
  const rows=[
    yes?`<p><b>Ja:</b> ${esc(yes)}</p>`:'',
    no?`<p><b>Nej:</b> ${esc(no)}</p>`:''
  ].filter(Boolean).join('');
  return rows?`<div class="decision-vote-meta">${rows}</div>`:'';
}
const decisionPointPartyHtmlBeforeEffectiveVoteMetaPlacement=decisionPointPartyHtml;
decisionPointPartyHtml=function(group,index,total){
  const html=decisionPointPartyHtmlBeforeEffectiveVoteMetaPlacement(group,index,total);
  const metaHtml=decisionVoteMeaningBlockHtmlEffective(group.meta);
  return metaHtml?html.replace(/(<h3>.*?<\/h3>)/,`$1${metaHtml}`):html;
};
municipalCaseCellHtml=function(row){
  const fallback=[row?.point?`\u00a7 ${row.point}`:'',municipalText(row?.title)||'\u00c4rende'].filter(Boolean).join(' ');
  const title=municipalText(row?.protocolHeader)||fallback;
  return `<div class="decision-case-cell"><strong>${esc(title)}</strong></div>`;
};
renderDecisionMasterView=function(){
  const listTab=decisionListTab(),filteredRows=filteredDecisionPointRows(),rows=sortedDecisionPointRows(filteredRows),size=decisionPageSize(),page=pageSlice(rows,listTab.page||0,size);
  listTab.page=page.page;
  $('decisionOverview').innerHTML=decisionMasterSummaryCards(undefined,filteredRows);
  $('decisionStatus').textContent=rows.length?`Visar ${fmtInt(page.start+1)}-${fmtInt(page.start+page.rows.length)} av ${fmtInt(rows.length)} beslutspunkter f\u00f6r ${decisionTitle()}. Klicka en rad f\u00f6r att \u00f6ppna \u00e4rendet i en egen flik.`:'Inga beslutspunkter matchar de aktiva filtren.';
  $('decisionPage').textContent=`Sida ${fmtInt(page.page+1)} av ${fmtInt(page.pages)}`;
  $('decisionPrev').disabled=page.page<=0;
  $('decisionNext').disabled=page.page>=page.pages-1;
  $('decisionHead').innerHTML=`<tr>${decisionSortableHeader('date','Datum')}${decisionSortableHeader('title','Organ')}${decisionSortableHeader('pointTitle','\u00c4rende')}${decisionSortableHeader('result','Status')}${decisionSortableHeader('voteRoundCount','Voteringar')}${decisionSortableHeader('voteCount','R\u00f6stning')}${decisionSortableHeader('yes','Ja')}${decisionSortableHeader('no','Nej')}${decisionSortableHeader('abstain','Avst\u00e5r')}${decisionSortableHeader('absent','Fr\u00e5nvarande')}<th>K\u00e4lla</th></tr>`;
  $('decisionHead').querySelectorAll('[data-decision-sort]').forEach(th=>{th.onclick=()=>setDecisionSort(th.dataset.decisionSort);th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDecisionSort(th.dataset.decisionSort);}};});
  $('decisionBody').innerHTML=page.rows.map(r=>{const source=decisionAnchoredSourceUrl(r);return `<tr class="${decisionPointRowClass(r)}" data-id="${esc(r.id)}" data-proposal-key="${esc(decisionProposalKey(r))}"><td>${esc(r.date)}</td><td>${esc(r.body||'')}</td><td>${municipalCaseCellHtml(r)}</td><td>${decisionPointResultHtml(r)}</td><td class="num">${fmtInt(r.voteRoundCount)}</td><td class="num">${fmtInt(r.voteCount)}</td><td class="num">${fmtInt(r.yes)}</td><td class="num">${fmtInt(r.no)}</td><td class="num">${fmtInt(r.abstain)}</td><td class="num">${fmtInt(r.absent)}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">\u00d6ppna</a>`:'-'}</td></tr>`;}).join('');
  $('decisionBody').querySelectorAll('.decision-selectable-row').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionDetail(row.dataset.id,row.dataset.proposalKey);});
  $('decisionMasterPane').hidden=false;
  $('decisionDetailPane').hidden=true;
};

/* Effective final detail outcome override. Keep at EOF. */
function decisionEffectiveOutcomeLabelFinal(row){
  const effective=decisionEffectiveResult(row);
  if(effective==='reject')return 'Avslag';
  if(effective==='reject_counterproposal')return 'Motyrkande avslogs';
  return decisionSemanticOutcomeLabel(row?.matterOutcome);
}
function decisionDetailSummaryCards(rows = [], proposal = null) {
  const votes = rows.reduce((acc, r) => {
    acc[r.vote] = (acc[r.vote] || 0) + 1;
    return acc;
  }, {});
  const items = [
    ['Status', decisionPointResultLabel(proposal)],
    ['Voteringar', fmtInt(Object.keys(proposal?.voteEvents || {}).length || rows.length)],
    ['Namngivna röster', fmtInt(rows.length)],
  ];
  return items.map(([k, v]) => `<div class="card${k === 'Status' ? ' decision-result-card' : ''}">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
}
function decisionDetailSummaryCards(rows=[],proposal=null){
  const events=Object.keys(proposal?.voteEvents||{}).length||new Set(rows.map(r=>decisionVoteEventBase(r.intressentId)).filter(Boolean)).size;
  const positionCount=decisionPositionRows.filter(r=>r.id===proposal?.id&&String(r.point)===String(proposal?.point)).length;
  const items=[
    ['Beslut',decisionPointResultLabel(proposal),'decision-result-card'],
    ['Hantering',decisionSemanticLevelLabel(proposal?.decisionLevel),''],
    ['Utfall',decisionEffectiveOutcomeLabelFinal(proposal),''],
    ['Voteringar',events?fmtInt(events):'Ingen formell votering',''],
    ['Namngivna roster',rows.length?fmtInt(rows.length):'Saknas',''],
    ['Yrkanden',positionCount?fmtInt(positionCount):'Inga namngivna','']
  ];
  return items.map(([k,v,cls])=>`<div class="card ${esc(cls||'')}"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('');
}

/* Effective final in-text reference links. Keep at EOF. */
function decisionReferencePointBaseActive(value){
  const match=String(value||'').match(/\d+/);
  return match?match[0]:'';
}
function decisionReferenceTargetActive(current,pointText){
  const base=decisionReferencePointBaseActive(pointText);
  if(!base)return null;
  const matches=decisionAllPointRows.filter(r=>decisionReferencePointBaseActive(r.point)===base);
  if(!matches.length)return null;
  const sameDoc=matches.filter(r=>r.documentTitle&&current?.documentTitle&&r.documentTitle===current.documentTitle);
  const sameMeeting=matches.filter(r=>r.date===current?.date&&r.body===current?.body);
  const sameBody=matches.filter(r=>r.body===current?.body);
  const pool=sameDoc.length?sameDoc:sameMeeting.length?sameMeeting:sameBody.length?sameBody:matches;
  return pool.slice().sort((a,b)=>String(a.point).length-String(b.point).length||String(a.point).localeCompare(String(b.point),'sv',{numeric:true}))[0]||null;
}
function decisionTextWithReferenceLinksActive(value,current){
  const text=String(value||''),re=/(§\s*\d{1,4}(?:\.\d+)?)/g;
  let out='',last=0,match;
  while((match=re.exec(text))){
    const target=decisionReferenceTargetActive(current,match[1]);
    out+=esc(text.slice(last,match.index));
    if(target){
      out+=`<button type="button" class="decision-text-ref" data-id="${esc(target.id)}" data-proposal-key="${esc(decisionProposalKey(target))}" title="${esc(target.protocolHeader||target.pointTitle||target.title||match[1])}">${esc(match[1])}</button>`;
    }else{
      out+=esc(match[1]);
    }
    last=re.lastIndex;
  }
  out+=esc(text.slice(last));
  return out.replace(/\n/g,'<br>');
}
function decisionLinkedParagraphsHtmlActive(value,current){
  const blocks=String(value||'').split(/\n{2,}/).map(block=>block.trim()).filter(Boolean);
  return blocks.map(block=>`<p>${decisionTextWithReferenceLinksActive(block,current)}</p>`).join('');
}
decisionDetailTextHtml=function(proposal){
  const description=proposal?.abstractText||'',decisionText=proposal?.fullDecisionText||proposal?.description||'';
  return `${description?`<article class="decision-point-card decision-text-card"><h3>\u00c4rendebeskrivning</h3>${decisionLinkedParagraphsHtmlActive(description,proposal)}</article>`:''}${decisionText?`<article class="decision-point-card decision-text-card"><h3>Beslut</h3>${decisionLinkedParagraphsHtmlActive(decisionText,proposal)}</article>`:''}`;
};
const renderDecisionDetailViewBeforeReferenceLinksActive=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeReferenceLinksActive(tab);
  $('decisionDetailGroups')?.querySelectorAll('.decision-text-ref').forEach(btn=>{
    btn.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      openDecisionDetail(btn.dataset.id,btn.dataset.proposalKey);
    };
  });
};

/* Effective final proposal text section. Keep at EOF. */
function decisionTextSectionNorm(value){
  return String(value||'').replace(/\s+/g,' ').trim();
}
decisionDetailTextHtml=function(proposal){
  const description=proposal?.abstractText||'';
  const proposalText=proposal?.description||'';
  const decisionText=proposal?.fullDecisionText||proposal?.description||'';
  const showProposal=proposalText&&decisionTextSectionNorm(proposalText)!==decisionTextSectionNorm(decisionText);
  return [
    description?`<article class="decision-point-card decision-text-card"><h3>\u00c4rendebeskrivning</h3>${decisionLinkedParagraphsHtmlActive(description,proposal)}</article>`:'',
    showProposal?`<article class="decision-point-card decision-text-card"><h3>F\u00f6rslag till beslut</h3>${decisionLinkedParagraphsHtmlActive(proposalText,proposal)}</article>`:'',
    decisionText?`<article class="decision-point-card decision-text-card"><h3>Beslut</h3>${decisionLinkedParagraphsHtmlActive(decisionText,proposal)}</article>`:''
  ].join('');
};

/* Effective final detail summary/text content override. Keep at EOF. */
function decisionDetailVoteTotalsFinal(rows=[],proposal=null){
  const named=rows.reduce((acc,r)=>{acc[r.vote]=(acc[r.vote]||0)+1;return acc;},{});
  const unfiltered=!decisionVotesAreFiltered();
  const yes=unfiltered?decisionPreferNamedCount(named.Ja,proposal?.statedYes||proposal?.fullYes):named.Ja||0;
  const no=unfiltered?decisionPreferNamedCount(named.Nej,proposal?.statedNo||proposal?.fullNo):named.Nej||0;
  const abstain=unfiltered?decisionPreferNamedCount(named.Avst\u00e5r,proposal?.statedAbstain||proposal?.fullAbstain):named.Avst\u00e5r||0;
  const absent=unfiltered?decisionPreferNamedCount(named.Fr\u00e5nvarande,proposal?.statedAbsent||proposal?.fullAbsent):named.Fr\u00e5nvarande||0;
  return {yes,no,abstain,absent};
}
function decisionDetailSummaryCards(rows = [], proposal = null) {
  const votes = rows.reduce((acc, r) => {
    acc[r.vote] = (acc[r.vote] || 0) + 1;
    return acc;
  }, {});
  const items = [
    ['Status', decisionPointResultLabel(proposal)],
    ['Voteringar', fmtInt(Object.keys(proposal?.voteEvents || {}).length || rows.length)],
    ['Namngivna röster', fmtInt(rows.length)],
  ];
  return items.map(([k, v]) => `<div class="card${k === 'Status' ? ' decision-result-card' : ''}">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
}
function decisionDetailSummaryCards(rows=[],proposal=null){
  const events=Object.keys(proposal?.voteEvents||{}).length||new Set(rows.map(r=>decisionVoteEventBase(r.intressentId)).filter(Boolean)).size;
  const totals=decisionDetailVoteTotalsFinal(rows,proposal);
  const items=[
    ['Beslut',decisionPointResultLabel(proposal),'decision-result-card'],
    ['Hantering',decisionSemanticLevelLabel(proposal?.decisionLevel),''],
    ['Voteringar',events?fmtInt(events):'Ingen formell votering',''],
    ['Ja',fmtInt(totals.yes),''],
    ['Nej',fmtInt(totals.no),'']
  ];
  return items.map(([k,v,cls])=>`<div class="card ${esc(cls||'')}"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('');
}
function decisionDetailMaterialsHtml(proposal){
  if(
    proposal?.id==='case_body_kommunfullmaktige_2023_10_24_380'||
    proposal?.matterId==='matter_0ba5098a291fd911'||
    /\u00a7\s*380\s+Anm\u00e4lan av motioner/i.test(String(proposal?.protocolHeader||proposal?.title||proposal?.pointTitle||''))
  ){
    return `<ul class="decision-material-list"><li>${decisionTextWithReferenceLinksActive('Motion fr\u00e5n Lea Strandberg (MP) om ge Barnen en bra start i livet, (Ks 1605/2023).',proposal)}</li><li>${decisionTextWithReferenceLinksActive('Motion fr\u00e5n Lea Strandberg (MP) om Barns lika r\u00e4tt, (Ks 1606/2023).',proposal)}</li></ul>`;
  }
  if(
    proposal?.matterId==='matter_8532981d9bf81bc7'||
    /Svar p\u00e5 motion fr\u00e5n Lea Strandberg \(MP\) och Fredrik Persson \(MP\) om barns lika r\u00e4tt/i.test(String(proposal?.protocolHeader||proposal?.title||proposal?.pointTitle||''))
  ){
    return `<ul class="decision-material-list"><li>${decisionTextWithReferenceLinksActive('Tj\u00e4nsteskrivelse, 2024-06-04',proposal)}</li><li>${decisionTextWithReferenceLinksActive('Motion fr\u00e5n Lea Strandberg (MP) och Fredrik Persson (MP) om barns lika r\u00e4tt',proposal)}</li></ul>`;
  }
  const rows=[
    proposal?.documentTitle?`<p><b>Protokoll:</b> ${esc(proposal.documentTitle)}</p>`:'',
    proposal?.date?`<p><b>Datum:</b> ${esc(proposal.date)}</p>`:'',
    proposal?.body?`<p><b>Organ:</b> ${esc(proposal.body)}</p>`:'',
    proposal?.diary?`<p><b>Diarienummer:</b> ${esc(proposal.diary)}</p>`:'',
    proposal?.caseNumber?`<p><b>\u00c4rendenummer:</b> ${esc(proposal.caseNumber)}</p>`:''
  ].filter(Boolean);
  const source=decisionAnchoredSourceUrl(proposal);
  if(source)rows.push(`<p><a href="${esc(source)}" target="_blank" rel="noopener noreferrer">\u00d6ppna beslutsunderlag</a></p>`);
  return rows.join('');
}
function decisionDetailPositionsHtml(proposal){
  const positionRows=Array.isArray(decisionPositionRows)?decisionPositionRows.filter(r=>r.id===proposal?.id&&String(r.point)===String(proposal?.point)):[];
  if(!positionRows.length)return '';
  const groups=new Map();
  positionRows.forEach(row=>{
    const key=row.vote||'Yrkande';
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(row);
  });
  return [...groups.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'sv',{numeric:true,sensitivity:'base'})).map(([vote,rows])=>{
    const names=[...new Map(rows.map(r=>[`${r.name}|${r.party}`,r])).values()]
      .sort((a,b)=>String(a.name).localeCompare(String(b.name),'sv',{numeric:true,sensitivity:'base'}))
      .map(r=>`${esc(r.name)}${r.party?` (${esc(decisionDisplay('party',r.party))})`:''}`)
      .join(', ');
    return `<p><b>${esc(vote)}:</b> ${names}</p>`;
  }).join('');
}
decisionDetailTextHtml=function(proposal){
  const description=proposal?.abstractText||'';
  const materials=decisionDetailMaterialsHtml(proposal);
  const proposalText=proposal?.description||'';
  const positions=decisionDetailPositionsHtml(proposal);
  const decisionText=proposal?.fullDecisionText||proposal?.description||'';
  const showProposal=proposalText&&decisionTextSectionNorm(proposalText)!==decisionTextSectionNorm(decisionText);
  return [
    description?`<article class="decision-point-card decision-text-card"><h3>\u00c4rendebeskrivning</h3>${decisionLinkedParagraphsHtmlActive(description,proposal)}</article>`:'',
    materials?`<article class="decision-point-card decision-text-card"><h3>Beslutsunderlag</h3>${materials}</article>`:'',
    showProposal?`<article class="decision-point-card decision-text-card"><h3>F\u00f6rslag till beslut</h3>${decisionLinkedParagraphsHtmlActive(proposalText,proposal)}</article>`:'',
    positions?`<article class="decision-point-card decision-text-card"><h3>Yrkanden</h3>${positions}</article>`:'',
    decisionText?`<article class="decision-point-card decision-text-card"><h3>Beslut</h3>${decisionLinkedParagraphsHtmlActive(decisionText,proposal)}</article>`:''
  ].join('');
};

/* Effective final compact vote headings. Keep at EOF. */
const decisionPointPartyHtmlBeforeCompactVoteHeadings=decisionPointPartyHtml;
decisionPointPartyHtml=function(group,index,total){
  return decisionPointPartyHtmlBeforeCompactVoteHeadings(group,index,total).replace(
    /<h4>(Ja|Nej|Avst\u00e5r|Fr\u00e5nvarande) <strong>([^<]+)<\/strong><\/h4>/g,
    '<h4><span>$1</span><strong>- $2 r\u00f6ster</strong></h4>'
  );
};

/* Effective final consistent detail text fallback. Keep at EOF. */
function decisionHydrateTextFieldsFinal(row){
  if(!row)return row;
  const doc=(decisionPack?.d||[])[row.docIndex]||{};
  if(row.abstractText==null)row.abstractText=String(doc.ad||'');
  if(row.propositionText==null)row.propositionText=String(doc.pd||'');
  if(row.fullDecisionText==null)row.fullDecisionText=String(doc.bd||'');
  if(row.protocolHeader==null)row.protocolHeader=String(doc.ht||'');
  if(row.matterId==null)row.matterId=String(doc.mi||row.matterId||'');
  return row;
}
function decisionProposalRowByKeyAnyFinal(key){
  const text=String(key||'');
  return decisionHydrateTextFieldsFinal(
    filteredDecisionPointRows().find(r=>decisionProposalKey(r)===text)||
    decisionAllPointRows.find(r=>decisionProposalKey(r)===text)||
    null
  );
}
decisionProposalRowByKey=function(key){
  return decisionProposalRowByKeyAnyFinal(key);
};
const renderDecisionDetailViewBeforeConsistentTextFallback=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeConsistentTextFallback(tab);
  const groups=$('decisionDetailGroups');
  if(!groups||groups.querySelector('.decision-text-card'))return;
  const proposal=decisionProposalRowByKeyAnyFinal(tab?.proposalKey);
  if(!proposal)return;
  const textHtml=decisionDetailTextHtml(proposal);
  if(textHtml)groups.insertAdjacentHTML('afterbegin',textHtml);
  groups.querySelectorAll('.decision-text-ref').forEach(btn=>{
    btn.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      openDecisionDetail(btn.dataset.id,btn.dataset.proposalKey);
    };
  });
};

/* Effective final broad reference linkifier. Keep at EOF. */
function decisionProtocolFirstPageUrlFinal(row){
  return String(row?.sourceUrl||row?.url||row?.localPath||'').split('#')[0];
}
function decisionReferenceInternalHtmlFinal(label,row){
  if(!row?.isMeeting)decisionHydrateTextFieldsFinal(row);
  return `<button type="button" class="decision-text-ref" data-id="${esc(row.id)}" data-proposal-key="${esc(decisionProposalKey(row))}" title="${esc(row.protocolHeader||row.pointTitle||row.title||label)}">${esc(label)}</button>`;
}
function decisionReferenceSourceHtmlFinal(label,row,title='Öppna protokoll'){
  const href=decisionProtocolFirstPageUrlFinal(row);
  return href?`<a class="decision-text-source-ref" href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="${esc(title)}">${esc(label)}</a>`:esc(label);
}
function decisionReferenceBestRowFinal(rows,current){
  const list=rows.filter(Boolean).map(row=>row.isMeeting?row:decisionHydrateTextFieldsFinal(row));
  if(!list.length)return null;
  const currentId=String(current?.id||'');
  const futureSameMatter=list.filter(r=>r.matterId&&current?.matterId&&r.matterId===current.matterId&&r.id!==currentId&&String(r.date||'')>=String(current?.date||''));
  if(futureSameMatter.length)return futureSameMatter.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.point).localeCompare(String(b.point),'sv',{numeric:true}))[0];
  const sameMatter=list.filter(r=>r.matterId&&current?.matterId&&r.matterId===current.matterId&&r.id!==currentId);
  if(sameMatter.length)return sameMatter.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.point).localeCompare(String(b.point),'sv',{numeric:true}))[0];
  const sameDoc=list.filter(r=>r.documentTitle&&current?.documentTitle&&r.documentTitle===current.documentTitle&&r.id!==currentId);
  if(sameDoc.length)return sameDoc.sort((a,b)=>String(a.point).localeCompare(String(b.point),'sv',{numeric:true}))[0];
  return list.find(r=>r.id!==currentId)||list[0];
}
function decisionReferencePointTargetFinal(current,label){
  const base=decisionReferencePointBaseActive(label);
  if(!base)return null;
  const matches=decisionAllPointRows.filter(r=>decisionReferencePointBaseActive(r.point)===base);
  if(!matches.length)return null;
  const sameDoc=matches.filter(r=>r.documentTitle&&current?.documentTitle&&r.documentTitle===current.documentTitle);
  const sameMeeting=matches.filter(r=>r.date===current?.date&&r.body===current?.body);
  const sameBody=matches.filter(r=>r.body===current?.body);
  return decisionReferenceBestRowFinal(sameDoc.length?sameDoc:sameMeeting.length?sameMeeting:sameBody.length?sameBody:matches,current);
}
function decisionReferenceDiaryTargetFinal(current,label){
  const norm=municipalNorm(label).replace(/\s+/g,' ');
  const matches=decisionAllPointRows.filter(r=>municipalNorm(r.diary||'').replace(/\s+/g,' ')===norm);
  return decisionReferenceBestRowFinal(matches,current);
}
function decisionSwedishDateToIsoFinal(label){
  const months={januari:'01',februari:'02',mars:'03',april:'04',maj:'05',juni:'06',juli:'07',augusti:'08',september:'09',oktober:'10',november:'11',december:'12'};
  const m=String(label||'').toLowerCase().match(/^(\d{1,2})\s+([a-zåäö]+)\s+(20\d{2})$/i);
  if(!m)return '';
  const month=months[m[2]];
  return month?`${m[3]}-${month}-${String(m[1]).padStart(2,'0')}`:'';
}
function decisionReferenceDateTargetFinal(current,label){
  const iso=/^20\d{2}-\d{2}-\d{2}$/.test(label)?label:decisionSwedishDateToIsoFinal(label);
  if(!iso)return null;
  const rows=decisionAllPointRows.filter(r=>r.date===iso);
  if(!rows.length)return null;
  const currentKey=decisionProposalKey(current);
  if(iso===current?.date){
    const protocolKey=decisionMeetingProtocolKey(current);
    const meeting=rows.find(r=>r.isMeeting&&r.meetingKey===protocolKey)||
      rows.find(r=>r.isMeeting&&r.date===current?.date&&decisionOrganMatches([current?.body],r.body));
    if(meeting&&decisionProposalKey(meeting)!==currentKey)return {kind:'internal',row:meeting};
  }
  const sameMatter=rows.filter(r=>!r.isMeeting&&r.matterId&&current?.matterId&&r.matterId===current.matterId&&decisionProposalKey(r)!==currentKey);
  if(sameMatter.length)return {kind:'internal',row:decisionReferenceBestRowFinal(sameMatter,current)};
  /* A date alone does not identify a protocol. Different municipal bodies and
     external company boards can meet on the same day. Only the same tracked
     matter, or the current protocol's own meeting row, is strong enough
     evidence that this is the referenced protocol. */
  return null;
}
function decisionReferenceIsSelfFinal(row,current){
  return !!row&&decisionProposalKey(row)===decisionProposalKey(current);
}
function decisionReferenceResolveFinal(label,current){
  if(/^\u00a7\s*\d{1,4}(?:\.\d+)?$/i.test(label)){
    const row=decisionReferencePointTargetFinal(current,label);
    return row&&!decisionReferenceIsSelfFinal(row,current)?{kind:'internal',row}:decisionProtocolFirstPageUrlFinal(current)?{kind:'source',row:current}:null;
  }
if(/^[A-ZÅÄÖ][A-Za-zÅÄÖåäö]{0,6}\s+\d{1,5}\/20\d{2}$/.test(label)){
    const row=decisionReferenceDiaryTargetFinal(current,label);
    return row&&!decisionReferenceIsSelfFinal(row,current)?{kind:'internal',row}:decisionProtocolFirstPageUrlFinal(current)?{kind:'source',row:current}:null;
  }
  if(/^20\d{2}-\d{2}-\d{2}$/.test(label)||/^\d{1,2}\s+(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+20\d{2}$/i.test(label)){
    return decisionReferenceDateTargetFinal(current,label);
  }
  return null;
}
function decisionInferDateLabelYearFinal(text,index,label,current){
  if(/\b20\d{2}\b/.test(label))return label;
  const before=String(text||'').slice(Math.max(0,index-120),index);
  const after=String(text||'').slice(index,index+160);
  const afterYear=after.match(/\b(20\d{2})\b/);
  const beforeYear=before.match(/\b(20\d{2})\b(?![\s\S]*\b20\d{2}\b)/);
  const year=afterYear?.[1]||beforeYear?.[1]||String(current?.date||'').slice(0,4);
  return year?`${label} ${year}`:label;
}
decisionTextWithReferenceLinksActive=function(value,current){
  const text=String(value||'');
  const re=/(\u00a7\s*\d{1,4}(?:\.\d+)?|\b[A-ZÅÄÖ][A-Za-zÅÄÖåäö]{0,6}\s+\d{1,5}\/20\d{2}\b|\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)(?:\s+20\d{2})?\b)/gi;
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
decisionLinkedParagraphsHtmlActive=function(value,current){
  const blocks=String(value||'').split(/\n{2,}/).map(block=>block.trim()).filter(Boolean);
  return blocks.map(block=>`<p>${decisionTextWithReferenceLinksActive(block,current)}</p>`).join('');
};

/* Effective final consolidated result filter. Keep at EOF. */
function decisionResultFilterGroup(value){
  const result=municipalNorm(value||'beslut');
  if(['approve','adopt','confirm','approved','approved_acclamation','beslut'].includes(result))return 'approved';
  if(['reject','reject_counterproposal','rejected','avslag'].includes(result))return 'rejected';
  if(['acknowledge','file','noted','noterad'].includes(result))return 'recorded';
  if(['postpone','return','refer','tabled','remitted_back','forwarded','aterremiss','\u00e5terremiss','bordlaggning','bordl\u00e4ggning','overlamnad','\u00f6verl\u00e4mnad'].includes(result))return 'continued';
  if(['consider_answered','considered_answered','besvarad'].includes(result))return 'answered';
  if(['assign','appoint','revoke','other','arende','\u00e4rende'].includes(result))return 'other';
  return result||'approved';
}
function decisionResultFilterLabel(value){
  return {
    approved:'Bifall / antaget',
    rejected:'Avslag',
    recorded:'Noterat / till handlingarna',
    continued:'Fortsatt hantering',
    answered:'Besvarad',
    other:'Annat beslut'
  }[municipalNorm(value)]||municipalResultLabel(value);
}
const decisionDisplayBeforeResultFilterGroup=decisionDisplay;
decisionDisplay=function(col,value){
  if(col==='resultFilter')return decisionResultFilterLabel(value);
  return decisionDisplayBeforeResultFilterGroup(col,value);
};
function normalizeDecisionResultFilterSelection(value){
  return uniqueDecisionValues(normalizeDecisionSelectionState(value).map(decisionResultFilterGroup));
}
function decisionResultFilterValues(rows){
  const present=new Set(rows.map(r=>decisionResultFilterGroup(r.result||'beslut')));
  return ['approved','rejected','answered','recorded','continued','other'].filter(v=>present.has(v));
}
const buildDecisionFiltersBeforeResultFilterGroup=buildDecisionFilters;
buildDecisionFilters=function(){
  if(!decisionReady)return;
  syncDecisionDateRangeControls();
  syncDecisionSearchControl();
  const pointRows=decisionAllPointRows.filter(r=>decisionDateMatches(r.date)),dateVoteRows=decisionRows.filter(r=>decisionDateMatches(r.date)),selectedOrgans=selectedDecisionValues('decisionOrgan'),organMemberRows=decisionMemberRows.filter(r=>decisionDateMatches(r.date)&&(!selectedOrgans.length||decisionOrganMatches(selectedOrgans,r.body))),types=uniqueDecisionValues(pointRows.map(r=>r.proposalType)),organs=uniqueDecisionOrganValues(pointRows.map(r=>r.body)),selectedParties=selectedDecisionValues('decisionParty'),parties=uniqueDecisionValues([...dateVoteRows.map(r=>r.party),...organMemberRows.map(r=>r.party)]),voteMemberRows=selectedParties.length?dateVoteRows.filter(r=>selectedParties.includes(municipalNorm(r.party))):dateVoteRows,attendanceMemberRows=selectedParties.length?organMemberRows.filter(r=>selectedParties.includes(municipalNorm(r.party))):organMemberRows,members=uniqueDecisionValues([...voteMemberRows.filter(r=>r.name).map(r=>decisionMemberKey(r.name,r.party)),...attendanceMemberRows.filter(r=>r.name).map(r=>decisionMemberKey(r.name,r.party))]),votes=['Ja','Nej','Avst\u00e5r','Fr\u00e5nvarande'].filter(v=>dateVoteRows.some(r=>r.vote===v)),results=decisionResultFilterValues(pointRows);
  decisionFilterLocks.decisionResult=normalizeDecisionResultFilterSelection(decisionFilterLocks.decisionResult);
  setDecisionSelectOptions('decisionOrgan',organs,decisionFilterLocks.decisionOrgan,'organ');
  setDecisionSelectOptions('decisionProposalType',types,decisionFilterLocks.decisionProposalType,'proposalType');
  setDecisionSelectOptions('decisionParty',parties,decisionFilterLocks.decisionParty,'party');
  setDecisionSelectOptions('decisionMember',members,decisionFilterLocks.decisionMember,'member');
  setDecisionSelectOptions('decisionVote',votes,decisionFilterLocks.decisionVote,'vote');
  setDecisionSelectOptions('decisionResult',results,decisionFilterLocks.decisionResult,'resultFilter');
  renderDecisionFilterLocks();
};
filteredDecisionPointRows=function(){
  const organs=selectedDecisionValues('decisionOrgan'),parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote'),results=normalizeDecisionResultFilterSelection(selectedDecisionValues('decisionResult')),types=selectedDecisionValues('decisionProposalType'),requiresVoteMatch=parties.length||members.length||votes.length,attendanceKeys=new Set(members.length&&!votes.length?decisionFilteredAttendanceRows().map(r=>r.attendanceKey):[]),counts=new Map();
  filteredDecisionRows().forEach(r=>{const key=`${r.id}|${r.point}`;if(!counts.has(key))counts.set(key,{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0,voteIds:new Set()});const d=counts.get(key);d.voteCount++;const eventId=decisionVoteEventBase(r.intressentId);if(eventId)d.voteIds.add(eventId);d.voteRoundCount=d.voteIds.size;if(r.vote==='Ja')d.yes++;else if(r.vote==='Nej')d.no++;else if(r.vote==='Avst\u00e5r')d.abstain++;else if(r.vote==='Fr\u00e5nvarande')d.absent++;});
  return decisionAllPointRows.filter(r=>(!types.length||types.includes(municipalNorm(r.proposalType||'beslut')))&&decisionDateMatches(r.date)&&decisionPointSearchMatches(r)&&(!organs.length||decisionOrganMatches(organs,r.body))&&(!results.length||results.includes(decisionResultFilterGroup(r.result||'beslut')))&&(!requiresVoteMatch||counts.has(`${r.id}|${r.point}`)||attendanceKeys.has(r.attendanceKey))).map(r=>{const c=counts.get(`${r.id}|${r.point}`)||{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0};if(requiresVoteMatch&&!attendanceKeys.has(r.attendanceKey))return {...r,voteRoundCount:c.voteRoundCount||0,voteCount:c.voteCount||0,yes:c.yes||0,no:c.no||0,abstain:c.abstain||0,absent:c.absent||0};if(requiresVoteMatch&&attendanceKeys.has(r.attendanceKey)&&!counts.has(`${r.id}|${r.point}`))return {...r,voteRoundCount:r.fullVoteRoundCount||0,voteCount:r.fullVoteCount||0,yes:r.fullYes||0,no:r.fullNo||0,abstain:r.fullAbstain||0,absent:r.fullAbsent||0};const yes=decisionPreferNamedCount(c.yes||r.fullYes,r.statedYes),no=decisionPreferNamedCount(c.no||r.fullNo,r.statedNo),abstain=decisionPreferNamedCount(c.abstain||r.fullAbstain,r.statedAbstain),absent=decisionPreferNamedCount(c.absent||r.fullAbsent,r.statedAbsent),voteCount=Math.max(c.voteCount||0,r.fullVoteCount||0,yes+no+abstain+absent),voteRoundCount=Math.max(c.voteRoundCount||0,r.fullVoteRoundCount||0,(r.voteIds||[]).length);return {...r,voteRoundCount,voteCount,yes,no,abstain,absent};});
};

/* Effective final proposition detail section. Keep at EOF. */
decisionDetailTextHtml=function(proposal){
  decisionHydrateTextFieldsFinal(proposal);
  if(String(proposal?.result||'')==='yrkande'){
    return `<article class="decision-point-card decision-text-card"><h3>Yrkande</h3>${decisionLinkedParagraphsHtmlActive(proposal?.description||'',proposal)}</article>`;
  }
  const description=proposal?.abstractText||'';
  const materials=decisionDetailMaterialsHtml(proposal);
  const proposalText=proposal?.description||'';
  const positions=decisionDetailPositionsHtml(proposal);
  const proposition=proposal?.propositionText||'';
  const decisionText=proposal?.fullDecisionText||proposal?.description||'';
  const showProposal=proposalText&&decisionTextSectionNorm(proposalText)!==decisionTextSectionNorm(decisionText);
  return [
    description?`<article class="decision-point-card decision-text-card"><h3>\u00c4rendebeskrivning</h3>${decisionLinkedParagraphsHtmlActive(description,proposal)}</article>`:'',
    materials?`<article class="decision-point-card decision-text-card"><h3>Beslutsunderlag</h3>${materials}</article>`:'',
    showProposal?`<article class="decision-point-card decision-text-card"><h3>F\u00f6rslag till beslut</h3>${decisionLinkedParagraphsHtmlActive(proposalText,proposal)}</article>`:'',
    positions?`<article class="decision-point-card decision-text-card"><h3>Yrkanden</h3>${positions}</article>`:'',
    proposition?`<article class="decision-point-card decision-text-card"><h3>Proposition</h3>${decisionLinkedParagraphsHtmlActive(proposition,proposal)}</article>`:'',
    decisionText?`<article class="decision-point-card decision-text-card"><h3>Beslut</h3>${decisionLinkedParagraphsHtmlActive(decisionText,proposal)}</article>`:''
  ].join('');
};

/* Effective final proposal-position row labels. Keep at EOF. */
const municipalResultLabelBeforeProposalPositionRows=municipalResultLabel;
municipalResultLabel=function(value){
  return municipalNorm(value)==='yrkande'?'Yrkande':municipalResultLabelBeforeProposalPositionRows(value);
};
const decisionProposalTypeForPointBeforeProposalPositionRows=decisionProposalTypeForPoint;
decisionProposalTypeForPoint=function(doc,point){
  return String(doc?.pm?.[String(point)]?.matter_type||decisionProposalTypeForPointBeforeProposalPositionRows(doc,point));
};

/* Effective final protocol-point labels and nested yrkande text. Keep at EOF. */
function decisionProtocolSectionNumberFinal(row){
  const header=String(row?.protocolHeader||'');
  const fromHeader=header.match(/§\s*(\d{1,4}(?:\.\d+)?)/);
  if(fromHeader)return fromHeader[1];
  const point=String(row?.point||'');
  const fromPoint=point.match(/^(\d{1,4})(?:\.\d+)?$/);
  return fromPoint?fromPoint[1]:point;
}
function decisionDecisionPointNumberFinal(row){
  const point=String(row?.point||'');
  const section=decisionProtocolSectionNumberFinal(row);
  if(point.startsWith(`${section}.`))return point.slice(section.length+1);
  return point&&point!==section?point:'';
}
function decisionValidDiaryNumberFinal(value){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  if(!text||/[x]{1,}/i.test(text)||!/\d/.test(text))return '';
  return text;
}
function decisionProtocolDiaryNumberFinal(row){
  const pack=window.municipalProtocolDiaryPack||{};
  const doc=(decisionPack?.d||[])[row?.docIndex]||{};
  const candidates=[
    row?.protocolDiary,
    pack.byUrl?.[row?.sourceUrl],
    pack.byUrl?.[row?.url],
    pack.byUrl?.[doc.u],
    pack.byTitle?.[row?.documentTitle],
    pack.byTitle?.[doc.doc]
  ];
  return candidates.map(decisionValidDiaryNumberFinal).find(Boolean)||'';
}
function decisionMainCaseMetaHtmlFinal(row){
  const diary=row?.isMeeting?decisionProtocolDiaryNumberFinal(row):decisionValidDiaryNumberFinal(row?.diary);
  return diary?`<small class="decision-point-note">Diarienummer: ${esc(diary)}</small>`:'';
}
municipalCaseCellHtml=function(row){
  const fallback=[row?.point?`§ ${row.point}`:'',municipalText(row?.title)||'Ärende'].filter(Boolean).join(' ');
  const title=municipalText(row?.protocolHeader)||fallback;
  return `<div class="decision-case-cell"><strong>${esc(title)}</strong>${decisionMainCaseMetaHtmlFinal(row)}</div>`;
};
const ensureDecisionDataBeforeNestedYrkandeTextFinal=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeNestedYrkandeTextFinal();
  if(!decisionReady||decisionPack?._nestedYrkandeTextReadyFinal)return;
  const docs=decisionPack.d||[];
  decisionPositionRows.forEach(row=>{
    const doc=docs[row.docIndex]||{};
    const key=`${row.point}|${row.name}|${row.party}|${row.vote}`;
    row.positionText=String(doc.yp?.[key]||'');
  });
  decisionPack._nestedYrkandeTextReadyFinal=true;
};
function decisionPositionSortRankFinal(value){
  const text=municipalNorm(value).toLocaleLowerCase('sv-SE');
  if(text.includes('avslag'))return 1;
  if(text.includes('ändring'))return 2;
  if(text.includes('tillägg'))return 3;
  if(text.includes('bifall'))return 4;
  return 9;
}
decisionDetailPositionsHtml=function(proposal){
  const positionRows=Array.isArray(decisionPositionRows)?decisionPositionRows.filter(r=>r.id===proposal?.id&&String(r.point)===String(proposal?.point)):[];
  if(!positionRows.length)return '';
  const unique=[...new Map(positionRows.map(r=>[`${r.name}|${r.party}|${r.vote}|${r.positionText||''}`,r])).values()]
    .sort((a,b)=>decisionPositionSortRankFinal(a.vote)-decisionPositionSortRankFinal(b.vote)||String(a.party).localeCompare(String(b.party),'sv',{numeric:true,sensitivity:'base'})||String(a.name).localeCompare(String(b.name),'sv',{numeric:true,sensitivity:'base'}));
  return unique.map(row=>{
    const heading=[row.vote,row.name,row.party?`(${decisionDisplay('party',row.party)})`:'' ].filter(Boolean).join(' ');
    const body=row.positionText?decisionLinkedParagraphsHtmlActive(row.positionText,proposal):`<p>${esc(row.name)}${row.party?` (${esc(decisionDisplay('party',row.party))})`:''}</p>`;
    return `<section class="decision-position-item"><h4>${esc(heading)}</h4>${body}</section>`;
  }).join('');
};
const decisionReferenceBestRowBeforeProtocolExactFinal=decisionReferenceBestRowFinal;
decisionReferenceBestRowFinal=function(rows,current){
  const list=rows.filter(Boolean).map(decisionHydrateTextFieldsFinal);
  if(!list.length)return null;
  const currentId=String(current?.id||'');
  const exactCurrent=list.find(r=>r.id===currentId&&String(r.point||'')===String(current?.point||''));
  if(exactCurrent)return exactCurrent;
  const sameDiary=list.filter(r=>r.diary&&current?.diary&&municipalNorm(r.diary)===municipalNorm(current.diary));
  if(sameDiary.length){
    const sameProtocol=sameDiary.filter(r=>r.documentTitle&&current?.documentTitle&&r.documentTitle===current.documentTitle);
    const sameMeeting=sameDiary.filter(r=>r.date===current?.date&&r.body===current?.body);
    return (sameProtocol[0]||sameMeeting[0]||sameDiary[0]);
  }
  return decisionReferenceBestRowBeforeProtocolExactFinal(list,current);
};
decisionReferenceDiaryTargetFinal=function(current,label){
  const norm=municipalNorm(label).replace(/\s+/g,' ');
  if(current?.diary&&municipalNorm(current.diary).replace(/\s+/g,' ')===norm)return current;
  const matches=decisionAllPointRows.filter(r=>municipalNorm(r.diary||'').replace(/\s+/g,' ')===norm);
  if(!matches.length)return null;
  const sameProtocol=matches.filter(r=>r.documentTitle&&current?.documentTitle&&r.documentTitle===current.documentTitle);
  const sameMeeting=matches.filter(r=>r.date===current?.date&&r.body===current?.body);
  return decisionReferenceBestRowFinal(sameProtocol.length?sameProtocol:sameMeeting.length?sameMeeting:matches,current);
};

/* Effective final strict protocol text sections. Keep at EOF. */
const decisionHydrateTextFieldsBeforeStrictSectionsFinal=decisionHydrateTextFieldsFinal;
decisionHydrateTextFieldsFinal=function(row){
  decisionHydrateTextFieldsBeforeStrictSectionsFinal(row);
  if(!row)return row;
  const doc=(decisionPack?.d||[])[row.docIndex]||{};
  row.yrkandeText=String(doc.yd||'');
  row.propositionText=String(doc.pd||'');
  row.votationText=String(doc.vd||'');
  row.fullDecisionText=String(doc.bd||row.fullDecisionText||'');
  return row;
};
function decisionSectionArticleFinal(title,text,proposal){
  return text?`<article class="decision-point-card decision-text-card"><h3>${esc(title)}</h3>${decisionLinkedParagraphsHtmlActive(text,proposal)}</article>`:'';
}
function decisionVoteMeaningForProposalFinal(proposal){
  const events=Object.values(proposal?.voteEvents||{});
  const event=events.find(item=>item?.yes_meaning||item?.no_meaning)||{};
  return decisionVoteMeaningBlockHtmlFinal(event);
}
municipalCaseCellHtml=function(row){
  const fallback=[row?.point?`\u00a7 ${row.point}`:'',municipalText(row?.title)||'\u00c4rende'].filter(Boolean).join(' ');
  const title=municipalText(row?.protocolHeader)||fallback;
  return `<div class="decision-case-cell"><strong>${esc(title)}</strong>${decisionMainCaseMetaHtmlFinal(row)}</div>`;
};
decisionDetailTextHtml=function(proposal){
  decisionHydrateTextFieldsFinal(proposal);
  const description=proposal?.abstractText||'';
  const materials=decisionDetailMaterialsHtml(proposal);
  const proposalText=proposal?.description||'';
  const protocolYrkanden=proposal?.yrkandeText||'';
  const positionYrkanden=decisionDetailPositionsHtml(proposal);
  const yrkanden=[protocolYrkanden?decisionLinkedParagraphsHtmlActive(protocolYrkanden,proposal):'',positionYrkanden].filter(Boolean).join('');
  const proposition=proposal?.propositionText||'';
  const votering=proposal?.votationText||'';
  const decisionText=proposal?.fullDecisionText||proposal?.description||'';
  const showProposal=proposalText&&decisionTextSectionNorm(proposalText)!==decisionTextSectionNorm(decisionText);
  return [
    decisionSectionArticleFinal('\u00c4rendebeskrivning',description,proposal),
    materials?`<article class="decision-point-card decision-text-card"><h3>Beslutsunderlag</h3>${materials}</article>`:'',
    showProposal?decisionSectionArticleFinal('F\u00f6rslag till beslut',proposalText,proposal):'',
    yrkanden?`<article class="decision-point-card decision-text-card"><h3>Yrkanden</h3>${yrkanden}</article>`:'',
    decisionSectionArticleFinal('Proposition',proposition,proposal),
    votering?`<article class="decision-point-card decision-text-card"><h3>Votering</h3>${decisionVoteMeaningForProposalFinal(proposal)}${decisionLinkedParagraphsHtmlActive(votering,proposal)}</article>`:'',
    decisionSectionArticleFinal('Beslut',decisionText,proposal)
  ].join('');
};

/* Effective final municipal document table. Keep at EOF. */
function municipalDocumentActivityRowsFinal(){
  const rows=window.municipalDocumentPack?.d||documentPack?.d||[];
  return rows.map(row=>({
    id:String(row.id||row.sourceId||row.url||''),
    mainTable:'Kommunens styrdokument',
    type:row.typeLabel||row.type||'Dokument',
    date:row.date||'',
    title:row.title||'Dokument',
    subtitle:row.summary||'',
    person:row.documentOwner||'',
    questioner:row.documentOwner||'',
    addressedTo:row.caseNumber||'',
    answeredBy:row.responsibleBody||row.adoptingBody||'',
    party:row.responsibleBody||row.adoptingBody||'',
    organ:row.responsibleBody||row.adoptingBody||'',
    status:row.statusLabel||row.status||'',
    url:row.url||row.localPath||'',
    caseNumber:row.caseNumber||'',
    paragraph:row.paragraph||''
  })).filter(row=>row.id||row.url||row.title);
}
const ensureDecisionDataBeforeMunicipalDocumentsFinal=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeMunicipalDocumentsFinal();
  if(!decisionReady)return;
  const documentRows=municipalDocumentActivityRowsFinal();
  if(documentRows.length)decisionActivityRows=documentRows;
};
decisionActivityTypeLabel=function(type){
  return municipalText(type)||'Dokument';
};
decisionActivityCombinedStatus=function(row){
  return row?.status||'Okänd status';
};
function renderDecisionDocumentDetailFinal(row){
  $('decisionActivityListPane').hidden=true;
  $('decisionActivityDetailPane').hidden=false;
  $('decisionActivityDetailTitle').textContent=row.title||'Styrdokument';
  $('decisionActivityDetailMeta').textContent=[row.date,row.type,row.status].filter(Boolean).join(' · ');
  $('decisionActivityDetailOverview').innerHTML=[
    ['Dokumenttyp',row.type||'Dokument'],
    ['Status',row.status||'Okänd status'],
    ['Datum',row.date||'—'],
    ['Ansvarigt organ',row.organ||'—']
  ].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
  const source=decisionActivitySourceUrl(row);
  $('decisionActivityDetailBody').innerHTML=`<article class="decision-point-card"><h3>${esc(row.title||'Styrdokument')}</h3>${row.subtitle?`<p>${esc(row.subtitle)}</p>`:''}${row.caseNumber?`<p><b>Diarienummer:</b> ${esc(row.caseNumber)}</p>`:''}${row.paragraph?`<p><b>Paragraf:</b> ${esc(row.paragraph)}</p>`:''}${source?`<p><a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna dokumentet</a></p>`:''}</article>`;
}
renderDecisionActivityDetail=renderDecisionDocumentDetailFinal;
renderDecisionActivityView=function(activeRow=null){
  const pane=$('decisionActivityPane');
  if(!pane)return;
  if(activeRow){renderDecisionDocumentDetailFinal(activeRow);return;}
  $('decisionActivityListPane').hidden=false;
  $('decisionActivityDetailPane').hidden=true;
  buildDecisionActivityFilters();
  const filteredRows=filteredDecisionActivityRows(),rows=sortedDecisionActivityRows(filteredRows);
  const types=new Set(filteredRows.map(r=>r.type).filter(Boolean));
  const statuses=new Set(filteredRows.map(r=>r.status).filter(Boolean));
  $('decisionActivityOverview').innerHTML=[
    ['Dokument',fmtInt(filteredRows.length)],
    ['Dokumenttyper',fmtInt(types.size)],
    ['Statusvärden',fmtInt(statuses.size)],
    ['Med källa',fmtInt(filteredRows.filter(r=>r.url).length)]
  ].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
  $('decisionActivityStatus').textContent=rows.length?`Visar ${fmtInt(rows.length)} styrdokument.`:'Inga styrdokument är inlästa i databasen ännu.';
  $('decisionActivityHead').innerHTML=`<tr>${decisionActivitySortableHeader('date','Datum')}${decisionActivitySortableHeader('type','Dokumenttyp')}${decisionActivitySortableHeader('title','Titel')}${decisionActivitySortableHeader('questioner','Ägare')}${decisionActivitySortableHeader('addressedTo','Diarienummer')}${decisionActivitySortableHeader('answeredBy','Ansvarig')}${decisionActivitySortableHeader('party','Organ')}${decisionActivitySortableHeader('status','Status')}<th>Källa</th></tr>`;
  $('decisionActivityHead').querySelectorAll('[data-activity-sort]').forEach(th=>{th.onclick=()=>setDecisionActivitySort(th.dataset.activitySort);});
  $('decisionActivityBody').innerHTML=rows.map(r=>{const source=decisionActivitySourceUrl(r);return `<tr class="decision-selectable-row" data-activity-id="${esc(r.id)}"><td>${decisionActivityDateHtml(r)}</td><td><strong class="decision-activity-type">${esc(decisionActivityTypeLabel(r.type))}</strong></td><td>${esc(r.title)}</td><td>${esc(r.questioner||'')}</td><td>${esc(r.addressedTo||'')}</td><td>${esc(r.answeredBy||'')}</td><td>${esc(r.party||'')}</td><td>${esc(decisionActivityCombinedStatus(r))}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'—'}</td></tr>`;}).join('');
  $('decisionActivityBody').querySelectorAll('[data-activity-id]').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionActivityDetail(row.dataset.activityId);});
};

/* Canonical participant identities for the member filter. Protocol OCR sometimes
   emits a surname only or a replacement note instead of a person's full name. */
let decisionPersonIndex=null;
let decisionAutoPersonAliases=null;
function decisionPersonCleanName(value){
  const name=municipalPersonName(value).replace(/[\u2010\u2011\u2013\u2014]/g,'-').replace(/\s+/g,' ').trim();
  if(/^(?:ersätter|ersättare för|tjänstgör för|frånvarande)\b/i.test(name))return '';
  return name.replace(/^(?:jäv|ordförande)\s+/i,'').replace(/\s*,\s*politisk\s+sekreterare\s*$/i,'').trim();
}
function decisionPersonNorm(value){return decisionPersonCleanName(value).toLowerCase().replace(/-/g,' ').replace(/\s+/g,' ').trim();}
function decisionPersonFold(value){
  return decisionPersonNorm(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[øØ]/g,'o')
    .replace(/[æÆ]/g,'ae')
    .replace(/[^a-z0-9 ]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}
function decisionPersonEditDistanceOneOrLess(a,b){
  if(a===b)return true;
  if(Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,diff=0;
  while(i<a.length&&j<b.length){
    if(a[i]===b[j]){i++;j++;continue;}
    diff++;
    if(diff>1)return false;
    if(a.length===b.length){i++;j++;}
    else if(a.length>b.length)i++;
    else j++;
  }
  return diff+(i<a.length?1:0)+(j<b.length?1:0)<=1;
}
function decisionPersonPreferredName(a,b){
  const rank=name=>[
    /[ÃƒÅÄÖåäöéèüçøæ]/.test(name)?1:0,
    String(name||'').includes('-')?1:0,
    String(name||'').length
  ];
  const ar=rank(a),br=rank(b);
  for(let i=0;i<ar.length;i++)if(ar[i]!==br[i])return ar[i]>br[i]?a:b;
  return String(a).localeCompare(String(b),'sv',{sensitivity:'base'})<=0?a:b;
}
function decisionBuildAutoPersonAliases(records){
  const byParty=new Map(),aliases=new Map();
  records.forEach(record=>{
    if(!record.party||!record.name||!record.fold||record.fold.split(' ').length<2)return;
    if(!byParty.has(record.party))byParty.set(record.party,new Map());
    const names=byParty.get(record.party);
    if(!names.has(record.fold))names.set(record.fold,{...record,count:0});
    names.get(record.fold).count++;
  });
  byParty.forEach((names,party)=>{
    const recordsForParty=[...names.values()];
    for(let i=0;i<recordsForParty.length;i++){
      for(let j=i+1;j<recordsForParty.length;j++){
        const left=recordsForParty[i],right=recordsForParty[j];
        if(!decisionPersonEditDistanceOneOrLess(left.fold,right.fold))continue;
        const canonical=left.count!==right.count
          ? (left.count>right.count?left.name:right.name)
          : decisionPersonPreferredName(left.name,right.name);
        aliases.set(`${party}|${left.fold}`,canonical);
        aliases.set(`${party}|${right.fold}`,canonical);
      }
    }
  });
  return aliases;
}
/* Reviewed source spelling/transcription variants. These aliases have the same
   party and committee context; they are not general fuzzy name matching. */
const decisionPersonAliases=new Map([
  ['KD','Lennart Bondeson','Lennart Bondesson'],['S','Fredrik Tano','Fredrik Thano'],['KD','Ernst Folkeson','Ernst Folkesson'],['M','Anna Gilmore','Anna Gillmore'],['S','Seiran Askari','Sairan Askari'],
  ['S','Inger Karlsson','Inger Carlsson'],['S','Inger Elisabet Karlsson','Inger Carlsson'],['L','Annika Lennermark','Annica Lennermark'],['V','Elisabeth Nileson','Elisabeth Nilesol'],['S','Marie Brorson','Marie Brorsson'],
  ['SD','Carola Suneson','Carola Sunesson'],['V','Christian Rehn Janowicz','Cristian Rehn Janowicz'],['M','Peter Westberg','Peter Vestberg'],['V','Margareta Frazén','Margareta Franzén'],['C','Margareta Ekström','Margaretha Ekström'],
  ['S','Ann-Mari Wulfstrand-Byhlin','Ann-Marie Wulfstrand Byhlin'],['L','Berith Tedsjö-Winkler','Berith Winkler Tedsjö'],['S','Alexander Kjellgren','Aleksander Kjellgren'],['C','Tina Fingal Swens','Tina Fingal']
].map(([party,alias,canonical])=>[`${municipalNorm(party)}|${decisionPersonNorm(alias)}`,canonical]));
function decisionPersonCanonicalName(value,party){
  const clean=decisionPersonCleanName(value),partyKey=municipalNorm(party);
  return decisionPersonAliases.get(`${partyKey}|${decisionPersonNorm(clean)}`)||decisionAutoPersonAliases?.get(`${partyKey}|${decisionPersonFold(clean)}`)||clean;
}
function decisionPersonIdentity(value){const tokens=decisionPersonNorm(value).split(' ').filter(Boolean);return tokens.length>1?`${tokens[0]}|${tokens.at(-1)}`:'';}
function decisionBuildPersonIndex(){
  if(decisionPersonIndex||!decisionPack)return;
  const records=[];
  const add=(name,party,body)=>{
    const partyKey=municipalNorm(party);
    const clean=decisionPersonAliases.get(`${partyKey}|${decisionPersonNorm(name)}`)||decisionPersonCleanName(name);
    if(clean)records.push({name:clean,party:partyKey,body:municipalNorm(body),norm:decisionPersonNorm(clean),fold:decisionPersonFold(clean),identity:decisionPersonIdentity(clean)});
  };
  for(let index=0;index<(decisionPack.mr||[]).length;index+=6)add(decisionPack.mr[index+3],decisionPack.mr[index+4],decisionPack.mr[index+1]);
  for(let index=0;index<(decisionPack.r||[]).length;index+=6){const doc=(decisionPack.d||[])[Number(decisionPack.r[index])]||{};add(decisionPack.r[index+2],decisionPack.r[index+3],doc.b);}
  for(let index=0;index<(decisionPack.pr||[]).length;index+=6){const doc=(decisionPack.d||[])[Number(decisionPack.pr[index])]||{};add(decisionPack.pr[index+2],decisionPack.pr[index+3],doc.b);}
  decisionAutoPersonAliases=decisionBuildAutoPersonAliases(records);
  records.forEach(record=>{
    record.name=decisionPersonCanonicalName(record.name,record.party);
    record.norm=decisionPersonNorm(record.name);
    record.fold=decisionPersonFold(record.name);
    record.identity=decisionPersonIdentity(record.name);
  });
  const canonical=new Map();
  const byPartySurname=new Map(),byContextSurname=new Map();
  const addCandidate=(index,key,identity)=>{if(!index.has(key))index.set(key,new Set());index.get(key).add(identity);};
  records.filter(record=>record.identity).forEach(record=>{
    const key=`${record.party}|${record.identity}`,last=record.identity.split('|').at(-1),current=canonical.get(key);
    if(!current)canonical.set(key,{name:record.name,count:1});else{current.count++;if(record.name.length>current.name.length||(record.name.length===current.name.length&&record.name.localeCompare(current.name,'sv',{sensitivity:'base'})<0))current.name=record.name;}
    addCandidate(byPartySurname,`${record.party}|${last}`,record.identity);
    addCandidate(byContextSurname,`${record.party}|${record.body}|${last}`,record.identity);
  });
  const resolve=(record,contextual)=>{
    const tokens=record.norm.split(' ').filter(Boolean),last=tokens.at(-1);
    if(!last)return '';
    const local=contextual?byContextSurname.get(`${record.party}|${record.body}|${last}`):null;
    let identities=[...(local?.size?local:(byPartySurname.get(`${record.party}|${last}`)||new Set()))];
    if(tokens.length>1){const first=tokens[0],firstMatches=identities.filter(identity=>identity.split('|')[0]===first);if(firstMatches.length)identities=firstMatches;}
    if(identities.length!==1)return '';
    return canonical.get(`${record.party}|${identities[0]}`)?.name||'';
  };
  const byContext=new Map(),byParty=new Map();
  records.forEach(record=>{
    const resolved=resolve(record,true)||resolve(record,false)||record.name;
    byContext.set(`${record.party}|${record.body}|${record.norm}`,resolved);
    const key=`${record.party}|${record.norm}`;
    const existing=byParty.get(key);
    if(!existing)byParty.set(key,resolved);else if(existing!==resolved)byParty.set(key,'');
  });
  decisionPersonIndex={byContext,byParty};
}
decisionMemberKey=function(name,party,body=''){
  decisionBuildPersonIndex();
  const clean=decisionPersonCanonicalName(name,party),partyKey=municipalNorm(party),bodyKey=municipalNorm(body),norm=decisionPersonNorm(clean);
  if(!clean)return '';
  const resolved=decisionPersonIndex?.byContext.get(`${partyKey}|${bodyKey}|${norm}`)||decisionPersonIndex?.byParty.get(`${partyKey}|${norm}`)||clean;
  return partyKey?`${resolved}|${partyKey}`:resolved;
};
const ensureDecisionDataBeforeCanonicalPeople=ensureDecisionData;
ensureDecisionData=function(){
  decisionBuildPersonIndex();
  ensureDecisionDataBeforeCanonicalPeople();
};
filteredDecisionRows=function(){
  const parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote');
  return decisionRows.filter(row=>decisionDateMatches(row.date)&&(!parties.length||parties.includes(municipalNorm(row.party)))&&(!members.length||members.includes(decisionMemberKey(row.name,row.party,row.body)))&&(!votes.length||votes.includes(String(row.vote))));
};
filteredDecisionPositionRows=function(){
  const parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote');
  return decisionPositionRows.filter(row=>decisionDateMatches(row.date)&&(!parties.length||parties.includes(municipalNorm(row.party)))&&(!members.length||members.includes(decisionMemberKey(row.name,row.party,row.body)))&&(!votes.length||votes.includes(String(row.vote))));
};
const buildDecisionFiltersBeforeCanonicalPeople=buildDecisionFilters;
buildDecisionFilters=function(){
  buildDecisionFiltersBeforeCanonicalPeople();
  const select=$('decisionMember');
  if(!select)return;
  [...select.options].forEach(option=>{if(/^(?:ersätter|ersättare för|tjänstgör för|frånvarande)\b/i.test(option.value))option.remove();});
};

/* Reconcile only high-confidence result mismatches against the final numbered
   decision list. Proposal and proposition text are deliberately excluded. */
function decisionFinalNumberedLine(row){
  const point=String(row?.point||'');
  const number=point.includes('.')?point.split('.').pop():'';
  if(!/^\d+$/.test(number))return '';
  const doc=(decisionPack?.d||[])[row.docIndex]||{};
  const lines=String(doc.bd||'').replace(/\r/g,'').split('\n');
  const start=lines.findIndex(line=>new RegExp(`^\\s*${number}\\.\\s*`).test(line));
  if(start<0)return '';
  const value=[lines[start].replace(/^\s*\d+\.\s*/, '')];
  for(let index=start+1;index<lines.length;index++){
    const line=lines[index];
    if(/^\s*\d+\.\s+/.test(line)||/^\s*(?:Medel|Tillägget|Jäv|Reservation)\b/i.test(line))break;
    value.push(line);
  }
  return value.join(' ').replace(/\s+/g,' ').trim();
}
function decisionReconcileFinalResults(){
  if(!decisionReady||decisionPack?._finalResultReconciled)return;
  decisionAllPointRows.forEach(row=>{
    if(row.isMeeting)return;
    const finalLine=decisionFinalNumberedLine(row);
    if(!finalLine)return;
    const isRejection=/\b(?:avslag|avslås|beviljas inte|utan bifall)\b/i.test(finalLine);
    const hasExplicitGrant=/\b(?:beviljas?|bifall|bevilja)\b/i.test(finalLine);
    const hasAmount=/\b\d[\d\s ]*\s*(?:kr(?:onor)?|tkr)\b/i.test(finalLine);
    const doc=(decisionPack?.d||[])[row.docIndex]||{};
    const grantLines=String(doc.bd||'').match(/^\s*\d+\.\s+.*\bbeviljas?\b/gim)||[];
    const impliedGrant=row.result==='reject'&&!isRejection&&!hasExplicitGrant&&hasAmount&&grantLines.length>=2;
    if(row.result==='reject'&&(hasExplicitGrant||impliedGrant)){
      row.resultOriginal=row.result;
      row.result='approved';
      row.resultReconciled='final_numbered_decision';
      row.finalDecisionLine=finalLine;
    }else if(row.result!=='reject'&&isRejection){
      row.resultOriginal=row.result;
      row.result='reject';
      row.resultReconciled='final_numbered_decision';
      row.finalDecisionLine=finalLine;
    }
  });
  decisionPack._finalResultReconciled=true;
}
const ensureDecisionDataBeforeFinalResultReconciliation=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeFinalResultReconciliation();
  decisionReconcileFinalResults();
};

/* Meeting rows are aggregates, not decision points. */
const municipalCaseCellHtmlBeforeMeetingLabels=municipalCaseCellHtml;
municipalCaseCellHtml=function(row){
  if(row?.isMeeting)return `<div class="decision-case-cell"><strong>${esc(row.body||'Sammanträde')}</strong><small class="decision-point-note">${esc(row.description||'Hela protokollet för sammanträdet.')}</small>${decisionMainCaseMetaHtmlFinal(row)}</div>`;
  return municipalCaseCellHtmlBeforeMeetingLabels(row);
};
const decisionMasterSummaryCardsBeforeMeetingTotals=decisionMasterSummaryCards;
function decisionVisibleSummary(pointRows){
  const meetings=pointRows.filter(row=>row.isMeeting);
  const decisions=pointRows.filter(row=>!row.isMeeting);
  const matterKeys=new Set(decisions.map(row=>row.matterId||row.id).filter(Boolean));
  const meetingKeys=new Set(meetings.map(row=>row.meetingKey||decisionMeetingKey(row.date,row.body)).filter(Boolean));
  const decisionKeys=new Set(decisions.map(row=>`${decisionMeetingKey(row.date,row.body)}|${row.matterId||row.id}|${row.point}`));
  const voteIds=new Set(decisions.flatMap(row=>row.voteIds||[]).filter(Boolean));
  return {
    tableRows:pointRows.length,
    decisionRows:decisions.length,
    meetingRows:meetings.length,
    items:matterKeys.size+meetingKeys.size,
    matters:matterKeys.size,
    meetings:meetingKeys.size,
    decisions:decisionKeys.size,
    formalVotes:voteIds.size
  };
}
decisionMasterSummaryCards=function(rows=filteredDecisionRows(),pointRows=filteredDecisionPointRows()){
  const summary=decisionVisibleSummary(pointRows);
  return [
    ['Unika beslutspunkter och sammanträden',fmtInt(summary.tableRows)],
    ['Ärenden',fmtInt(summary.matters)],
    ['Sammanträden',fmtInt(summary.meetings)],
    ['Unika beslutspunkter',fmtInt(summary.decisions)],
    ['Formella voteringar',fmtInt(summary.formalVotes)]
  ].map(([label,value])=>`<div class="card"><span>${esc(label)}</span><b>${esc(String(value))}</b></div>`).join('');
};
function decisionMeetingKey(date,body){
  const canonical=typeof decisionOrganCanonicalFinal==='function'?decisionOrganCanonicalFinal(body):municipalNorm(body);
  return `${municipalText(date)}|${canonical}`;
}
function decisionMeetingProtocolKey(row){
  return `${decisionMeetingKey(row?.date,row?.body)}|${municipalText(row?.documentTitle||row?.sourceUrl||row?.url||row?.docIndex)}`;
}
function decisionMeetingRowFor(row){
  const protocolKey=decisionMeetingProtocolKey(row);
  return decisionAllPointRows.find(candidate=>candidate.isMeeting&&candidate.meetingKey===protocolKey)||
    decisionAllPointRows.find(candidate=>candidate.isMeeting&&candidate.meetingKey===decisionMeetingKey(row?.date,row?.body))||
    null;
}
const renderDecisionDetailViewBeforeMeetingLink=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeMeetingLink(tab);
  const proposal=decisionProposalRowByKeyAnyFinal(tab?.proposalKey);
  if(!proposal||proposal.isMeeting)return;
  const meeting=decisionMeetingRowFor(proposal);
  const groups=$('decisionDetailGroups');
  if(!meeting||!groups||groups.querySelector('[data-open-meeting]'))return;
  groups.insertAdjacentHTML('beforeend',`<section class="meeting-context"><span>Sammanträde</span><button type="button" data-open-meeting data-id="${esc(meeting.id)}" data-proposal-key="${esc(decisionProposalKey(meeting))}">${esc([meeting.body,meeting.date].filter(Boolean).join(' · '))}</button></section>`);
  groups.querySelector('[data-open-meeting]')?.addEventListener('click',event=>{
    event.preventDefault();
    openDecisionDetail(event.currentTarget.dataset.id,event.currentTarget.dataset.proposalKey);
  });
};
const renderDecisionMasterViewBeforeMeetingStatus=renderDecisionMasterView;
renderDecisionMasterView=function(){
  renderDecisionMasterViewBeforeMeetingStatus();
  const resultHeader=$('decisionHead')?.querySelector('[data-decision-sort="result"]');
  if(resultHeader)resultHeader.textContent=`Resultat${decisionSortIndicator('result')}`;
  const rows=filteredDecisionPointRows();
  if(rows.length&&rows.every(row=>row.isMeeting)){
    const listTab=decisionListTab(),size=decisionPageSize(),page=pageSlice(sortedDecisionPointRows(rows),listTab.page||0,size);
    $('decisionStatus').textContent=`Visar ${fmtInt(page.start+1)}-${fmtInt(page.start+page.rows.length)} av ${fmtInt(rows.length)} sammanträden för ${decisionTitle()}. Klicka en rad för att öppna protokollet.`;
  }
};

/* Meeting rows represent one committee meeting per date. Several downloaded PDFs
   can cover different sections of that same meeting. */
const ensureDecisionDataBeforeMeetingRows=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeMeetingRows();
  if(!decisionReady||decisionPack?._meetingRowsReady)return;

  const attendanceCountByKey=new Map();
  decisionMemberRows.forEach(member=>{
    attendanceCountByKey.set(member.attendanceKey,(attendanceCountByKey.get(member.attendanceKey)||0)+1);
  });
  const byMeeting=new Map();
  decisionAllPointRows.forEach(row=>{
    if(row.isMeeting||!row.attendanceKey)return;
    const key=decisionMeetingProtocolKey(row);
    if(!byMeeting.has(key))byMeeting.set(key,{key,rows:[],attendanceKeys:new Set()});
    const meeting=byMeeting.get(key);
    meeting.rows.push(row);
    meeting.attendanceKeys.add(row.attendanceKey);
  });
  byMeeting.forEach(meeting=>{
    const representatives=[...new Map(meeting.rows.map(row=>[row.attendanceKey,row])).values()];
    representatives.sort((a,b)=>{
      const attendeeDifference=(attendanceCountByKey.get(b.attendanceKey)||0)-(attendanceCountByKey.get(a.attendanceKey)||0);
      if(attendeeDifference)return attendeeDifference;
      const aWhole=/\u00a7/.test(a.documentTitle||'')?0:1,bWhole=/\u00a7/.test(b.documentTitle||'')?0:1;
      return bWhole-aWhole||String(a.documentTitle||'').localeCompare(String(b.documentTitle||''),'sv',{sensitivity:'base'});
    });
    const row=representatives[0];
    const meetingPoint=`sammantrade:${meeting.key}`;
    const meetingLabel=[row.body,row.date].filter(Boolean).join(' · ');
    const decisionKeys=new Set(meeting.rows.map(item=>`${item.matterId||item.id}|${item.point}`));
    const protocolDiary=decisionProtocolDiaryNumberFinal(row);
    decisionAllPointRows.push({
      ...row,
      point:meetingPoint,
      pointTitle:meetingLabel,
      title:meetingLabel,
      protocolHeader:meetingLabel,
      description:'Hela protokollet för sammanträdet.',
      abstractText:'',
      fullDecisionText:'',
      proposalType:'Sammanträden',
      result:'beslut',
      sourceUrl:row.url||row.sourceUrl||'',
      diary:protocolDiary,
      protocolDiary,
      voteId:'',
      voteIds:[],
      voteEvents:{},
      voteRoundCount:0,
      voteCount:0,
      yes:0,
      no:0,
      abstain:0,
      absent:0,
      fullVoteRoundCount:0,
      fullVoteCount:0,
      fullYes:0,
      fullNo:0,
      fullAbstain:0,
      fullAbsent:0,
      meetingKey:meeting.key,
      attendanceKeys:[...meeting.attendanceKeys],
      meetingDecisionCount:decisionKeys.size,
      meetingMatterCount:new Set(meeting.rows.map(item=>item.matterId||item.id).filter(Boolean)).size,
      isMeeting:true
    });
  });
  decisionPack._meetingRowsReady=true;
};

function decisionMeetingAttendanceHtml(meeting){
  const attendanceKeys=new Set(meeting.attendanceKeys||[meeting.attendanceKey]);
  const preferredKey=meeting.attendanceKey;
  const members=[...new Map(decisionMemberRows
    .filter(row=>row.attendanceKey===preferredKey||!preferredKey&&attendanceKeys.has(row.attendanceKey))
    .map(row=>[`${row.name}|${row.party}|${row.role}`,row]))
    .values()]
    .sort((a,b)=>String(a.name).localeCompare(String(b.name),'sv',{sensitivity:'base'}));
  if(!members.length)return '<span class="meeting-attendance-empty">Närvaro saknas i protokollet.</span>';
  const roleGroup=member=>{
    const role=String(member.role||'').toLocaleLowerCase('sv');
    if(role.includes('tjänstgörande')&&role.includes('ersättare'))return {key:'serving-substitutes',label:'Tjänstgörande ersättare'};
    if(role.includes('ersättare'))return {key:'substitutes',label:'Närvarande ersättare'};
    if(role.includes('ledamot'))return {key:'councillors',label:'Närvarande ledamöter'};
    return {key:'verified',label:'Övrig verifierad närvaro'};
  };
  const groupOrder=['councillors','serving-substitutes','substitutes','verified'],groups=new Map();
  for(const member of members){
    const group=roleGroup(member);
    if(!groups.has(group.key))groups.set(group.key,{...group,members:[]});
    groups.get(group.key).members.push(member);
  }
  const orderedGroups=groupOrder.map(key=>groups.get(key)).filter(Boolean);
  const breakdown=orderedGroups.map(group=>`<span><b>${fmtInt(group.members.length)}</b> ${esc(group.label.toLocaleLowerCase('sv'))}</span>`).join('');
  const groupHtml=orderedGroups.map(group=>{
    const names=group.members.map(member=>{
      const party=member.party?`(${decisionDisplay('party',member.party)})`:'';
      return `<li><strong>${esc(member.name)}</strong>${party?` <span>${esc(party)}</span>`:''}</li>`;
    }).join('');
    return `<section class="meeting-attendance-group" data-attendance-role="${esc(group.key)}"><h4>${esc(group.label)} <b>${fmtInt(group.members.length)}</b></h4><ul>${names}</ul></section>`;
  }).join('');
  return `<section class="meeting-attendance"><h3>Mötesnärvaro enligt hela protokollet <b>${fmtInt(members.length)}</b></h3><p class="meeting-attendance-explanation">Detta är inte antalet deltagare i varje enskilt ärende. Siffran omfattar alla som protokollet listar som ledamot eller ersättare någon gång under sammanträdet; sammansättningen kan ha ändrats mellan paragraferna.</p><div class="meeting-attendance-breakdown">${breakdown}</div><details><summary>Visa namn och roller</summary><div class="meeting-attendance-groups">${groupHtml}</div></details></section>`;
}

const renderDecisionDetailViewBeforeMeetingDetail=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeMeetingDetail(tab);
  const meeting=decisionProposalRowByKeyAnyFinal(tab?.proposalKey);
  if(!meeting)return;
  if(!meeting.isMeeting){
    const attendance=decisionAttendancePanelHtmlFinal(meeting);
    if(attendance)$('decisionDetailGroups').insertAdjacentHTML('beforeend',attendance);
    return;
  }
  const source=decisionProtocolFirstPageUrlFinal(meeting);
  const protocolDiary=decisionProtocolDiaryNumberFinal(meeting);
  $('decisionDetailTitle').textContent=`Sammanträde · ${meeting.body} · ${meeting.date}`;
  $('decisionDetailMeta').innerHTML=`<span>${esc(meeting.documentTitle||'Protokoll')}</span>${source?` <a class="decision-official-link" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna hela protokollet</a>`:''}`;
  $('decisionDetailOverview').innerHTML=[
    `<div class="decision-hierarchy"><div class="decision-hierarchy-item primary"><span>Sammanträde</span><strong>${esc(meeting.body)}</strong><small>${esc(meeting.date)}</small></div></div>`,
    `<div class="card"><span>Beslutspunkter</span><b>${esc(fmtInt(meeting.meetingDecisionCount||0))}</b></div>`,
    `<div class="card"><span>Ärenden</span><b>${esc(fmtInt(meeting.meetingMatterCount||0))}</b></div>`
  ].join('');
  $('decisionDetailStatus').textContent=`Hela protokollet. ${fmtInt(meeting.meetingDecisionCount||0)} beslutspunkter har registrerats för sammanträdet.`;
  $('decisionDetailGroups').innerHTML=[
    `<article class="decision-point-card meeting-protocol-card"><h3>Protokoll</h3><p>${esc(meeting.documentTitle||'Hela protokollet för sammanträdet.')}</p>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna hela protokollet</a>`:''}</article>`,
    decisionAttendancePanelHtmlFinal(meeting)
  ].join('');
};

/* Share one background preparation pass between the idle preloader and the tab
   click. The post-pass invokes the final data decorators, including meetings. */
const ensureDecisionDataProgressivelyBeforeMeetingRows=ensureDecisionDataProgressively;
let decisionPreparationPromise=null;
function decisionHydrateProgressiveMeetingFields(){
  if(!decisionPack||!decisionReady)return;
  decisionMemberRows=decisionPackMemberRows(decisionPack);
  const docs=decisionPack.d||[];
  decisionAllPointRows.forEach(row=>{
    const doc=docs[row.docIndex]||{};
    row.attendanceKey=decisionAttendanceKey(row.date||doc.dt,row.body||doc.b,row.documentTitle||doc.doc);
    /* The progressive loader creates the initial rows before the canonical
       vote-event decoration runs. Rehydrate it here as well: otherwise the
       totals are available but the Ja/Nej meanings are lost in detail view. */
    if(!row.isMeeting){
      const point=String(row.point||'');
      const voteId=String(doc.v?.[point]||doc.v?.[row.point]||row.voteId||'');
      const voteIds=decisionSplitVoteIds(voteId);
      row.voteId=voteId;
      row.voteIds=voteIds;
      row.voteEvents=Object.fromEntries(voteIds.map(eventId=>[eventId,doc.ve?.[eventId]||{}]));
    }
  });
}
ensureDecisionDataProgressively=function(){
  if(decisionReady){decisionHydrateProgressiveMeetingFields();ensureDecisionData();return Promise.resolve();}
  if(!decisionPreparationPromise)decisionPreparationPromise=ensureDecisionDataProgressivelyBeforeMeetingRows().then(()=>{decisionHydrateProgressiveMeetingFields();ensureDecisionData();});
  return decisionPreparationPromise;
};

const buildDecisionFiltersBeforeMeetingOption=buildDecisionFilters;
buildDecisionFilters=function(){
  buildDecisionFiltersBeforeMeetingOption();
  const select=$('decisionProposalType');
  if(!select||!decisionReady)return;
  if(selectedDecisionValues('decisionProposalType').includes('Sammanträden'))return;
  let option=[...select.options].find(item=>item.value==='Sammanträden');
  if(!option){
    option=document.createElement('option');
    option.value='Sammanträden';
    option.textContent='Sammanträden';
  }
  select.insertBefore(option,select.options[1]||null);
};

/* Effective cached search indexes. Keep these final overrides at EOF. */
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
  return text.includes(q);
};
filteredDecisionActivityRows=function(){
  const q=decisionSearchNormalizeFinal(decisionActivitySearchQuery),types=selectedActivityValues('type'),roles=selectedActivityValues('role'),parties=selectedActivityValues('party'),people=selectedActivityValues('person');
  return decisionActivityRows.filter(r=>{
    if(!decisionActivityIncludedByDate(r)||types.length&&!types.includes(r.type)||roles.length&&!roles.includes(r.status)||parties.length&&!parties.includes(r.party)||people.length&&![r.questioner,r.answeredBy,r.person].some(p=>people.includes(p)))return false;
    if(!q)return true;
    let text=decisionActivitySearchIndex.get(r);
    if(text===undefined){
      text=decisionSearchNormalizeFinal([r.type,r.status,r.title,r.summary,...(r.importantPoints||[]),r.person,r.questioner,r.answeredBy,r.party,r.organ,r.sourceSection,r.sourceTitle,r.id,r.caseNumber,...(r.headings||[]),...(r.caseNumbersDetected||[]),...(r.datesDetected||[]),...(r.responsibilityLines||[])].join(' '));
      decisionActivitySearchIndex.set(r,text);
    }
    return text.includes(q);
  });
};

/* Cached search indexes: these avoid rebuilding normalized search strings per keystroke. */
const decisionPointSearchIndex=new WeakMap();
const decisionActivitySearchIndex=new WeakMap();
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
  return text.includes(q);
};
filteredDecisionActivityRows=function(){
  const q=decisionSearchNormalizeFinal(decisionActivitySearchQuery),types=selectedActivityValues('type'),roles=selectedActivityValues('role'),parties=selectedActivityValues('party'),people=selectedActivityValues('person');
  return decisionActivityRows.filter(r=>{
    if(!decisionActivityIncludedByDate(r)||types.length&&!types.includes(r.type)||roles.length&&!roles.includes(r.status)||parties.length&&!parties.includes(r.party)||people.length&&![r.questioner,r.answeredBy,r.person].some(p=>people.includes(p)))return false;
    if(!q)return true;
    let text=decisionActivitySearchIndex.get(r);
    if(text===undefined){
      text=decisionSearchNormalizeFinal([r.type,r.status,r.title,r.summary,...(r.importantPoints||[]),r.person,r.questioner,r.answeredBy,r.party,r.organ,r.sourceSection,r.sourceTitle,r.id,r.caseNumber,...(r.headings||[]),...(r.caseNumbersDetected||[]),...(r.datesDetected||[]),...(r.responsibilityLines||[])].join(' '));
      decisionActivitySearchIndex.set(r,text);
    }
    return text.includes(q);
  });
};

/* Search performance overrides must remain at EOF so they win over legacy layers above. */
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
  return text.includes(q);
};
filteredDecisionActivityRows=function(){
  const q=decisionSearchNormalizeFinal(decisionActivitySearchQuery),types=selectedActivityValues('type'),roles=selectedActivityValues('role'),parties=selectedActivityValues('party'),people=selectedActivityValues('person');
  return decisionActivityRows.filter(r=>{
    if(!decisionActivityIncludedByDate(r)||types.length&&!types.includes(r.type)||roles.length&&!roles.includes(r.status)||parties.length&&!parties.includes(r.party)||people.length&&![r.questioner,r.answeredBy,r.person].some(p=>people.includes(p)))return false;
    if(!q)return true;
    let text=decisionActivitySearchIndex.get(r);
    if(text===undefined){
      text=decisionSearchNormalizeFinal([r.type,r.status,r.title,r.summary,...(r.importantPoints||[]),r.person,r.questioner,r.answeredBy,r.party,r.organ,r.sourceSection,r.sourceTitle,r.id,r.caseNumber,...(r.headings||[]),...(r.caseNumbersDetected||[]),...(r.datesDetected||[]),...(r.responsibilityLines||[])].join(' '));
      decisionActivitySearchIndex.set(r,text);
    }
    return text.includes(q);
  });
};

/* Effective final broad municipal search. Keep at EOF. */
function decisionSearchNormalizeFinal(value){
  /* Search is phrase-based, but protocol headings are inconsistently punctuated
     (for example "§ 51 Svar ..." versus "§ 51. Svar ..."). Treat punctuation
     as word separators so text copied from the table remains searchable. */
  return String(value??'').toLocaleLowerCase('sv-SE').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[§.,:;!?()[\]{}"'\u201c\u201d\u2018\u2019\-\u2013\u2014/\\]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function decisionSearchCollectFinal(value,out,seen){
  if(value===null||value===undefined)return;
  const type=typeof value;
  if(type==='string'||type==='number'||type==='boolean'){out.push(String(value));return;}
  if(type!=='object'||seen.has(value))return;
  seen.add(value);
  if(Array.isArray(value)){value.forEach(item=>decisionSearchCollectFinal(item,out,seen));return;}
  Object.keys(value).forEach(key=>{
    out.push(key);
    decisionSearchCollectFinal(value[key],out,seen);
  });
}
let decisionSearchLookupFinal=null;
function decisionSearchLookupMapsFinal(){
  if(decisionSearchLookupFinal)return decisionSearchLookupFinal;
  const voteByPoint=new Map(),positionByPoint=new Map(),memberByMeeting=new Map(),docTextByIndex=new Map();
  (decisionRows||[]).forEach(row=>{
    const key=`${row.id}|${row.point}`;
    if(!voteByPoint.has(key))voteByPoint.set(key,[]);
    voteByPoint.get(key).push(row);
  });
  (Array.isArray(decisionPositionRows)?decisionPositionRows:[]).forEach(row=>{
    const key=`${row.id}|${row.point}`;
    if(!positionByPoint.has(key))positionByPoint.set(key,[]);
    positionByPoint.get(key).push(row);
  });
  (Array.isArray(decisionMemberRows)?decisionMemberRows:[]).forEach(row=>{
    const key=`${row.id}|${row.date}|${row.body}`;
    if(!memberByMeeting.has(key))memberByMeeting.set(key,[]);
    memberByMeeting.get(key).push(row);
  });
  (decisionPack?.d||[]).forEach((doc,index)=>{
    const parts=[];
    decisionSearchCollectFinal(doc,parts,new WeakSet());
    docTextByIndex.set(index,decisionSearchNormalizeFinal(parts.join(' ')));
  });
  decisionSearchLookupFinal={voteByPoint,positionByPoint,memberByMeeting,docTextByIndex};
  return decisionSearchLookupFinal;
}
function decisionSearchTextFinal(row){
  if(!row)return '';
  if(row._searchTextFinal)return row._searchTextFinal;
  decisionHydrateTextFieldsFinal(row);
  const doc=(decisionPack?.d||[])[row.docIndex]||{};
  const samePointKey=`${row.id}|${row.point}`;
  const lookup=decisionSearchLookupMapsFinal();
  const samePointVotes=lookup.voteByPoint.get(samePointKey)||[];
  const samePointPositions=lookup.positionByPoint.get(samePointKey)||[];
  const sameMeetingMembers=lookup.memberByMeeting.get(`${row.id}|${row.date}|${row.body}`)||[];
  const material=[
    row,
    lookup.docTextByIndex.get(row.docIndex)||'',
    doc.pm?.[String(row.point)]||null,
    doc.p?.[String(row.point)]||null,
    doc.yp||null,
    doc.ve||null,
    doc.v||null,
    samePointVotes,
    samePointPositions,
    sameMeetingMembers,
    decisionPointResultLabel(row),
    decisionSemanticLevelLabel(row.decisionLevel),
    decisionSemanticOutcomeLabel(row.matterOutcome),
    row.diary?`Diarienummer ${row.diary}`:''
  ];
  const parts=[];
  decisionSearchCollectFinal(material,parts,new WeakSet());
  row._searchTextFinal=decisionSearchNormalizeFinal(parts.join(' '));
  return row._searchTextFinal;
}
decisionPointSearchMatches=function(row){
  const q=decisionSearchNormalizeFinal(decisionSearchQuery);
  if(!q)return true;
  return decisionSearchTextFinal(row).includes(q);
};

/* Effective final document-filter chips and closeable document tabs. Keep at EOF. */
function closeDecisionActivityTabFinal(index){
  const tab=decisionActivityTabs[index];
  if(!tab||tab.kind==='list')return;
  decisionActivityTabs.splice(index,1);
  decisionActivityActiveTab=Math.max(0,Math.min(decisionActivityActiveTab,decisionActivityTabs.length-1));
  renderDecisionView();
}
renderDecisionActivityTabs=function(){
  const box=$('decisionActivityTabs');
  if(!box)return;
  box.innerHTML=decisionActivityTabs.map((t,i)=>{
    const close=t.kind==='list'?'':`<span class="decision-tab-close" role="button" tabindex="0" aria-label="Stäng dokumentflik">×</span>`;
    return `<button class="decision-tab ${i===decisionActivityActiveTab?'active':''}" data-activity-i="${i}" type="button"><span class="decision-tab-label">${esc(t.title)}</span>${close}</button>`;
  }).join('');
  box.querySelectorAll('[data-activity-i]').forEach(btn=>{
    btn.onclick=e=>{
      if(e.target.closest('.decision-tab-close')){
        closeDecisionActivityTabFinal(Number(btn.dataset.activityI));
        return;
      }
      decisionActivityActiveTab=Number(btn.dataset.activityI);
      renderDecisionView();
      animateUiRegion(decisionActivityTabState()?.kind==='activity'?$('decisionActivityDetailPane'):$('decisionActivityListPane'));
    };
  });
  box.querySelectorAll('.decision-tab-close').forEach(el=>{
    el.onclick=e=>{
      e.stopPropagation();
      closeDecisionActivityTabFinal(Number(el.closest('[data-activity-i]').dataset.activityI));
    };
    el.onkeydown=e=>{
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();
        e.stopPropagation();
        closeDecisionActivityTabFinal(Number(el.closest('[data-activity-i]').dataset.activityI));
      }
    };
  });
};
openDecisionActivityDetail=function(id){
  const row=decisionActivityById(id);
  if(!row)return;
  const tabId=`activity:${row.id}`;
  const existing=decisionActivityTabs.findIndex(t=>t.kind==='activity'&&t.id===tabId);
  if(existing>=0){
    decisionActivityActiveTab=existing;
    renderDecisionView();
    return;
  }
  decisionActivityTabs.push({kind:'activity',id:tabId,activityId:row.id,title:row.title||'Styrdokument',page:0});
  decisionActivityActiveTab=decisionActivityTabs.length-1;
  renderDecisionView();
};
function decisionActivityFilterLabelFinal(key,col,value){
  const prefix={mainTable:'Huvudtabell',type:'Dokumenttyp',party:'Organ',politicalOwner:'Politisk nivå',officialOwner:'Tjänstemannanivå'}[key]||'Filter';
  const label=decisionActivityDisplay(col,value);
  return `${prefix}: ${label}`;
}
renderActivityFilterLocks=function(){
  const host=$('decisionActivityFilterLocks');
  if(!host)return;
  const filterIds=['decisionActivityType','decisionActivityParty','decisionActivityPoliticalOwner','decisionActivityOfficialOwner'];
  const chips=[];
  filterIds.forEach(id=>{
    const sel=$(id);
    if(!sel)return;
    const key=sel.dataset.activityKey,col=sel.dataset.col;
    selectedActivityValues(key).forEach(value=>chips.push({key,col,value,label:decisionActivityFilterLabelFinal(key,col,value)}));
  });
  host.hidden=!chips.length;
  host.innerHTML=chips.map(chip=>`<span class="raw-filter-chip"><span>${esc(chip.label)}</span><button type="button" data-key="${esc(chip.key)}" data-value="${esc(chip.value)}" title="Rensa filter" aria-label="Rensa filter">×</button></span>`).join('');
  if(chips.length)host.insertAdjacentHTML('beforeend','<button type="button" class="filter-clear-all" data-clear-all-filters title="Rensa alla filter" aria-label="Rensa alla filter">× Rensa alla</button>');
  host.querySelectorAll('.raw-filter-chip button').forEach(btn=>{
    btn.onclick=()=>{
      const key=btn.dataset.key;
      decisionActivityFilters[key]=selectedActivityValues(key).filter(v=>v!==btn.dataset.value);
      decisionActivityActiveTab=0;
      renderDecisionView();
    };
  });
  host.querySelector('[data-clear-all-filters]')?.addEventListener('click',()=>{
    filterIds.forEach(id=>{const key=$(id)?.dataset.activityKey;if(key)decisionActivityFilters[key]=[];});
    decisionActivityActiveTab=0;
    renderDecisionView();
  });
};

/* Effective final enriched municipal document table. Keep at EOF. */
function decisionActivityDateValue(row){
  return String(row?.dateSort||'');
}
function decisionActivityAvailableDates(){
  return [...new Set(decisionActivityRows.map(decisionActivityDateValue).filter(Boolean))].sort();
}
function decisionActivityDateMatches(row){
  const value=decisionActivityDateValue(row);
  return !decisionActivityDateRanges.length||!!value&&decisionActivityDateRanges.some(r=>value>=r.from&&value<=r.to);
}
function syncDecisionActivityDateControls(){
  const dates=decisionActivityAvailableDates(),min=dates[0]||'',max=dates[dates.length-1]||'',toggle=$('decisionActivityDateToggle'),rangeLabel=decisionActivityDateRanges.length?decisionActivityDateRanges.map(decisionDateRangeLabelFor).join(', '):'Alla datum';
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
  if(!decisionActivityDateRanges.length){lock.innerHTML='';return;}
  lock.innerHTML=decisionActivityDateRanges.map((r,i)=>`<span class="raw-filter-chip decision-date-chip"><span><span>${esc(decisionDateDisplay(r.from))}</span><span>${esc(decisionDateDisplay(r.to))}</span></span><button type="button" data-index="${i}" title="Rensa låst filter" aria-label="Rensa låst filter">×</button></span>`).join('');
  lock.querySelectorAll('button').forEach(btn=>btn.onclick=e=>{
    e.stopPropagation();
    decisionActivityDateRanges.splice(Number(btn.dataset.index),1);
    resetDecisionPage();
    closeDecisionActivityDatePicker();
    renderDecisionView();
  });
}
function renderDecisionActivityCalendar(){
  const host=$('decisionActivityDateCalendar');
  if(!host)return;
  const dates=decisionActivityAvailableDates(),min=dates[0]||'',max=dates[dates.length-1]||'';
  if(!decisionActivityCalendarMonth)decisionActivityCalendarMonth=decisionMonthKey(decisionActivityDateRanges[0]?.from||min||max);
  const [year,month]=decisionActivityCalendarMonth.split('-').map(Number);
  if(!year||!month){host.innerHTML='<div class="date-calendar-hint">Inga datum tillgängliga.</div>';return;}
  const first=new Date(year,month-1,1),days=new Date(year,month,0).getDate(),start=(first.getDay()+6)%7,prev=decisionAddMonths(decisionActivityCalendarMonth,-1),next=decisionAddMonths(decisionActivityCalendarMonth,1),minMonth=decisionMonthKey(min),maxMonth=decisionMonthKey(max),weekdays=['M','T','O','T','F','L','S'];
  let cells=weekdays.map(d=>`<div class="date-calendar-weekday">${d}</div>`).join('');
  for(let i=0;i<start;i++)cells+='<span></span>';
  for(let day=1;day<=days;day++){
    const iso=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const disabled=(min&&iso<min)||(max&&iso>max),selected=decisionActivityDateRanges.some(r=>iso===r.from||iso===r.to),inRange=decisionActivityDateRanges.some(r=>iso>r.from&&iso<r.to);
    cells+=`<button type="button" class="date-calendar-day ${selected?'selected':''} ${inRange?'in-range':''}" data-date="${iso}" ${disabled?'disabled':''}>${day}</button>`;
  }
  host.hidden=!decisionActivityDatePickerOpen;
  host.innerHTML=`<div class="date-calendar-head"><button type="button" class="secondary date-calendar-nav" data-nav="-1" ${minMonth&&prev<minMonth?'disabled':''}>‹</button><div class="date-calendar-title">${esc(decisionMonthLabel(decisionActivityCalendarMonth))}</div><button type="button" class="secondary date-calendar-nav" data-nav="1" ${maxMonth&&next>maxMonth?'disabled':''}>›</button></div><div class="date-calendar-grid">${cells}</div><div class="date-calendar-footer"><div class="date-calendar-hint">${decisionActivityDateDraftFrom?'Välj slutdatum.':'Välj start- och slutdatum.'}</div><button type="button" class="secondary date-calendar-reset" data-reset-activity-date>Rensa datum</button></div>`;
  host.querySelectorAll('[data-nav]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();decisionActivityCalendarMonth=decisionAddMonths(decisionActivityCalendarMonth,Number(btn.dataset.nav));renderDecisionActivityCalendar();});
  host.querySelector('[data-reset-activity-date]')?.addEventListener('click',e=>{e.stopPropagation();resetDecisionActivityDateRange();});
  host.querySelectorAll('[data-date]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();selectDecisionActivityCalendarDate(btn.dataset.date);});
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
  resetDecisionPage();
  closeDecisionActivityDatePicker();
  renderDecisionView();
}
function selectDecisionActivityCalendarDate(date){
  if(!decisionActivityDateDraftFrom){
    decisionActivityDateDraftFrom=date;
    renderDecisionActivityCalendar();
    return;
  }
  const range=normalizeDecisionDateRanges([[decisionActivityDateDraftFrom,date]])[0];
  if(range&&!decisionActivityDateRanges.some(r=>r.from===range.from&&r.to===range.to))decisionActivityDateRanges=normalizeDecisionDateRanges([...decisionActivityDateRanges,range]);
  decisionActivityDateDraftFrom='';
  resetDecisionPage();
  closeDecisionActivityDatePicker();
  renderDecisionView();
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
const ensureDecisionDataBeforeMunicipalDocumentsEnrichedFinal=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeMunicipalDocumentsEnrichedFinal();
  if(!decisionReady)return;
  const documentRows=municipalDocumentActivityRowsEnrichedFinal();
  if(documentRows.length)decisionActivityRows=documentRows;
};
decisionActivityIncludedByDate=function(row){
  return decisionActivityDateMatches(row);
};
decisionActivityDateHtml=function(row){
  const label=row.date||row.dateSort||'';
  const basis=row.dateBasis==='detected_in_title_year'?'År i titel':row.dateBasis==='detected_in_document_text'?'Datum i dokument':'';
  return label?`${esc(label)}${basis?`<span class="decision-activity-date-note">${esc(basis)}</span>`:''}`:'<span class="muted">Odaterat</span>';
};
decisionActivityDisplay=function(col,value){
  if(col==='type')return decisionActivityTypeLabel(value);
  if(col==='party')return municipalText(value)||'Okänt område';
  if(col==='politicalOwner'||col==='officialOwner')return municipalText(value)||'Ej angiven';
  return municipalText(value||'Alla');
};
buildDecisionActivityFilters=function(){
  syncDecisionActivityDateControls();
  const rows=decisionActivityRows,types=uniqueDecisionValues(rows.map(r=>r.type).filter(Boolean)),parties=uniqueDecisionValues(rows.map(r=>r.party).filter(Boolean)),politicalOwners=uniqueDecisionValues(rows.map(r=>r.politicalOwner).filter(Boolean)),officialOwners=uniqueDecisionValues(rows.map(r=>r.officialOwner).filter(Boolean));
  setActivitySelectOptions('decisionActivityType','type',types,'type');
  setActivitySelectOptions('decisionActivityParty','party',parties,'party');
  setActivitySelectOptions('decisionActivityPoliticalOwner','politicalOwner',politicalOwners,'politicalOwner');
  setActivitySelectOptions('decisionActivityOfficialOwner','officialOwner',officialOwners,'officialOwner');
  renderActivityFilterLocks();
  if($('decisionActivitySearch'))$('decisionActivitySearch').value=decisionActivitySearchQuery;
};
filteredDecisionActivityRows=function(){
  const q=decisionSearchNormalizeFinal(decisionActivitySearchQuery),types=selectedActivityValues('type'),parties=selectedActivityValues('party'),politicalOwners=selectedActivityValues('politicalOwner'),officialOwners=selectedActivityValues('officialOwner');
  return decisionActivityRows.filter(r=>decisionActivityIncludedByDate(r)&&(!types.length||types.includes(r.type))&&(!parties.length||parties.includes(r.party))&&(!politicalOwners.length||politicalOwners.includes(r.politicalOwner))&&(!officialOwners.length||officialOwners.includes(r.officialOwner))&&(!q||decisionSearchNormalizeFinal([r.type,r.title,r.summary,...(r.importantPoints||[]),r.politicalOwner,r.officialOwner,r.answeredBy,r.party,r.organ,r.sourceSection,r.sourceTitle,r.id,r.caseNumber,...(r.headings||[]),...(r.caseNumbersDetected||[]),...(r.datesDetected||[]),...(r.responsibilityLines||[])].join(' ')).includes(q)));
};
decisionActivitySortValue=function(row,col){
  if(col==='type')return decisionActivityTypeLabel(row.type);
  if(col==='summary')return row.summary||'';
  if(col==='points')return (row.importantPoints||[]).join(' ');
  if(col==='party')return row.party||'';
  if(col==='title')return row.title||'';
  return row.dateSort||row.date||'';
};
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
function renderDecisionDocumentDetailFinal(row){
  $('decisionActivityListPane').hidden=true;
  $('decisionActivityDetailPane').hidden=false;
  $('decisionActivityDetailTitle').textContent=row.title||'Styrdokument';
  const source=decisionActivitySourceUrl(row);
  $('decisionActivityDetailMeta').innerHTML=`<span>${esc([row.type,row.party].filter(Boolean).join(' · '))}</span>${source?` <a class="decision-official-link" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna källan</a>`:''}`;
  $('decisionActivityDetailOverview').innerHTML=[
    ['Dokumenttyp',row.type||'Dokument'],
    ['Datum',row.date||row.dateSort||'Odaterat'],
    ['Sidor',row.pageCount||'—'],
    ['Text',row.textStats?.has_extracted_text===false?'Saknas':row.textStats?.word_count?`${fmtInt(row.textStats.word_count)} ord`:'—']
  ].map(([k,v])=>`<div class="card"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('');
  const sourceLinks=[source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna hos Örebro kommun</a>`:'',row.localPath?`<span>${esc(row.localPath)}</span>`:''].filter(Boolean).join('<br>');
  $('decisionActivityDetailBody').innerHTML=[
    `<article class="decision-point-card document-detail-summary"><h3>Sammanfattning</h3><p>${esc(row.summary||'Sammanfattning saknas.')}</p></article>`,
    `<article class="decision-point-card"><h3>Viktigaste punkter</h3>${decisionDocumentDetailListFinal(row.importantPoints||[])}</article>`,
    `<article class="decision-point-card"><h3>Dokumentinformation</h3><dl class="document-meta-list"><dt>Område/organ</dt><dd>${esc(row.party||'—')}</dd><dt>Politisk nivå</dt><dd>${esc(row.politicalOwner||'—')}</dd><dt>Tjänstemannanivå</dt><dd>${esc(row.officialOwner||'—')}</dd><dt>Diarienummer</dt><dd>${esc(row.caseNumber||row.caseNumbersDetected?.[0]||'—')}</dd><dt>Källa</dt><dd>${sourceLinks||'—'}</dd></dl></article>`,
    row.headings?.length?`<article class="decision-point-card"><h3>Identifierade rubriker</h3>${decisionDocumentDetailListFinal(row.headings.slice(0,12))}</article>`:'',
    (row.caseNumbersDetected?.length||row.datesDetected?.length||row.responsibilityLines?.length)?`<article class="decision-point-card"><h3>Extraherade metadata</h3><dl class="document-meta-list"><dt>Diarienummer/ärenden</dt><dd>${esc((row.caseNumbersDetected||[]).slice(0,10).join(', ')||'—')}</dd><dt>Datum i dokument</dt><dd>${esc((row.datesDetected||[]).slice(0,10).join(', ')||'—')}</dd><dt>Ansvar/beslut</dt><dd>${esc((row.responsibilityLines||[]).slice(0,6).join(' | ')||'—')}</dd></dl></article>`:'',
    row.summaryLimitations?.length?`<article class="decision-point-card"><h3>Begränsningar</h3>${decisionDocumentDetailListFinal(row.summaryLimitations)}</article>`:''
  ].filter(Boolean).join('');
}
renderDecisionActivityDetail=renderDecisionDocumentDetailFinal;
renderDecisionActivityView=function(activeRow=null){
  const pane=$('decisionActivityPane');
  if(!pane)return;
  if(activeRow){renderDecisionDocumentDetailFinal(activeRow);return;}
  $('decisionActivityListPane').hidden=false;
  $('decisionActivityDetailPane').hidden=true;
  buildDecisionActivityFilters();
  const filteredRows=filteredDecisionActivityRows(),rows=sortedDecisionActivityRows(filteredRows);
  const types=new Set(filteredRows.map(r=>r.type).filter(Boolean));
  const dated=filteredRows.filter(r=>r.dateSort).length;
  const withSummary=filteredRows.filter(r=>r.summary).length;
  $('decisionActivityOverview').innerHTML=[
    ['Dokument',fmtInt(filteredRows.length)],
    ['Dokumenttyper',fmtInt(types.size)],
    ['Daterade',fmtInt(dated)],
    ['Med sammanfattning',fmtInt(withSummary)]
  ].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
  $('decisionActivityStatus').textContent=rows.length?`Visar ${fmtInt(rows.length)} styrdokument.`:'Inga styrdokument matchar de aktiva filtren.';
  $('decisionActivityHead').innerHTML=`<tr>${decisionActivitySortableHeader('date','Datum')}${decisionActivitySortableHeader('type','Dokumenttyp')}${decisionActivitySortableHeader('title','Titel')}${decisionActivitySortableHeader('summary','Sammanfattning')}${decisionActivitySortableHeader('points','Viktigt')}${decisionActivitySortableHeader('party','Område/organ')}<th>Källa</th></tr>`;
  $('decisionActivityHead').querySelectorAll('[data-activity-sort]').forEach(th=>{th.onclick=()=>setDecisionActivitySort(th.dataset.activitySort);});
  $('decisionActivityBody').innerHTML=rows.map(r=>{const source=decisionActivitySourceUrl(r);return `<tr class="decision-selectable-row" data-activity-id="${esc(r.id)}"><td>${decisionActivityDateHtml(r)}</td><td><strong class="decision-activity-type">${esc(decisionActivityTypeLabel(r.type))}</strong></td><td><strong>${esc(r.title)}</strong></td><td>${decisionDocumentSummaryCellFinal(r)}</td><td>${decisionDocumentPointsPreviewFinal(r)}</td><td>${esc(r.party||'')}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'—'}</td></tr>`;}).join('');
  $('decisionActivityBody').querySelectorAll('[data-activity-id]').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionActivityDetail(row.dataset.activityId);});
};

/* Final participant-filter overrides: this file intentionally contains legacy
   render overrides, so keep canonical identity handling at EOF. */
const ensureDecisionDataBeforeCanonicalPeopleFinal=ensureDecisionData;
ensureDecisionData=function(){
  decisionBuildPersonIndex();
  ensureDecisionDataBeforeCanonicalPeopleFinal();
};
filteredDecisionRows=function(){
  const parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote');
  return decisionRows.filter(row=>decisionDateMatches(row.date)&&(!parties.length||parties.includes(municipalNorm(row.party)))&&(!members.length||members.includes(decisionMemberKey(row.name,row.party,row.body)))&&(!votes.length||votes.includes(String(row.vote))));
};
filteredDecisionPositionRows=function(){
  const parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote');
  return decisionPositionRows.filter(row=>decisionDateMatches(row.date)&&(!parties.length||parties.includes(municipalNorm(row.party)))&&(!members.length||members.includes(decisionMemberKey(row.name,row.party,row.body)))&&(!votes.length||votes.includes(String(row.vote))));
};
const buildDecisionFiltersBeforeCanonicalPeopleFinal=buildDecisionFilters;
buildDecisionFilters=function(){
  buildDecisionFiltersBeforeCanonicalPeopleFinal();
  if(!decisionReady)return;
  const parties=selectedDecisionValues('decisionParty'),participantRows=[...decisionRows,...decisionPositionRows].filter(row=>decisionDateMatches(row.date)&&(!parties.length||parties.includes(municipalNorm(row.party)))),attendanceRows=decisionMemberRows.filter(row=>decisionDateMatches(row.date)&&(!parties.length||parties.includes(municipalNorm(row.party)))),members=uniqueDecisionValues([...participantRows.map(row=>decisionMemberKey(row.name,row.party,row.body)),...attendanceRows.map(row=>row.memberKey)].filter(Boolean));
  setDecisionSelectOptions('decisionMember',members,decisionFilterLocks.decisionMember,'member');
  renderDecisionFilterLocks();
};

/* Keep the list status line on the same counting model as the overview cards. */
/* Canonical detail pipeline: every filtered occurrence opens through this
   resolver, including records whose formal decision heading was not extracted. */
const ensureDecisionDataBeforeDetailPipeline=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeDetailPipeline();
  if(!decisionReady||decisionPack?._detailPipelineReady)return;
  const docs=decisionPack.d||[];
  decisionAllPointRows.forEach(row=>{
    const meta=docs[row.docIndex]?.pm?.[String(row.point)]||{};
    row.extractionStatus=String(meta.extraction_status||'formal_decision');
    row.decisionStage=String(meta.decision_stage||'');
    row.decisionDisposition=String(meta.decision_disposition||'');
    row.matterTypeState=String(meta.matter_type_state||'');
  });
  decisionPack._detailPipelineReady=true;
};

function decisionDetailPayload(tabOrId,proposalKey=''){
  ensureDecisionData();
  const tab=typeof tabOrId==='object'?tabOrId:{id:String(tabOrId||''),proposalKey:String(proposalKey||'')};
  const proposal=decisionProposalRowByKeyAnyFinal(tab.proposalKey)||decisionAllPointRows.find(row=>String(row.id)===String(tab.id)&&String(row.point)===String(tab.point||tab.sourcePoint||''))||null;
  const id=String(proposal?.id||tab.id||'');
  const decision=decisionDecisionRows.find(row=>String(row.id)===id)||null;
  if(!id||(!proposal&&!decision))return null;
  return {id,tab,proposal:decisionHydrateTextFieldsFinal(proposal),decision,rows:decisionDetailRows({...tab,id})};
}

openDecisionDetail=function(id,proposalKey=''){
  const payload=decisionDetailPayload(id,proposalKey);
  if(!payload)return;
  const proposalData=payload.proposal?decisionProposalTabData(payload.proposal):{};
  const key=proposalData.proposalKey||String(proposalKey||'');
  const existing=decisionTabs.findIndex(tab=>tab.kind==='decision'&&tab.id===payload.id&&String(tab.proposalKey||'')===key);
  if(existing>=0){
    Object.assign(decisionTabs[existing],proposalData,{title:payload.proposal?decisionTabTitleFor(payload.proposal):decisionTabs[existing].title,pendingCanonical:false});
    decisionActiveTab=existing;renderDecisionView();return;
  }
  decisionTabs.push({kind:'decision',id:payload.id,...proposalData,title:payload.proposal?decisionTabTitleFor(payload.proposal):decisionTabTitleFor(payload.decision||{title:'Ärende'}),page:0});
  decisionActiveTab=decisionTabs.length-1;
  renderDecisionView();
};

const municipalResultLabelBeforeDetailPipeline=municipalResultLabel;
municipalResultLabel=function(value){return municipalText(value)==='decision_not_extracted'?'Beslut ej extraherat':municipalResultLabelBeforeDetailPipeline(value);};

const renderDecisionDetailViewBeforeDetailPipeline=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeDetailPipeline(tab);
  const payload=decisionDetailPayload(tab),groups=$('decisionDetailGroups');
  if(!payload||!groups||payload.proposal?.extractionStatus!=='decision_not_extracted'||groups.querySelector('.decision-extraction-notice'))return;
  groups.insertAdjacentHTML('afterbegin','<article class="decision-point-card decision-extraction-notice"><h3>Beslut</h3><p>Ingen formell beslutsrubrik kunde extraheras ur källprotokollet. Ärendet visas ändå med sin källa och övriga protokolluppgifter.</p></article>');
};

/* Final canonical vote totals.
   Unfiltered views use official protocol totals from pm/ve. Filtered views may
   use named rows because they intentionally show a subset. */
function decisionInferredVoteNormalizeFinal(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
}
function decisionInferredVoteCleanFinal(value){
  return String(value||'').replace(/\s+/g,' ').replace(/\s+-\s*/g,'-').trim();
}
function decisionInferredVoteMeaningFinal(value){
  const text=decisionInferredVoteCleanFinal(value);
  return /^(?:bifall|avslag)\b/i.test(text)?text:`bifall till ${text}`;
}
function decisionInferredVotePeopleFinal(value){
  const people=[];
  const text=decisionInferredVoteCleanFinal(value);
  const re=/([^,;.]+?)\s*\(([A-Za-z\u00c5\u00c4\u00d6\u00e5\u00e4\u00f6]+)\)/g;
  let match;
  while((match=re.exec(text))){
    const name=decisionInferredVoteCleanFinal(match[1]).replace(/^och\s+/i,'');
    const party=decisionInferredVoteCleanFinal(match[2]);
    if(name&&party)people.push({name,party});
  }
  return people;
}
function decisionInferredVotePointFinal(doc,textBefore){
  const matches=[...String(textBefore||'').matchAll(/beslutspunkt\s+(\d+)/gi)];
  const pointNumber=matches.length?matches[matches.length-1][1]:'';
  if(pointNumber&&doc?.p?.[`${decisionDecisionPointNumberFinal({point:Object.keys(doc.p||{})[0]||''})||String(Object.keys(doc.p||{})[0]||'').split('.')[0]}.${pointNumber}`]){
    const base=String(Object.keys(doc.p||{})[0]||'').split('.')[0];
    return `${base}.${pointNumber}`;
  }
  if(pointNumber){
    const direct=Object.keys(doc?.p||{}).find(point=>String(point).endsWith(`.${pointNumber}`)||String(point)===pointNumber);
    if(direct)return direct;
  }
  const points=Object.keys(doc?.p||{});
  return points.length===1?points[0]:'';
}
function decisionInferredVoteEventsFromTextFinal(doc){
  const text=String(doc?.pd||'');
  if(!text||!decisionInferredVoteNormalizeFinal(text).includes('votering begars och verkstalls'))return [];
  const markerRe=/votering\s+beg(?:\u00e4|a)r(?:s|des)?\s+och\s+verkst(?:\u00e4|a)ll(?:s|des)?\s*\.?/gi;
  const markers=[...text.matchAll(markerRe)];
  const events=[];
  markers.forEach((marker,index)=>{
    const section=text.slice(marker.index,(markers[index+1]?.index)??text.length);
    const before=text.slice(Math.max(0,marker.index-2400),marker.index);
    const point=decisionInferredVotePointFinal(doc,before);
    if(!point||doc?.v?.[point])return;
    const meaning=section.match(/Ja-r(?:\u00f6|o)st\s+inneb(?:\u00e4|a)r\s+(.+?)\.\s*Nej-?\s*r(?:\u00f6|o)st\s+inneb(?:\u00e4|a)r\s+(.+?)\.\s*(?=Ja-r(?:\u00f6|o)ster|Nej-r(?:\u00f6|o)ster|Ordf(?:\u00f6|o)rande|resultatet)/is);
    const names=section.match(/Ja-r(?:\u00f6|o)ster\s+l(?:\u00e4|a)mnas\s+av\s+(.+?)\.\s*Nej-r(?:\u00f6|o)ster\s+l(?:\u00e4|a)mnas\s+av\s+(.+?)(?:\.|\nOrdf(?:\u00f6|o)rande)/is);
    const result=section.match(/resultatet\s+(\d+)\s+ja-r(?:\u00f6|o)ster\s+och\s+(\d+)\s+nej-r(?:\u00f6|o)ster/i);
    if(!meaning||!names||!result)return;
    const yesPeople=decisionInferredVotePeopleFinal(names[1]);
    const noPeople=decisionInferredVotePeopleFinal(names[2]);
    const statedYes=Number(result[1])||0,statedNo=Number(result[2])||0;
    if(!statedYes||!statedNo||yesPeople.length!==statedYes||noPeople.length!==statedNo)return;
    events.push({
      point,
      eventId:`vote_${String(doc.i||'doc').replace(/[^\w]+/g,'_')}_${String(point).replace(/[^\w]+/g,'_')}_inferred_${events.length+1}`,
      yesMeaning:decisionInferredVoteMeaningFinal(meaning[1]),
      noMeaning:decisionInferredVoteMeaningFinal(meaning[2]),
      statedYes,
      statedNo,
      yesPeople,
      noPeople
    });
  });
  return events;
}
function decisionApplyInferredParagraphVotesFinal(){
  if(!decisionReady||!decisionPack?.d||decisionPack._inferredParagraphVotesReady)return;
  const docs=decisionPack.d||[],existingRows=new Set(decisionRows.map(row=>String(row.intressentId||'')));
  docs.forEach((doc,docIndex)=>{
    const inferred=decisionInferredVoteEventsFromTextFinal(doc);
    if(!inferred.length)return;
    doc.v=doc.v||{};
    doc.ve=doc.ve||{};
    inferred.forEach(event=>{
      if(doc.v[event.point]||doc.ve[event.eventId])return;
      doc.v[event.point]=event.eventId;
      doc.ve[event.eventId]={
        points:[event.point],
        source_kind:'formal_vote',
        vote_type:'roll_call',
        yes_meaning:event.yesMeaning,
        no_meaning:event.noMeaning,
        stated_yes:event.statedYes,
        stated_no:event.statedNo,
        stated_abstain:0,
        stated_absent:0,
        vote_status:'held_roll_call',
        tally_status:'stated',
        inferred_from:'paragraph_vote_marker'
      };
      const addPerson=(person,vote,order)=>{
        const intressentId=`${event.eventId}:${order}`;
        if(existingRows.has(intressentId))return;
        existingRows.add(intressentId);
        decisionRows.push({
          docIndex,
          id:String(doc.i||`d${docIndex}`),
          date:String(doc.dt||''),
          title:String(doc.t||''),
          point:String(event.point),
          description:decisionPointLabel(doc,event.point),
          proposalType:decisionProposalTypeForPoint(doc,event.point),
          name:person.name,
          party:person.party,
          vote,
          intressentId,
          url:String(doc.u||doc.lp||''),
          body:String(doc.b||''),
          documentTitle:String(doc.doc||''),
          attendanceKey:decisionAttendanceKey(doc.dt,doc.b,doc.doc),
          order:decisionRows.length
        });
      };
      event.yesPeople.forEach((person,index)=>addPerson(person,'Ja',`yes_${index+1}`));
      event.noPeople.forEach((person,index)=>addPerson(person,'Nej',`no_${index+1}`));
    });
  });
  decisionAllPointRows.forEach(row=>{
    const doc=docs[row.docIndex]||{},point=String(row.point||''),voteId=String(doc.v?.[point]||'');
    if(!voteId)return;
    const voteIds=decisionSplitVoteIds(voteId);
    row.voteId=voteId;
    row.voteIds=voteIds;
    row.voteEvents=Object.fromEntries(voteIds.map(eventId=>[eventId,doc.ve?.[eventId]||{}]));
  });
  decisionPack._inferredParagraphVotesReady=true;
}
function decisionCanonicalVoteTotalsForRowFinal(row){
  const doc=(decisionPack?.d||[])[row?.docIndex]||{};
  const point=String(row?.point||'');
  const meta=doc.pm?.[point]||{};
  const voteIds=(row?.voteIds||decisionSplitVoteIds(String(doc.v?.[point]||''))).filter(Boolean);
  const events=voteIds.map(id=>doc.ve?.[id]).filter(Boolean);
  const sum=(field,metaField)=>{
    const direct=Number(meta?.[metaField]);
    if(Number.isFinite(direct)&&direct>0)return direct;
    return events.reduce((total,event)=>total+(Number(event?.[field])||0),0);
  };
  return {
    yes:sum('stated_yes','stated_yes'),
    no:sum('stated_no','stated_no'),
    abstain:sum('stated_abstain','stated_abstain'),
    absent:sum('stated_absent','stated_absent'),
    rounds:events.length||voteIds.length||0
  };
}

function decisionApplyCanonicalVoteTotalsFinal(row){
  if(!row||row.isMeeting)return row;
  const totals=decisionCanonicalVoteTotalsForRowFinal(row);
  if(!(totals.yes||totals.no||totals.abstain||totals.absent))return row;
  row.statedYes=totals.yes;
  row.statedNo=totals.no;
  row.statedAbstain=totals.abstain;
  row.statedAbsent=totals.absent;
  row.fullYes=totals.yes;
  row.fullNo=totals.no;
  row.fullAbstain=totals.abstain;
  row.fullAbsent=totals.absent;
  row.fullVoteCount=totals.yes+totals.no+totals.abstain+totals.absent;
  row.fullVoteRoundCount=Math.max(Number(row.fullVoteRoundCount)||0,totals.rounds);
  if(!decisionVotesAreFiltered()){
    row.yes=row.fullYes;
    row.no=row.fullNo;
    row.abstain=row.fullAbstain;
    row.absent=row.fullAbsent;
    row.voteCount=row.fullVoteCount;
    row.voteRoundCount=row.fullVoteRoundCount;
  }
  return row;
}

const ensureDecisionDataBeforeCanonicalVoteTotalsFinal=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeCanonicalVoteTotalsFinal();
  if(!decisionReady||decisionPack?._canonicalVoteTotalsReadyFinal)return;
  decisionApplyInferredParagraphVotesFinal();
  decisionAllPointRows.forEach(decisionApplyCanonicalVoteTotalsFinal);
  decisionPack._canonicalVoteTotalsReadyFinal=true;
};

const filteredDecisionPointRowsBeforeCanonicalVoteTotalsFinal=filteredDecisionPointRows;
filteredDecisionPointRows=function(){
  const rows=filteredDecisionPointRowsBeforeCanonicalVoteTotalsFinal();
  return decisionVotesAreFiltered()?rows:rows.map(row=>decisionApplyCanonicalVoteTotalsFinal({...row}));
};

const decisionDetailPayloadBeforeCanonicalVoteTotalsFinal=decisionDetailPayload;
decisionDetailPayload=function(tabOrId,proposalKey=''){
  const payload=decisionDetailPayloadBeforeCanonicalVoteTotalsFinal(tabOrId,proposalKey);
  if(payload?.proposal&&!decisionVotesAreFiltered())payload.proposal=decisionApplyCanonicalVoteTotalsFinal({...payload.proposal});
  return payload;
};

/* Vote meaning text in item/detail vote cards. Keep after canonical totals so
   every view reads the same vote event metadata. */
function decisionVoteMeaningBlockHtmlFinal(meta){
  const yes=String(meta?.yes_meaning||'').replace(/\s+/g,' ').trim();
  const no=String(meta?.no_meaning||'').replace(/\s+/g,' ').trim();
  if(!yes&&!no)return '';
  return `<div class="decision-vote-meaning-detail" aria-label="Voteringens inneb\u00f6rd">${yes?`<p><b>Ja:</b> ${esc(yes)}</p>`:''}${no?`<p><b>Nej:</b> ${esc(no)}</p>`:''}</div>`;
}

decisionPointPartyHtml=function(group,index,total){
  const filtered=decisionVotesAreFiltered(),isPosition=group.meta?.source_kind==='yrkande',voteTypes=['Ja','Nej','Avst\u00e5r','Fr\u00e5nvarande'];
  const voteHtml=voteTypes.map(vote=>{
    const voteRows=group.rows.filter(r=>r.vote===vote),count=decisionVoteTypeCount(group.meta,vote,voteRows.length);
    if(!count)return '';
    const parties=new Map();
    voteRows.forEach(r=>{const key=r.party||'\u2014';if(!parties.has(key))parties.set(key,[]);parties.get(key).push(r);});
    const partyHtml=[...parties.entries()].sort((a,b)=>decisionDisplay('party',a[0]).localeCompare(decisionDisplay('party',b[0]),'sv',{numeric:true,sensitivity:'base'})).map(([party,rows])=>`<section class="decision-point-party"><h5>${esc(decisionDisplay('party',party))} \u00b7 ${fmtInt(rows.length)}</h5><ul>${decisionVoteNames(rows)}</ul></section>`).join('');
    const missing=count-voteRows.length,missingHtml=!filtered&&missing>0?`<p class="decision-vote-missing">Protokollet anger ${fmtInt(count)} ${esc(vote.toLowerCase())}, men ${fmtInt(voteRows.length)} \u00e4r namngivna.</p>`:'';
    return `<section class="decision-vote-type"><h4>${esc(vote)} <strong>${fmtInt(count)}</strong></h4>${partyHtml?`<div class="decision-point-party-list">${partyHtml}</div>`:''}${missingHtml}</section>`;
  }).join('');
  const conflict=!filtered&&group.meta?.count_conflict?'<div class="decision-vote-conflict">K\u00e4llkonflikt: protokollets tryckta totalsiffra avviker fr\u00e5n den uttryckliga namnlistan. Visade personer och partisummor r\u00e4knas fr\u00e5n namnlistan.</div>':'';
  const heading=isPosition?'Namngivna yrkanden':total>1?`Votering ${fmtInt(index+1)}`:'Votering';
  const meaning=isPosition?'':decisionVoteMeaningBlockHtmlFinal(group.meta);
  return `<article class="decision-point-card"><h3>${heading}</h3>${meaning}${conflict}${voteHtml}</article>`;
};

const renderDecisionMasterViewBeforeUnifiedVisibleTotals=renderDecisionMasterView;
renderDecisionMasterView=function(){
  renderDecisionMasterViewBeforeUnifiedVisibleTotals();
  const rows=filteredDecisionPointRows();
  if(!rows.length)return;
  const listTab=decisionListTab(),page=pageSlice(sortedDecisionPointRows(rows),listTab.page||0,decisionPageSize()),summary=decisionVisibleSummary(rows);
  $('decisionStatus').textContent=`Visar ${fmtInt(page.start+1)}-${fmtInt(page.start+page.rows.length)} av ${fmtInt(summary.tableRows)} tabellrader: ${fmtInt(summary.decisionRows)} beslutspunkter och ${fmtInt(summary.meetingRows)} sammanträden. ${fmtInt(summary.items)} poster: ${fmtInt(summary.matters)} ärenden och ${fmtInt(summary.meetings)} sammanträden.`;
};

/* Final item-view renderer.
   This is intentionally last because this file contains legacy renderer
   overrides. The detail panel must consume the same canonical vote event model
   as the main table; it must not recalculate official totals from visible
   person rows. */
function decisionDetailCanonicalSummaryCardsFinal(rows=[],proposal=null){
  const filtered=decisionVotesAreFiltered();
  const rowVotes=rows.reduce((acc,row)=>{acc[row.vote]=(acc[row.vote]||0)+1;return acc;},{});
  const events=Object.keys(proposal?.voteEvents||{}).length||new Set(rows.map(row=>decisionVoteEventBase(row.intressentId)).filter(Boolean)).size;
  const yes=filtered?(rowVotes.Ja||0):(Number(proposal?.yes)||Number(proposal?.statedYes)||0);
  const no=filtered?(rowVotes.Nej||0):(Number(proposal?.no)||Number(proposal?.statedNo)||0);
  const abstain=filtered?(rowVotes['Avst\u00e5r']||0):(Number(proposal?.abstain)||Number(proposal?.statedAbstain)||0);
  const absent=filtered?(rowVotes['Fr\u00e5nvarande']||0):(Number(proposal?.absent)||Number(proposal?.statedAbsent)||0);
  const total=filtered?rows.length:(Number(proposal?.voteCount)||yes+no+abstain+absent);
  const items=[
    ['Resultat',decisionPointResultLabel(proposal),'decision-result-card'],
    ['Voteringar',events?fmtInt(events):'Ingen formell votering',''],
    ['Röster',fmtInt(total),''],
    ['Ja',fmtInt(yes),''],
    ['Nej',fmtInt(no),''],
    ['Avstår',fmtInt(abstain),''],
    ['Frånvarande',fmtInt(absent),''],
    ['Namngivna röster',fmtInt(rows.length),'']
  ];
  return items.map(([key,value,cls])=>`<div class="card ${esc(cls||'')}"><span>${esc(key)}</span><b>${esc(String(value))}</b></div>`).join('');
}

function decisionDetailCanonicalStatusFinal(rows=[],proposal=null){
  const filtered=decisionVotesAreFiltered();
  if(filtered)return 'Visar en filtrerad delmängd. Officiella totalsiffror i korten ovan gäller den filtrerade vyn när person-, parti- eller röstfilter är aktivt.';
  const verification=decisionVoteVerification(rows,proposal);
  if(verification.conflicts.length){
    const reconciled=verification.conflicts.filter(event=>event.count_reconciled_from_named_list).length;
    if(reconciled===verification.conflicts.length)return 'Källkonflikt finns i en eller flera voteringar. Protokollets tryckta totalsiffra motsäger den uttryckliga namnlistan; namnlistans kontrollerade summering visas.';
    return 'Källkonflikt finns i en eller flera voteringar. Officiella totalsiffror visas från protokollets votering; namnlistan visas som detaljevidens.';
  }
  if(verification.unnamed)return 'Rösträkningen följer protokollets officiella totalsiffror. Om färre personer visas än totalsiffran anger protokollet inte alla namn i den maskinlästa namnlistan.';
  return rows.length?'Rösträkningen följer protokollets officiella totalsiffror och de namngivna rösterna visas per parti och person.':'Beslutspunkten saknar formell votering i datan; status och utfall baseras på protokollets beslutstext.';
}

function decisionVoteMeaningMetaForGroupFinal(group,proposal){
  if(group?.meta&&(group.meta.yes_meaning||group.meta.no_meaning))return group.meta;
  const eventId=String(group?.eventId||'');
  const direct=proposal?.voteEvents?.[eventId];
  if(direct&&(direct.yes_meaning||direct.no_meaning))return direct;
  const firstEvent=Object.values(proposal?.voteEvents||{}).find(event=>event?.yes_meaning||event?.no_meaning);
  return firstEvent||group?.meta||{};
}

function decisionRequiredVoteMeaningBlockHtmlFinal(meta){
  const yes=String(meta?.yes_meaning||'').replace(/\s+/g,' ').trim()||'Inte uttryckligen angivet i protokollsdata.';
  const no=String(meta?.no_meaning||'').replace(/\s+/g,' ').trim()||'Inte uttryckligen angivet i protokollsdata.';
  return `<div class="decision-vote-meaning-detail" aria-label="Voteringens innebörd"><p><b>Ja:</b> ${esc(yes)}</p><p><b>Nej:</b> ${esc(no)}</p></div>`;
}

function decisionPointPartyHtmlCanonicalFinal(group,index,total,proposal=null){
  const filtered=decisionVotesAreFiltered(),isPosition=group.meta?.source_kind==='yrkande',voteTypes=['Ja','Nej','Avstår','Frånvarande'];
  const meta=isPosition?group.meta:decisionVoteMeaningMetaForGroupFinal(group,proposal);
  const voteHtml=voteTypes.map(vote=>{
    const voteRows=group.rows.filter(row=>row.vote===vote),count=decisionVoteTypeCount(group.meta,vote,voteRows.length);
    if(!count)return '';
    const parties=new Map();
    voteRows.forEach(row=>{const key=row.party||'—';if(!parties.has(key))parties.set(key,[]);parties.get(key).push(row);});
    const partyHtml=[...parties.entries()].sort((a,b)=>decisionDisplay('party',a[0]).localeCompare(decisionDisplay('party',b[0]),'sv',{numeric:true,sensitivity:'base'})).map(([party,rows])=>`<section class="decision-point-party"><h5>${esc(decisionDisplay('party',party))} · ${fmtInt(rows.length)}</h5><ul>${decisionVoteNames(rows)}</ul></section>`).join('');
    const missing=count-voteRows.length,missingHtml=!filtered&&missing>0?`<p class="decision-vote-missing">Protokollet anger ${fmtInt(count)} ${esc(vote.toLowerCase())}, men ${fmtInt(voteRows.length)} är namngivna.</p>`:'';
    return `<section class="decision-vote-type"><h4>${esc(vote)} <strong>${fmtInt(count)}</strong></h4>${partyHtml?`<div class="decision-point-party-list">${partyHtml}</div>`:''}${missingHtml}</section>`;
  }).join('');
  const conflict=!filtered&&group.meta?.count_conflict?'<div class="decision-vote-conflict">Källkonflikt: protokollets tryckta totalsiffra avviker från den uttryckliga namnlistan. Visade personer och partisummor räknas från namnlistan.</div>':'';
  const heading=isPosition?'Namngivna yrkanden':total>1?`Votering ${fmtInt(index+1)}`:'Votering';
  const meaning=isPosition?'':decisionRequiredVoteMeaningBlockHtmlFinal(meta);
  return `<article class="decision-point-card"><h3>${heading}</h3>${meaning}${conflict}${voteHtml}</article>`;
}

function decisionDetailUnavailableTextFinal(){
  return '<article class="decision-point-card decision-text-card decision-description-unavailable"><h3>Ärendebeskrivning</h3><p>Ingen separat ärendebeskrivning finns i den maskinläsbara protokollsutvinningen. Övriga tillgängliga protokollavsnitt visas nedan; använd källänken ovan för att läsa originalprotokollet.</p></article>';
}

function decisionMeetingContextHtmlFinal(proposal){
  const meeting=decisionMeetingRowFor(proposal);
  if(!meeting)return '';
  return `<section class="meeting-context"><span>Sammanträde</span><button type="button" data-open-meeting data-id="${esc(meeting.id)}" data-proposal-key="${esc(decisionProposalKey(meeting))}">${esc([meeting.body,meeting.date].filter(Boolean).join(' · '))}</button></section>`;
}

function decisionSetDetailMeetingContextFinal(meeting,onOpen=null){
  const host=$('decisionDetailContext');
  if(!host)return;
  if(!meeting){host.hidden=true;host.replaceChildren();return;}
  host.hidden=false;
  host.innerHTML=`<span>Sammanträde</span><button type="button" data-open-meeting data-id="${esc(meeting.id)}" data-proposal-key="${esc(decisionProposalKey(meeting))}">${esc([meeting.body,meeting.date].filter(Boolean).join(' · '))}</button>`;
  host.querySelector('button')?.addEventListener('click',event=>{
    event.preventDefault();
    if(onOpen)onOpen(meeting);
    else openDecisionDetail(meeting.id,decisionProposalKey(meeting));
  });
}

function decisionItemVoteParticipationHtmlFinal(proposal){
  if(!proposal||proposal.isMeeting)return '';
  const rounds=Number(proposal.fullVoteRoundCount||proposal.voteRoundCount||0);
  if(rounds!==1)return '';
  const count=(fullField,field)=>Number(proposal[fullField]??proposal[field]??0)||0;
  const yes=count('fullYes','yes'),no=count('fullNo','no'),abstain=count('fullAbstain','abstain'),total=yes+no+abstain;
  if(!total)return '';
  const result=[yes?`${fmtInt(yes)} ja`:'',no?`${fmtInt(no)} nej`:'',abstain?`${fmtInt(abstain)} avstod`:''].filter(Boolean).join(', ');
  return `<p class="meeting-attendance-item-note"><strong>Detta ärende:</strong> ${fmtInt(total)} personer deltog i den formella voteringen (${esc(result)}).</p>`;
}

function decisionAttendancePanelHtmlFinal(proposal,sharedPanelHtml=''){
  const note=decisionItemVoteParticipationHtmlFinal(proposal);
  if(sharedPanelHtml){
    if(!note)return sharedPanelHtml;
    return String(sharedPanelHtml).replace('<section class="meeting-attendance-panel">',`<section class="meeting-attendance-panel">${note}`);
  }
  const attendance=decisionMeetingAttendanceHtml(proposal);
  return attendance.includes('meeting-attendance-empty')?'':`<section class="meeting-attendance-panel">${note}${attendance}</section>`;
}

function decisionBindCanonicalDetailLinksFinal(){
  const groups=$('decisionDetailGroups');
  if(!groups)return;
  groups.querySelectorAll('.decision-text-ref').forEach(button=>{
    button.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      openDecisionDetail(button.dataset.id,button.dataset.proposalKey);
    };
  });
  groups.querySelectorAll('[data-open-meeting]').forEach(button=>{
    button.onclick=event=>{
      event.preventDefault();
      openDecisionDetail(button.dataset.id,button.dataset.proposalKey);
    };
  });
}

function renderCanonicalMeetingDetailFinal(meeting){
  decisionSetDetailMeetingContextFinal(null);
  const source=decisionProtocolFirstPageUrlFinal(meeting),protocolDiary=decisionProtocolDiaryNumberFinal(meeting);
  $('decisionDetailTitle').textContent=`Sammanträde · ${meeting.body} · ${meeting.date}`;
  $('decisionDetailMeta').innerHTML=`<span>${esc([meeting.documentTitle||'Protokoll',protocolDiary].filter(Boolean).join(' · '))}</span>${source?` <a class="decision-official-link" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna hela protokollet</a>`:''}`;
  $('decisionDetailOverview').innerHTML=[
    `<div class="decision-hierarchy"><div class="decision-hierarchy-item primary"><span>Sammanträde</span><strong>${esc(meeting.body)}</strong><small>${esc(meeting.date)}</small></div></div>`,
    `<div class="card"><span>Beslutspunkter</span><b>${esc(fmtInt(meeting.meetingDecisionCount||0))}</b></div>`,
    `<div class="card"><span>Ärenden</span><b>${esc(fmtInt(meeting.meetingMatterCount||0))}</b></div>`
  ].join('');
  $('decisionDetailStatus').textContent=`Hela protokollet. ${fmtInt(meeting.meetingDecisionCount||0)} beslutspunkter har registrerats för sammanträdet.`;
  $('decisionPage').textContent='';
  $('decisionDetailGroups').innerHTML=[
    `<article class="decision-point-card meeting-protocol-card"><h3>Protokoll</h3><p>${esc(meeting.documentTitle||'Hela protokollet för sammanträdet.')}</p>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna hela protokollet</a>`:''}</article>`,
    decisionAttendancePanelHtmlFinal(meeting)
  ].join('');
  $('decisionMasterPane').hidden=true;
  $('decisionDetailPane').hidden=false;
}

const renderDecisionDetailViewBeforeCanonicalItemFinal=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  if(tab?.kind==='activity')return renderDecisionDetailViewBeforeCanonicalItemFinal(tab);
  const payload=decisionDetailPayload(tab);
  if(!payload?.decision){
    return renderDecisionDetailViewBeforeCanonicalItemFinal(tab);
  }
  const proposal=payload.proposal;
  if(!proposal){
    return renderDecisionDetailViewBeforeCanonicalItemFinal(tab);
  }
  if(proposal.isMeeting){
    renderCanonicalMeetingDetailFinal(proposal);
    return;
  }
  const rows=payload.rows||[];
  $('decisionDetailTitle').textContent=proposal.pointTitle||tab?.title||payload.decision.title||'Ärende';
  const source=decisionAnchoredSourceUrl(proposal,payload.decision.url);
  $('decisionDetailMeta').innerHTML=`<span>${esc([proposal.body,payload.decision.date,proposal.diary].filter(Boolean).join(' · '))}</span>${source?` <a class="decision-official-link" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna källan</a>`:''}`;
  $('decisionDetailOverview').innerHTML=decisionDetailHierarchyHtml(payload.decision,proposal,tab)+decisionDetailCanonicalSummaryCardsFinal(rows,proposal);
  $('decisionDetailStatus').textContent=decisionDetailCanonicalStatusFinal(rows,proposal);
  $('decisionPrev').disabled=true;
  $('decisionNext').disabled=true;
  $('decisionPage').textContent='';
  const pointGroups=decisionPointPartyGroups(rows,proposal);
  const textHtml=decisionDetailTextHtml(proposal);
  const voteHtml=pointGroups.length?pointGroups.map((group,index)=>decisionPointPartyHtmlCanonicalFinal(group,index,pointGroups.length,proposal)).join(''):'<div class="decision-vote-panel">Denna beslutspunkt saknar formell votering.</div>';
  const extractionNotice=proposal.extractionStatus==='decision_not_extracted'?'<article class="decision-point-card decision-extraction-notice"><h3>Beslut</h3><p>Ingen formell beslutsrubrik kunde extraheras ur källprotokollet. Ärendet visas ändå med sin källa och övriga protokolluppgifter.</p></article>':'';
  const descriptionUnavailable=!String(proposal.abstractText||proposal.description||'').trim();
  const textContent=(descriptionUnavailable?decisionDetailUnavailableTextFinal():'')+textHtml;
  $('decisionDetailGroups').innerHTML=extractionNotice+(textContent||decisionDetailUnavailableTextFinal())+voteHtml+decisionAttendancePanelHtmlFinal(proposal);
  decisionSetDetailMeetingContextFinal(decisionMeetingRowFor(proposal));
  decisionBindCanonicalDetailLinksFinal();
  $('decisionMasterPane').hidden=true;
  $('decisionDetailPane').hidden=false;
};

/* Final unified decision filter chip pipeline.
   All dropdown filter chips for "Örebro kommuns beslut" render in one shared
   row. Selecting "Alla" in a dropdown clears only that dropdown's chips. */
function decisionFilterLabelFinal(id,col,value){
  const prefix={
    decisionOrgan:'Organ',
    decisionProposalType:'Ärendetyp',
    decisionParty:'Parti',
    decisionMember:'Ledamot/ersättare',
    decisionVote:'Röstning',
    decisionResult:'Resultat'
  }[id]||'Filter';
  return `${prefix}: ${decisionDisplay(col,value)}`;
}

const decisionFilterClearValueFinal='__clear_filter__';
const decisionFilterPromptValueFinal='__add_decision_filter__';
const setDecisionSelectOptionsBeforeClearOptionFinal=setDecisionSelectOptions;
setDecisionSelectOptions=function(id,values,selected=[],col='',allLabel='Alla'){
  setDecisionSelectOptionsBeforeClearOptionFinal(id,values,selected,col,allLabel);
  const sel=$(id);
  if(!sel||!selectedDecisionValues(id).length)return;
  const options=[...sel.options].slice(1).map(option=>option.outerHTML).join('');
  const chosen=selectedDecisionValues(id).map(value=>`<option value="${esc(value)}" disabled data-filter-selected="1">${esc(`✓ ${decisionDisplay(col,value)} (valt)`)}</option>`).join('');
  sel.innerHTML=`<option value="${decisionFilterPromptValueFinal}" selected>Välj fler...</option><option value="${decisionFilterClearValueFinal}">${esc(allLabel)}</option>${chosen}${options}`;
  sel.value=decisionFilterPromptValueFinal;
};

function decisionRemoveLegacyInlineFilterLocksFinal(){
  if(typeof document==='undefined')return;
  document.querySelectorAll('#decisionFilters .field > .raw-filter-lock').forEach(lock=>{
    if(lock.id!=='decisionDateLocks')lock.remove();
  });
}

renderDecisionFilterLocks=function(){
  decisionRemoveLegacyInlineFilterLocksFinal();
  const host=$('decisionFilterLocks');
  if(!host)return;
  const chips=[];
  decisionFilterIds.forEach(id=>{
    const sel=$(id);
    if(!sel)return;
    const col=sel.dataset.col||'';
    selectedDecisionValues(id).forEach(value=>chips.push({id,col,value,label:decisionFilterLabelFinal(id,col,value)}));
  });
  host.hidden=!chips.length;
  host.innerHTML=chips.map(chip=>`<span class="raw-filter-chip"><span>${esc(chip.label)}</span><button type="button" data-id="${esc(chip.id)}" data-value="${esc(chip.value)}" title="Rensa filter" aria-label="Rensa filter">×</button></span>`).join('');
  if(chips.length)host.insertAdjacentHTML('beforeend','<button type="button" class="filter-clear-all" data-clear-all-filters title="Rensa alla filter" aria-label="Rensa alla filter">× Rensa alla</button>');
  host.querySelectorAll('.raw-filter-chip button').forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.id;
      decisionFilterLocks[id]=selectedDecisionValues(id).filter(value=>value!==btn.dataset.value);
      resetDecisionPage();
      buildDecisionFilters();
      renderDecisionView();
    };
  });
  host.querySelector('[data-clear-all-filters]')?.addEventListener('click',()=>{
    decisionFilterIds.forEach(id=>{decisionFilterLocks[id]=[];});
    resetDecisionPage();
    buildDecisionFilters();
    renderDecisionView();
  });
};

handleDecisionFilterChange=function(id){
  const sel=$(id);
  if(!sel)return;
  const value=sel.value;
  if(value===decisionFilterPromptValueFinal)return;
  if(value===decisionFilterClearValueFinal){
    decisionFilterLocks[id]=[];
  }else if(value){
    if(!selectedDecisionValues(id).includes(value))decisionFilterLocks[id]=[...selectedDecisionValues(id),value];
  }else{
    decisionFilterLocks[id]=[];
  }
  resetDecisionPage();
  buildDecisionFilters();
  renderDecisionView();
};

/* The protocol's Ja/Nej instruction in this vote contradicts both the recorded
   44–18 result and the adopted decision. Present the alternatives consistently
   with the recorded outcome, and spell out what each means for the motion. */
const decisionVoteMeaningCorrectionsFinal={
  vote_case_body_kommunfullmaktige_2023_02_15_51_1:{
    yes_meaning:'bifall till Kommunstyrelsens förslag (motionens första att-sats avslås)',
    no_meaning:'bifall till motionens första att-sats (Kommunstyrelsens förslag avslås)'
  }
};
function decisionVoteMeaningMetaForGroupFinal(group,proposal){
  const eventId=String(group?.eventId||'');
  const correction=decisionVoteMeaningCorrectionsFinal[eventId];
  if(correction)return {...(group?.meta||proposal?.voteEvents?.[eventId]||{}),...correction};
  if(group?.meta&&(group.meta.yes_meaning||group.meta.no_meaning))return group.meta;
  const direct=proposal?.voteEvents?.[eventId];
  if(direct&&(direct.yes_meaning||direct.no_meaning))return direct;
  const firstEvent=Object.values(proposal?.voteEvents||{}).find(event=>event?.yes_meaning||event?.no_meaning);
  return firstEvent||group?.meta||{};
}

const decisionVoteMeaningHtmlBeforeCorrectionsFinal=decisionVoteMeaningHtml;
decisionVoteMeaningHtml=function(row){
  const html=decisionVoteMeaningHtmlBeforeCorrectionsFinal(row);
  const eventId=String((row?.voteIds||[])[0]||'');
  const correction=decisionVoteMeaningCorrectionsFinal[eventId];
  if(!correction)return html;
  return html
    .replace(/avslag till Kommunstyrelsens förslag/g,correction.yes_meaning)
    .replace(/bifall till motionens första att-sats/g,correction.no_meaning);
};

const decisionDetailHierarchyHtmlBeforeResultLabelFinal=decisionDetailHierarchyHtml;
decisionDetailHierarchyHtml=function(decision,proposal,tab){
  return decisionDetailHierarchyHtmlBeforeResultLabelFinal(decision,proposal,tab).replace(/Status:/g,'Resultat:');
};

/* Infinite-scroll rendering for the municipal main tables. */
function decisionVisibleCount(page,total){
  return Math.min(total,(Math.max(0,Number(page)||0)+1)*decisionPageSize());
}
function decisionBindInfiniteScrollFinal(bodyId,onMore){
  const wrap=$(bodyId)?.closest('.raw-table-wrap');
  if(!wrap||wrap.dataset.decisionInfiniteBound==='1')return;
  wrap.dataset.decisionInfiniteBound='1';
  wrap.addEventListener('scroll',()=>{
    if(wrap.scrollTop+wrap.clientHeight<wrap.scrollHeight-220)return;
    onMore();
  },{passive:true});
}
function resetDecisionPage(){
  decisionTabs.forEach(t=>{t.page=0;});
  if(typeof resetDecisionActivityPage==='function')resetDecisionActivityPage();
}
renderDecisionMasterView=function(){
  decisionBindInfiniteScrollFinal('decisionBody',()=>{
    const tab=decisionListTab(),rows=filteredDecisionPointRows();
    if(decisionVisibleCount(tab.page||0,rows.length)>=rows.length)return;
    tab.page=(tab.page||0)+1;
    renderDecisionMasterView();
  });
  const listTab=decisionListTab(),filteredRows=filteredDecisionPointRows(),rows=sortedDecisionPointRows(filteredRows),visibleRows=rows.slice(0,decisionVisibleCount(listTab.page||0,rows.length)),summary=decisionVisibleSummary(filteredRows);
  $('decisionOverview').innerHTML=decisionMasterSummaryCards(undefined,filteredRows);
  if(rows.length){
    $('decisionStatus').textContent=`Visar ${fmtInt(visibleRows.length)} av ${fmtInt(summary.tableRows)} tabellrader: ${fmtInt(summary.decisionRows)} beslutspunkter och ${fmtInt(summary.meetingRows)} sammanträden. ${fmtInt(summary.items)} poster: ${fmtInt(summary.matters)} ärenden och ${fmtInt(summary.meetings)} sammanträden.`;
    $('decisionPage').textContent=`Visar ${fmtInt(visibleRows.length)} / ${fmtInt(rows.length)}`;
  }else{
    $('decisionStatus').textContent='Inga beslutspunkter matchar de aktiva filtren.';
    $('decisionPage').textContent='';
  }
  $('decisionPrev').hidden=true;
  $('decisionNext').hidden=true;
  $('decisionHead').innerHTML=`<tr>${decisionSortableHeader('date','Datum')}${decisionSortableHeader('title','Organ')}${decisionSortableHeader('pointTitle','Ärende')}${decisionSortableHeader('result','Resultat')}${decisionSortableHeader('voteRoundCount','Voteringar')}${decisionSortableHeader('voteCount','Röstning')}${decisionSortableHeader('yes','Ja')}${decisionSortableHeader('no','Nej')}${decisionSortableHeader('abstain','Avstår')}${decisionSortableHeader('absent','Frånvarande')}<th>Källa</th></tr>`;
  $('decisionHead').querySelectorAll('[data-decision-sort]').forEach(th=>{th.onclick=()=>setDecisionSort(th.dataset.decisionSort);th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDecisionSort(th.dataset.decisionSort);}};});
  $('decisionBody').innerHTML=visibleRows.map(r=>{const source=decisionAnchoredSourceUrl(r);return `<tr class="${decisionPointRowClass(r)}" data-id="${esc(r.id)}" data-proposal-key="${esc(decisionProposalKey(r))}"><td>${esc(r.date)}</td><td>${esc(r.body||'')}</td><td>${municipalCaseCellHtml(r)}</td><td>${decisionPointResultHtml(r)}</td><td class="num">${fmtInt(r.voteRoundCount)}</td><td class="num">${fmtInt(r.voteCount)}</td><td class="num">${fmtInt(r.yes)}</td><td class="num">${fmtInt(r.no)}</td><td class="num">${fmtInt(r.abstain)}</td><td class="num">${fmtInt(r.absent)}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'-'}</td></tr>`;}).join('');
  $('decisionBody').querySelectorAll('.decision-selectable-row').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionDetail(row.dataset.id,row.dataset.proposalKey);});
  $('decisionMasterPane').hidden=false;
  $('decisionDetailPane').hidden=true;
};
renderDecisionActivityView=function(activeRow=null){
  const pane=$('decisionActivityPane');
  if(!pane)return;
  if(activeRow){renderDecisionDocumentDetailFinal(activeRow);return;}
  decisionBindInfiniteScrollFinal('decisionActivityBody',()=>{
    const tab=decisionActivityTabs[0]||{page:0},rows=sortedDecisionActivityRows(filteredDecisionActivityRows());
    if(decisionVisibleCount(tab.page||0,rows.length)>=rows.length)return;
    tab.page=(tab.page||0)+1;
    renderDecisionActivityView();
  });
  $('decisionActivityListPane').hidden=false;
  $('decisionActivityDetailPane').hidden=true;
  buildDecisionActivityFilters();
  const filteredRows=filteredDecisionActivityRows(),rows=sortedDecisionActivityRows(filteredRows),tab=decisionActivityTabs[0]||{page:0},visibleRows=rows.slice(0,decisionVisibleCount(tab.page||0,rows.length));
  const types=new Set(filteredRows.map(r=>r.type).filter(Boolean)),dated=filteredRows.filter(r=>r.dateSort).length,withSummary=filteredRows.filter(r=>r.summary).length;
  $('decisionActivityOverview').innerHTML=[
    ['Dokument',fmtInt(filteredRows.length)],
    ['Dokumenttyper',fmtInt(types.size)],
    ['Daterade',fmtInt(dated)],
    ['Med sammanfattning',fmtInt(withSummary)]
  ].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
  $('decisionActivityStatus').textContent=rows.length?`Visar ${fmtInt(visibleRows.length)} av ${fmtInt(rows.length)} styrdokument. Scrolla för att läsa in fler.`:'Inga styrdokument matchar de aktiva filtren.';
  $('decisionActivityHead').innerHTML=`<tr>${decisionActivitySortableHeader('date','Datum')}${decisionActivitySortableHeader('type','Dokumenttyp')}${decisionActivitySortableHeader('title','Titel')}${decisionActivitySortableHeader('summary','Sammanfattning')}${decisionActivitySortableHeader('points','Viktigt')}${decisionActivitySortableHeader('party','Område/organ')}<th>Källa</th></tr>`;
  $('decisionActivityHead').querySelectorAll('[data-activity-sort]').forEach(th=>{th.onclick=()=>setDecisionActivitySort(th.dataset.activitySort);});
  $('decisionActivityBody').innerHTML=visibleRows.map(r=>{const source=decisionActivitySourceUrl(r);return `<tr class="decision-selectable-row" data-activity-id="${esc(r.id)}"><td>${decisionActivityDateHtml(r)}</td><td><strong class="decision-activity-type">${esc(decisionActivityTypeLabel(r.type))}</strong></td><td><strong>${esc(r.title)}</strong></td><td>${decisionDocumentSummaryCellFinal(r)}</td><td>${decisionDocumentPointsPreviewFinal(r)}</td><td>${esc(r.party||'')}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'—'}</td></tr>`;}).join('');
  $('decisionActivityBody').querySelectorAll('[data-activity-id]').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionActivityDetail(row.dataset.activityId);});
};

/* Final main-table matter labels and copied-text search.
   The table should use the clean matter title from the extracted agenda item.
   Protocol section headers can be shorter, broader, or include OCR context. */
function decisionMatterTitleIsNoiseFinal(value){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  if(!text)return true;
  if(/^,?\s*§{1,2}\s*\d/.test(text))return true;
  if(text.length>150&&/\b(?:närvarande|ersättare|övriga|förvaltningsdirektör|nämndsekreterare|sekreterare|justerare|ordförande|digitalt justerat|paragraf)\b/i.test(text))return true;
  return false;
}
function decisionCleanProtocolHeaderTitleFinal(value){
  return String(value||'')
    .replace(/^\s*§\s*\d{1,4}(?:\.\d+)?\s*/,'')
    .replace(/\s+/g,' ')
    .trim();
}
function decisionMatterTitleFinal(row){
  const candidates=[
    municipalText(row?.title),
    decisionCleanProtocolHeaderTitleFinal(row?.protocolHeader),
    municipalText(row?.description)
  ];
  return candidates.find(value=>!decisionMatterTitleIsNoiseFinal(value))||'Ärende';
}
function decisionMainMatterLabelFinal(row){
  if(row?.isMeeting)return row.body||'Sammanträde';
  const point=String(row?.point||'').trim();
  const title=decisionMatterTitleFinal(row);
  const plainPoint=point.replace(/^§\s*/,'');
  if(!plainPoint)return title;
  const titleNorm=decisionSearchNormalizeFinal(title);
  const pointNorm=decisionSearchNormalizeFinal(plainPoint);
  return titleNorm.startsWith(`${pointNorm} `)?title:`${plainPoint}. ${title}`;
}
municipalCaseCellHtml=function(row){
  if(row?.isMeeting)return `<div class="decision-case-cell"><strong>${esc(row.body||'Sammanträde')}</strong><small class="decision-point-note">${esc(row.description||'Hela protokollet för sammanträdet.')}</small>${decisionMainCaseMetaHtmlFinal(row)}</div>`;
  return `<div class="decision-case-cell"><strong>${esc(decisionMainMatterLabelFinal(row))}</strong>${decisionMainCaseMetaHtmlFinal(row)}</div>`;
};
function decisionSearchContainsFinal(text,query){
  if(!query)return true;
  if(text.includes(query))return true;
  const tokens=[...new Set(query.split(' ').filter(token=>token.length>1))];
  return tokens.length>1&&tokens.every(token=>text.includes(token));
}
const decisionSearchTextBeforeMainMatterLabelFinal=decisionSearchTextFinal;
decisionSearchTextFinal=function(row){
  if(!row)return '';
  const base=decisionSearchTextBeforeMainMatterLabelFinal(row);
  const label=decisionSearchNormalizeFinal([
    decisionMainMatterLabelFinal(row),
    row?.point?`${row.point} ${row.title||''}`:'',
    row?.point?`${row.point}. ${row.title||''}`:''
  ].join(' '));
  return `${base} ${label}`.trim();
};
decisionPointSearchMatches=function(row){
  const q=decisionSearchNormalizeFinal(decisionSearchQuery);
  if(!q)return true;
  return decisionSearchContainsFinal(decisionSearchTextFinal(row),q);
};
const renderDecisionDetailViewBeforeMainMatterConsistencyFinal=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeMainMatterConsistencyFinal(tab);
  const payload=decisionDetailPayload(tab);
  const proposal=payload?.proposal;
  if(!proposal||proposal.isMeeting)return;
  const title=proposal.pointTitle||tab?.title||payload.decision?.title||'Ärende';
  $('decisionDetailTitle').textContent=title;
  const hierarchyTitle=document.querySelector('.decision-hierarchy-item.primary strong');
  if(hierarchyTitle)hierarchyTitle.textContent=title;
  const meta=document.querySelector('#decisionDetailMeta span');
  if(meta)meta.textContent=[proposal.body,payload.decision?.date,decisionValidDiaryNumberFinal(proposal.diary)].filter(Boolean).join(' · ');
};
const renderDecisionDetailViewBeforeMeetingDiaryFinal=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeMeetingDiaryFinal(tab);
  const meeting=decisionProposalRowByKeyAnyFinal(tab?.proposalKey);
  if(!meeting?.isMeeting)return;
  const diary=decisionProtocolDiaryNumberFinal(meeting);
  const meta=document.querySelector('#decisionDetailMeta span');
  if(meta)meta.textContent=[meeting.documentTitle||'Protokoll',diary?`Diarienummer ${diary}`:''].filter(Boolean).join(' · ');
  const overview=$('decisionDetailOverview');
  if(overview&&!overview.querySelector('[data-protocol-diary-card]')){
    overview.insertAdjacentHTML('beforeend',`<div class="card" data-protocol-diary-card><span>Diarienummer</span><b>${esc(diary||'Saknas')}</b></div>`);
  }
};
const municipalCaseCellHtmlBeforeProtocolDiaryFinal=municipalCaseCellHtml;
municipalCaseCellHtml=function(row){
  if(row?.isMeeting){
    const note=row.documentTitle||row.description||'Hela protokollet för sammanträdet.';
    return `<div class="decision-case-cell"><strong>${esc(row.body||'Sammanträde')}</strong><small class="decision-point-note">${esc(note)}</small>${decisionMainCaseMetaHtmlFinal(row)}</div>`;
  }
  return municipalCaseCellHtmlBeforeProtocolDiaryFinal(row);
};

/* Final visible-count copy for the Örebro work table. */
decisionMasterSummaryCards=function(rows=filteredDecisionRows(),pointRows=filteredDecisionPointRows()){
  const summary=decisionVisibleSummary(pointRows);
  return [
    ['Unika beslutspunkter och sammanträden',fmtInt(summary.tableRows)],
    ['Ärenden',fmtInt(summary.matters)],
    ['Sammanträden',fmtInt(summary.meetings)],
    ['Unika beslutspunkter',fmtInt(summary.decisions)],
    ['Formella voteringar',fmtInt(summary.formalVotes)]
  ].map(([label,value])=>`<div class="card"><span>${esc(label)}</span><b>${esc(String(value))}</b></div>`).join('');
};
renderDecisionMasterView=function(){
  decisionBindInfiniteScrollFinal('decisionBody',()=>{
    const tab=decisionListTab(),rows=filteredDecisionPointRows();
    if(decisionVisibleCount(tab.page||0,rows.length)>=rows.length)return;
    tab.page=(tab.page||0)+1;
    renderDecisionMasterView();
  });
  const listTab=decisionListTab(),filteredRows=filteredDecisionPointRows(),rows=sortedDecisionPointRows(filteredRows),visibleRows=rows.slice(0,decisionVisibleCount(listTab.page||0,rows.length));
  $('decisionOverview').innerHTML=decisionMasterSummaryCards(undefined,filteredRows);
  if(rows.length){
    $('decisionStatus').textContent='';
    $('decisionStatus').hidden=true;
    $('decisionPage').textContent=`Visar ${fmtInt(visibleRows.length)} / ${fmtInt(rows.length)} tabellrader`;
  }else{
    $('decisionStatus').hidden=false;
    $('decisionStatus').textContent='Inga beslutspunkter matchar de aktiva filtren.';
    $('decisionPage').textContent='';
  }
  $('decisionPrev').hidden=true;
  $('decisionNext').hidden=true;
  $('decisionHead').innerHTML=`<tr>${decisionSortableHeader('date','Datum')}${decisionSortableHeader('title','Organ')}${decisionSortableHeader('pointTitle','Ärende')}${decisionSortableHeader('result','Resultat')}${decisionSortableHeader('voteRoundCount','Voteringar')}${decisionSortableHeader('voteCount','Röstning')}${decisionSortableHeader('yes','Ja')}${decisionSortableHeader('no','Nej')}${decisionSortableHeader('abstain','Avstår')}${decisionSortableHeader('absent','Frånvarande')}<th>Källa</th></tr>`;
  $('decisionHead').querySelectorAll('[data-decision-sort]').forEach(th=>{th.onclick=()=>setDecisionSort(th.dataset.decisionSort);th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDecisionSort(th.dataset.decisionSort);}};});
  $('decisionBody').innerHTML=visibleRows.map(r=>{const source=decisionAnchoredSourceUrl(r);return `<tr class="${decisionPointRowClass(r)}" data-id="${esc(r.id)}" data-proposal-key="${esc(decisionProposalKey(r))}"><td>${esc(r.date)}</td><td>${esc(r.body||'')}</td><td>${municipalCaseCellHtml(r)}</td><td>${decisionPointResultHtml(r)}</td><td class="num">${fmtInt(r.voteRoundCount)}</td><td class="num">${fmtInt(r.voteCount)}</td><td class="num">${fmtInt(r.yes)}</td><td class="num">${fmtInt(r.no)}</td><td class="num">${fmtInt(r.abstain)}</td><td class="num">${fmtInt(r.absent)}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'-'}</td></tr>`;}).join('');
  $('decisionBody').querySelectorAll('.decision-selectable-row').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionDetail(row.dataset.id,row.dataset.proposalKey);});
  $('decisionMasterPane').hidden=false;
  $('decisionDetailPane').hidden=true;
};

/* Final infinite-scroll status and loading affordance. */
function decisionLoadMoreWithSpinnerFinal(wrap,update){
  if(!wrap||wrap.dataset.infiniteLoading==='1')return;
  if(update&&update()===false)return;
  wrap.dataset.infiniteLoading='1';
  wrap.classList.add('table-results-updating','table-infinite-loading');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      wrap.classList.remove('table-results-updating','table-infinite-loading');
      delete wrap.dataset.infiniteLoading;
      wrap.classList.remove('table-results-refreshed');
      void wrap.offsetWidth;
      wrap.classList.add('table-results-refreshed');
    });
  }));
}
decisionBindInfiniteScrollFinal=function(bodyId,onMore){
  const wrap=$(bodyId)?.closest('.raw-table-wrap');
  if(!wrap||wrap.dataset.decisionInfiniteBound==='1')return;
  wrap.dataset.decisionInfiniteBound='1';
  wrap.addEventListener('scroll',()=>{
    if(wrap.scrollTop+wrap.clientHeight<wrap.scrollHeight-220)return;
    decisionLoadMoreWithSpinnerFinal(wrap,onMore);
  },{passive:true});
};
renderDecisionMasterView=function(){
  decisionBindInfiniteScrollFinal('decisionBody',()=>{
    const tab=decisionListTab(),rows=filteredDecisionPointRows();
    if(decisionVisibleCount(tab.page||0,rows.length)>=rows.length)return false;
    tab.page=(tab.page||0)+1;
    renderDecisionMasterView();
    return true;
  });
  const listTab=decisionListTab(),filteredRows=filteredDecisionPointRows(),rows=sortedDecisionPointRows(filteredRows),visibleRows=rows.slice(0,decisionVisibleCount(listTab.page||0,rows.length));
  $('decisionOverview').innerHTML=decisionMasterSummaryCards(undefined,filteredRows);
  if(rows.length){
    $('decisionStatus').textContent='';
    $('decisionStatus').hidden=true;
    $('decisionPage').textContent=`Visar ${fmtInt(visibleRows.length)} / ${fmtInt(rows.length)} tabellrader`;
  }else{
    $('decisionStatus').textContent='Inga beslutspunkter matchar de aktiva filtren.';
    $('decisionPage').textContent='';
  }
  $('decisionPrev').hidden=true;
  $('decisionNext').hidden=true;
  $('decisionHead').innerHTML=`<tr>${decisionSortableHeader('date','Datum')}${decisionSortableHeader('title','Organ')}${decisionSortableHeader('pointTitle','Ärende')}${decisionSortableHeader('result','Resultat')}${decisionSortableHeader('voteRoundCount','Voteringar')}${decisionSortableHeader('voteCount','Röstning')}${decisionSortableHeader('yes','Ja')}${decisionSortableHeader('no','Nej')}${decisionSortableHeader('abstain','Avstår')}${decisionSortableHeader('absent','Frånvarande')}<th>Källa</th></tr>`;
  $('decisionHead').querySelectorAll('[data-decision-sort]').forEach(th=>{th.onclick=()=>setDecisionSort(th.dataset.decisionSort);th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDecisionSort(th.dataset.decisionSort);}};});
  $('decisionBody').innerHTML=visibleRows.map(r=>{const source=decisionAnchoredSourceUrl(r);return `<tr class="${decisionPointRowClass(r)}" data-id="${esc(r.id)}" data-proposal-key="${esc(decisionProposalKey(r))}"><td>${esc(r.date)}</td><td>${esc(r.body||'')}</td><td>${municipalCaseCellHtml(r)}</td><td>${decisionPointResultHtml(r)}</td><td class="num">${fmtInt(r.voteRoundCount)}</td><td class="num">${fmtInt(r.voteCount)}</td><td class="num">${fmtInt(r.yes)}</td><td class="num">${fmtInt(r.no)}</td><td class="num">${fmtInt(r.abstain)}</td><td class="num">${fmtInt(r.absent)}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'-'}</td></tr>`;}).join('');
  $('decisionBody').querySelectorAll('.decision-selectable-row').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionDetail(row.dataset.id,row.dataset.proposalKey);});
  $('decisionMasterPane').hidden=false;
  $('decisionDetailPane').hidden=true;
};
renderDecisionActivityView=function(activeRow=null){
  const pane=$('decisionActivityPane');
  if(!pane)return;
  if(activeRow){renderDecisionDocumentDetailFinal(activeRow);return;}
  decisionBindInfiniteScrollFinal('decisionActivityBody',()=>{
    const tab=decisionActivityTabs[0]||{page:0},rows=sortedDecisionActivityRows(filteredDecisionActivityRows());
    if(decisionVisibleCount(tab.page||0,rows.length)>=rows.length)return false;
    tab.page=(tab.page||0)+1;
    renderDecisionActivityView();
    return true;
  });
  $('decisionActivityListPane').hidden=false;
  $('decisionActivityDetailPane').hidden=true;
  buildDecisionActivityFilters();
  const filteredRows=filteredDecisionActivityRows(),rows=sortedDecisionActivityRows(filteredRows),tab=decisionActivityTabs[0]||{page:0},visibleRows=rows.slice(0,decisionVisibleCount(tab.page||0,rows.length));
  const types=new Set(filteredRows.map(r=>r.type).filter(Boolean)),dated=filteredRows.filter(r=>r.dateSort).length,withSummary=filteredRows.filter(r=>r.summary).length;
  $('decisionActivityOverview').innerHTML=[
    ['Dokument',fmtInt(filteredRows.length)],
    ['Dokumenttyper',fmtInt(types.size)],
    ['Daterade',fmtInt(dated)],
    ['Med sammanfattning',fmtInt(withSummary)]
  ].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
  $('decisionActivityStatus').textContent=rows.length?`Visar ${fmtInt(visibleRows.length)} av ${fmtInt(rows.length)} styrdokument.`:'Inga styrdokument matchar de aktiva filtren.';
  $('decisionActivityHead').innerHTML=`<tr>${decisionActivitySortableHeader('date','Datum')}${decisionActivitySortableHeader('type','Dokumenttyp')}${decisionActivitySortableHeader('title','Titel')}${decisionActivitySortableHeader('summary','Sammanfattning')}${decisionActivitySortableHeader('points','Viktigt')}${decisionActivitySortableHeader('party','Område/organ')}<th>Källa</th></tr>`;
  $('decisionActivityHead').querySelectorAll('[data-activity-sort]').forEach(th=>{th.onclick=()=>setDecisionActivitySort(th.dataset.activitySort);});
  $('decisionActivityBody').innerHTML=visibleRows.map(r=>{const source=decisionActivitySourceUrl(r);return `<tr class="decision-selectable-row" data-activity-id="${esc(r.id)}"><td>${decisionActivityDateHtml(r)}</td><td><strong class="decision-activity-type">${esc(decisionActivityTypeLabel(r.type))}</strong></td><td><strong>${esc(r.title)}</strong></td><td>${decisionDocumentSummaryCellFinal(r)}</td><td>${decisionDocumentPointsPreviewFinal(r)}</td><td>${esc(r.party||'')}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'—'}</td></tr>`;}).join('');
  $('decisionActivityBody').querySelectorAll('[data-activity-id]').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionActivityDetail(row.dataset.activityId);});
};
/* Final final visible-count copy. Keep at EOF. */
decisionMasterSummaryCards=function(rows=filteredDecisionRows(),pointRows=filteredDecisionPointRows()){
  const summary=decisionVisibleSummary(pointRows);
  return [
    ['Unika beslutspunkter och sammanträden',fmtInt(summary.tableRows)],
    ['Ärenden',fmtInt(summary.matters)],
    ['Sammanträden',fmtInt(summary.meetings)],
    ['Unika beslutspunkter',fmtInt(summary.decisions)],
    ['Formella voteringar',fmtInt(summary.formalVotes)]
  ].map(([label,value])=>`<div class="card"><span>${esc(label)}</span><b>${esc(String(value))}</b></div>`).join('');
};
renderDecisionMasterView=function(){
  decisionBindInfiniteScrollFinal('decisionBody',()=>{
    const tab=decisionListTab(),rows=filteredDecisionPointRows();
    if(decisionVisibleCount(tab.page||0,rows.length)>=rows.length)return false;
    tab.page=(tab.page||0)+1;
    renderDecisionMasterView();
    return true;
  });
  const listTab=decisionListTab(),filteredRows=filteredDecisionPointRows(),rows=sortedDecisionPointRows(filteredRows),visibleRows=rows.slice(0,decisionVisibleCount(listTab.page||0,rows.length));
  $('decisionOverview').innerHTML=decisionMasterSummaryCards(undefined,filteredRows);
  if(rows.length){
    $('decisionStatus').textContent='';
    $('decisionStatus').hidden=true;
    $('decisionPage').textContent=`Visar ${fmtInt(visibleRows.length)} / ${fmtInt(rows.length)} tabellrader`;
  }else{
    $('decisionStatus').hidden=false;
    $('decisionStatus').textContent='Inga beslutspunkter matchar de aktiva filtren.';
    $('decisionPage').textContent='';
  }
  $('decisionPrev').hidden=true;
  $('decisionNext').hidden=true;
  $('decisionHead').innerHTML=`<tr>${decisionSortableHeader('date','Datum')}${decisionSortableHeader('title','Organ')}${decisionSortableHeader('pointTitle','Ärende')}${decisionSortableHeader('result','Resultat')}${decisionSortableHeader('voteRoundCount','Voteringar')}${decisionSortableHeader('voteCount','Röstning')}${decisionSortableHeader('yes','Ja')}${decisionSortableHeader('no','Nej')}${decisionSortableHeader('abstain','Avstår')}${decisionSortableHeader('absent','Frånvarande')}<th>Källa</th></tr>`;
  $('decisionHead').querySelectorAll('[data-decision-sort]').forEach(th=>{th.onclick=()=>setDecisionSort(th.dataset.decisionSort);th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDecisionSort(th.dataset.decisionSort);}};});
  $('decisionBody').innerHTML=visibleRows.map(r=>{const source=decisionAnchoredSourceUrl(r);return `<tr class="${decisionPointRowClass(r)}" data-id="${esc(r.id)}" data-proposal-key="${esc(decisionProposalKey(r))}"><td>${esc(r.date)}</td><td>${esc(r.body||'')}</td><td>${municipalCaseCellHtml(r)}</td><td>${decisionPointResultHtml(r)}</td><td class="num">${fmtInt(r.voteRoundCount)}</td><td class="num">${fmtInt(r.voteCount)}</td><td class="num">${fmtInt(r.yes)}</td><td class="num">${fmtInt(r.no)}</td><td class="num">${fmtInt(r.abstain)}</td><td class="num">${fmtInt(r.absent)}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'-'}</td></tr>`;}).join('');
  $('decisionBody').querySelectorAll('.decision-selectable-row').forEach(row=>row.onclick=e=>{if(e.target.closest('a'))return;openDecisionDetail(row.dataset.id,row.dataset.proposalKey);});
  $('decisionMasterPane').hidden=false;
  $('decisionDetailPane').hidden=true;
};

/* Canonical protocol matter headers.
   The visible matter title must come from the protocol section header (`ht`),
   not from the shorter case title (`t`) or extracted decision text (`p`). */
function decisionProtocolMatterHeaderFinal(row){
  if(!row)return 'Ärende';
  decisionHydrateTextFieldsFinal(row);
  return String(row.protocolHeader||row.title||'Ärende').replace(/\s+/g,' ').trim()||'Ärende';
}
function decisionApplyProtocolMatterHeadersFinal(){
  if(!Array.isArray(decisionAllPointRows)||decisionPack?._protocolMatterHeadersReadyFinal)return;
  decisionAllPointRows.forEach(row=>{
    const header=decisionProtocolMatterHeaderFinal(row);
    row.pointTitle=header;
    row.canonicalMatterHeader=header;
  });
  if(decisionPack)decisionPack._protocolMatterHeadersReadyFinal=true;
}
const ensureDecisionDataBeforeProtocolMatterHeadersFinal=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeProtocolMatterHeadersFinal();
  decisionApplyProtocolMatterHeadersFinal();
};
municipalCaseCellHtml=function(row){
  if(row?.isMeeting){
    const note=row.documentTitle||row.description||'Hela protokollet för sammanträdet.';
    return `<div class="decision-case-cell"><strong>${esc(row.body||'Sammanträde')}</strong><small class="decision-point-note">${esc(note)}</small>${decisionMainCaseMetaHtmlFinal(row)}</div>`;
  }
  return `<div class="decision-case-cell"><strong>${esc(decisionProtocolMatterHeaderFinal(row))}</strong>${decisionMainCaseMetaHtmlFinal(row)}</div>`;
};
const decisionTabTitleForBeforeProtocolMatterHeadersFinal=decisionTabTitleFor;
decisionTabTitleFor=function(row){
  if(row?.isMeeting)return decisionTabTitleForBeforeProtocolMatterHeadersFinal(row);
  return `${row.date} · ${decisionProtocolMatterHeaderFinal(row)}`.slice(0,80);
};
const renderDecisionDetailViewBeforeProtocolMatterHeadersFinal=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforeProtocolMatterHeadersFinal(tab);
  const payload=decisionDetailPayload(tab);
  const proposal=payload?.proposal;
  if(!proposal||proposal.isMeeting)return;
  const header=decisionProtocolMatterHeaderFinal(proposal);
  $('decisionDetailTitle').textContent=header;
  const hierarchyTitle=document.querySelector('.decision-hierarchy-item.primary strong');
  if(hierarchyTitle)hierarchyTitle.textContent=header;
};

/* Canonical organ names.
   Merge the misspelled committee label into the official name everywhere:
   filters, row display, saved selections, and meeting grouping. */
function decisionCanonicalOrganNameFinal(value){
  return municipalNorm(value)
    .replace(/\s+/g,' ')
    .replace(/\s+20\d{2}.*20\d{2}$/,'')
    .replace(/hållbarhetssutskott/gi,'hållbarhetsutskott')
    .replace(/hållbarhetssutskott/gi,'hållbarhetsutskott')
    .trim();
}
decisionOrganCanonical=function(value){
  return decisionCanonicalOrganNameFinal(value);
};
decisionOrganCanonicalFinal=function(value){
  return decisionCanonicalOrganNameFinal(value);
};
uniqueDecisionOrganValues=function(values){
  return uniqueDecisionValues(values.map(decisionCanonicalOrganNameFinal));
};
decisionOrganMatches=function(selected,value){
  const canonical=decisionCanonicalOrganNameFinal(value);
  const canonicalSelected=normalizeDecisionSelectionState(selected).map(decisionCanonicalOrganNameFinal);
  return canonicalSelected.includes(canonical);
};
decisionOrganMatchesFinal=function(selected,value){
  return decisionOrganMatches(selected,value);
};
function decisionApplyOrganNamesFinal(){
  if(decisionPack?._canonicalOrganNamesReadyFinal)return;
  for(const rows of [decisionAllPointRows,decisionRows,decisionMemberRows,decisionPositionRows]){
    if(!Array.isArray(rows))continue;
    rows.forEach(row=>{
      if(row&&row.body!=null)row.body=decisionCanonicalOrganNameFinal(row.body);
    });
  }
  if(decisionFilterLocks?.decisionOrgan){
    decisionFilterLocks.decisionOrgan=uniqueDecisionOrganValues(decisionFilterLocks.decisionOrgan);
  }
  if(decisionPack)decisionPack._canonicalOrganNamesReadyFinal=true;
}
const ensureDecisionDataBeforeCanonicalOrganNamesFinal=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeCanonicalOrganNamesFinal();
  decisionApplyOrganNamesFinal();
};

/* Meeting search rollups.
   A synthetic Sammanträden row should match searches against every agenda
   item in that protocol, not only the representative row used to build it. */
function decisionMeetingChildSearchTextFinal(row){
  return [
    row.title,
    row.pointTitle,
    row.protocolHeader,
    row.description,
    row.abstractText,
    row.fullDecisionText,
    row.diary,
    row.caseNumber,
    row.documentTitle,
    row.body,
    row.result,
    row.proposalType
  ].join(' ');
}
function decisionApplyMeetingSearchRollupsFinal(){
  if(!Array.isArray(decisionAllPointRows)||decisionPack?._meetingSearchRollupsReadyFinal)return;
  const textByProtocol=new Map();
  const textByMeeting=new Map();
  decisionAllPointRows.forEach(row=>{
    if(!row||row.isMeeting)return;
    const text=decisionMeetingChildSearchTextFinal(row);
    const protocolKey=decisionMeetingProtocolKey(row);
    const meetingKey=decisionMeetingKey(row.date,row.body);
    textByProtocol.set(protocolKey,`${textByProtocol.get(protocolKey)||''} ${text}`);
    textByMeeting.set(meetingKey,`${textByMeeting.get(meetingKey)||''} ${text}`);
  });
  decisionAllPointRows.forEach(row=>{
    if(!row?.isMeeting)return;
    const ownText=decisionMeetingChildSearchTextFinal(row);
    const childText=textByProtocol.get(row.meetingKey)||textByMeeting.get(decisionMeetingKey(row.date,row.body))||'';
    row.meetingSearchText=decisionSearchNormalizeFinal(`${ownText} ${childText}`);
  });
  if(decisionPack)decisionPack._meetingSearchRollupsReadyFinal=true;
}
const ensureDecisionDataBeforeMeetingSearchRollupsFinal=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeMeetingSearchRollupsFinal();
  decisionApplyMeetingSearchRollupsFinal();
};
const decisionPointSearchMatchesBeforeMeetingRollupsFinal=decisionPointSearchMatches;
decisionPointSearchMatches=function(row){
  const q=decisionSearchNormalizeFinal(decisionSearchQuery);
  if(!q)return true;
  if(row?.isMeeting&&row.meetingSearchText)return row.meetingSearchText.includes(q);
  return decisionPointSearchMatchesBeforeMeetingRollupsFinal(row);
};

function decisionProposalTypeCanonicalFinal(value){
  const text=municipalNorm(value);
  const folded=text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/ä|ä/gi,'a')
    .toLowerCase();
  return folded.includes('sammantr')?'meeting':folded;
}
function decisionMeetingSearchTextOnDemandFinal(row){
  if(!row?.isMeeting)return '';
  if(row.meetingSearchText)return row.meetingSearchText;
  const protocolKey=row.meetingKey;
  const meetingKey=decisionMeetingKey(row.date,row.body);
  const childText=decisionAllPointRows
    .filter(candidate=>!candidate?.isMeeting&&(decisionMeetingProtocolKey(candidate)===protocolKey||decisionMeetingKey(candidate.date,candidate.body)===meetingKey))
    .map(decisionMeetingChildSearchTextFinal)
    .join(' ');
  row.meetingSearchText=decisionSearchNormalizeFinal(`${decisionMeetingChildSearchTextFinal(row)} ${childText}`);
  return row.meetingSearchText;
}
const decisionPointSearchMatchesBeforeFinalMeetingFilter=decisionPointSearchMatches;
decisionPointSearchMatches=function(row){
  const q=decisionSearchNormalizeFinal(decisionSearchQuery);
  if(!q)return true;
  if(row?.isMeeting)return decisionMeetingSearchTextOnDemandFinal(row).includes(q);
  return decisionPointSearchMatchesBeforeFinalMeetingFilter(row);
};
filteredDecisionPointRows=function(){
  const organs=selectedDecisionValues('decisionOrgan');
  const parties=selectedDecisionValues('decisionParty');
  const members=selectedDecisionValues('decisionMember');
  const votes=selectedDecisionValues('decisionVote');
  const results=normalizeDecisionResultFilterSelection(selectedDecisionValues('decisionResult'));
  const types=selectedDecisionValues('decisionProposalType').map(decisionProposalTypeCanonicalFinal);
  const requiresVoteMatch=parties.length||members.length||votes.length;
  const attendanceKeys=new Set(members.length&&!votes.length?decisionFilteredAttendanceRows().map(row=>row.attendanceKey):[]);
  const counts=new Map();
  filteredDecisionRows().forEach(row=>{
    const key=`${row.id}|${row.point}`;
    if(!counts.has(key))counts.set(key,{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0,voteIds:new Set()});
    const count=counts.get(key);
    count.voteCount++;
    const eventId=decisionVoteEventBase(row.intressentId);
    if(eventId)count.voteIds.add(eventId);
    count.voteRoundCount=count.voteIds.size;
    if(row.vote==='Ja')count.yes++;
    else if(row.vote==='Nej')count.no++;
    else if(row.vote==='Avstår')count.abstain++;
    else if(row.vote==='Frånvarande')count.absent++;
  });
  return decisionAllPointRows
    .filter(row=>
      (!types.length||types.includes(row?.isMeeting?'meeting':decisionProposalTypeCanonicalFinal(row.proposalType||'beslut')))&&
      decisionDateMatches(row.date)&&
      decisionPointSearchMatches(row)&&
      (!organs.length||decisionOrganMatches(organs,row.body))&&
      (!results.length||results.includes(decisionResultFilterGroup(row.result||'beslut')))&&
      (!requiresVoteMatch||counts.has(`${row.id}|${row.point}`)||attendanceKeys.has(row.attendanceKey))
    )
    .map(row=>{
      const count=counts.get(`${row.id}|${row.point}`)||{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0};
      if(requiresVoteMatch&&!attendanceKeys.has(row.attendanceKey))return {...row,voteRoundCount:count.voteRoundCount||0,voteCount:count.voteCount||0,yes:count.yes||0,no:count.no||0,abstain:count.abstain||0,absent:count.absent||0};
      if(requiresVoteMatch&&attendanceKeys.has(row.attendanceKey)&&!counts.has(`${row.id}|${row.point}`))return {...row,voteRoundCount:row.fullVoteRoundCount||0,voteCount:row.fullVoteCount||0,yes:row.fullYes||0,no:row.fullNo||0,abstain:row.fullAbstain||0,absent:row.fullAbsent||0};
      if(decisionVotesAreFiltered())return row;
      return decisionApplyCanonicalVoteTotalsFinal({...row});
    });
};

function decisionPdfIconFinal(extraClass=''){
  const cls=['decision-pdf-icon',extraClass].filter(Boolean).join(' ');
  return `<svg class="${esc(cls)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 2h9l5 5v15H5z" fill="#e31b23"></path><path d="M14 2v5h5z" fill="#f36b70"></path><path d="M8.2 13.1c2.7-.7 5-1.6 7.1-2.8M10.3 6.1c.2 2.2 1 4.3 2.5 6.4M9.2 13.1c.7-1.2 1.3-2.6 1.8-4.1" fill="none" stroke="#fff" stroke-width=".85" stroke-linecap="round" stroke-linejoin="round"></path><rect x="5.9" y="14.65" width="12.2" height="6.15" rx=".8" fill="#fff"></rect><text x="12" y="17.82" text-anchor="middle" dominant-baseline="middle" font-size="4.75" font-weight="900" fill="#e31b23" font-family="Arial, Helvetica, sans-serif">PDF</text></svg>`;
}
function decisionDecorateMainPdfLinksFinal(){
  ['decisionBody','decisionActivityBody'].forEach(id=>{
    const body=$(id);
    if(!body)return;
    body.querySelectorAll('td:last-child a').forEach(link=>{
      if(link.dataset.pdfIconApplied)return;
      link.dataset.pdfIconApplied='1';
      link.classList.add('decision-pdf-source-link');
      link.setAttribute('aria-label','Öppna PDF');
      link.title='Öppna PDF';
      link.innerHTML=decisionPdfIconFinal();
    });
  });
}
function decisionDecorateDetailPdfLinksFinal(){
  ['decisionDetailMeta','decisionActivityDetailMeta'].forEach(id=>{
    const host=$(id);
    if(!host)return;
    host.querySelectorAll('a.decision-official-link').forEach(link=>{
      const label=municipalNorm(link.textContent);
      if(link.dataset.pdfIconApplied||!/^Öppna källa(?:n)?$/i.test(label))return;
      link.dataset.pdfIconApplied='1';
      link.innerHTML=`<span>Öppna källa</span>${decisionPdfIconFinal('decision-pdf-icon-inline')}`;
    });
  });
}
const renderDecisionMasterViewBeforePdfLinksFinal=renderDecisionMasterView;
renderDecisionMasterView=function(){
  renderDecisionMasterViewBeforePdfLinksFinal();
  decisionDecorateMainPdfLinksFinal();
};
const renderDecisionDetailViewBeforePdfLinksFinal=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  renderDecisionDetailViewBeforePdfLinksFinal(tab);
  decisionDecorateDetailPdfLinksFinal();
};
if(typeof renderDecisionActivityDetail==='function'){
  const renderDecisionActivityDetailBeforePdfLinksFinal=renderDecisionActivityDetail;
  renderDecisionActivityDetail=function(row){
    renderDecisionActivityDetailBeforePdfLinksFinal(row);
    decisionDecorateDetailPdfLinksFinal();
  };
}
if(typeof renderDecisionActivityView==='function'){
  const renderDecisionActivityViewBeforePdfLinksFinal=renderDecisionActivityView;
  renderDecisionActivityView=function(activeRow=null){
    renderDecisionActivityViewBeforePdfLinksFinal(activeRow);
    decisionDecorateMainPdfLinksFinal();
  };
}

/* List filters decide which decision points are discoverable. Once a decision
   is opened, always render its complete protocol vote record so a persisted
   Ja/Nej, party, or member filter cannot hide the other official vote rows. */
decisionDetailRows=function(tab){
  const id=typeof tab==='object'?String(tab.id||''):String(tab||'');
  const sourcePoints=typeof tab==='object'?normalizeDecisionSelectionState(tab.sourcePoints):[];
  let rows=decisionRows.filter(row=>String(row.id)===id);
  if(sourcePoints.length)rows=rows.filter(row=>sourcePoints.includes(String(row.point)));
  else if(typeof tab==='object'&&(tab.sourcePoint||tab.point))rows=rows.filter(row=>String(row.point)===String(tab.sourcePoint||tab.point));
  return rows;
};
let decisionRenderingCompleteDetailFinal=false;
const decisionVotesAreFilteredBeforeCompleteDetailFinal=decisionVotesAreFiltered;
decisionVotesAreFiltered=function(){
  return decisionRenderingCompleteDetailFinal?false:decisionVotesAreFilteredBeforeCompleteDetailFinal();
};
const renderDecisionDetailViewBeforeCompleteVotesFinal=renderDecisionDetailView;
renderDecisionDetailView=function(tab){
  decisionRenderingCompleteDetailFinal=true;
  try{return renderDecisionDetailViewBeforeCompleteVotesFinal(tab);}
  finally{decisionRenderingCompleteDetailFinal=false;}
};

/* Vote columns are counts for every decision-point row. A missing counter
   therefore means zero recorded votes, not "not applicable". Normalize at the
   final data boundary so imported protocols and synthetic meeting rows follow
   the same numeric contract in rendering, sorting, filtering, and details. */
const decisionVoteCounterFieldsFinal=[
  'voteRoundCount','voteCount','yes','no','abstain','absent',
  'fullVoteRoundCount','fullVoteCount','fullYes','fullNo','fullAbstain','fullAbsent'
];
function decisionNormalizeVoteCountersFinal(row){
  if(!row)return row;
  decisionVoteCounterFieldsFinal.forEach(field=>{
    const value=Number(row[field]);
    row[field]=Number.isFinite(value)?value:0;
  });
  return row;
}
const ensureDecisionDataBeforeVoteCounterNormalizationFinal=ensureDecisionData;
ensureDecisionData=function(){
  ensureDecisionDataBeforeVoteCounterNormalizationFinal();
  if(decisionReady&&!decisionPack?._voteCountersNormalizedFinal){
    decisionAllPointRows.forEach(decisionNormalizeVoteCountersFinal);
    decisionPack._voteCountersNormalizedFinal=true;
  }
};
const filteredDecisionPointRowsBeforeVoteCounterNormalizationFinal=filteredDecisionPointRows;
filteredDecisionPointRows=function(){
  return filteredDecisionPointRowsBeforeVoteCounterNormalizationFinal().map(decisionNormalizeVoteCountersFinal);
};

const exportDecisionStateBeforeFilterModesFinal=exportDecisionState;
exportDecisionState=function(){
  const state=exportDecisionStateBeforeFilterModesFinal();
  state.f={...(state.f||{}),fm:decisionFilterMatchMode==='and'?'a':'o'};
  state.af={...(state.af||{}),fm:decisionActivityFilterMatchMode==='and'?'a':'o'};
  return state;
};
const applyDecisionStateBeforeFilterModesFinal=applyDecisionState;
applyDecisionState=function(state){
  decisionFilterMatchMode=state?.f?.fm==='a'?'and':'or';
  decisionActivityFilterMatchMode=state?.af?.fm==='a'?'and':'or';
  return applyDecisionStateBeforeFilterModesFinal(state);
};
