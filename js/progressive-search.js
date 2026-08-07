/* Progressive search rendering for every searchable main table. */
const progressiveSearchJobsFinal=new Map();
const progressiveSearchHandlersFinal=new Map();
const scheduleTableSearchBeforeProgressiveFinal=scheduleTableSearch;

const municipalDataWorkerSrcFinal='js/municipal-data-loader-worker.js?v=20260806-4';
const municipalProtocolPackByteSizesFinal=[29624019];
function progressiveCreateDataWorkerFinal(){
  if(typeof Worker!=='function'||window.location.protocol==='file:')return null;
  try{return new Worker(municipalDataWorkerSrcFinal);}
  catch(_error){return null;}
}

let decisionPackWorkerPromiseFinal=null;
async function decisionAssembleWorkerPartsFinal(parts){
  const ordered=Object.keys(parts||{}).map(Number).filter(Number.isFinite).sort((a,b)=>a-b).map(key=>parts[key]),part1=ordered[0];
  if(!part1)throw Error('Kommundatans delar kunde inte sättas samman.');
  const documents=ordered.flatMap(part=>part.d||[]),voteRows=ordered.flatMap(part=>part.r||[]),positionRows=ordered.flatMap(part=>part.pr||[]),memberRows=ordered.flatMap(part=>part.mr||[]);
  const yieldUi=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  decisionUpdateInitialProgressFinal(45);
  await yieldUi();applyMunicipalProtocolMetadataCorrections(documents,memberRows);
  decisionUpdateInitialProgressFinal(46);
  await yieldUi();
  let cleanStarted=performance.now(),cleanIndex=0;
  for(const document of documents){
    cleanIndex++;
    for(const field of ['ht','ad','bd'])if(document[field])document[field]=cleanMunicipalProtocolExtractedText(document[field]);
    for(const point of Object.keys(document.p||{}))document.p[point]=cleanMunicipalProtocolExtractedText(document.p[point]);
    if(performance.now()-cleanStarted>=3){
      decisionUpdateInitialProgressFinal(46+(documents.length?cleanIndex/documents.length*3:3));
      await yieldUi();cleanStarted=performance.now();
    }
  }
  decisionUpdateInitialProgressFinal(49);
  await yieldUi();synchronizeMunicipalProtocolTitles(documents);decisionUpdateInitialProgressFinal(49.5);
  await yieldUi();pruneUnmatchedMunicipalAttendanceRows(documents,memberRows);decisionUpdateInitialProgressFinal(50);
  await yieldUi();repairMunicipalPageBoundaryAttendance(documents,voteRows,memberRows);applyMunicipalAttendanceSourceRoleCorrections(memberRows);decisionUpdateInitialProgressFinal(50.2);
  await yieldUi();disambiguateMunicipalProtocolDocumentIds(documents);decisionUpdateInitialProgressFinal(50.4);
  await yieldUi();disambiguateMunicipalDecisionPointIds(documents);decisionUpdateInitialProgressFinal(50.8);
  await yieldUi();repairMunicipalVoteEvents(documents,voteRows);decisionUpdateInitialProgressFinal(51.2);
  await yieldUi();repairMunicipalTruncatedVoteMeanings(documents);decisionUpdateInitialProgressFinal(51.6);
  await yieldUi();markMunicipalVoteCountConflicts(documents,voteRows);decisionUpdateInitialProgressFinal(52);
  await yieldUi();
  return {...part1,d:documents,r:voteRows,pr:positionRows,mr:memberRows};
}

async function decisionLoadWithoutWorkerFinal(){
  if(window.municipalProtocolPack?.d?.length){
    decisionPack=window.municipalProtocolPack;
    decisionUpdateInitialProgressFinal(52);
    return decisionPack;
  }
  let parts=window.municipalProtocolPackParts||{};
  const totalBytes=municipalProtocolPackByteSizesFinal.reduce((sum,size)=>sum+size,0);
  let loadedBytes=municipalProtocolPackByteSizesFinal.reduce((sum,size,index)=>sum+(parts[index+1]?size:0),0);
  await Promise.all(municipalProtocolPackSrcs.map((src,index)=>{
    if(parts[index+1])return Promise.resolve();
    return loadScriptOnce(src).then(()=>{
      loadedBytes+=municipalProtocolPackByteSizesFinal[index]||0;
      decisionUpdateInitialProgressFinal(totalBytes?loadedBytes/totalBytes*45:45);
    });
  }));
  parts=window.municipalProtocolPackParts||{};
  const assembled=await decisionAssembleWorkerPartsFinal(parts);
  decisionPack=window.municipalProtocolPack=assembled;
  return assembled;
}

function decisionLoadWithWorkerFinal(worker){
  return new Promise((resolve,reject)=>{
    const parts={};
    worker.onmessage=async event=>{
      const message=event.data||{};
      if(message.type==='load-progress'){
        const total=Math.max(0,Number(message.totalBytes)||0),loaded=Math.max(0,Number(message.loadedBytes)||0);
        decisionUpdateInitialProgressFinal(total?Math.min(1,loaded/total)*45:0);
      }else if(message.type==='meta'){parts[message.part]=parts[message.part]||{};Object.assign(parts[message.part],message.value||{});}
      else if(message.type==='chunk'){
        const target=parts[message.part]=parts[message.part]||{};
        if(!Array.isArray(target[message.key]))target[message.key]=[];
        target[message.key].push(...(message.value||[]));
      }else if(message.type==='error'){
        worker.terminate();reject(Error(message.message||'Kommundatan kunde inte läsas in.'));
      }else if(message.type==='complete'){
        worker.terminate();
        try{
          const assembled=await decisionAssembleWorkerPartsFinal(parts);
          decisionPack=window.municipalProtocolPack=assembled;
          resolve(assembled);
        }catch(error){reject(error);}
      }
    };
    worker.onerror=event=>{worker.terminate();reject(Error(event.message||'Kommundatan kunde inte läsas in.'));};
    worker.postMessage({
      sources:municipalProtocolPackSrcs.map(src=>new URL(src,window.location.href).href),
      sourceSizes:municipalProtocolPackByteSizesFinal
    });
  });
}

ensureDecisionPackLoaded=async function(){
  if(!municipalWorkEnabled)throw Error('Kommunvyn är avstängd.');
  if(decisionPack?.d?.length)return decisionPack;
  if(decisionPackWorkerPromiseFinal)return decisionPackWorkerPromiseFinal;
  decisionPackWorkerPromiseFinal=(async()=>{
    const worker=progressiveCreateDataWorkerFinal();
    if(worker){
      try{return await decisionLoadWithWorkerFinal(worker);}
      catch(_error){/* A blocked worker is expected for some local/CSP deployments. */}
    }
    return decisionLoadWithoutWorkerFinal();
  })().finally(()=>{decisionPackWorkerPromiseFinal=null;});
  return decisionPackWorkerPromiseFinal;
};

let progressiveLastVisualYieldFinal=0;
function progressiveSearchFrameFinal(job){
  const now=performance.now();
  if(now-progressiveLastVisualYieldFinal>=32||progressiveInputPendingFinal()){
    progressiveLastVisualYieldFinal=now;
    return new Promise(resolve=>requestAnimationFrame(()=>resolve(!job.cancelled)));
  }
  if(globalThis.scheduler?.yield)return scheduler.yield().then(()=>!job.cancelled);
  return new Promise(resolve=>setTimeout(()=>resolve(!job.cancelled),0));
}

function progressiveVisualFrameFinal(job){
  return new Promise(resolve=>requestAnimationFrame(()=>resolve(!job.cancelled)));
}

function progressiveInputPendingFinal(){
  try{return !!navigator.scheduling?.isInputPending?.({includeContinuous:true});}
  catch(_error){return false;}
}

function progressiveSliceExpiredFinal(started,budget=5){
  return performance.now()-started>=budget||progressiveInputPendingFinal();
}

/* Each source record has the same traversal weight. The per-frame caps keep
   progress visually even while still yielding immediately for user input. */
const progressiveRecordsPerFrameFinal={raw:256,decision:96,activity:12};
const progressiveVisibleRowsPerPaintFinal={raw:12,decision:8,activity:8};

function progressiveResultStatusFinal({active=false,matches=0,visible=0,index=0,total=0,selected=null,percentOverride=null,progressLabel='genomsökt'}={}){
  const matchCount=Math.max(0,Number(matches)||0),visibleCount=Math.max(0,Number(visible)||0);
  if(active){
    const calculated=total?Math.max(0,Number(index)||0)/total*100:0;
    const percent=Math.min(99,Math.floor(percentOverride===null?calculated:Math.max(0,Number(percentOverride)||0)));
    return `Visar ${fmtInt(visibleCount)} · ${percent} % ${progressLabel}`;
  }
  return `Visar ${fmtInt(matchCount?visibleCount:0)}`;
}

let decisionInitialProgressPercentFinal=0;
let decisionInitialLoadCompleteFinal=false;
let rawInitialLoadCompleteFinal=false;
let decisionActivityInitialLoadCompleteFinal=false;

const municipalDecisionTableIndexSrcFinal='data/municipal-decision-table-index.ndjson.gz?v=20260807-1';
const municipalDecisionTableIndexPartsBaseFinal='data/municipal-decision-table-index-parts';
const municipalDecisionMeetingDetailsSrcFinal='data/municipal-decision-meeting-details.js?v=20260807-1';
const decisionTableIndexBootstrapFinal=window.municipalDecisionTableBootstrap||{total:0,rows:[]};
const decisionBootstrapFilterOptionsFinal=decisionTableIndexBootstrapFinal.filterOptions||null;
const decisionAvailableDatesBeforeBootstrapFinal=decisionAvailableDates;
decisionAvailableDates=function(){
  const dates=decisionAvailableDatesBeforeBootstrapFinal();
  return dates.length?dates:[...(decisionBootstrapFilterOptionsFinal?.dates||[])];
};
const decisionTableIndexRowsFinal=[...(decisionTableIndexBootstrapFinal.rows||[])];
const decisionTableIndexBootstrapCountFinal=decisionTableIndexRowsFinal.length;
const decisionTableIndexWaitersFinal=new Set();
let decisionTableIndexPromiseFinal=null;
let decisionTableIndexStartedFinal=false;
let decisionTableIndexCompleteFinal=false;
let decisionTableIndexErrorFinal=null;
let decisionTableIndexTotalFinal=Math.max(0,Number(decisionTableIndexBootstrapFinal.total)||0);
let decisionTableIndexRevisionFinal=0;
let decisionCanonicalDetailsRequestedFinal=false;

function decisionSignalTableIndexChangeFinal(){
  decisionTableIndexRevisionFinal++;
  const waiters=[...decisionTableIndexWaitersFinal];
  decisionTableIndexWaitersFinal.clear();
  for(const resolve of waiters)resolve();
}

function decisionAwaitTableIndexChangeFinal(revision){
  if(revision!==decisionTableIndexRevisionFinal)return Promise.resolve();
  return new Promise(resolve=>decisionTableIndexWaitersFinal.add(resolve));
}

function decisionRequestCanonicalDetailsFinal(){
  decisionCanonicalDetailsRequestedFinal=true;
  decisionSignalTableIndexChangeFinal();
}

function decisionWaitForTableIndexRowsFinal(count=250,timeout=1200){
  if(decisionTableIndexRowsFinal.length>=count||decisionTableIndexCompleteFinal||decisionCanonicalDetailsRequestedFinal)return Promise.resolve();
  return new Promise(resolve=>{
    let settled=false;
    const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);decisionTableIndexWaitersFinal.delete(check);resolve();};
    const check=()=>{
      if(decisionTableIndexRowsFinal.length>=count||decisionTableIndexCompleteFinal||decisionCanonicalDetailsRequestedFinal)finish();
      else decisionTableIndexWaitersFinal.add(check);
    };
    const timer=setTimeout(finish,timeout);
    decisionTableIndexWaitersFinal.add(check);
  });
}

async function decisionReadTableIndexStreamFinal(stream){
  if(typeof DecompressionStream!=='function')throw Error('Webbläsaren saknar stöd för strömmad dekomprimering.');
  const reader=stream.pipeThrough(new DecompressionStream('gzip')).getReader();
  const decoder=new TextDecoder();
  let buffer='',parsedSinceYield=0,sourceRowIndex=0,started=performance.now();
  const consumeLine=line=>{
    if(!line)return;
    const value=JSON.parse(line);
    if(value?.type==='meta'){
      decisionTableIndexTotalFinal=Math.max(0,Number(value.total)||0);
      if(value.meetings)decisionRegisterIndexedMeetingDetailsFinal(value.meetings);
    }
    else if(sourceRowIndex++>=decisionTableIndexBootstrapCountFinal)decisionTableIndexRowsFinal.push(value);
  };
  while(true){
    const {value,done}=await reader.read();
    buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});
    let newline=buffer.indexOf('\n');
    while(newline>=0){
      consumeLine(buffer.slice(0,newline));
      buffer=buffer.slice(newline+1);
      parsedSinceYield++;
      if(parsedSinceYield===1||parsedSinceYield>=8){
        decisionSignalTableIndexChangeFinal();
        parsedSinceYield=0;
      }
      if(performance.now()-started>=4||progressiveInputPendingFinal()){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        started=performance.now();
      }
      newline=buffer.indexOf('\n');
    }
    if(done)break;
  }
  consumeLine(buffer.trim());
  decisionTableIndexCompleteFinal=true;
  if(!decisionTableIndexTotalFinal)decisionTableIndexTotalFinal=decisionTableIndexRowsFinal.length;
  decisionSignalTableIndexChangeFinal();
}

function decisionReadTableIndexFileProgressivelyFinal(){
  return (async()=>{
    const partCount=Math.max(0,Number(decisionTableIndexBootstrapFinal.partCount)||0),version=decisionTableIndexBootstrapFinal.version||'20260807-1';
    if(!partCount)throw Error('Tabellindexets lokala delar saknas.');
    await loadScriptOnce(municipalDecisionMeetingDetailsSrcFinal);
    const meetingDetails=window.municipalDecisionMeetingDetails||JSON.parse(await decodeHistoricPackText(window.municipalDecisionMeetingDetailsCompressed||''));
    decisionRegisterIndexedMeetingDetailsFinal(meetingDetails);
    delete window.municipalDecisionMeetingDetailsCompressed;
    const columns=decisionTableIndexBootstrapFinal.fields||[];
    let sourceRowIndex=0;
    for(let part=1;part<=partCount;part++){
      const partName=String(part).padStart(3,'0');
      await loadScriptOnce(`${municipalDecisionTableIndexPartsBaseFinal}/part-${partName}.js?v=${version}`);
      const rows=window.municipalDecisionTableIndexParts?.[part]||JSON.parse(await decodeHistoricPackText(window.municipalDecisionTableIndexCompressedParts?.[part]||''));
      for(let start=0;start<rows.length;start+=64){
        const end=Math.min(rows.length,start+64);
        for(let index=start;index<end;index++){
          const source=rows[index],row={};
          for(let columnIndex=0;columnIndex<source.length;columnIndex++)if(source[columnIndex]!==null)row[columns[columnIndex]]=source[columnIndex];
          if(sourceRowIndex++>=decisionTableIndexBootstrapCountFinal)decisionTableIndexRowsFinal.push(row);
        }
        decisionSignalTableIndexChangeFinal();
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
      if(window.municipalDecisionTableIndexParts)delete window.municipalDecisionTableIndexParts[part];
      if(window.municipalDecisionTableIndexCompressedParts)delete window.municipalDecisionTableIndexCompressedParts[part];
    }
    decisionTableIndexCompleteFinal=true;
    if(!decisionTableIndexTotalFinal)decisionTableIndexTotalFinal=decisionTableIndexRowsFinal.length;
    decisionSignalTableIndexChangeFinal();
  })();
}

function decisionStartTableIndexLoadFinal(){
  if(decisionTableIndexPromiseFinal)return decisionTableIndexPromiseFinal;
  decisionTableIndexStartedFinal=true;
  decisionTableIndexPromiseFinal=(async()=>{
    if(window.location.protocol==='file:')await decisionReadTableIndexFileProgressivelyFinal();
    else{
      const response=await fetch(municipalDecisionTableIndexSrcFinal);
      if(!response.ok)throw Error(`Tabellindex kunde inte läsas in (${response.status}).`);
      const stream=response.body;
      if(!stream)throw Error('Tabellindex saknar en läsbar dataström.');
      await decisionReadTableIndexStreamFinal(stream);
    }
    return true;
  })().catch(error=>{
    decisionTableIndexErrorFinal=error;
    decisionTableIndexCompleteFinal=true;
    decisionSignalTableIndexChangeFinal();
    return false;
  });
  return decisionTableIndexPromiseFinal;
}

function decisionUpdateInitialProgressFinal(percent,{matches=null,visible=null}={}){
  if(decisionInitialLoadCompleteFinal)return;
  decisionInitialProgressPercentFinal=Math.max(decisionInitialProgressPercentFinal,Math.min(99,Math.max(0,Number(percent)||0)));
}

function progressiveOverviewCardsFinal(id,entries,active=false){
  const host=$(id);
  if(!host)return;
  const signature=entries.map(([label])=>label).join('\u001f');
  if(host.dataset.progressiveLabels!==signature||host.children.length!==entries.length){
    host.dataset.progressiveLabels=signature;
    host.innerHTML=entries.map(([label,value])=>`<div class="card"><span>${esc(label)}</span><b>${esc(String(value))}</b></div>`).join('');
  }else{
    [...host.children].forEach((card,index)=>{
      const value=String(entries[index][1]),output=card.querySelector('b');
      if(output&&output.textContent!==value)output.textContent=value;
    });
  }
  host.setAttribute('aria-busy',active?'true':'false');
}

async function progressiveCooperativeSortFinal(rows,compare,job,budget=5){
  let source=[...rows],target=new Array(source.length);
  for(let width=1;width<source.length;width*=2){
    let started=performance.now();
    for(let left=0;left<source.length;left+=width*2){
      const middle=Math.min(left+width,source.length),right=Math.min(left+width*2,source.length);
      let a=left,b=middle,out=left,operations=0;
      while(a<middle||b<right){
        if(b>=right||(a<middle&&compare(source[a],source[b])<=0))target[out++]=source[a++];
        else target[out++]=source[b++];
        if((++operations&127)===0&&progressiveSliceExpiredFinal(started,budget)){
          if(!await progressiveSearchFrameFinal(job))return null;
          started=performance.now();
        }
      }
      if(progressiveSliceExpiredFinal(started,budget)){
        if(!await progressiveSearchFrameFinal(job))return null;
        started=performance.now();
      }
    }
    const swap=source;source=target;target=swap;
  }
  return source;
}

function progressiveInsertRankedFinal(rows,row,compare,limit){
  let low=0,high=rows.length;
  while(low<high){
    const middle=(low+high)>>1;
    if(compare(rows[middle],row)<=0)low=middle+1;else high=middle;
  }
  if(low<limit)rows.splice(low,0,row);
  if(rows.length>limit)rows.length=limit;
}

function progressiveNodeFromHtmlFinal(html){
  const template=document.createElement('template');
  template.innerHTML=html.trim();
  return template.content.firstElementChild;
}

function progressiveReconcileRowsFinal(body,rows,keyFor,rowHtml,{animate=true,pointerDown=false}={}){
  const wrap=body?.closest('.raw-table-wrap');
  if(!body||!wrap||pointerDown)return false;
  const current=[...body.children],desiredKeys=rows.map(row=>String(keyFor(row)));
  const isPrefix=current.length<=rows.length&&current.every((node,index)=>node.dataset.progressiveKey===desiredKeys[index]);
  if(isPrefix){
    const additions=document.createDocumentFragment();
    for(let index=current.length;index<rows.length;index++){
      const node=progressiveNodeFromHtmlFinal(rowHtml(rows[index]));
      node.dataset.progressiveKey=desiredKeys[index];
      additions.appendChild(node);
    }
    if(additions.childNodes.length)body.appendChild(additions);
    return true;
  }
  const existing=new Map(current.map(node=>[node.dataset.progressiveKey,node]));
  const previousPositions=new Map();
  if(animate&&!prefersReducedMotion?.matches&&!progressiveInputPendingFinal()){
    const wrapRect=wrap.getBoundingClientRect();
    existing.forEach((node,key)=>{
      const rect=node.getBoundingClientRect();
      if(rect.bottom>=wrapRect.top-60&&rect.top<=wrapRect.bottom+60)previousPositions.set(key,rect.top);
    });
  }
  const fragment=document.createDocumentFragment(),nodes=[];
  rows.forEach((row,index)=>{
    const key=desiredKeys[index];
    const node=existing.get(key)||progressiveNodeFromHtmlFinal(rowHtml(row));
    node.dataset.progressiveKey=key;
    nodes.push(node);
    fragment.appendChild(node);
  });
  body.replaceChildren(fragment);
  if(previousPositions.size&&!progressiveInputPendingFinal())nodes.forEach(node=>{
    const previousTop=previousPositions.get(node.dataset.progressiveKey);
    if(previousTop===undefined)return;
    const delta=previousTop-node.getBoundingClientRect().top;
    if(Math.abs(delta)<1||Math.abs(delta)>wrap.clientHeight*1.25)return;
    node.getAnimations().forEach(animation=>animation.cancel());
    node.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:120,easing:'cubic-bezier(.2,.75,.25,1)'});
  });
  return true;
}

