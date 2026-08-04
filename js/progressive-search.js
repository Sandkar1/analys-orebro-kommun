/* Progressive search rendering for every searchable main table. */
const progressiveSearchJobsFinal=new Map();
const progressiveSearchHandlersFinal=new Map();
const scheduleTableSearchBeforeProgressiveFinal=scheduleTableSearch;

function progressiveSearchFrameFinal(job){
  return new Promise(resolve=>requestAnimationFrame(()=>resolve(!job.cancelled)));
}

function progressiveSearchWrapsFinal(tableIds,active){
  tableIds.forEach(id=>{
    const wrap=$(id)?.closest('.raw-table-wrap');
    if(!wrap)return;
    wrap.classList.toggle('table-progressive-loading',active);
    if(active){
      wrap.classList.remove('table-results-refreshed');
      wrap.scrollTop=0;
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

/* Historical election data: scan the 59,000-row dataset in short slices. */
const filteredRawRowsBeforeProgressiveFinal=filteredRawRows;
let rawProgressiveSearchStateFinal=null;

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
  state.visibleRows=complete?state.matches:state.matches.slice(0,1000);
  renderRawTable();
  if(complete)return;
  const percent=state.total?Math.floor(state.index/state.total*100):100;
  $('rawCount').textContent=`Söker… ${fmtInt(state.matches.length)} träffar hittills. ${fmtInt(state.index)} av ${fmtInt(state.total)} rader genomsökta (${percent} %).`;
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
  const state={key:rawProgressiveSearchKeyFinal(),matches:[],visibleRows:[],index:0,total:rawRows.length};
  rawProgressiveSearchStateFinal=state;
  rawProgressivePaintFinal(state);
  let lastPaint=performance.now(),lastPaintCount=0;
  while(state.index<state.total&&!job.cancelled){
    const sliceStarted=performance.now();
    do{
      const row=rawRows[state.index++];
      if(rawProgressivePredicateFinal(row,filters,query))state.matches.push(row);
    }while(state.index<state.total&&performance.now()-sliceStarted<10);
    const now=performance.now();
    if(state.matches.length!==lastPaintCount&&now-lastPaint>=90){
      rawProgressivePaintFinal(state);
      lastPaint=now;
      lastPaintCount=state.matches.length;
    }else{
      const percent=state.total?Math.floor(state.index/state.total*100):100;
      $('rawCount').textContent=`Söker… ${fmtInt(state.matches.length)} träffar hittills. ${fmtInt(state.index)} av ${fmtInt(state.total)} rader genomsökta (${percent} %).`;
    }
    if(!await progressiveSearchFrameFinal(job))return;
  }
  if(job.cancelled)return;
  state.visibleRows=state.matches;
  rawProgressivePaintFinal(state,true);
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
  if(state&&state.key===decisionProgressiveSearchKeyFinal())return state.matches.has(row);
  return decisionPointSearchMatchesBeforeProgressiveFinal(row);
};

function decisionProgressivePaintFinal(state,complete=false){
  if(typeof decisionFilteredPointCacheFinal!=='undefined')decisionFilteredPointCacheFinal=null;
  renderDecisionView();
  if(complete)return;
  const visible=filteredDecisionPointRows().length;
  const percent=state.total?Math.floor(state.index/state.total*100):100;
  $('decisionStatus').hidden=false;
  $('decisionStatus').textContent=`Söker… ${fmtInt(visible)} matchande tabellrader hittills. ${fmtInt(state.index)} av ${fmtInt(state.total)} rader genomsökta (${percent} %).`;
}

progressiveSearchHandlersFinal.set('decision',async job=>{
  const state={key:decisionProgressiveSearchKeyFinal(),matches:new Set(),index:0,total:decisionAllPointRows.length};
  decisionProgressiveSearchStateFinal=state;
  decisionProgressivePaintFinal(state);
  let lastPaint=performance.now(),lastPaintCount=0;
  while(state.index<state.total&&!job.cancelled){
    const sliceStarted=performance.now();
    do{
      const row=decisionAllPointRows[state.index++];
      if(decisionPointSearchMatchesBeforeProgressiveFinal(row))state.matches.add(row);
    }while(state.index<state.total&&performance.now()-sliceStarted<10);
    const now=performance.now();
    if(state.matches.size!==lastPaintCount&&now-lastPaint>=120){
      decisionProgressivePaintFinal(state);
      lastPaint=now;
      lastPaintCount=state.matches.size;
    }else{
      const percent=state.total?Math.floor(state.index/state.total*100):100;
      $('decisionStatus').hidden=false;
      $('decisionStatus').textContent=`Söker… ${fmtInt(state.matches.size)} textträffar hittills. ${fmtInt(state.index)} av ${fmtInt(state.total)} rader genomsökta (${percent} %).`;
    }
    if(!await progressiveSearchFrameFinal(job))return;
  }
  if(job.cancelled)return;
  decisionProgressivePaintFinal(state,true);
});

/* Municipal documents are smaller, so compute the exact set once and reveal
   it over consecutive frames. */
const filteredDecisionActivityRowsBeforeProgressiveFinal=filteredDecisionActivityRows;
let decisionActivityProgressiveSearchStateFinal=null;

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

progressiveSearchHandlersFinal.set('decision-activity',async job=>{
  const rows=filteredDecisionActivityRowsBeforeProgressiveFinal();
  const state={key:decisionActivityProgressiveSearchKeyFinal(),rows,visibleRows:[],index:0};
  decisionActivityProgressiveSearchStateFinal=state;
  renderDecisionActivityView();
  while(state.index<rows.length&&!job.cancelled){
    const batchSize=state.index?18:8;
    state.index=Math.min(rows.length,state.index+batchSize);
    state.visibleRows=rows.slice(0,state.index);
    renderDecisionActivityView();
    $('decisionActivityStatus').textContent=`Laddar sökträffar… visar ${fmtInt(state.index)} av ${fmtInt(rows.length)}.`;
    if(!await progressiveSearchFrameFinal(job))return;
  }
  if(job.cancelled)return;
  state.visibleRows=rows;
  renderDecisionActivityView();
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