function progressiveSearchWrapsFinal(tableIds,active){
  tableIds.forEach(id=>{
    const wrap=$(id)?.closest('.raw-table-wrap');
    if(!wrap)return;
    wrap.classList.toggle('table-progressive-loading',active);
    if(active){
      wrap.classList.remove('table-results-refreshed');
    }
  });
}

function progressiveSearchFinishFinal(key,job,inputId,tableIds){
  if(progressiveSearchJobsFinal.get(key)!==job)return;
  progressiveSearchJobsFinal.delete(key);
  setTableSearchBusy(inputId,tableIds,false);
  progressiveSearchWrapsFinal(tableIds,false);
  tableIds.forEach(id=>{
    const wrap=$(id)?.closest('.raw-table-wrap');
    if(!wrap)return;
    wrap.classList.remove('table-results-refreshed');
  });
}

scheduleTableSearch=function(key,inputId,tableIds,render){
  const handler=progressiveSearchHandlersFinal.get(key);
  if(!handler)return scheduleTableSearchBeforeProgressiveFinal(key,inputId,tableIds,render);
  const previous=progressiveSearchJobsFinal.get(key);
  if(previous){
    previous.cancelled=true;
    if(previous.frame)cancelAnimationFrame(previous.frame);
  }
  const job={cancelled:false,frame:0};
  progressiveSearchJobsFinal.set(key,job);
  setTableSearchBusy(inputId,tableIds,true);
  progressiveSearchWrapsFinal(tableIds,true);
  job.frame=requestAnimationFrame(()=>{
    if(job.cancelled)return;
    job.frame=requestAnimationFrame(async()=>{
      if(job.cancelled)return;
      try{
        await handler(job,render);
      }catch(error){
        if(!job.cancelled){
          console.error(error);
          render();
        }
      }finally{
        progressiveSearchFinishFinal(key,job,inputId,tableIds);
      }
    });
  });
};

/* A short input debounce must be able to stop an obsolete municipal scan
   immediately, while leaving the current rows still until its replacement
   begins. */
function decisionCancelProgressiveSearchForTypingFinal(){
  const job=progressiveSearchJobsFinal.get('decision');
  if(!job)return;
  job.cancelled=true;
  if(job.frame)cancelAnimationFrame(job.frame);
  progressiveSearchJobsFinal.delete('decision');
}

/* Historical election data: scan the 59,000-row dataset in short slices. */
const filteredRawRowsBeforeProgressiveFinal=filteredRawRows;
let rawProgressiveSearchStateFinal=null;
let rawProgressivePointerDownFinal=false;

function rawOverviewAccumulatorFinal(){
  return {rows:0,groups:new Set(),totalVotesCast:0,validVotesCast:0,totalEligibleVoters:0,eligibleVotes:0,ineligibleVotes:0,firstParticipation:0};
}

function rawOverviewCollectFinal(summary,row){
  const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;};
  summary.rows++;
  const votes=number(rawValue(row,'votes'));
  if(isRawInvalidVoteRow(row))summary.ineligibleVotes+=votes;else summary.eligibleVotes+=votes;
  const key=[rawComparable(row,'year'),rawComparable(row,'election_type'),rawComparable(row,'county_name'),rawComparable(row,'municipality_name')].join('|');
  if(summary.groups.has(key))return;
  summary.groups.add(key);
  if(summary.groups.size===1)summary.firstParticipation=number(row.election_participation_percent);
  summary.totalVotesCast+=number(row.total_votes_cast);
  summary.validVotesCast+=number(row.valid_votes_cast);
  summary.totalEligibleVoters+=number(row.total_eligible_voters);
}

function rawOverviewEntriesFinal(summary,active=false){
  const validTotal=summary.validVotesCast||summary.eligibleVotes;
  const invalidTotal=summary.totalVotesCast&&summary.validVotesCast?Math.max(0,summary.totalVotesCast-summary.validVotesCast):summary.ineligibleVotes;
  const participation=summary.totalEligibleVoters>0?summary.totalVotesCast/summary.totalEligibleVoters*100:summary.firstParticipation;
  return [
    ['Totalt röstberättigade',fmtInt(summary.totalEligibleVoters)],
    ['Avgivna röster',fmtInt(summary.totalVotesCast)],
    ['Giltiga röster',fmtInt(validTotal)],
    ['Ogiltiga röster',fmtInt(invalidTotal)],
    ['Valdeltagande',participation?participation.toFixed(2)+'%':active?'0.00%':'—']
  ];
}

function rawProgressiveSearchKeyFinal(){
  return JSON.stringify([
    fuzzySearchNormalize($('rawSearch')?.value||''),
    ...['rawYear','rawElection','rawCounty','rawMunicipality','rawParty'].map(id=>selectedRawValues(id))
  ]);
}

filteredRawRows=function(){
  const state=rawProgressiveSearchStateFinal;
  if(state&&state.key===rawProgressiveSearchKeyFinal())return state.visibleRows;
  return filteredRawRowsBeforeProgressiveFinal();
};

function rawProgressivePredicateFinal(row,filters,query){
  if(filters.years.length&&!filters.years.includes(String(rawComparable(row,'year'))))return false;
  if(filters.elections.length&&!filters.elections.includes(rawComparable(row,'election_type')))return false;
  if(filters.counties.length&&!filters.counties.includes(rawComparable(row,'county_name')))return false;
  if(filters.municipalities.length&&!filters.municipalities.includes(rawComparable(row,'municipality_name')))return false;
  if(filters.parties.length&&!filters.parties.includes(rawComparable(row,'party_standard')))return false;
  if(!query)return true;
  const text=row.__searchText||(row.__searchText=rawColumns.map(column=>rawDisplay(column,rawValue(row,column))).join(' '));
  return fuzzySearchTextMatches(text,query);
}

function rawProgressivePaintFinal(state,complete=false){
  if(rawProgressiveSearchStateFinal!==state)return;
  if(rawProgressivePointerDownFinal){state.paintPending=true;state.complete=complete;return;}
  state.visibleRows=state.matches;
  state.complete=complete;
  if(!complete){
    const eligibleTarget=state.previewEligible.length,ineligibleTarget=state.previewIneligible.length;
    state.revealEligible=Math.min(state.revealEligible,eligibleTarget);
    state.revealIneligible=Math.min(state.revealIneligible,ineligibleTarget);
    let budget=progressiveVisibleRowsPerPaintFinal.raw;
    if(state.revealEligible<eligibleTarget&&state.revealIneligible<ineligibleTarget){
      const eligibleBudget=Math.ceil(budget/2),ineligibleBudget=budget-eligibleBudget;
      const eligibleAdded=Math.min(eligibleBudget,eligibleTarget-state.revealEligible),ineligibleAdded=Math.min(ineligibleBudget,ineligibleTarget-state.revealIneligible);
      state.revealEligible+=eligibleAdded;state.revealIneligible+=ineligibleAdded;budget-=eligibleAdded+ineligibleAdded;
    }
    if(budget&&state.revealEligible<eligibleTarget){const added=Math.min(budget,eligibleTarget-state.revealEligible);state.revealEligible+=added;budget-=added;}
    if(budget&&state.revealIneligible<ineligibleTarget)state.revealIneligible+=Math.min(budget,ineligibleTarget-state.revealIneligible);
  }
  if(currentTopView()!=='raw')return;
  rawStableRenderRowsFinal(complete?state.sortedRows:state.previewEligible.slice(0,state.revealEligible),complete?null:state.previewIneligible.slice(0,state.revealIneligible),{complete,state});
  if(complete)return;
  $('rawCount').textContent=progressiveResultStatusFinal({active:true,matches:state.matches.length,visible:state.revealEligible+state.revealIneligible,index:state.index,total:state.total,progressLabel:state.initialLoad?'inläst':'genomsökt'});
}

async function rawBuildFinalPresentationFinal(state,job){
  const eligible=[],ineligible=[],groups=new Map();
  let eligibleVotes=0,ineligibleVotes=0,index=0,started=performance.now();
  const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;};
  while(index<state.sortedRows.length&&!job.cancelled){
    const row=state.sortedRows[index++],votes=Number(rawValue(row,'votes'))||0;
    if(isRawInvalidVoteRow(row)){ineligible.push(row);ineligibleVotes+=votes;}
    else{eligible.push(row);eligibleVotes+=votes;}
    const key=[rawComparable(row,'year'),rawComparable(row,'election_type'),rawComparable(row,'county_name'),rawComparable(row,'municipality_name')].join('|');
    if(!groups.has(key))groups.set(key,{totalVotesCast:number(row.total_votes_cast),validVotesCast:number(row.valid_votes_cast),totalEligibleVoters:number(row.total_eligible_voters),participation:number(row.election_participation_percent)});
    if(progressiveSliceExpiredFinal(started,3)){
      if(!await progressiveSearchFrameFinal(job))return null;
      started=performance.now();
    }
  }
  let totalVotesCast=0,validVotesCast=0,totalEligibleVoters=0,firstParticipation=0,groupIndex=0;
  for(const meta of groups.values()){
    if(groupIndex++===0)firstParticipation=meta.participation||0;
    totalVotesCast+=meta.totalVotesCast;validVotesCast+=meta.validVotesCast;totalEligibleVoters+=meta.totalEligibleVoters;
    if(progressiveSliceExpiredFinal(started,3)){
      if(!await progressiveSearchFrameFinal(job))return null;
      started=performance.now();
    }
  }
  return {eligible,ineligible,eligibleVotes,ineligibleVotes,meta:{totalVotesCast,validVotesCast,totalEligibleVoters,participation:totalEligibleVoters>0?totalVotesCast/totalEligibleVoters*100:firstParticipation}};
}

async function rawFinalizeProgressiveStateFinal(state,job){
  state.sortedRows=await progressiveCooperativeSortFinal(state.matches,rawProgressiveCompareFinal,job,5);
  if(job.cancelled||!state.sortedRows)return false;
  state.finalPresentation=await rawBuildFinalPresentationFinal(state,job);
  if(job.cancelled||!state.finalPresentation)return false;
  state.previewEligible=state.finalPresentation.eligible.slice(0,rawVisibleCount(rawEligiblePage,state.finalPresentation.eligible.length));
  state.previewIneligible=state.finalPresentation.ineligible.slice(0,rawVisibleCount(rawIneligiblePage,state.finalPresentation.ineligible.length));
  while(rawProgressiveSearchStateFinal===state&&!job.cancelled&&(state.revealEligible<state.previewEligible.length||state.revealIneligible<state.previewIneligible.length)){
    rawProgressivePaintFinal(state,false);
    if(!await progressiveVisualFrameFinal(job))return false;
  }
  if(rawProgressiveSearchStateFinal!==state||job.cancelled)return false;
  if(state.initialLoad)rawInitialLoadCompleteFinal=true;
  rawProgressivePaintFinal(state,true);
  return true;
}

progressiveSearchHandlersFinal.set('raw',async job=>{
  const filters={
    years:selectedRawValues('rawYear'),
    elections:selectedRawValues('rawElection'),
    counties:selectedRawValues('rawCounty'),
    municipalities:selectedRawValues('rawMunicipality'),
    parties:selectedRawValues('rawParty')
  };
  const query=fuzzySearchNormalize($('rawSearch')?.value||'');
  const filterAccumulator=rawFilterOptionCacheFinal?null:rawFilterAccumulatorFinal();
  const state={key:rawProgressiveSearchKeyFinal(),matches:[],visibleRows:[],previewEligible:[],previewIneligible:[],sortedRows:[],summary:rawOverviewAccumulatorFinal(),index:0,total:rawRows.length,initialLoad:!rawInitialLoadCompleteFinal,hasPainted:false,pointerDown:false,paintPending:false,revealEligible:0,revealIneligible:0};
  rawProgressiveSearchStateFinal=state;
  rawProgressivePaintFinal(state);
  let lastPaint=performance.now(),lastPaintCount=0;
  while(state.index<state.total&&!job.cancelled){
    const sliceStarted=performance.now();let traversed=0;
    do{
      const row=rawRows[state.index++];
      traversed++;
      if(filterAccumulator)rawCollectFilterOptionFinal(filterAccumulator,row);
      if(rawProgressivePredicateFinal(row,filters,query)){
        state.matches.push(row);
        rawOverviewCollectFinal(state.summary,row);
        const preview=isRawInvalidVoteRow(row)?state.previewIneligible:state.previewEligible;
        progressiveInsertRankedFinal(preview,row,rawProgressiveCompareFinal,rawPageSize());
      }
    }while(state.index<state.total&&traversed<progressiveRecordsPerFrameFinal.raw&&!progressiveSliceExpiredFinal(sliceStarted,4));
    const now=performance.now();
    if(state.matches.length!==lastPaintCount&&(!state.hasPainted||now-lastPaint>=48||state.index===state.total)){
      rawProgressivePaintFinal(state);
      lastPaint=now;
      lastPaintCount=state.matches.length;
    }else if(currentTopView()==='raw'){
      $('rawCount').textContent=progressiveResultStatusFinal({active:true,matches:state.matches.length,visible:state.revealEligible+state.revealIneligible,index:state.index,total:state.total,progressLabel:state.initialLoad?'inläst':'genomsökt'});
    }
    if(!await progressiveVisualFrameFinal(job))return;
  }
  if(job.cancelled)return;
  if(filterAccumulator){
    rawFilterOptionCacheFinal=rawFinalizeFilterOptionsFinal(filterAccumulator);
    const keyBefore=state.key;
    buildRawFilters();
    if(keyBefore!==rawProgressiveSearchKeyFinal()){
      rawScheduleProgressiveFinal();
      return;
    }
  }
  await rawFinalizeProgressiveStateFinal(state,job);
});

/* Municipal decisions: build the fuzzy-match set incrementally, then let the
   existing filters, vote aggregation, relevance sort, and row renderer use it. */
const decisionPointSearchMatchesBeforeProgressiveFinal=decisionPointSearchMatches;
let decisionProgressiveSearchStateFinal=null;

function decisionProgressiveSearchKeyFinal(){
  return decisionSearchNormalizeFinal(decisionSearchQuery);
}

decisionPointSearchMatches=function(row){
  const state=decisionProgressiveSearchStateFinal;
  if(state?.complete&&state.key===decisionProgressiveSearchKeyFinal())return state.matches.has(row);
  return decisionPointSearchMatchesBeforeProgressiveFinal(row);
};

/* Municipal documents are smaller, so compute the exact set once and reveal
   it over consecutive frames. */
const filteredDecisionActivityRowsBeforeProgressiveFinal=filteredDecisionActivityRows;
let decisionActivityProgressiveSearchStateFinal=null;
let decisionActivityProgressivePointerDownFinal=false;

function decisionActivityProgressiveSearchKeyFinal(){
  return JSON.stringify([
    decisionSearchNormalizeFinal(decisionActivitySearchQuery),
    decisionActivityDateRanges,
    ...['type','party','politicalOwner','officialOwner'].map(key=>selectedActivityValues(key))
  ]);
}

filteredDecisionActivityRows=function(){
  const state=decisionActivityProgressiveSearchStateFinal;
  if(state&&state.key===decisionActivityProgressiveSearchKeyFinal())return state.visibleRows;
  return filteredDecisionActivityRowsBeforeProgressiveFinal();
};

function decisionActivitySummaryAccumulatorFinal(){
  return {documents:0,types:new Set(),dated:0,withSummary:0};
}

function decisionActivitySummaryCollectFinal(summary,row){
  summary.documents++;
  if(row.type)summary.types.add(row.type);
  if(row.dateSort)summary.dated++;
  if(row.summary)summary.withSummary++;
}

function decisionActivitySummaryEntriesFinal(summary){
  return [
    ['Dokument',fmtInt(summary.documents)],
    ['Dokumenttyper',fmtInt(summary.types.size)],
    ['Daterade',fmtInt(summary.dated)],
    ['Med sammanfattning',fmtInt(summary.withSummary)]
  ];
}

progressiveSearchHandlersFinal.set('decision-activity',async job=>{
  ensureMunicipalDocumentData();
  const query=decisionSearchNormalizeFinal(decisionActivitySearchQuery);
  const filters={
    types:selectedActivityValues('type'),
    parties:selectedActivityValues('party'),
    politicalOwners:selectedActivityValues('politicalOwner'),
    officialOwners:selectedActivityValues('officialOwner')
  };
  const compare=(a,b)=>{
    if(query){
      const relevance=decisionActivitySearchRelevanceFinal(b,query)-decisionActivitySearchRelevanceFinal(a,query);
      if(relevance)return relevance;
    }
    return decisionActivitySortCompare(a,b);
  };
  const state={key:decisionActivityProgressiveSearchKeyFinal(),matches:[],visibleRows:[],previewRows:[],sortedRows:[],summary:decisionActivitySummaryAccumulatorFinal(),index:0,total:decisionActivityRows.length,initialLoad:!decisionActivityInitialLoadCompleteFinal,hasPainted:false,pointerDown:false,paintPending:false,revealCount:0};
  decisionActivityProgressiveSearchStateFinal=state;
  decisionActivityProgressivePaintFinal(state,false);
  let lastPaint=performance.now(),lastPaintCount=0;
  while(state.index<state.total&&!job.cancelled){
    const started=performance.now();let traversed=0;
    do{
      const row=decisionActivityRows[state.index++];
      traversed++;
      if(!decisionActivityIncludedByDate(row)||filters.types.length&&!filters.types.includes(row.type)||filters.parties.length&&!filters.parties.includes(row.party)||filters.politicalOwners.length&&!filters.politicalOwners.includes(row.politicalOwner)||filters.officialOwners.length&&!filters.officialOwners.includes(row.officialOwner))continue;
      if(query&&decisionActivitySearchRelevanceFinal(row,query)<=0)continue;
      state.matches.push(row);
      decisionActivitySummaryCollectFinal(state.summary,row);
      progressiveInsertRankedFinal(state.previewRows,row,compare,decisionVisibleCount(0,Number.MAX_SAFE_INTEGER));
    }while(state.index<state.total&&traversed<progressiveRecordsPerFrameFinal.activity&&!progressiveSliceExpiredFinal(started,4));
    const now=performance.now();
    if(state.matches.length!==lastPaintCount&&(lastPaintCount===0||!state.hasPainted||now-lastPaint>=32||state.index===state.total)){
      decisionActivityProgressivePaintFinal(state,false);
      lastPaint=now;
      lastPaintCount=state.matches.length;
    }else if(decisionActivityProgressiveSearchStateFinal===state&&currentTopView()==='decisionActivity'){
      $('decisionActivityStatus').textContent=progressiveResultStatusFinal({active:true,matches:state.matches.length,visible:$('decisionActivityBody')?.children.length||0,index:state.index,total:state.total,progressLabel:state.initialLoad?'inläst':'genomsökt'});
    }
    if(!await progressiveVisualFrameFinal(job))return;
  }
  if(job.cancelled)return;
  state.sortedRows=await progressiveCooperativeSortFinal(state.matches,compare,job,5);
  if(job.cancelled||!state.sortedRows)return;
  state.visibleRows=state.matches;
  state.previewRows=state.sortedRows.slice(0,decisionVisibleCount(0,state.sortedRows.length));
  const finalVisibleCount=decisionVisibleCount((decisionActivityTabs[0]||{page:0}).page||0,state.sortedRows.length);
  while(decisionActivityProgressiveSearchStateFinal===state&&!job.cancelled&&state.revealCount<finalVisibleCount){
    decisionActivityProgressivePaintFinal(state,false);
    if(!await progressiveVisualFrameFinal(job))return;
  }
  if(decisionActivityProgressiveSearchStateFinal!==state||job.cancelled)return;
  if(state.initialLoad)decisionActivityInitialLoadCompleteFinal=true;
  decisionActivityProgressivePaintFinal(state,true);
});

/* Reuse one municipal-data preparation job. The app preloads this data in the
   background, and an opened/restored detail tab may request it at the same time. */
const ensureDecisionDataProgressivelyBeforeSingleFlightFinal=ensureDecisionDataProgressively;
let decisionDataProgressivePromiseFinal=null;
ensureDecisionDataProgressively=function(){
  if(decisionReady)return Promise.resolve();
  if(decisionDataProgressivePromiseFinal)return decisionDataProgressivePromiseFinal;
  decisionDataProgressivePromiseFinal=Promise.resolve(ensureDecisionDataProgressivelyBeforeSingleFlightFinal())
    .finally(()=>{decisionDataProgressivePromiseFinal=null;});
  return decisionDataProgressivePromiseFinal;
};

/* List-level counters and loading text do not belong to an opened detail tab. */
function syncDecisionListDetailChromeFinal(){
  const detail=decisionActiveTabState()?.kind==='decision'&&!$('decisionDetailPane')?.hidden;
  const overview=$('decisionOverview');
  const toolbar=$('decisionPage')?.closest('.decision-toolbar');
  const status=$('decisionStatus');
  if(overview)overview.hidden=detail;
  if(toolbar)toolbar.hidden=detail;
  if(detail&&status)status.hidden=true;
}

const renderDecisionViewBeforeListDetailChromeFinal=renderDecisionView;
renderDecisionView=function(){
  const result=renderDecisionViewBeforeListDetailChromeFinal();
  syncDecisionListDetailChromeFinal();
  return result;
};

/* Keep the municipal result table stable while searching and while revealing
   more rows. Partial search paints and infinite loading append rows without
   recreating rows that are already clickable. */
const decisionStableSearchDocumentCacheFinal=new WeakMap();
const decisionStableSearchScoreCacheFinal=new WeakMap();
const decisionStableQuickSearchCacheFinal=new WeakMap();
let decisionStableListRenderFinal=null;
let decisionSearchWarmIndexFinal=0;
let decisionSearchWarmScheduledFinal=false;

function decisionStableSearchDocumentFinal(row){
  let cached=decisionStableSearchDocumentCacheFinal.get(row);
  if(cached)return cached;
  const meetingText=row?.isMeeting&&typeof decisionMeetingSearchTextOnDemandFinal==='function'
    ?decisionMeetingSearchTextOnDemandFinal(row)
    :row?.meetingSearchText;
  const normalizedText=row?.isMeeting&&meetingText
    ?meetingText
    :decisionSearchNormalizeFinal([
      row.title,row.point,row.description,row.body,row.diary,row.caseNumber,row.documentTitle,
      row.protocolHeader,row.abstractText,row.fullDecisionText,row.result,row.proposalType,row.meetingSearchText
    ].join(' '));
  const text=fuzzySearchNormalize(normalizedText);
  cached={text,tokenData:null,fields:null,meetingText};
  decisionStableSearchDocumentCacheFinal.set(row,cached);
  return cached;
}

function decisionStableQuickSearchTextFinal(row){
  let text=decisionStableQuickSearchCacheFinal.get(row);
  if(text!==undefined)return text;
  text=fuzzySearchNormalize(decisionSearchNormalizeFinal([
    row.title,row.point,row.body,row.diary,row.caseNumber,row.documentTitle,
    row.protocolHeader,row.result,row.proposalType
  ].join(' ')));
  decisionStableQuickSearchCacheFinal.set(row,text);
  return text;
}

function decisionStableSearchFieldsFinal(row,cached){
  if(cached.fields)return cached.fields;
  const matterTitle=row?.isMeeting
    ?[row.title,row.protocolHeader,row.documentTitle].join(' ')
    :[
      typeof decisionMainMatterLabelFinal==='function'?decisionMainMatterLabelFinal(row):'',
      row.protocolHeader,row.pointTitle,row.title,row.documentTitle
    ].join(' ');
  cached.fields=[
    [matterTitle,12],
    [[row.point,row.diary,row.caseNumber].join(' '),7],
    [[row.body,row.result,row.proposalType].join(' '),4],
    [[row.description,row.abstractText].join(' '),2.5],
    [row.fullDecisionText,1.5],
    [cached.meetingText,row?.isMeeting?1:1.5]
  ].map(([value,weight])=>{
    const text=fuzzySearchNormalize(value);
    return [text,weight,[...new Set(text.split(' ').filter(Boolean))]];
  });
  return cached.fields;
}

function decisionStableTokenDataFinal(cached){
  if(cached.tokenData)return cached.tokenData;
  const tokens=[...new Set(cached.text.split(' ').filter(token=>token.length>=3))];
  const byLength=new Map(),prefix5=new Set(),shortPrefix5=new Set(),prefix6=new Set();
  for(const token of tokens){
    if(!byLength.has(token.length))byLength.set(token.length,[]);
    byLength.get(token.length).push(token);
    if(token.length>=6){
      prefix5.add(token.slice(0,5));
      if(token.length<10)shortPrefix5.add(token.slice(0,5));
    }
    if(token.length>=10)prefix6.add(token.slice(0,6));
  }
  cached.tokenData={byLength,prefix5,shortPrefix5,prefix6};
  return cached.tokenData;
}

function decisionStableSearchMatchesFinal(row,normalizedQuery){
  normalizedQuery=fuzzySearchNormalize(normalizedQuery);
  if(!normalizedQuery)return true;
  const cached=decisionStableSearchDocumentFinal(row);
  if(cached.text.includes(normalizedQuery))return true;
  const queryTokens=normalizedQuery.split(' ').filter(token=>token.length>=3);
  if(!queryTokens.length||queryTokens.length>6)return false;
  const {byLength,prefix5,shortPrefix5,prefix6}=decisionStableTokenDataFinal(cached);
  return queryTokens.every(queryToken=>{
    if(cached.text.includes(queryToken))return true;
    if(queryToken.length>=6){
      if(queryToken.length<10&&prefix5.has(queryToken.slice(0,5)))return true;
      if(queryToken.length>=10&&(prefix6.has(queryToken.slice(0,6))||shortPrefix5.has(queryToken.slice(0,5))))return true;
    }
    if(queryToken.length<4)return false;
    const max=queryToken.length>=8?2:1;
    for(let length=Math.max(4,queryToken.length-max);length<=queryToken.length+max;length++){
      for(const textToken of byLength.get(length)||[]){
        if(queryToken[0]!==textToken[0]&&queryToken[queryToken.length-1]!==textToken[textToken.length-1])continue;
        if(fuzzySearchDistanceWithin(queryToken,textToken,max))return true;
      }
    }
    return false;
  });
}

function decisionStableFieldScoreFinal(text,textTokens,normalizedQuery){
  if(!normalizedQuery||!text)return 0;
  if(text===normalizedQuery)return 1000;
  const queryTokens=normalizedQuery.split(' ').filter(Boolean);
  if(!queryTokens.length||queryTokens.length>6)return text.includes(normalizedQuery)?700:0;
  const phraseIndex=text.indexOf(normalizedQuery);
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

decisionPointSearchRelevanceFinal=function(row,query=decisionSearchQuery){
  const normalizedQuery=fuzzySearchNormalize(decisionSearchNormalizeFinal(query));
  if(!normalizedQuery)return 0;
  const cachedScore=decisionStableSearchScoreCacheFinal.get(row);
  if(cachedScore?.query===normalizedQuery)return cachedScore.score;
  let best=0,support=0;
  const cached=decisionStableSearchDocumentFinal(row);
  for(const [text,weight,textTokens] of decisionStableSearchFieldsFinal(row,cached)){
    const weighted=decisionStableFieldScoreFinal(text,textTokens,normalizedQuery)*weight;
    if(weighted>best){support+=best;best=weighted;}
    else support+=weighted;
  }
  const score=best+Math.min(support*.08,250);
  decisionStableSearchScoreCacheFinal.set(row,{query:normalizedQuery,score});
  return score;
};

function decisionScheduleSearchWarmFinal(){
  if(decisionSearchWarmScheduledFinal||!decisionReady||decisionSearchWarmIndexFinal>=decisionAllPointRows.length)return;
  decisionSearchWarmScheduledFinal=true;
  const run=deadline=>{
    decisionSearchWarmScheduledFinal=false;
    if(progressiveSearchJobsFinal.has('decision')){
      decisionScheduleSearchWarmFinal();
      return;
    }
    const started=performance.now();
    while(decisionSearchWarmIndexFinal<decisionAllPointRows.length){
      decisionStableQuickSearchTextFinal(decisionAllPointRows[decisionSearchWarmIndexFinal++]);
      if(deadline?.timeRemaining&&deadline.timeRemaining()<2)break;
      if(performance.now()-started>=6)break;
    }
    if(decisionSearchWarmIndexFinal<decisionAllPointRows.length)decisionScheduleSearchWarmFinal();
  };
  if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:500});
  else setTimeout(()=>run(null),16);
}

const ensureDecisionDataProgressivelyBeforeSearchWarmFinal=ensureDecisionDataProgressivelyBeforeMeetingRows;
let decisionCooperativePreparationPromiseFinal=null;

async function decisionBuildPersonIndexCooperativelyFinal(job){
  if(decisionPersonIndex||!decisionPack)return;
  const records=[],docs=decisionPack.d||[];
  const add=(name,party,body)=>{
    const partyKey=municipalNorm(party),clean=decisionPersonAliases.get(`${partyKey}|${decisionPersonNorm(name)}`)||decisionPersonCleanName(name);
    if(clean)records.push({name:clean,party:partyKey,body:municipalNorm(body),norm:decisionPersonNorm(clean),fold:decisionPersonFold(clean),identity:decisionPersonIdentity(clean)});
  };
  let started=performance.now();
  for(let index=0;index<(decisionPack.mr||[]).length;index+=6){
    add(decisionPack.mr[index+3],decisionPack.mr[index+4],decisionPack.mr[index+1]);
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  for(let index=0;index<(decisionPack.r||[]).length;index+=6){
    const doc=docs[Number(decisionPack.r[index])]||{};add(decisionPack.r[index+2],decisionPack.r[index+3],doc.b);
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  for(let index=0;index<(decisionPack.pr||[]).length;index+=6){
    const doc=docs[Number(decisionPack.pr[index])]||{};add(decisionPack.pr[index+2],decisionPack.pr[index+3],doc.b);
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  const namesByParty=new Map(),aliases=new Map();
  for(const record of records){
    if(record.party&&record.name&&record.fold&&record.fold.split(' ').length>=2){
      if(!namesByParty.has(record.party))namesByParty.set(record.party,new Map());
      const names=namesByParty.get(record.party);
      if(!names.has(record.fold))names.set(record.fold,{...record,count:0});
      names.get(record.fold).count++;
    }
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  for(const [party,names] of namesByParty){
    const partyRecords=[...names.values()];
    for(let leftIndex=0;leftIndex<partyRecords.length;leftIndex++){
      for(let rightIndex=leftIndex+1;rightIndex<partyRecords.length;rightIndex++){
        const left=partyRecords[leftIndex],right=partyRecords[rightIndex];
        if(decisionPersonEditDistanceOneOrLess(left.fold,right.fold)){
          const canonical=left.count!==right.count?(left.count>right.count?left.name:right.name):decisionPersonPreferredName(left.name,right.name);
          aliases.set(`${party}|${left.fold}`,canonical);aliases.set(`${party}|${right.fold}`,canonical);
        }
        if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
      }
    }
  }
  decisionAutoPersonAliases=aliases;
  for(const record of records){
    record.name=decisionPersonCanonicalName(record.name,record.party);record.norm=decisionPersonNorm(record.name);record.fold=decisionPersonFold(record.name);record.identity=decisionPersonIdentity(record.name);
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  const canonical=new Map(),byPartySurname=new Map(),byContextSurname=new Map();
  const addCandidate=(index,key,identity)=>{if(!index.has(key))index.set(key,new Set());index.get(key).add(identity);};
  for(const record of records){
    if(record.identity){
      const key=`${record.party}|${record.identity}`,last=record.identity.split('|').at(-1),current=canonical.get(key);
      if(!current)canonical.set(key,{name:record.name,count:1});
      else{current.count++;if(record.name.length>current.name.length||(record.name.length===current.name.length&&record.name.localeCompare(current.name,'sv',{sensitivity:'base'})<0))current.name=record.name;}
      addCandidate(byPartySurname,`${record.party}|${last}`,record.identity);addCandidate(byContextSurname,`${record.party}|${record.body}|${last}`,record.identity);
    }
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  const resolve=(record,contextual)=>{
    const tokens=record.norm.split(' ').filter(Boolean),last=tokens.at(-1);if(!last)return '';
    const local=contextual?byContextSurname.get(`${record.party}|${record.body}|${last}`):null;
    let identities=[...(local?.size?local:(byPartySurname.get(`${record.party}|${last}`)||new Set()))];
    if(tokens.length>1){const first=tokens[0],firstMatches=identities.filter(identity=>identity.split('|')[0]===first);if(firstMatches.length)identities=firstMatches;}
    if(identities.length!==1)return '';
    return canonical.get(`${record.party}|${identities[0]}`)?.name||'';
  };
  const byContext=new Map(),byParty=new Map();
  for(const record of records){
    const resolved=resolve(record,true)||resolve(record,false)||record.name;
    byContext.set(`${record.party}|${record.body}|${record.norm}`,resolved);
    const key=`${record.party}|${record.norm}`,existing=byParty.get(key);
    if(!existing)byParty.set(key,resolved);else if(existing!==resolved)byParty.set(key,'');
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  decisionPersonIndex={byContext,byParty};
}

async function decisionHydrateMeetingFieldsCooperativelyFinal(job){
  const packedRows=Array.isArray(decisionPack?.mr)?decisionPack.mr:[],members=[];
  let started=performance.now();
  for(let index=0;index<packedRows.length;index+=6){
    const date=String(packedRows[index]??''),body=String(packedRows[index+1]??''),documentTitle=String(packedRows[index+2]??''),name=String(packedRows[index+3]??''),party=String(packedRows[index+4]??''),role=String(packedRows[index+5]??'');
    if(date&&body&&documentTitle&&name)members.push({date,body,documentTitle,name,party,role,memberKey:decisionMemberKey(name,party,body),attendanceKey:decisionAttendanceKey(date,body,documentTitle)});
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  decisionMemberRows=members;
  const docs=decisionPack?.d||[];
  for(const row of decisionAllPointRows){
    const doc=docs[row.docIndex]||{};row.attendanceKey=decisionAttendanceKey(row.date||doc.dt,row.body||doc.b,row.documentTitle||doc.doc);
    if(!row.isMeeting){
      const point=String(row.point||''),voteId=String(doc.v?.[point]||doc.v?.[row.point]||row.voteId||''),voteIds=decisionSplitVoteIds(voteId);
      row.voteId=voteId;row.voteIds=voteIds;row.voteEvents=Object.fromEntries(voteIds.map(eventId=>[eventId,doc.ve?.[eventId]||{}]));
    }
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
}

async function decisionPreparePositionsCooperativelyFinal(job){
  if(decisionPack?._v2PositionsReady)return;
  const docs=decisionPack?.d||[],packedRows=Array.isArray(decisionPack?.pr)?decisionPack.pr:[],positions=[];
  let started=performance.now();
  for(let index=0;index<packedRows.length;index+=6){
    const docIndex=Number(packedRows[index]),point=String(packedRows[index+1]??''),name=String(packedRows[index+2]??''),party=String(packedRows[index+3]??''),vote=String(packedRows[index+4]??''),proposalId=String(packedRows[index+5]??''),doc=docs[docIndex]||{};
    positions.push({docIndex,id:String(doc.i||`d${docIndex}`),date:String(doc.dt||''),title:String(doc.t||''),point,name,party,vote,intressentId:proposalId,url:String(doc.u||''),body:String(doc.b||''),documentTitle:String(doc.doc||''),attendanceKey:decisionAttendanceKey(doc.dt,doc.b,doc.doc),sourceKind:'yrkande'});
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  decisionPositionRows=positions;
  for(const row of decisionAllPointRows){
    const doc=docs[row.docIndex]||{},meta=doc.pm?.[String(row.point)]||{};
    row.decisionLevel=String(meta.decision_level||'');row.matterOutcome=String(meta.matter_outcome||doc.mo||'');row.confidence=String(meta.confidence||doc.cf||'');row.matterId=String(meta.matter_id||doc.mi||'');row.sourcePage=Number(meta.source_page)||0;row.sourcePageEnd=Number(meta.source_page_end)||0;
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  decisionPack._v2PositionsReady=true;
}

async function decisionHydrateDecoratorsCooperativelyFinal(job){
  const docs=decisionPack?.d||[];
  let started=performance.now();
  for(const row of decisionAllPointRows){
    const doc=docs[row.docIndex]||{},meta=doc.pm?.[String(row.point)]||{};
    row.decisionLevel=String(meta.decision_level||'');row.matterOutcome=String(meta.matter_outcome||doc.mo||'');row.confidence=String(meta.confidence||doc.cf||'');row.matterId=String(meta.matter_id||doc.mi||'');
    row.sourcePage=Number(meta.source_page)||0;row.sourcePageEnd=Number(meta.source_page_end)||0;row.sourceTop=Number(meta.source_top??meta.source_y??meta.target_top??meta.target_y);
    if(meta.source_url)row.sourceUrl=String(meta.source_url);if(meta.local_path)row.localPath=String(meta.local_path);
    row.abstractText=String(doc.ad||'');row.fullDecisionText=String(doc.bd||'');row.protocolHeader=String(doc.ht||'');
    row.extractionStatus=String(meta.extraction_status||'formal_decision');row.decisionStage=String(meta.decision_stage||'');row.decisionDisposition=String(meta.decision_disposition||'');row.matterTypeState=String(meta.matter_type_state||'');
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  for(const row of decisionPositionRows){
    const doc=docs[row.docIndex]||{},key=`${row.point}|${row.name}|${row.party}|${row.vote}`;row.positionText=String(doc.yp?.[key]||'');
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  Object.assign(decisionPack,{
    _finalSourceMetaReady:true,_finalSourceMetaReadyEof:true,_finalTextSectionsReady:true,
    _nestedYrkandeTextReadyFinal:true,_detailPipelineReady:true
  });
  const basicDocuments=municipalDocumentActivityRowsFinal();
  if(basicDocuments.length)decisionActivityRows=basicDocuments;
  await progressiveSearchFrameFinal(job);
  const enrichedDocuments=municipalDocumentActivityRowsEnrichedFinal();
  if(enrichedDocuments.length)decisionActivityRows=enrichedDocuments;
  await progressiveSearchFrameFinal(job);
  decisionReconcileFinalResults();
  await progressiveSearchFrameFinal(job);
}

async function decisionBuildMeetingRowsCooperativelyFinal(job){
  if(decisionPack?._meetingRowsReady)return;
  const attendanceCountByKey=new Map(),byMeeting=new Map();
  let started=performance.now();
  for(const member of decisionMemberRows){
    attendanceCountByKey.set(member.attendanceKey,(attendanceCountByKey.get(member.attendanceKey)||0)+1);
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  for(const row of decisionAllPointRows){
    if(!row.isMeeting&&row.attendanceKey){
      const key=decisionMeetingProtocolKey(row);
      if(!byMeeting.has(key))byMeeting.set(key,{key,rows:[],attendanceKeys:new Set()});
      const meeting=byMeeting.get(key);meeting.rows.push(row);meeting.attendanceKeys.add(row.attendanceKey);
    }
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  for(const meeting of byMeeting.values()){
    const representatives=[...new Map(meeting.rows.map(row=>[row.attendanceKey,row])).values()];
    representatives.sort((a,b)=>{
      const attendeeDifference=(attendanceCountByKey.get(b.attendanceKey)||0)-(attendanceCountByKey.get(a.attendanceKey)||0);
      if(attendeeDifference)return attendeeDifference;
      const aWhole=/§/.test(a.documentTitle||'')?0:1,bWhole=/§/.test(b.documentTitle||'')?0:1;
      return bWhole-aWhole||String(a.documentTitle||'').localeCompare(String(b.documentTitle||''),'sv',{sensitivity:'base'});
    });
    const row=representatives[0];
    if(row){
      const meetingPoint=`sammantrade:${meeting.key}`,meetingLabel=[row.body,row.date].filter(Boolean).join(' · '),decisionKeys=new Set(meeting.rows.map(item=>`${item.matterId||item.id}|${item.point}`)),protocolDiary=decisionProtocolDiaryNumberFinal(row);
      decisionAllPointRows.push({...row,point:meetingPoint,pointTitle:meetingLabel,title:meetingLabel,protocolHeader:meetingLabel,description:'Hela protokollet för sammanträdet.',abstractText:'',fullDecisionText:'',proposalType:'Sammanträden',result:'beslut',sourceUrl:row.url||row.sourceUrl||'',diary:protocolDiary,protocolDiary,voteId:'',voteIds:[],voteEvents:{},voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0,fullVoteRoundCount:0,fullVoteCount:0,fullYes:0,fullNo:0,fullAbstain:0,fullAbsent:0,meetingKey:meeting.key,attendanceKeys:[...meeting.attendanceKeys],meetingDecisionCount:decisionKeys.size,meetingMatterCount:new Set(meeting.rows.map(item=>item.matterId||item.id).filter(Boolean)).size,isMeeting:true});
    }
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  decisionPack._meetingRowsReady=true;
}

async function decisionApplyCanonicalTotalsCooperativelyFinal(job){
  let started=performance.now();
  for(const row of decisionAllPointRows){
    decisionApplyCanonicalVoteTotalsFinal(row);
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  decisionPack._canonicalVoteTotalsReadyFinal=true;
}

async function decisionNormalizeVoteCountersCooperativelyFinal(job){
  let started=performance.now();
  for(const row of decisionAllPointRows){
    decisionNormalizeVoteCountersFinal(row);
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  decisionPack._voteCountersNormalizedFinal=true;
}

async function decisionApplyMeetingRollupsCooperativelyFinal(job){
  const textByProtocol=new Map(),textByMeeting=new Map();
  let started=performance.now();
  for(const row of decisionAllPointRows){
    if(row&&!row.isMeeting){
      const text=decisionMeetingChildSearchTextFinal(row),protocolKey=decisionMeetingProtocolKey(row),meetingKey=decisionMeetingKey(row.date,row.body);
      textByProtocol.set(protocolKey,`${textByProtocol.get(protocolKey)||''} ${text}`);textByMeeting.set(meetingKey,`${textByMeeting.get(meetingKey)||''} ${text}`);
    }
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  for(const row of decisionAllPointRows){
    if(row?.isMeeting){
      const ownText=decisionMeetingChildSearchTextFinal(row),childText=textByProtocol.get(row.meetingKey)||textByMeeting.get(decisionMeetingKey(row.date,row.body))||'';
      row.meetingSearchText=decisionSearchNormalizeFinal(`${ownText} ${childText}`);
    }
    if(progressiveSliceExpiredFinal(started,3)){await progressiveSearchFrameFinal(job);started=performance.now();}
  }
  decisionPack._meetingSearchRollupsReadyFinal=true;
}

ensureDecisionDataProgressively=function(){
  if(decisionPack?._cooperativePreparationReadyFinal){decisionScheduleSearchWarmFinal();return Promise.resolve();}
  if(decisionCooperativePreparationPromiseFinal)return decisionCooperativePreparationPromiseFinal;
  const job={cancelled:false};
  decisionCooperativePreparationPromiseFinal=(async()=>{
    await ensureDecisionDataProgressivelyBeforeSearchWarmFinal();
    decisionUpdateInitialProgressFinal(72);
    decisionStableBaseRowsFinal=null;
    decisionProgressiveSearchStateFinal=null;
    await progressiveSearchFrameFinal(job);
    await decisionBuildPersonIndexCooperativelyFinal(job);
    decisionUpdateInitialProgressFinal(74);
    await decisionHydrateMeetingFieldsCooperativelyFinal(job);
    decisionUpdateInitialProgressFinal(75);
    await decisionPreparePositionsCooperativelyFinal(job);
    decisionUpdateInitialProgressFinal(77);
    await decisionHydrateDecoratorsCooperativelyFinal(job);
    decisionUpdateInitialProgressFinal(79);
    await decisionBuildMeetingRowsCooperativelyFinal(job);
    decisionUpdateInitialProgressFinal(81);
    decisionApplyProtocolMatterHeadersFinal();
    decisionUpdateInitialProgressFinal(82);
    await progressiveSearchFrameFinal(job);
    decisionApplyOrganNamesFinal();
    decisionUpdateInitialProgressFinal(83);
    await progressiveSearchFrameFinal(job);
    decisionApplyInferredParagraphVotesFinal();
    decisionUpdateInitialProgressFinal(84);
    await progressiveSearchFrameFinal(job);
    await decisionApplyCanonicalTotalsCooperativelyFinal(job);
    decisionUpdateInitialProgressFinal(85);
    await decisionNormalizeVoteCountersCooperativelyFinal(job);
    await decisionApplyMeetingRollupsCooperativelyFinal(job);
    decisionUpdateInitialProgressFinal(86);
    decisionPack._cooperativePreparationReadyFinal=true;
    if(typeof decisionBuildRuntimeIndexesFinal==='function')decisionBuildRuntimeIndexesFinal();
    decisionScheduleSearchWarmFinal();
  })().finally(()=>{decisionCooperativePreparationPromiseFinal=null;});
  return decisionCooperativePreparationPromiseFinal;
};

const ensureDecisionDataBeforeCompletedProgressiveFinal=ensureDecisionData;
ensureDecisionData=function(){
  if(decisionReady&&(decisionCooperativePreparationPromiseFinal||decisionPack?._cooperativePreparationReadyFinal))return;
  return ensureDecisionDataBeforeCompletedProgressiveFinal();
};

let decisionProgressivePointerDownFinal=false;
let decisionStableBaseRowsFinal=null;
let decisionFilterOptionsCacheFinal=null;
const decisionFilterControlKeysFinal=new Map();

function decisionApplyBootstrapFilterOptionsFinal(){
  const options=decisionBootstrapFilterOptionsFinal;
  if(!options)return;
  syncDecisionDateRangeControls();
  syncDecisionSearchControl();
  const fields=[
    ['decisionOrgan',options.organs||[],'organ'],['decisionProposalType',options.types||[],'proposalType'],['decisionParty',options.parties||[],'party'],
    ['decisionMember',options.members||[],'member'],['decisionVote',options.votes||[],'vote'],['decisionResult',options.results||[],'resultFilter']
  ];
  for(const [id,values,column] of fields){
    const selected=decisionFilterLocks[id]||[],key=JSON.stringify([values,selected,column]);
    setDecisionSelectOptions(id,values,selected,column);
    decisionFilterControlKeysFinal.set(id,key);
  }
  renderDecisionFilterLocks();
}

function decisionStableBaseFilterKeyFinal(){
  return JSON.stringify([
    decisionDateRanges.map(range=>[range.from,range.to]),
    decisionFilterIds.map(id=>[id,...selectedDecisionValues(id)])
  ]);
}

function decisionFilterOptionsKeyFinal(){
  return JSON.stringify([
    decisionDateRanges.map(range=>[range.from,range.to]),
    selectedDecisionValues('decisionOrgan'),selectedDecisionValues('decisionParty'),
    decisionAllPointRows.length,decisionRows.length,decisionMemberRows.length
  ]);
}

async function decisionBuildFilterOptionsFinal(job){
  const key=decisionFilterOptionsKeyFinal();
  if(decisionFilterOptionsCacheFinal?.key===key)return decisionFilterOptionsCacheFinal.options;
  const selectedOrgans=selectedDecisionValues('decisionOrgan'),selectedParties=selectedDecisionValues('decisionParty');
  const types=new Set(),organs=new Set(),parties=new Set(),members=new Set(),votes=new Set(),results=new Set();
  let started=performance.now();
  for(const row of decisionAllPointRows){
    if(decisionDateMatches(row.date)){
      if(row.proposalType)types.add(row.proposalType);
      if(row.body)organs.add(row.body);
      results.add(decisionResultFilterGroup(row.result||'beslut'));
    }
    if(progressiveSliceExpiredFinal(started,3)){if(!await progressiveSearchFrameFinal(job))return null;started=performance.now();}
  }
  for(const row of decisionRows){
    if(decisionDateMatches(row.date)){
      if(row.party)parties.add(row.party);
      if(row.vote)votes.add(row.vote);
      if(row.name&&(!selectedParties.length||selectedParties.includes(municipalNorm(row.party))))members.add(decisionMemberKey(row.name,row.party));
    }
    if(progressiveSliceExpiredFinal(started,3)){if(!await progressiveSearchFrameFinal(job))return null;started=performance.now();}
  }
  for(const row of decisionMemberRows){
    if(decisionDateMatches(row.date)&&(!selectedOrgans.length||selectedOrgans.includes(municipalNorm(row.body)))){
      if(row.party)parties.add(row.party);
      if(row.name&&(!selectedParties.length||selectedParties.includes(municipalNorm(row.party))))members.add(row.memberKey||decisionMemberKey(row.name,row.party));
    }
    if(progressiveSliceExpiredFinal(started,3)){if(!await progressiveSearchFrameFinal(job))return null;started=performance.now();}
  }
  const options={
    types:uniqueDecisionValues([...types]),organs:uniqueDecisionValues([...organs]),parties:uniqueDecisionValues([...parties]),members:uniqueDecisionValues([...members]),
    votes:['Ja','Nej','Avstår','Frånvarande'].filter(value=>votes.has(value)),results:['approved','rejected','answered','recorded','continued','other'].filter(value=>results.has(value))
  };
  decisionFilterOptionsCacheFinal={key,options};
  return options;
}

async function decisionApplyFilterOptionsFinal(options,job){
  if(!options||job.cancelled)return;
  syncDecisionDateRangeControls();
  syncDecisionSearchControl();
  const fields=[
    ['decisionOrgan',options.organs,'organ'],['decisionProposalType',options.types,'proposalType'],['decisionParty',options.parties,'party'],
    ['decisionMember',options.members,'member'],['decisionVote',options.votes,'vote'],['decisionResult',options.results,'resultFilter']
  ];
  for(const [id,values,column] of fields){
    const selected=decisionFilterLocks[id]||[],key=JSON.stringify([values,selected,column]);
    if(decisionFilterControlKeysFinal.get(id)!==key){
      setDecisionSelectOptions(id,values,selected,column);
      decisionFilterControlKeysFinal.set(id,key);
    }
    if(!await progressiveSearchFrameFinal(job))return;
  }
  renderDecisionFilterLocks();
}

async function decisionStableBuildBaseRowsFinal(job){
  const organs=selectedDecisionValues('decisionOrgan'),parties=selectedDecisionValues('decisionParty'),members=selectedDecisionValues('decisionMember'),votes=selectedDecisionValues('decisionVote'),results=selectedDecisionValues('decisionResult'),types=selectedDecisionValues('decisionProposalType');
  const requiresVoteMatch=parties.length||members.length||votes.length,attendanceKeys=new Set(),counts=new Map();
  if(members.length&&!votes.length){
    let started=performance.now();
    for(const row of decisionMemberRows){
      if(decisionDateMatches(row.date)&&(!organs.length||organs.includes(municipalNorm(row.body)))&&(!parties.length||parties.includes(municipalNorm(row.party)))&&members.includes(row.memberKey))attendanceKeys.add(row.attendanceKey);
      if(progressiveSliceExpiredFinal(started,3)){if(!await progressiveSearchFrameFinal(job))return null;started=performance.now();}
    }
  }
  let started=performance.now();
  for(const row of decisionRows){
    if(decisionDateMatches(row.date)&&(!parties.length||parties.includes(municipalNorm(row.party)))&&(!members.length||members.includes(decisionMemberKey(row.name,row.party)))&&(!votes.length||votes.includes(String(row.vote)))){
      const key=`${row.id}|${row.point}`;
      if(!counts.has(key))counts.set(key,{voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0,voteIds:new Set()});
      const count=counts.get(key),eventId=decisionVoteEventBase(row.intressentId);
      count.voteCount++;if(eventId)count.voteIds.add(eventId);count.voteRoundCount=count.voteIds.size;
      if(row.vote==='Ja')count.yes++;else if(row.vote==='Nej')count.no++;else if(row.vote==='Avstår')count.abstain++;else if(row.vote==='Frånvarande')count.absent++;
    }
    if(progressiveSliceExpiredFinal(started,3)){if(!await progressiveSearchFrameFinal(job))return null;started=performance.now();}
  }
  const output=[];
  started=performance.now();
  for(const row of decisionAllPointRows){
    const key=`${row.id}|${row.point}`,count=counts.get(key),hasAttendance=attendanceKeys.has(row.attendanceKey);
    if((types.length&&!types.includes(municipalNorm(row.proposalType||'beslut')))||!decisionDateMatches(row.date)||(organs.length&&!organs.includes(municipalNorm(row.body)))||(results.length&&!results.includes(decisionResultFilterGroup(row.result||'beslut')))||(requiresVoteMatch&&!count&&!hasAttendance))continue;
    const fallback={voteRoundCount:0,voteCount:0,yes:0,no:0,abstain:0,absent:0},current=count||fallback;
    if(requiresVoteMatch&&!hasAttendance)output.push({...row,voteRoundCount:current.voteRoundCount||0,voteCount:current.voteCount||0,yes:current.yes||0,no:current.no||0,abstain:current.abstain||0,absent:current.absent||0});
    else if(requiresVoteMatch&&hasAttendance&&!count)output.push({...row,voteRoundCount:row.fullVoteRoundCount||0,voteCount:row.fullVoteCount||0,yes:row.fullYes||0,no:row.fullNo||0,abstain:row.fullAbstain||0,absent:row.fullAbsent||0});
    else{
      const yes=decisionPreferNamedCount(current.yes||row.fullYes,row.statedYes),no=decisionPreferNamedCount(current.no||row.fullNo,row.statedNo),abstain=decisionPreferNamedCount(current.abstain||row.fullAbstain,row.statedAbstain),absent=decisionPreferNamedCount(current.absent||row.fullAbsent,row.statedAbsent);
      output.push({...row,yes,no,abstain,absent,voteCount:Math.max(current.voteCount||0,row.fullVoteCount||0,yes+no+abstain+absent),voteRoundCount:Math.max(current.voteRoundCount||0,row.fullVoteRoundCount||0,(row.voteIds||[]).length)});
    }
    if(progressiveSliceExpiredFinal(started,3)){if(!await progressiveSearchFrameFinal(job))return null;started=performance.now();}
  }
  return output;
}

function decisionCreateStableRowFinal(row){
  const container=document.createElement('tbody');
  container.innerHTML=decisionStableRowHtmlFinal(row);
  return container.firstElementChild;
}

function decisionProgressiveReconcileRowsFinal(rows,animate=true){
  progressiveReconcileRowsFinal($('decisionBody'),rows,decisionProposalKey,decisionStableRowHtmlFinal,{animate,pointerDown:decisionProgressivePointerDownFinal});
}

let decisionStableHeaderKeyFinal='';
function decisionEnsureStableHeaderFinal(){
  const head=$('decisionHead');
  if(!head)return;
  const key=`${decisionSortColumn}|${decisionSortDir}`;
  if(decisionStableHeaderKeyFinal===key&&head.children.length)return;
  decisionStableHeaderKeyFinal=key;
  head.innerHTML=`<tr>${decisionSortableHeader('date','Datum')}${decisionSortableHeader('title','Organ')}${decisionSortableHeader('pointTitle','Ärende')}${decisionSortableHeader('result','Resultat')}${decisionSortableHeader('voteRoundCount','Voteringar')}${decisionSortableHeader('voteCount','Röstning')}${decisionSortableHeader('yes','Ja')}${decisionSortableHeader('no','Nej')}${decisionSortableHeader('abstain','Avstår')}${decisionSortableHeader('absent','Frånvarande')}<th>Källa</th></tr>`;
  head.querySelectorAll('[data-decision-sort]').forEach(header=>{
    header.onclick=()=>setDecisionSort(header.dataset.decisionSort);
    header.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setDecisionSort(header.dataset.decisionSort);}};
  });
}

function decisionProgressiveStatusFinal(state,complete,visibleCount){
  const initial=!!state.initialLoad&&!complete;
  const traversed=state.progressIndex??state.index,total=state.progressTotal??state.total;
  return progressiveResultStatusFinal({
    active:!complete,
    matches:state.filteredMatches.length,
    visible:visibleCount,
    index:traversed,
    total,
    percentOverride:null,
    progressLabel:initial?'inläst':'genomsökt'
  });
}

function decisionProgressivePaintRankedFinal(state,complete=false){
  if(decisionProgressiveSearchStateFinal!==state)return;
  if(decisionProgressivePointerDownFinal){state.paintPending=true;return;}
  state.paintPending=false;
  if(decisionActiveTabState()?.kind!=='list'||currentTopView()!=='decision')return;
  decisionBindStableListEventsFinal();
  const filteredRows=state.filteredMatches;
  /* Search results arrive in discovery order while the scan is running. That
     makes every partial paint a stable prefix: existing rows stay put and new
     rows are appended. Relevance order is applied once, without motion, when
     the scan is complete. Initial loading keeps its ranked preview. */
  const rows=complete?state.sortedRows:state.initialLoad?state.previewRows:state.filteredMatches;
  const targetCount=decisionVisibleCount(decisionListTab().page||0,rows.length);
  state.revealCount=complete?targetCount:Math.min(targetCount,(state.revealCount||0)+progressiveVisibleRowsPerPaintFinal.decision);
  const visibleCount=Math.min(targetCount,state.revealCount);
  decisionEnsureStableHeaderFinal();
  if(visibleCount||complete)$('decisionMasterPane')?.classList.remove('table-shell-awaiting-data');
  if(!state.hasPainted){
    const wrap=$('decisionBody')?.closest('.raw-table-wrap');
    if(wrap)wrap.scrollTop=0;
    renderDecisionTabs();
  }
  decisionProgressiveReconcileRowsFinal(rows.slice(0,visibleCount),false);
  state.hasPainted=true;
  decisionStableListRenderFinal={key:decisionStableListKeyFinal(),filteredRows,rows,rendered:visibleCount};
  progressiveOverviewCardsFinal('decisionOverview',decisionSummaryEntriesFinal(state.summary),!complete);
  $('decisionStatus').textContent='';
  $('decisionStatus').hidden=true;
  $('decisionPage').textContent=decisionProgressiveStatusFinal(state,complete,visibleCount);
  $('decisionPrev').hidden=true;
  $('decisionNext').hidden=true;
  $('decisionMasterPane').hidden=false;
  $('decisionDetailPane').hidden=true;
}

function decisionSummaryAccumulatorFinal(){
  return {tableRows:0,decisionRows:0,meetingRows:0,matters:new Set(),meetings:new Set(),decisions:new Set(),votes:new Set()};
}

function decisionSummaryCollectFinal(summary,row){
  summary.tableRows++;
  if(row.isMeeting){
    summary.meetingRows++;
    const key=row.meetingKey||decisionMeetingKey(row.date,row.body);
    if(key)summary.meetings.add(key);
    return;
  }
  summary.decisionRows++;
  const matter=row.matterId||row.id;
  if(matter)summary.matters.add(matter);
  summary.decisions.add(`${decisionMeetingKey(row.date,row.body)}|${matter}|${row.point}`);
  for(const voteId of row.voteIds||[])if(voteId)summary.votes.add(voteId);
}

function decisionSummaryEntriesFinal(summary){
  return [
    ['Unika beslutspunkter och sammanträden',fmtInt(summary.tableRows)],
    ['Ärenden',fmtInt(summary.matters.size)],
    ['Sammanträden',fmtInt(summary.meetings.size)],
    ['Unika beslutspunkter',fmtInt(summary.decisions.size)],
    ['Formella voteringar',fmtInt(summary.votes.size)]
  ];
}

function decisionSummaryHtmlFinal(summary){
  return decisionSummaryEntriesFinal(summary).map(([label,value])=>`<div class="card"><span>${esc(label)}</span><b>${esc(String(value))}</b></div>`).join('');
}

function decisionIndexAdvancedFiltersSelectedFinal(){
  return ['decisionParty','decisionMember','decisionVote'].some(id=>selectedDecisionValues(id).length);
}

function decisionShouldUseTableIndexFinal(){
  if(!decisionTableIndexStartedFinal||decisionIndexAdvancedFiltersSelectedFinal())return false;
  return !decisionTableIndexErrorFinal||!decisionCanonicalPreparationReadyFinal();
}

function decisionTableIndexPredicateFinal(row,query){
  const organs=selectedDecisionValues('decisionOrgan'),results=selectedDecisionValues('decisionResult'),types=selectedDecisionValues('decisionProposalType');
  if(!decisionDateMatches(row.date))return false;
  if(organs.length&&!organs.includes(municipalNorm(row.body)))return false;
  if(results.length&&!results.includes(decisionResultFilterGroup(row.result||'beslut')))return false;
  if(types.length&&!types.includes(municipalNorm(row.proposalType||'beslut')))return false;
  if(!query)return true;
  const quickQuery=fuzzySearchNormalize(query);
  return decisionStableQuickSearchTextFinal(row).includes(quickQuery)||decisionStableSearchMatchesFinal(row,query);
}

async function decisionRunTableIndexJobFinal(job){
  const query=decisionProgressiveSearchKeyFinal(),baseFilterKey=decisionStableBaseFilterKeyFinal();
  const sortKey=`${decisionSortColumn}|${decisionSortDir}|${decisionPageSize()}`;
  const compare=(a,b)=>{
    if(query){const relevance=decisionPointSearchRelevanceFinal(b,query)-decisionPointSearchRelevanceFinal(a,query);if(relevance)return relevance;}
    return decisionSortCompare(a,b);
  };
  const state={fromTableIndex:true,key:query,baseFilterKey,sortKey,dataKey:'table-index',matches:new Set(),filteredMatches:[],previewRows:[],sortedRows:[],summary:decisionSummaryAccumulatorFinal(),index:0,total:decisionTableIndexTotalFinal,progressIndex:0,progressTotal:decisionTableIndexTotalFinal,complete:true,finished:false,initialLoad:!decisionInitialLoadCompleteFinal&&!query,hasPainted:false,paintPending:false,revealCount:0};
  decisionProgressiveSearchStateFinal=state;
  decisionListTab().page=0;
  decisionProgressivePaintRankedFinal(state,false);
  let lastPaint=performance.now(),revision=decisionTableIndexRevisionFinal;
  while(!job.cancelled){
    state.total=decisionTableIndexTotalFinal||state.total;
    state.progressTotal=state.total;
    let processed=false;
    while(state.index<decisionTableIndexRowsFinal.length&&!job.cancelled){
      const sliceStarted=performance.now();let traversed=0,matchChanged=false;
      do{
        const row=decisionTableIndexRowsFinal[state.index++];
        traversed++;processed=true;
        if(decisionTableIndexPredicateFinal(row,query)){
          state.matches.add(row);
          state.filteredMatches.push(row);
          decisionSummaryCollectFinal(state.summary,row);
          progressiveInsertRankedFinal(state.previewRows,row,compare,decisionPageSize());
          matchChanged=true;
        }
      }while(state.index<decisionTableIndexRowsFinal.length&&traversed<progressiveRecordsPerFrameFinal.decision&&!progressiveSliceExpiredFinal(sliceStarted,6));
      state.progressIndex=state.index;
      const now=performance.now();
      const visibleTarget=Math.min(decisionPageSize(),state.previewRows.length),needsMoreVisibleRows=state.revealCount<visibleTarget;
      if(!state.hasPainted||(matchChanged&&needsMoreVisibleRows&&now-lastPaint>=48)){
        decisionProgressivePaintRankedFinal(state,false);
        lastPaint=now;
      }else $('decisionPage').textContent=decisionProgressiveStatusFinal(state,false,$('decisionBody')?.children.length||0);
      if(state.index<decisionTableIndexRowsFinal.length&&!await progressiveSearchFrameFinal(job))return;
    }
    if(decisionTableIndexCompleteFinal&&state.index>=decisionTableIndexRowsFinal.length)break;
    if(processed){
      decisionProgressivePaintRankedFinal(state,false);
      if(!await progressiveSearchFrameFinal(job))return;
    }
    revision=decisionTableIndexRevisionFinal;
    if(state.index<decisionTableIndexRowsFinal.length||decisionTableIndexCompleteFinal)continue;
    await decisionAwaitTableIndexChangeFinal(revision);
  }
  if(job.cancelled)return;
  state.total=decisionTableIndexTotalFinal||state.index;
  state.progressTotal=state.total;
  state.progressIndex=state.index;
  state.sortedRows=await progressiveCooperativeSortFinal(state.filteredMatches,compare,job,3);
  if(job.cancelled||!state.sortedRows)return;
  state.previewRows=state.sortedRows.slice(0,decisionPageSize());
  const finalVisibleCount=decisionVisibleCount(decisionListTab().page||0,state.sortedRows.length);
  while(decisionProgressiveSearchStateFinal===state&&!job.cancelled&&state.revealCount<finalVisibleCount){
    decisionProgressivePaintRankedFinal(state,false);
    if(!await progressiveVisualFrameFinal(job))return;
  }
  if(decisionProgressiveSearchStateFinal!==state||job.cancelled)return;
  state.finished=true;
  if(state.initialLoad)decisionInitialLoadCompleteFinal=true;
  decisionProgressivePaintRankedFinal(state,true);
}

progressiveSearchHandlersFinal.set('decision',async job=>{
  if(decisionShouldUseTableIndexFinal())return decisionRunTableIndexJobFinal(job);
  const query=decisionProgressiveSearchKeyFinal();
  const baseFilterKey=decisionStableBaseFilterKeyFinal();
  const dataKey=`${decisionAllPointRows.length}|${decisionRows.length}|${decisionMemberRows.length}`;
  const sortKey=`${decisionSortColumn}|${decisionSortDir}|${decisionPageSize()}`;
  const compare=(a,b)=>{
    if(query){const relevance=decisionPointSearchRelevanceFinal(b,query)-decisionPointSearchRelevanceFinal(a,query);if(relevance)return relevance;}
    return decisionSortCompare(a,b);
  };
  const state={key:query,baseFilterKey,sortKey,dataKey,matches:new Set(),filteredMatches:[],previewRows:[],sortedRows:[],summary:decisionSummaryAccumulatorFinal(),index:0,total:decisionAllPointRows.length,progressIndex:0,progressTotal:decisionAllPointRows.length,complete:true,finished:false,initialLoad:!decisionInitialLoadCompleteFinal,hasPainted:false,paintPending:false,revealCount:0};
  decisionProgressiveSearchStateFinal=state;
  decisionListTab().page=0;
  decisionProgressivePaintRankedFinal(state,false);
  let baseRows=decisionStableBaseRowsFinal?.key===baseFilterKey&&decisionStableBaseRowsFinal?.dataKey===dataKey?decisionStableBaseRowsFinal.rows:null;
  if(!baseRows){
    baseRows=await decisionStableBuildBaseRowsFinal(job);
    if(job.cancelled||!baseRows)return;
    decisionStableBaseRowsFinal={key:baseFilterKey,dataKey,rows:baseRows};
  }
  const baseByKey=new Map(baseRows.map(row=>[decisionProposalKey(row),row]));
  if(!query){
    state.matches=new Set(decisionAllPointRows);
    state.total=baseRows.length;
    state.progressTotal=state.total;
    let lastPaint=performance.now();
    while(state.index<state.total&&!job.cancelled){
      const started=performance.now();let traversed=0;
      do{
        const row=baseRows[state.index++];
        traversed++;
        state.filteredMatches.push(row);
        decisionSummaryCollectFinal(state.summary,row);
        progressiveInsertRankedFinal(state.previewRows,row,compare,decisionPageSize());
      }while(state.index<state.total&&traversed<progressiveRecordsPerFrameFinal.decision&&!progressiveSliceExpiredFinal(started,6));
      state.progressIndex=state.index;
      const now=performance.now();
      if(!state.hasPainted||now-lastPaint>=48||state.index===state.total){
        decisionProgressivePaintRankedFinal(state,false);
        lastPaint=now;
      }else{
        $('decisionPage').textContent=decisionProgressiveStatusFinal(state,false,$('decisionBody')?.children.length||0);
      }
      if(state.index<state.total&&!await progressiveSearchFrameFinal(job))return;
    }
  }else{
    const quickQuery=fuzzySearchNormalize(query);
    let lastPaint=performance.now(),lastPaintCount=0;
    while(state.index<state.total&&!job.cancelled){
      const sliceStarted=performance.now();let traversed=0;
      do{
        const row=decisionAllPointRows[state.index++];
        traversed++;
        if(decisionStableQuickSearchTextFinal(row).includes(quickQuery)||decisionStableSearchMatchesFinal(row,query)){
          state.matches.add(row);
          const filteredRow=baseByKey.get(decisionProposalKey(row));
          if(filteredRow){state.filteredMatches.push(filteredRow);decisionSummaryCollectFinal(state.summary,filteredRow);progressiveInsertRankedFinal(state.previewRows,filteredRow,compare,decisionPageSize());}
        }
      }while(state.index<state.total&&traversed<progressiveRecordsPerFrameFinal.decision&&!progressiveSliceExpiredFinal(sliceStarted,6));
      state.progressIndex=state.index;
      const now=performance.now();
      if(state.matches.size!==lastPaintCount&&(!state.hasPainted||now-lastPaint>=48||state.index===state.total)){
        decisionProgressivePaintRankedFinal(state,false);
        lastPaint=now;
        lastPaintCount=state.matches.size;
      }else{
        $('decisionPage').textContent=decisionProgressiveStatusFinal(state,false,$('decisionBody')?.children.length||0);
      }
      if(state.index<state.total&&!await progressiveSearchFrameFinal(job))return;
    }
  }
  if(job.cancelled)return;
  state.sortedRows=await progressiveCooperativeSortFinal(state.filteredMatches,compare,job,3);
  if(job.cancelled||!state.sortedRows)return;
  state.previewRows=state.sortedRows.slice(0,decisionPageSize());
  state.summaryHtml=decisionSummaryHtmlFinal(state.summary);
  const finalVisibleCount=decisionVisibleCount(decisionListTab().page||0,state.sortedRows.length);
  while(decisionProgressiveSearchStateFinal===state&&!job.cancelled&&state.revealCount<finalVisibleCount){
    decisionProgressivePaintRankedFinal(state,false);
    if(!await progressiveVisualFrameFinal(job))return;
  }
  if(decisionProgressiveSearchStateFinal!==state||job.cancelled)return;
  state.finished=true;
  if(state.initialLoad)decisionInitialLoadCompleteFinal=true;
  decisionProgressivePaintRankedFinal(state,true);
  const filterOptions=await decisionBuildFilterOptionsFinal(job);
  if(!job.cancelled)await decisionApplyFilterOptionsFinal(filterOptions,job);
  if(!job.cancelled&&baseFilterKey!==decisionStableBaseFilterKeyFinal())decisionScheduleProgressiveRefreshFinal();
});

function decisionStableListKeyFinal(){
  const filterKey=typeof decisionRuntimeFilterStateKeyFinal==='function'
    ?decisionRuntimeFilterStateKeyFinal()
    :JSON.stringify([decisionDateRanges,decisionSearchQuery,decisionFilterLocks]);
  return `${filterKey}|${decisionSortColumn}|${decisionSortDir}`;
}

function decisionStableSourceLinkFinal(source){
  if(!source)return '-';
  return `<a class="decision-pdf-source-link" href="${esc(source)}" target="_blank" rel="noopener noreferrer" data-pdf-icon-applied="1" aria-label="Öppna PDF" title="Öppna PDF">${decisionPdfIconFinal()}</a>`;
}

function decisionStableRowHtmlFinal(row){
  const source=decisionAnchoredSourceUrl(row);
  const label=String(row.protocolHeader||row.pointTitle||row.title||'Ärende').replace(/\s+/g,' ').trim();
  return `<tr class="${decisionPointRowClass(row)}" data-id="${esc(row.id)}" data-proposal-key="${esc(decisionProposalKey(row))}" tabindex="0" role="button" aria-label="Öppna ärendet ${esc(label)}"><td>${esc(row.date)}</td><td>${esc(row.body||'')}</td><td>${municipalCaseCellHtml(row)}</td><td>${decisionPointResultHtml(row)}</td><td class="num">${fmtInt(row.voteRoundCount)}</td><td class="num">${fmtInt(row.voteCount)}</td><td class="num">${fmtInt(row.yes)}</td><td class="num">${fmtInt(row.no)}</td><td class="num">${fmtInt(row.abstain)}</td><td class="num">${fmtInt(row.absent)}</td><td>${decisionStableSourceLinkFinal(source)}</td></tr>`;
}

const decisionIndexedDetailRowsFinal=new Map();
const decisionIndexedDetailPartPromisesFinal=new Map();
const decisionIndexedMeetingDetailsFinal=new Map();
let decisionCanonicalWarmupTimerFinal=0;

function decisionRegisterIndexedMeetingDetailsFinal(meetings){
  Object.entries(meetings||{}).forEach(([key,value])=>{
    if(!value?.row||!value?.detail)return;
    decisionIndexedMeetingDetailsFinal.set(key,value);
    decisionIndexedDetailRowsFinal.set(key,{...value.row,fastDetail:value.detail});
  });
}

decisionRegisterIndexedMeetingDetailsFinal(decisionTableIndexBootstrapFinal.meetings);

function decisionRegisterIndexedDetailRowFinal(row){
  if(!row)return null;
  const key=decisionProposalKey(row);
  if(key)decisionIndexedDetailRowsFinal.set(key,row);
  return row;
}

function decisionIndexedDetailRowByKeyFinal(key){
  const text=String(key||'');
  if(!text)return null;
  const stateRows=decisionProgressiveSearchStateFinal?.filteredMatches||[];
  return decisionIndexedDetailRowsFinal.get(text)||stateRows.find(row=>decisionProposalKey(row)===text)||decisionTableIndexRowsFinal.find(row=>decisionProposalKey(row)===text)||null;
}

async function decisionLoadIndexedDetailPartFinal(part,proposalKey){
  const current=decisionIndexedDetailRowByKeyFinal(proposalKey);
  if(current)return decisionRegisterIndexedDetailRowFinal(current);
  const partNumber=Math.max(0,Number(part)||0);
  if(!partNumber)return null;
  if(!decisionIndexedDetailPartPromisesFinal.has(partNumber)){
    decisionIndexedDetailPartPromisesFinal.set(partNumber,(async()=>{
      const partName=String(partNumber).padStart(3,'0');
      const version=decisionTableIndexBootstrapFinal.version||'20260807-1';
      await loadScriptOnce(`${municipalDecisionTableIndexPartsBaseFinal}/part-${partName}.js?v=${version}`);
      const columns=decisionTableIndexBootstrapFinal.fields||[];
      const rows=window.municipalDecisionTableIndexParts?.[partNumber]||JSON.parse(await decodeHistoricPackText(window.municipalDecisionTableIndexCompressedParts?.[partNumber]||''));
      for(const source of rows){
        const row={};
        for(let columnIndex=0;columnIndex<source.length;columnIndex++)if(source[columnIndex]!==null)row[columns[columnIndex]]=source[columnIndex];
        decisionRegisterIndexedDetailRowFinal(row);
      }
      if(window.municipalDecisionTableIndexCompressedParts)delete window.municipalDecisionTableIndexCompressedParts[partNumber];
    })().catch(error=>{
      decisionIndexedDetailPartPromisesFinal.delete(partNumber);
      throw error;
    }));
  }
  await decisionIndexedDetailPartPromisesFinal.get(partNumber);
  return decisionIndexedDetailRowByKeyFinal(proposalKey);
}

function decisionScheduleCanonicalWarmupFinal(){
  if(decisionCanonicalPreparationReadyFinal()||decisionCanonicalMountPromise||decisionCanonicalWarmupTimerFinal)return;
  decisionCanonicalWarmupTimerFinal=setTimeout(()=>{
    decisionCanonicalWarmupTimerFinal=0;
    const start=()=>ensureDecisionCanonicalDataFinal().catch(()=>{});
    if(typeof requestIdleCallback==='function')requestIdleCallback(start,{timeout:2500});
    else setTimeout(start,250);
  },750);
}

function decisionIndexedRowForElementFinal(element){
  const direct=element?.indexedRow||element?._indexedRow;
  if(direct)return decisionRegisterIndexedDetailRowFinal(direct);
  return decisionRegisterIndexedDetailRowFinal(decisionIndexedDetailRowByKeyFinal(element?.dataset.proposalKey||''));
}

function decisionBindIndexedDetailLinksFinal(){
  const groups=$('decisionDetailGroups');
  if(!groups)return;
  groups.querySelectorAll('.decision-text-ref').forEach(button=>{
    button.onclick=async event=>{
      event.preventDefault();
      event.stopPropagation();
      if(button.getAttribute('aria-busy')==='true')return;
      button.setAttribute('aria-busy','true');
      try{
        const target=decisionIndexedDetailRowByKeyFinal(button.dataset.proposalKey)||await decisionLoadIndexedDetailPartFinal(button.dataset.indexPart,button.dataset.proposalKey);
        if(target?.fastDetail)decisionOpenIndexedDetailRowFinal(target);
        else{
          await ensureDecisionCanonicalDataFinal();
          openDecisionDetail(button.dataset.id,button.dataset.proposalKey);
        }
      }finally{button.removeAttribute('aria-busy');}
    };
  });
}

function decisionRenderIndexedFastDetailFinal(row,tab){
  const detail=row?.fastDetail;
  if(!detail)return false;
  $('decisionDetailTitle').textContent=detail.title||row.protocolHeader||row.pointTitle||row.title||'Kommunalt ärende';
  $('decisionDetailMeta').innerHTML=`<span>${esc(detail.metaText||'')}</span>${detail.sourceUrl?` <a class="decision-official-link" href="${esc(detail.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(detail.sourceLabel||'Öppna källan')}</a>`:''}`;
  $('decisionDetailOverview').innerHTML=detail.overviewHtml||'';
  $('decisionDetailStatus').textContent=detail.status||'';
  const meeting=decisionIndexedMeetingDetailsFinal.get(detail.meetingKey)||null;
  const attendance=!detail.isMeeting&&meeting?.attendanceHtml?decisionAttendancePanelHtmlFinal(row,meeting.attendanceHtml):'';
  $('decisionDetailGroups').innerHTML=(detail.groupsHtml||decisionDetailUnavailableTextFinal())+attendance;
  $('decisionPage').textContent='';
  $('decisionPrev').disabled=true;
  $('decisionNext').disabled=true;
  if(detail.isMeeting||!meeting?.row)decisionSetDetailMeetingContextFinal(null);
  else{
    const meetingRow=decisionRegisterIndexedDetailRowFinal({...meeting.row,fastDetail:meeting.detail});
    decisionSetDetailMeetingContextFinal(meetingRow,decisionOpenIndexedDetailRowFinal);
  }
  decisionBindIndexedDetailLinksFinal();
  if(typeof decisionDecorateDetailPdfLinksFinal==='function')decisionDecorateDetailPdfLinksFinal();
  $('decisionMasterPane').hidden=true;
  $('decisionDetailPane').hidden=false;
  syncDecisionListDetailChromeFinal();
  decisionScheduleCanonicalWarmupFinal();
  return true;
}

function decisionOpenIndexedDetailRowFinal(row){
  if(!row)return null;
  decisionRegisterIndexedDetailRowFinal(row);
  return decisionShowIndexedDetailFinal({_indexedRow:row,dataset:{id:row.id||'',proposalKey:decisionProposalKey(row)}});
}

function decisionShowIndexedDetailFinal(element){
  const row=decisionIndexedRowForElementFinal(element)||{},id=element?.dataset.id||row.id||'',proposalKey=element?.dataset.proposalKey||decisionProposalKey(row);
  const title=String(row.protocolHeader||row.pointTitle||row.title||'Kommunalt ärende').replace(/\s+/g,' ').trim();
  const proposalData=row.id?decisionProposalTabData(row):{proposalKey};
  const hasFastDetail=!!row.fastDetail;
  let tabIndex=decisionTabs.findIndex(tab=>tab.kind==='decision'&&tab.id===id&&String(tab.proposalKey||'')===proposalKey);
  if(tabIndex<0){
    decisionTabs.push({kind:'decision',id,...proposalData,proposalKey,title,page:0,pendingCanonical:!hasFastDetail});
    tabIndex=decisionTabs.length-1;
  }else{
    Object.assign(decisionTabs[tabIndex],proposalData,{title,pendingCanonical:!hasFastDetail});
  }
  decisionActiveTab=tabIndex;
  renderDecisionTabs();
  if(decisionRenderIndexedFastDetailFinal(row,decisionTabs[tabIndex]))return decisionTabs[tabIndex];
  decisionSetDetailMeetingContextFinal(null);
  $('decisionDetailTitle').textContent=title;
  const source=decisionAnchoredSourceUrl(row);
  $('decisionDetailMeta').innerHTML=`<span>${esc([row.body,row.date,row.diary].filter(Boolean).join(' · '))}</span>${source?` <a class="decision-official-link" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna källan</a>`:''}`;
  const cards=[
    ['Resultat',decisionDisplay('result',row.result||'beslut')],
    ['Voteringar',fmtInt(row.voteRoundCount)],
    ['Ja',fmtInt(row.yes)],
    ['Nej',fmtInt(row.no)]
  ];
  $('decisionDetailOverview').innerHTML=cards.map(([label,value])=>`<div class="card"><span>${esc(label)}</span><b>${esc(String(value))}</b></div>`).join('');
  const sections=[['Ärendebeskrivning',row.abstractText||row.description],['Beslut',row.fullDecisionText]].filter(([,text])=>String(text||'').trim());
  $('decisionDetailGroups').innerHTML=sections.length?sections.map(([heading,text])=>`<article class="decision-point-card decision-text-card"><h3>${esc(heading)}</h3><p>${esc(String(text)).replace(/\n/g,'<br>')}</p></article>`).join(''):'<div class="decision-vote-panel">Ärendet öppnas. Detaljerad information laddas.</div>';
  $('decisionDetailStatus').textContent='Ärendet är öppet. Detaljerad voteringsinformation laddas i bakgrunden.';
  $('decisionMasterPane').hidden=true;
  $('decisionDetailPane').hidden=false;
  syncDecisionListDetailChromeFinal();
  return decisionTabs[tabIndex];
}

function decisionOpenStableRowFinal(element){
  if(!element)return;
  if(decisionCanonicalPreparationReadyFinal()){
    openDecisionDetail(element.dataset.id,element.dataset.proposalKey);
    return;
  }
  const indexedRow=decisionIndexedRowForElementFinal(element);
  if(indexedRow?.fastDetail){
    decisionOpenIndexedDetailRowFinal(indexedRow);
    return;
  }
  const proposalKey=element.dataset.proposalKey;
  const pendingTab=decisionShowIndexedDetailFinal(element);
  decisionRequestCanonicalDetailsFinal();
  ensureDecisionCanonicalDataFinal().then(()=>{
    const tabIndex=decisionTabs.indexOf(pendingTab);
    if(tabIndex<0)return;
    const proposal=decisionProposalRowByKeyAnyFinal(proposalKey);
    if(proposal)Object.assign(pendingTab,decisionProposalTabData(proposal),{title:decisionTabTitleFor(proposal),pendingCanonical:false});
    else pendingTab.pendingCanonical=false;
    if(currentTopView()==='decision')renderDecisionTabs();
    if(decisionActiveTabState()===pendingTab&&currentTopView()==='decision'&&!$('decisionDetailPane')?.hidden)renderDecisionView();
  }).catch(error=>{
    if(decisionActiveTabState()!==pendingTab)return;
    $('decisionDetailStatus').textContent=`Den detaljerade voteringsinformationen kunde inte laddas: ${error?.message||'okänt fel'}`;
  });
}

function decisionBindStableListEventsFinal(){
  const body=$('decisionBody');
  if(body&&body.dataset.stableClickBound!=='1'){
    body.dataset.stableClickBound='1';
    body.addEventListener('pointerdown',()=>{decisionProgressivePointerDownFinal=true;});
    const releasePointer=()=>{
      decisionProgressivePointerDownFinal=false;
      const state=decisionProgressiveSearchStateFinal;
      if(state?.paintPending)requestAnimationFrame(()=>decisionProgressivePaintRankedFinal(state,!!state.finished));
    };
    window.addEventListener('pointerup',releasePointer);
    window.addEventListener('pointercancel',releasePointer);
    body.addEventListener('click',event=>{
      const row=event.target.closest?.('.decision-selectable-row');
      if(!row||event.target.closest('a'))return;
      decisionOpenStableRowFinal(row);
    });
    body.addEventListener('keydown',event=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      const row=event.target.closest?.('.decision-selectable-row');
      if(!row||event.target.closest('a'))return;
      event.preventDefault();
      decisionOpenStableRowFinal(row);
    });
  }
}

renderDecisionMasterView=function(){
  decisionBindInfiniteScrollFinal('decisionBody',()=>{
    const state=decisionStableListRenderFinal;
    if(!state||state.rendered>=state.rows.length)return false;
    decisionListTab().page=(decisionListTab().page||0)+1;
    renderDecisionMasterView();
    return true;
  });
  decisionBindStableListEventsFinal();
  const key=decisionStableListKeyFinal();
  const listTab=decisionListTab();
  let state=decisionStableListRenderFinal;
  const reset=!state||state.key!==key;
  if(reset){
    const filteredRows=filteredDecisionPointRows();
    state={key,filteredRows,rows:sortedDecisionPointRows(filteredRows),rendered:0};
    decisionStableListRenderFinal=state;
    if(!decisionSearchNormalizeFinal(decisionSearchQuery)){
      decisionStableBaseRowsFinal={key:decisionStableBaseFilterKeyFinal(),rows:filteredRows};
    }
  }
  const visibleCount=decisionVisibleCount(listTab.page||0,state.rows.length);
  const body=$('decisionBody');
  if(reset||body.children.length!==state.rendered){
    body.innerHTML=state.rows.slice(0,visibleCount).map(decisionStableRowHtmlFinal).join('');
  }else if(visibleCount>state.rendered){
    body.insertAdjacentHTML('beforeend',state.rows.slice(state.rendered,visibleCount).map(decisionStableRowHtmlFinal).join(''));
  }
  state.rendered=visibleCount;
  decisionEnsureStableHeaderFinal();
  if(reset){
    $('decisionOverview').innerHTML=decisionMasterSummaryCards(undefined,state.filteredRows);
  }
  if(state.rows.length){
    $('decisionStatus').textContent='';
    $('decisionStatus').hidden=true;
    $('decisionPage').textContent=progressiveResultStatusFinal({matches:state.rows.length,visible:visibleCount});
  }else{
    $('decisionStatus').hidden=false;
    $('decisionStatus').textContent='Inga beslutspunkter matchar de aktiva filtren.';
    $('decisionPage').textContent=progressiveResultStatusFinal();
  }
  $('decisionPrev').hidden=true;
  $('decisionNext').hidden=true;
  $('decisionMasterPane').hidden=false;
  $('decisionDetailPane').hidden=true;
};

/* Shared stable rendering for Historisk valdata. Search, filter, sort and page
   size changes all use the same cooperative job and preserve existing rows. */
function rawProgressiveCompareFinal(a,b){
  const av=rawSortValue(a,rawSortColumn),bv=rawSortValue(b,rawSortColumn);
  let cmp=0;
  if(typeof av==='number'&&typeof bv==='number')cmp=av-bv;
  else cmp=String(av).localeCompare(String(bv),'sv',{numeric:true,sensitivity:'base'});
  if(cmp===0)cmp=String(rawDisplay('party_standard',rawValue(a,'party_standard'))).localeCompare(String(rawDisplay('party_standard',rawValue(b,'party_standard'))),'sv',{numeric:true,sensitivity:'base'});
  return rawSortDir==='asc'?cmp:-cmp;
}

const rawProgressiveSearchKeyBeforeSortFinal=rawProgressiveSearchKeyFinal;
rawProgressiveSearchKeyFinal=function(){
  return JSON.stringify([rawProgressiveSearchKeyBeforeSortFinal(),rawSortColumn,rawSortDir,rawPageSize()]);
};

function rawEligibleRowHtmlFinal(row){
  return `<tr class="raw-selectable-row ${rawSelected.has(row.__rawId)?'selected':''}" data-id="${row.__rawId}"><td><input class="raw-pick" type="checkbox" data-id="${row.__rawId}" ${rawSelected.has(row.__rawId)?'checked':''}></td>${rawColumns.map(column=>`<td>${esc(rawDisplay(column,rawValue(row,column)))}</td>`).join('')}</tr>`;
}

function rawIneligibleRowHtmlFinal(row){
  return `<tr aria-describedby="rawInvalidVoteNote" data-id="${row.__rawId}">${rawColumns.map(column=>`<td>${rawInvalidVoteCell(row,column)}</td>`).join('')}</tr>`;
}

let rawStableHeaderKeyFinal='';
function rawBindStableEventsFinal(){
  const body=$('rawEligibleBody');
  if(!body||body.dataset.stableClickBound==='1')return;
  body.dataset.stableClickBound='1';
  body.addEventListener('pointerdown',()=>{rawProgressivePointerDownFinal=true;});
  const release=()=>{
    const state=rawProgressiveSearchStateFinal;
    if(!state)return;
    rawProgressivePointerDownFinal=false;
    if(state.paintPending)requestAnimationFrame(()=>rawProgressivePaintFinal(state,state.complete));
  };
  window.addEventListener('pointerup',release);
  window.addEventListener('pointercancel',release);
  body.addEventListener('click',event=>{
    const row=event.target.closest('.raw-selectable-row');
    if(!row||event.target.closest('input,button,a,label,select,textarea'))return;
    const id=Number(row.dataset.id);
    if(rawSelected.has(id))rawSelected.delete(id);else rawSelected.add(id);
    syncRawSelectionUi();
  });
  body.addEventListener('change',event=>{
    const box=event.target.closest('.raw-pick');
    if(!box)return;
    const id=Number(box.dataset.id);
    if(box.checked)rawSelected.add(id);else rawSelected.delete(id);
    syncRawSelectionUi();
  });
}

function rawStableRenderRowsFinal(sortedRows,partialIneligible=null,{complete=true,state=null}={}){
  if(rawProgressivePointerDownFinal){if(state){state.paintPending=true;state.complete=complete;}return;}
  if(state){state.paintPending=false;state.complete=complete;}
  rawBindStableEventsFinal();
  renderRawFilterLocks();
  renderRawPageSizeControls();
  rawMaybeLoadMore('eligible');
  rawMaybeLoadMore('ineligible');
  const finalPresentation=complete&&state?.finalPresentation;
  const eligible=finalPresentation?.eligible||(partialIneligible===null?rawEligibleRows(sortedRows):sortedRows);
  const ineligible=finalPresentation?.ineligible||(partialIneligible===null?rawIneligibleRows(sortedRows):partialIneligible);
  const eligibleTo=complete?rawVisibleCount(rawEligiblePage,eligible.length):eligible.length;
  const ineligibleTo=complete?rawVisibleCount(rawIneligiblePage,ineligible.length):ineligible.length;
  const shownEligible=eligible.slice(0,eligibleTo),shownIneligible=ineligible.slice(0,ineligibleTo);
  rawLastEligibleCount=eligible.length;
  rawLastIneligibleCount=ineligible.length;
  const headerKey=`${rawColumns.join('|')}|${rawSortColumn}|${rawSortDir}`;
  if(rawStableHeaderKeyFinal!==headerKey){
    rawStableHeaderKeyFinal=headerKey;
    $('rawEligibleHead').innerHTML='<tr><th>Val</th>'+rawColumns.map(column=>`<th data-col="${esc(column)}" style="cursor:pointer">${esc(rawLabel(column)+rawSortIndicator(column))}</th>`).join('')+'</tr>';
    $('rawIneligibleHead').innerHTML='<tr>'+rawColumns.map(column=>`<th>${esc(rawLabel(column))}</th>`).join('')+'</tr>';
    $('rawEligibleHead').querySelectorAll('th[data-col]').forEach(header=>header.onclick=()=>setRawSort(header.dataset.col));
  }
  progressiveReconcileRowsFinal($('rawEligibleBody'),shownEligible,row=>row.__rawId,rawEligibleRowHtmlFinal,{animate:!!state?.hasPainted,pointerDown:rawProgressivePointerDownFinal});
  progressiveReconcileRowsFinal($('rawIneligibleBody'),shownIneligible,row=>row.__rawId,rawIneligibleRowHtmlFinal,{animate:!!state?.hasPainted,pointerDown:rawProgressivePointerDownFinal});
  $('rawEligibleCount').textContent=eligible.length?'':'Inga giltiga rader matchar filtren.';
  $('rawEligibleCount').hidden=!!eligible.length;
  $('rawIneligibleCount').textContent=ineligible.length?'':'Inga ogiltiga rader matchar filtren.';
  $('rawIneligibleCount').hidden=!!ineligible.length;
  $('rawInvalidVoteNote').hidden=!ineligible.length;
  $('rawEligiblePage').textContent='';
  $('rawIneligiblePage').textContent='';
  ['rawEligiblePrev','rawEligibleNext','rawIneligiblePrev','rawIneligibleNext'].forEach(id=>{$(id).hidden=true;});
  if(state?.summary)progressiveOverviewCardsFinal('rawOverview',rawOverviewEntriesFinal(state.summary,!complete),!complete);
  else if(complete){
    const meta=finalPresentation?.meta||rawMeta(sortedRows);
    const invalidTotal=meta.totalVotesCast&&meta.validVotesCast?Math.max(0,meta.totalVotesCast-meta.validVotesCast):(finalPresentation?.ineligibleVotes??ineligible.reduce((sum,row)=>sum+(Number(rawValue(row,'votes'))||0),0));
    const validTotal=meta.validVotesCast||(finalPresentation?.eligibleVotes??eligible.reduce((sum,row)=>sum+(Number(rawValue(row,'votes'))||0),0));
    progressiveOverviewCardsFinal('rawOverview',[
      ['Totalt röstberättigade',fmtInt(meta.totalEligibleVoters)],
      ['Avgivna röster',fmtInt(meta.totalVotesCast)],
      ['Giltiga röster',fmtInt(validTotal)],
      ['Ogiltiga röster',fmtInt(invalidTotal)],
      ['Valdeltagande',meta.participation?meta.participation.toFixed(2)+'%':'—']
    ]);
  }
  syncRawSelectionUi();
  if(complete)$('rawCount').textContent=progressiveResultStatusFinal({matches:sortedRows.length,visible:shownEligible.length+shownIneligible.length});
  if(state)state.hasPainted=true;
}

function rawScheduleProgressiveFinal(){
  resetRawPage();
  scheduleTableSearch('raw','rawSearch',['rawEligibleBody','rawIneligibleBody'],()=>renderRawTable());
}

let rawFilterOptionCacheFinal=null;
function rawFilterAccumulatorFinal(){
  return {years:new Set(),elections:new Set(),counties:new Set(),municipalities:new Set(),municipalitiesByCounty:new Map(),partyVotes:new Map()};
}

function rawCollectFilterOptionFinal(options,row){
  const year=rawComparable(row,'year'),election=rawComparable(row,'election_type'),county=rawComparable(row,'county_name'),municipality=rawComparable(row,'municipality_name'),party=rawComparable(row,'party_standard');
  if(year)options.years.add(year);if(election)options.elections.add(election);if(county)options.counties.add(county);if(municipality)options.municipalities.add(municipality);
  if(county&&municipality){if(!options.municipalitiesByCounty.has(county))options.municipalitiesByCounty.set(county,new Set());options.municipalitiesByCounty.get(county).add(municipality);}
  if(party)options.partyVotes.set(party,(options.partyVotes.get(party)||0)+(Number(rawValue(row,'votes'))||0));
}

function rawFinalizeFilterOptionsFinal(options){
  const sort=values=>[...values].sort((a,b)=>String(a).localeCompare(String(b),'sv',{numeric:true}));
  return {rows:rawRows,years:sort(options.years),elections:['parliamentary','regional','municipal'].filter(value=>options.elections.has(value)),counties:sort(options.counties),municipalities:sort(options.municipalities),municipalitiesByCounty:options.municipalitiesByCounty,parties:[...options.partyVotes].sort((a,b)=>b[1]-a[1]||rawDisplay('party_standard',a[0]).localeCompare(rawDisplay('party_standard',b[0]),'sv',{numeric:true,sensitivity:'base'})).map(([key])=>key)};
}

function rawFilterOptionsFinal(){
  return rawFilterOptionCacheFinal?.rows===rawRows?rawFilterOptionCacheFinal:null;
}

let rawFilterControlRevisionFinal=0;
const rawFilterControlKeysFinal=new Map();
buildRawFilters=function(){
  const options=rawFilterOptionsFinal();
  if(!options){renderRawFilterLocks();return;}
  const revision=++rawFilterControlRevisionFinal;
  const selectedCounties=selectedRawValues('rawCounty');
  const municipalities=selectedCounties.length?new Set(selectedCounties.flatMap(county=>[...(options.municipalitiesByCounty.get(county)||[])])):new Set(options.municipalities);
  rawFilterLocks.rawMunicipality=selectedRawValues('rawMunicipality').filter(value=>municipalities.has(value));
  renderRawFilterLocks();
  const fields=[
    ['rawYear',options.years,rawFilterLocks.rawYear,'year'],
    ['rawElection',options.elections,rawFilterLocks.rawElection,'election_type'],
    ['rawCounty',options.counties,rawFilterLocks.rawCounty,'county_name'],
    ['rawMunicipality',[...municipalities].sort((a,b)=>String(a).localeCompare(String(b),'sv',{numeric:true})),rawFilterLocks.rawMunicipality,'municipality_name'],
    ['rawParty',rawPartyOptionsByCurrentContext(rawRows),rawFilterLocks.rawParty,'party_standard']
  ];
  let index=0;
  const applyNext=()=>{
    if(revision!==rawFilterControlRevisionFinal)return;
    const field=fields[index++];
    if(field){
      const [id,values,selected,column]=field,key=JSON.stringify([values,selected,column]);
      if(rawFilterControlKeysFinal.get(id)!==key){setSelectOptions(...field);rawFilterControlKeysFinal.set(id,key);}
    }
    renderRawFilterLocks();
    if(index<fields.length)requestAnimationFrame(applyNext);
  };
  requestAnimationFrame(applyNext);
};

handleRawFilterChange=function(id){
  const select=$(id),value=select?.value;
  if(value===rawFilterPromptValue)return;
  if(value===rawFilterClearValue)rawFilterLocks[id]=[];
  else if(value&&!selectedRawValues(id).includes(value))rawFilterLocks[id]=[...selectedRawValues(id),value];
  else if(!value)rawFilterLocks[id]=[];
  buildRawFilters();
  rawScheduleProgressiveFinal();
};

renderRawFilterLocks=function(){
  const host=$('rawFilterLocks');
  if(!host)return;
  const chips=[];
  rawFilterIds.forEach(id=>{
    const select=$(id),column=select?.dataset.col||'';
    selectedRawValues(id).forEach(value=>chips.push({id,value,label:rawFilterLabel(id,column,value)}));
  });
  host.hidden=!chips.length;
  host.innerHTML=chips.map(chip=>`<span class="raw-filter-chip"><span>${esc(chip.label)}</span><button type="button" data-id="${esc(chip.id)}" data-value="${esc(chip.value)}" title="Rensa filter" aria-label="Rensa filter">×</button></span>`).join('');
  if(chips.length)host.insertAdjacentHTML('beforeend','<button type="button" class="filter-clear-all" data-clear-all-filters title="Rensa alla filter" aria-label="Rensa alla filter">× Rensa alla</button>');
  host.querySelectorAll('.raw-filter-chip button').forEach(button=>button.onclick=()=>{
    rawFilterLocks[button.dataset.id]=selectedRawValues(button.dataset.id).filter(value=>value!==button.dataset.value);
    buildRawFilters();
    rawScheduleProgressiveFinal();
  });
  host.querySelector('[data-clear-all-filters]')?.addEventListener('click',()=>{
    rawFilterIds.forEach(id=>{rawFilterLocks[id]=[];});
    buildRawFilters();
    rawScheduleProgressiveFinal();
  });
};

renderRawTable=function(){
  if(!rawRows.length)return rawStableRenderRowsFinal([],null,{complete:true});
  const state=rawProgressiveSearchStateFinal;
  if(!state||state.key!==rawProgressiveSearchKeyFinal()||!state.complete){rawScheduleProgressiveFinal();return;}
  rawStableRenderRowsFinal(state.sortedRows,null,{complete:true,state});
};

setRawSort=function(column){
  if(rawSortColumn===column)rawSortDir=rawSortDir==='asc'?'desc':'asc';
  else{rawSortColumn=column;rawSortDir=column==='votes'?'desc':'asc';}
  rawStableHeaderKeyFinal='';
  rawScheduleProgressiveFinal();
};

setRawPageSize=function(size){
  rawPageSizeValue=[100,250,500,1000,2500].includes(Number(size))?Number(size):250;
  renderRawPageSizeControls();
  rawScheduleProgressiveFinal();
};

/* Decode and materialize historical rows cooperatively. Only the table is
   updated while the dataset is being restored; the rest of the view remains
   fully interactive. */
function rawLoadHistoricWorkerFinal(worker){
  return new Promise((resolve,reject)=>{
    let state=null,filters=null,query='',filterAccumulator=null,lastPaint=performance.now(),workerComplete=false,drainScheduled=false,finishing=false;
    const queue=[];let queueIndex=0;
    const finish=async()=>{
      if(finishing||!state)return;
      finishing=true;
      try{
        worker.terminate();
        rawFilterOptionCacheFinal=rawFinalizeFilterOptionsFinal(filterAccumulator);
        rawReady=true;
        buildRawFilters();
        const current=rawProgressiveSearchStateFinal===state&&state.key===rawProgressiveSearchKeyFinal();
        if(current)await rawFinalizeProgressiveStateFinal(state,{cancelled:false});
        else rawScheduleProgressiveFinal();
        resolve();
      }catch(error){reject(error);}
    };
    const scheduleDrain=()=>{
      if(drainScheduled||finishing||!state)return;
      drainScheduled=true;
      requestAnimationFrame(async()=>{
        drainScheduled=false;
        if(finishing)return;
        const started=performance.now();let traversed=0;
        while(queueIndex<queue.length&&traversed<progressiveRecordsPerFrameFinal.raw&&!progressiveSliceExpiredFinal(started,4)){
          const row=queue[queueIndex++];row.__rawId=rawRows.length+1;rawRows.push(row);state.index=rawRows.length;traversed++;
          rawCollectFilterOptionFinal(filterAccumulator,row);
          if(rawProgressivePredicateFinal(row,filters,query)){
            state.matches.push(row);
            rawOverviewCollectFinal(state.summary,row);
            progressiveInsertRankedFinal(isRawInvalidVoteRow(row)?state.previewIneligible:state.previewEligible,row,rawProgressiveCompareFinal,rawPageSize());
          }
        }
        if(rawProgressiveSearchStateFinal===state){
          const now=performance.now();
          if(now-lastPaint>=48||workerComplete&&queueIndex===queue.length){rawProgressivePaintFinal(state,false);lastPaint=now;}
          else $('rawCount').textContent=progressiveResultStatusFinal({active:true,matches:state.matches.length,visible:($('rawEligibleBody')?.children.length||0)+($('rawIneligibleBody')?.children.length||0),index:state.index,total:state.total,progressLabel:'inläst'});
        }
        if(queueIndex<queue.length)scheduleDrain();
        else if(workerComplete)await finish();
      });
    };
    worker.onmessage=event=>{
      const message=event.data||{};
      if(message.type==='historic-meta'){
        rawColumns=(message.columns||[]).filter(column=>!rawHiddenColumns.has(column));
        rawRows=[];
        filters={years:selectedRawValues('rawYear'),elections:selectedRawValues('rawElection'),counties:selectedRawValues('rawCounty'),municipalities:selectedRawValues('rawMunicipality'),parties:selectedRawValues('rawParty')};
        query=fuzzySearchNormalize($('rawSearch')?.value||'');filterAccumulator=rawFilterAccumulatorFinal();
        state={key:rawProgressiveSearchKeyFinal(),matches:[],visibleRows:[],previewEligible:[],previewIneligible:[],sortedRows:[],summary:rawOverviewAccumulatorFinal(),index:0,total:Number(message.total)||0,initialLoad:true,hasPainted:false,paintPending:false,revealEligible:0,revealIneligible:0};
        rawProgressiveSearchStateFinal=state;
        rawProgressivePaintFinal(state,false);
        lastPaint=performance.now();
      }else if(message.type==='historic-chunk'&&state){
        queue.push(...(message.value||[]));
        scheduleDrain();
      }else if(message.type==='historic-complete'){
        workerComplete=true;
        scheduleDrain();
      }else if(message.type==='error'){
        if(!finishing){finishing=true;worker.terminate();reject(Error(message.message||'Den historiska valdatabasen kunde inte läsas.'));}
      }
    };
    worker.onerror=event=>{if(!finishing){finishing=true;worker.terminate();reject(Error(event.message||'Den historiska valdatabasen kunde inte läsas.'));}};
    worker.postMessage({
      mode:'historic',packed:historicPack,
      search:{hiddenColumns:[...rawHiddenColumns],electionLabels:rawElectionLabels,regionAliases:rawRegionAliases}
    });
  });
}

ensureRawData=async function(){
  if(rawReady)return;
  if(rawDataPromise)return rawDataPromise;
  $('rawCount').textContent=progressiveResultStatusFinal({active:true,progressLabel:'inläst'});
  rawDataPromise=(async()=>{
    try{
      const worker=progressiveCreateDataWorkerFinal();
      if(worker){
        try{
          await rawLoadHistoricWorkerFinal(worker);
          return;
        }catch(_error){/* Continue with the cooperative local loader. */}
      }
      let packed=historicPack;
      if(typeof packed==='string'){
        const json=await decodeHistoricPackText(packed.startsWith('gz:')?packed.slice(3):packed);
        packed=JSON.parse(json);
      }else if(packed&&packed.f==='gz'&&typeof packed.d==='string'){
        const json=await decodeHistoricPackText(packed.d);
        packed=JSON.parse(json);
      }
      const sourceColumns=Array.isArray(packed)?Object.keys(packed[0]||{}):(packed.c||packed.columns||Object.keys(packed.rows?.[0]||{}));
      const sourceRows=Array.isArray(packed)?packed:(packed.r||packed.rows||[]),stringColumns=new Set(packed?.sc||[]),strings=packed?.s||[];
      rawColumns=sourceColumns.filter(column=>!rawHiddenColumns.has(column));
      rawRows=[];
      const filters={years:selectedRawValues('rawYear'),elections:selectedRawValues('rawElection'),counties:selectedRawValues('rawCounty'),municipalities:selectedRawValues('rawMunicipality'),parties:selectedRawValues('rawParty')};
      const query=fuzzySearchNormalize($('rawSearch')?.value||''),filterAccumulator=rawFilterAccumulatorFinal();
      const state={key:rawProgressiveSearchKeyFinal(),matches:[],visibleRows:[],previewEligible:[],previewIneligible:[],sortedRows:[],summary:rawOverviewAccumulatorFinal(),index:0,total:sourceRows.length,initialLoad:true,hasPainted:false,paintPending:false,revealEligible:0,revealIneligible:0};
      rawProgressiveSearchStateFinal=state;
      rawProgressivePaintFinal(state,false);
      let lastPaint=performance.now(),started=performance.now(),traversed=0;
      for(let index=0;index<sourceRows.length;index++){
        const source=sourceRows[index];
        let row;
        if(Array.isArray(source)){
          row={};
          for(let columnIndex=0;columnIndex<sourceColumns.length;columnIndex++){
            const value=source[columnIndex];
            row[sourceColumns[columnIndex]]=stringColumns.has(columnIndex)&&value!==null?strings[value]:value;
          }
        }else row=source;
        row.__rawId=index+1;
        rawRows.push(row);
        rawCollectFilterOptionFinal(filterAccumulator,row);
        state.index=index+1;
        traversed++;
        if(rawProgressivePredicateFinal(row,filters,query)){
          state.matches.push(row);
          rawOverviewCollectFinal(state.summary,row);
          progressiveInsertRankedFinal(isRawInvalidVoteRow(row)?state.previewIneligible:state.previewEligible,row,rawProgressiveCompareFinal,rawPageSize());
        }
        if(traversed>=progressiveRecordsPerFrameFinal.raw||progressiveSliceExpiredFinal(started,4)){
          const now=performance.now();
          if(rawProgressiveSearchStateFinal===state){
            if(now-lastPaint>=48||state.index===state.total){rawProgressivePaintFinal(state,false);lastPaint=now;}
            else $('rawCount').textContent=progressiveResultStatusFinal({active:true,matches:state.matches.length,visible:($('rawEligibleBody')?.children.length||0)+($('rawIneligibleBody')?.children.length||0),index:state.index,total:state.total,progressLabel:'inläst'});
          }
          await new Promise(resolve=>requestAnimationFrame(resolve));
          started=performance.now();traversed=0;
        }
      }
      rawFilterOptionCacheFinal=rawFinalizeFilterOptionsFinal(filterAccumulator);
      rawReady=true;
      buildRawFilters();
      const current=rawProgressiveSearchStateFinal===state&&state.key===rawProgressiveSearchKeyFinal();
      if(current)await rawFinalizeProgressiveStateFinal(state,{cancelled:false});
      else rawScheduleProgressiveFinal();
    }catch(error){
      $('rawStatus').textContent='Den inbäddade JSON-datan kunde inte läsas: '+error.message;
      throw error;
    }finally{rawDataPromise=null;}
  })();
  return rawDataPromise;
};
initRawData=function(){return ensureRawData();};

/* Shared stable rendering for Styrdokument. Matching and ranking remain the
   existing functions; only their scheduling and DOM reconciliation change. */
function decisionActivityRowHtmlFinal(row){
  const source=decisionActivitySourceUrl(row);
  return `<tr class="decision-selectable-row" data-activity-id="${esc(row.id)}"><td>${decisionActivityDateHtml(row)}</td><td><strong class="decision-activity-type">${esc(decisionActivityTypeLabel(row.type))}</strong></td><td><strong>${esc(row.title)}</strong></td><td>${decisionDocumentSummaryCellFinal(row)}</td><td>${decisionDocumentPointsPreviewFinal(row)}</td><td>${esc(row.party||'')}</td><td>${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Öppna</a>`:'—'}</td></tr>`;
}

let decisionActivityStableHeaderKeyFinal='';
function decisionActivityEnsureStableHeaderFinal(){
  const head=$('decisionActivityHead');
  if(!head)return;
  const key=`${decisionActivitySortColumn}|${decisionActivitySortDir}`;
  if(decisionActivityStableHeaderKeyFinal===key&&head.children.length)return;
  decisionActivityStableHeaderKeyFinal=key;
  head.innerHTML=`<tr>${decisionActivitySortableHeader('date','Datum')}${decisionActivitySortableHeader('type','Dokumenttyp')}${decisionActivitySortableHeader('title','Titel')}${decisionActivitySortableHeader('summary','Sammanfattning')}${decisionActivitySortableHeader('points','Viktigt')}${decisionActivitySortableHeader('party','Område/organ')}<th>Källa</th></tr>`;
  head.querySelectorAll('[data-activity-sort]').forEach(header=>header.onclick=()=>setDecisionActivitySort(header.dataset.activitySort));
}

function decisionActivityBindStableEventsFinal(){
  const body=$('decisionActivityBody');
  if(!body||body.dataset.stableClickBound==='1')return;
  body.dataset.stableClickBound='1';
  body.addEventListener('pointerdown',()=>{decisionActivityProgressivePointerDownFinal=true;});
  const release=()=>{
    const state=decisionActivityProgressiveSearchStateFinal;
    if(!state)return;
    decisionActivityProgressivePointerDownFinal=false;
    if(state.paintPending)requestAnimationFrame(()=>decisionActivityProgressivePaintFinal(state,state.complete));
  };
  window.addEventListener('pointerup',release);
  window.addEventListener('pointercancel',release);
  body.addEventListener('click',event=>{
    const row=event.target.closest('[data-activity-id]');
    if(!row||event.target.closest('a'))return;
    openDecisionActivityDetail(row.dataset.activityId);
  });
}

function decisionActivityStableRenderRowsFinal(filteredRows,sortedRows,{complete=true,state=null}={}){
  if(decisionActivityProgressivePointerDownFinal){if(state){state.paintPending=true;state.complete=complete;}return;}
  if(state){state.paintPending=false;state.complete=complete;}
  if(currentTopView()!=='decisionActivity')return;
  const listTab=decisionActivityTabs[0]||{page:0};
  const visibleRows=complete?sortedRows.slice(0,decisionVisibleCount(listTab.page||0,sortedRows.length)):sortedRows;
  if(visibleRows.length||complete)$('decisionActivityBody')?.closest('.raw-table-wrap')?.classList.remove('table-shell-awaiting-data');
  decisionActivityBindStableEventsFinal();
  decisionBindInfiniteScrollFinal('decisionActivityBody',()=>{
    const current=decisionActivityProgressiveSearchStateFinal;
    if(!current?.complete)return false;
    if(decisionVisibleCount(listTab.page||0,current.sortedRows.length)>=current.sortedRows.length)return false;
    listTab.page=(listTab.page||0)+1;
    renderDecisionActivityView();
    return true;
  });
  decisionActivityEnsureStableHeaderFinal();
  progressiveReconcileRowsFinal($('decisionActivityBody'),visibleRows,row=>row.id,decisionActivityRowHtmlFinal,{animate:!!state?.hasPainted,pointerDown:decisionActivityProgressivePointerDownFinal});
  let summary=state?.summary;
  if(!summary){
    summary=decisionActivitySummaryAccumulatorFinal();
    filteredRows.forEach(row=>decisionActivitySummaryCollectFinal(summary,row));
  }
  progressiveOverviewCardsFinal('decisionActivityOverview',decisionActivitySummaryEntriesFinal(summary),!complete);
  $('decisionActivityStatus').textContent=progressiveResultStatusFinal({active:!complete,matches:filteredRows.length,visible:visibleRows.length,index:state?.index||0,total:state?.total||0,progressLabel:state?.initialLoad?'inläst':'genomsökt'});
  decisionDecorateMainPdfLinksFinal();
  if(state)state.hasPainted=true;
}

/* Only canonical municipal rows are allowed into the results table. */
function decisionCanonicalPreparationReadyFinal(){
  return !!(decisionReady&&decisionPack?._cooperativePreparationReadyFinal);
}

function decisionPaintTableBootstrapImmediatelyFinal(){
  if(decisionProgressiveSearchStateFinal||!decisionTableIndexRowsFinal.length)return;
  const query=decisionProgressiveSearchKeyFinal(),baseFilterKey=decisionStableBaseFilterKeyFinal();
  const sortKey=`${decisionSortColumn}|${decisionSortDir}|${decisionPageSize()}`;
  const compare=(a,b)=>{
    if(query){const relevance=decisionPointSearchRelevanceFinal(b,query)-decisionPointSearchRelevanceFinal(a,query);if(relevance)return relevance;}
    return decisionSortCompare(a,b);
  };
  const state={fromTableIndex:true,key:query,baseFilterKey,sortKey,dataKey:'table-index',matches:new Set(),filteredMatches:[],previewRows:[],sortedRows:[],summary:decisionSummaryAccumulatorFinal(),index:decisionTableIndexRowsFinal.length,total:decisionTableIndexTotalFinal,progressIndex:decisionTableIndexRowsFinal.length,progressTotal:decisionTableIndexTotalFinal,complete:true,finished:false,initialLoad:true,hasPainted:false,paintPending:false,revealCount:0};
  for(const row of decisionTableIndexRowsFinal){
    if(!decisionTableIndexPredicateFinal(row,query))continue;
    state.matches.add(row);
    state.filteredMatches.push(row);
    decisionSummaryCollectFinal(state.summary,row);
    progressiveInsertRankedFinal(state.previewRows,row,compare,decisionPageSize());
  }
  decisionProgressiveSearchStateFinal=state;
  decisionProgressivePaintRankedFinal(state,false);
}

/* Paint the complete municipal UI before any large dataset is requested.
   Loading is then confined to the table and its data-derived counters. */
function renderMunicipalTableShellFinal(view){
  if(view==='decision'){
    renderDecisionPageSizeControls();
    renderDecisionTabs();
    syncDecisionDateRangeControls();
    renderDecisionFilterLocks();
    decisionEnsureStableHeaderFinal();
    $('decisionMasterPane').classList.toggle('table-shell-awaiting-data',!decisionProgressiveSearchStateFinal?.finished);
    $('decisionMasterPane').hidden=false;
    $('decisionDetailPane').hidden=true;
    $('decisionPrev').hidden=true;
    $('decisionNext').hidden=true;
    if(!decisionProgressiveSearchStateFinal){
      progressiveOverviewCardsFinal('decisionOverview',decisionSummaryEntriesFinal(decisionSummaryAccumulatorFinal()),true);
      $('decisionBody').replaceChildren();
      $('decisionPage').textContent=progressiveResultStatusFinal({active:true,percentOverride:0,progressLabel:'inläst'});
      decisionPaintTableBootstrapImmediatelyFinal();
    }
    $('decisionStatus').textContent='';
    $('decisionStatus').hidden=true;
    return;
  }
  renderDecisionActivityTabs();
  syncDecisionActivityDateControls();
  renderActivityFilterLocks();
  decisionActivityEnsureStableHeaderFinal();
  $('decisionActivityBody')?.closest('.raw-table-wrap')?.classList.toggle('table-shell-awaiting-data',!decisionActivityProgressiveSearchStateFinal?.complete);
  $('decisionActivityListPane').hidden=false;
  $('decisionActivityDetailPane').hidden=true;
  if(!decisionActivityProgressiveSearchStateFinal){
    progressiveOverviewCardsFinal('decisionActivityOverview',decisionActivitySummaryEntriesFinal(decisionActivitySummaryAccumulatorFinal()),true);
    $('decisionActivityBody').replaceChildren();
    $('decisionActivityStatus').textContent=progressiveResultStatusFinal({active:true,progressLabel:'inläst'});
  }
}

/* The pre-indexing phase must not replace the ready GUI with a spinner. */
decisionLoadingStatus=function(){
  const status=$('decisionStatus');
  if(status){status.textContent='';status.hidden=true;}
};

function decisionActivityProgressivePaintFinal(state,complete=false){
  if(decisionActivityProgressiveSearchStateFinal!==state)return;
  if(decisionActivityProgressivePointerDownFinal){state.paintPending=true;state.complete=complete;return;}
  state.visibleRows=state.matches;
  state.complete=complete;
  const rows=complete?state.sortedRows:state.previewRows;
  const target=decisionVisibleCount((decisionActivityTabs[0]||{page:0}).page||0,rows.length);
  if(!complete)state.revealCount=Math.min(target,(state.revealCount||0)+progressiveVisibleRowsPerPaintFinal.activity);
  if(currentTopView()!=='decisionActivity'){if(complete)buildDecisionActivityFilters();return;}
  if(!state.hasPainted){
    renderDecisionActivityTabs();
    $('decisionActivityListPane').hidden=false;
    $('decisionActivityDetailPane').hidden=true;
    const wrap=$('decisionActivityBody')?.closest('.raw-table-wrap');
    if(wrap)wrap.scrollTop=0;
  }
  decisionActivityStableRenderRowsFinal(state.matches,rows.slice(0,complete?target:state.revealCount),{complete,state});
  if(complete)buildDecisionActivityFilters();
}

const renderDecisionActivityViewBeforeStableFinal=renderDecisionActivityView;
renderDecisionActivityView=function(activeRow=null){
  const tab=decisionActivityTabState();
  if(activeRow||tab?.kind==='activity')return renderDecisionActivityViewBeforeStableFinal(activeRow);
  ensureMunicipalDocumentData();
  const state=decisionActivityProgressiveSearchStateFinal;
  if(!state||state.key!==decisionActivityProgressiveSearchKeyFinal()){
    scheduleTableSearch('decision-activity','decisionActivitySearch',['decisionActivityBody'],()=>renderDecisionActivityView());
    return;
  }
  if(!state.complete){decisionActivityProgressivePaintFinal(state,false);return;}
  renderDecisionActivityTabs();
  $('decisionActivityListPane').hidden=false;
  $('decisionActivityDetailPane').hidden=true;
  const sorted=sortedDecisionActivityRows(state.visibleRows);
  state.sortedRows=sorted;
  decisionActivityStableRenderRowsFinal(state.visibleRows,sorted,{complete:true,state});
};

handleDecisionActivityFilterChange=function(id){
  const select=$(id),key=select?.dataset.activityKey,value=select?.value;
  if(key){
    if(value===decisionActivityFilterPromptValueFinal)return;
    if(value===decisionActivityFilterClearValueFinal)decisionActivityFilters[key]=[];
    else if(value&&!selectedActivityValues(key).includes(value))decisionActivityFilters[key]=[...selectedActivityValues(key),value];
    else if(!value)decisionActivityFilters[key]=[];
  }
  decisionActivityActiveTab=0;
  resetDecisionActivityPage();
  renderDecisionActivityView();
};

renderActivityFilterLocks=function(){
  const host=$('decisionActivityFilterLocks');
  if(!host)return;
  const ids=['decisionActivityType','decisionActivityParty','decisionActivityPoliticalOwner','decisionActivityOfficialOwner'],chips=[];
  ids.forEach(id=>{
    const select=$(id),key=select?.dataset.activityKey,column=select?.dataset.col;
    if(key)selectedActivityValues(key).forEach(value=>chips.push({key,value,label:decisionActivityFilterLabelFinal(key,column,value)}));
  });
  host.hidden=!chips.length;
  host.innerHTML=chips.map(chip=>`<span class="raw-filter-chip"><span>${esc(chip.label)}</span><button type="button" data-key="${esc(chip.key)}" data-value="${esc(chip.value)}" title="Rensa filter" aria-label="Rensa filter">×</button></span>`).join('');
  if(chips.length)host.insertAdjacentHTML('beforeend','<button type="button" class="filter-clear-all" data-clear-all-filters title="Rensa alla filter" aria-label="Rensa alla filter">× Rensa alla</button>');
  host.querySelectorAll('.raw-filter-chip button').forEach(button=>button.onclick=()=>{
    decisionActivityFilters[button.dataset.key]=selectedActivityValues(button.dataset.key).filter(value=>value!==button.dataset.value);
    decisionActivityActiveTab=0;resetDecisionActivityPage();renderDecisionActivityView();
  });
  host.querySelector('[data-clear-all-filters]')?.addEventListener('click',()=>{
    ids.forEach(id=>{const key=$(id)?.dataset.activityKey;if(key)decisionActivityFilters[key]=[];});
    decisionActivityActiveTab=0;resetDecisionActivityPage();renderDecisionActivityView();
  });
};

/* Every Ärendelista state change enters the same cooperative table job. The
   controls and surrounding view remain interactive while rows are replaced. */
function decisionScheduleProgressiveRefreshFinal(){
  decisionActiveTab=0;
  resetDecisionPage();
  decisionStableListRenderFinal=null;
  decisionSignalTableIndexChangeFinal();
  if(!decisionCanonicalPreparationReadyFinal()&&!decisionTableIndexStartedFinal)return;
  scheduleTableSearch('decision','decisionDecisionSearch',['decisionBody'],()=>renderDecisionView());
}

function decisionProgressiveStateIsCurrentFinal(){
  const state=decisionProgressiveSearchStateFinal;
  const dataKey=`${decisionAllPointRows.length}|${decisionRows.length}|${decisionMemberRows.length}`;
  const sourceCurrent=state?.fromTableIndex?!decisionIndexAdvancedFiltersSelectedFinal():state?.dataKey===dataKey;
  return !!state&&state.finished&&sourceCurrent&&state.key===decisionProgressiveSearchKeyFinal()&&state.baseFilterKey===decisionStableBaseFilterKeyFinal()&&state.sortKey===`${decisionSortColumn}|${decisionSortDir}|${decisionPageSize()}`;
}

async function decisionHydrateFilterOptionsAfterPreparationFinal(){
  if(!decisionCanonicalPreparationReadyFinal())return;
  const job={cancelled:false};
  const options=await decisionBuildFilterOptionsFinal(job);
  if(options)await decisionApplyFilterOptionsFinal(options,job);
}

handleDecisionFilterChange=function(id){
  const select=$(id);
  if(!select)return;
  const value=select.value;
  if(value===decisionFilterPromptValueFinal)return;
  if(value===decisionFilterClearValueFinal)decisionFilterLocks[id]=[];
  else if(value&&!selectedDecisionValues(id).includes(value))decisionFilterLocks[id]=[...selectedDecisionValues(id),value];
  else if(!value)decisionFilterLocks[id]=[];
  renderDecisionFilterLocks();
  decisionScheduleProgressiveRefreshFinal();
};

renderDecisionFilterLocks=function(){
  decisionRemoveLegacyInlineFilterLocksFinal();
  const host=$('decisionFilterLocks');
  if(!host)return;
  const chips=[];
  decisionFilterIds.forEach(id=>{
    const select=$(id),column=select?.dataset.col||'';
    selectedDecisionValues(id).forEach(value=>chips.push({id,value,label:decisionFilterLabelFinal(id,column,value)}));
  });
  host.hidden=!chips.length;
  host.innerHTML=chips.map(chip=>`<span class="raw-filter-chip"><span>${esc(chip.label)}</span><button type="button" data-id="${esc(chip.id)}" data-value="${esc(chip.value)}" title="Rensa filter" aria-label="Rensa filter">×</button></span>`).join('');
  if(chips.length)host.insertAdjacentHTML('beforeend','<button type="button" class="filter-clear-all" data-clear-all-filters title="Rensa alla filter" aria-label="Rensa alla filter">× Rensa alla</button>');
  host.querySelectorAll('.raw-filter-chip button').forEach(button=>button.onclick=()=>{
    decisionFilterLocks[button.dataset.id]=selectedDecisionValues(button.dataset.id).filter(value=>value!==button.dataset.value);
    renderDecisionFilterLocks();
    decisionScheduleProgressiveRefreshFinal();
  });
  host.querySelector('[data-clear-all-filters]')?.addEventListener('click',()=>{
    decisionFilterIds.forEach(id=>{decisionFilterLocks[id]=[];});
    renderDecisionFilterLocks();
    decisionScheduleProgressiveRefreshFinal();
  });
};

renderDecisionDateLocks=function(){
  const lock=$('decisionDateLocks');
  if(!lock)return;
  lock.hidden=!decisionDateRanges.length;
  if(!decisionDateRanges.length){lock.innerHTML='';return;}
  lock.innerHTML=decisionDateRanges.map((range,index)=>`<span class="raw-filter-chip decision-date-chip"><span><span>${esc(decisionDateDisplay(range.from))}</span><span>${esc(decisionDateDisplay(range.to))}</span></span><button type="button" data-index="${index}" title="Rensa låst filter" aria-label="Rensa låst filter">×</button></span>`).join('');
  lock.querySelectorAll('button').forEach(button=>button.onclick=event=>{
    event.stopPropagation();
    decisionDateRanges.splice(Number(button.dataset.index),1);
    renderDecisionDateLocks();
    decisionScheduleProgressiveRefreshFinal();
  });
};

setDecisionSort=function(column){
  if(decisionSortColumn===column)decisionSortDir=decisionSortDir==='asc'?'desc':'asc';
  else{decisionSortColumn=column;decisionSortDir=['voteRoundCount','voteCount','yes','no','abstain','absent'].includes(column)?'desc':'asc';}
  decisionScheduleProgressiveRefreshFinal();
};

setDecisionPageSize=function(size){
  decisionPageSizeValue=[100,250,500,1000,2500].includes(Number(size))?Number(size):250;
  renderDecisionPageSizeControls();
  decisionScheduleProgressiveRefreshFinal();
};

renderDecisionView=function(){
  if(!decisionCanonicalPreparationReadyFinal()&&!decisionTableIndexStartedFinal){
    $('decisionStatus').textContent='';
    $('decisionStatus').hidden=true;
    $('decisionMasterPane').hidden=false;
    $('decisionDetailPane').hidden=true;
    return;
  }
  renderDecisionPageSizeControls();
  renderDecisionTabs();
  const tab=decisionActiveTabState();
  if(tab?.kind==='decision'){
    if(decisionCanonicalPreparationReadyFinal())renderDecisionDetailView(tab);
    else decisionShowIndexedDetailFinal({dataset:{id:tab.id,proposalKey:tab.proposalKey}});
  }
  else if(currentTopView()==='decision'){
    if(!decisionProgressiveStateIsCurrentFinal())decisionScheduleProgressiveRefreshFinal();
    else renderDecisionMasterView();
  }
  syncDecisionListDetailChromeFinal();
};

/* Whole main views never enter a loading state. Only their table containers
   receive the unobtrusive loading indicator. */
setUiRegionBusy=function(target,busy){
  const element=typeof target==='string'?$(target):target;
  if(!element)return;
  element.classList.remove('is-view-loading');
  element.removeAttribute('aria-busy');
  element.querySelectorAll('.raw-table-wrap').forEach(wrap=>{
    wrap.classList.toggle('table-results-updating',busy);
    wrap.setAttribute('aria-busy',busy?'true':'false');
  });
};

/* Native select popups close when their option DOM is replaced. Data-derived
   filters can finish loading while a user has a dropdown open, so defer only
   that select's refresh until it loses focus. The latest queued refresh wins. */
const municipalDeferredSelectRefreshesFinal=new Map();
function municipalDeferFocusedSelectRefreshFinal(id,refresh){
  const select=$(id);
  if(!select||document.activeElement!==select)return false;
  municipalDeferredSelectRefreshesFinal.set(id,refresh);
  if(select.dataset.deferredOptionRefresh==='1')return true;
  select.dataset.deferredOptionRefresh='1';
  select.addEventListener('blur',()=>{
    delete select.dataset.deferredOptionRefresh;
    setTimeout(()=>{
      const pending=municipalDeferredSelectRefreshesFinal.get(id);
      if(!pending)return;
      if(document.activeElement===select){municipalDeferFocusedSelectRefreshFinal(id,pending);return;}
      municipalDeferredSelectRefreshesFinal.delete(id);
      pending();
    },0);
  },{once:true});
  return true;
}

const setRawSelectOptionsBeforeFocusSafetyFinal=setSelectOptions;
setSelectOptions=function(...args){
  const id=args[0];
  const refresh=()=>{
    const selected=selectedRawValues(id),latest=[...args];
    latest[1]=[...new Set([...(args[1]||[]),...selected])];latest[2]=selected;
    return setRawSelectOptionsBeforeFocusSafetyFinal(...latest);
  };
  if(municipalDeferFocusedSelectRefreshFinal(id,refresh))return;
  return refresh();
};
const setDecisionSelectOptionsBeforeFocusSafetyFinal=setDecisionSelectOptions;
setDecisionSelectOptions=function(...args){
  const id=args[0];
  const refresh=()=>{
    const selected=selectedDecisionValues(id),latest=[...args];
    latest[1]=uniqueDecisionValues([...(args[1]||[]),...selected]);latest[2]=selected;
    return setDecisionSelectOptionsBeforeFocusSafetyFinal(...latest);
  };
  if(municipalDeferFocusedSelectRefreshFinal(id,refresh))return;
  return refresh();
};
const setActivitySelectOptionsBeforeFocusSafetyFinal=setActivitySelectOptions;
setActivitySelectOptions=function(...args){
  const id=args[0],key=args[1];
  const refresh=()=>{
    const selected=selectedActivityValues(key),latest=[...args];
    latest[2]=uniqueDecisionValues([...(args[2]||[]),...selected]);
    return setActivitySelectOptionsBeforeFocusSafetyFinal(...latest);
  };
  if(municipalDeferFocusedSelectRefreshFinal(id,refresh))return;
  return refresh();
};
