import http from 'node:http';
import {spawn} from 'node:child_process';
import {createReadStream,stat} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fileAudit=process.argv.includes('--file');
const filterResultsOnly=process.argv.includes('--filter-results-only');
const chromePath=process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const mime=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.gz','application/gzip']]);
const server=http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const file=path.resolve(root,pathname==='/'?'index.html':pathname.replace(/^\/+/,''));
  if(file!==root&&!file.startsWith(`${root}${path.sep}`)){response.writeHead(403).end();return;}
  stat(file,(error,info)=>{
    if(error||!info.isFile()){response.writeHead(404).end();return;}
    response.writeHead(200,{'content-type':mime.get(path.extname(file))||'application/octet-stream','content-length':info.size});
    createReadStream(file).pipe(response);
  });
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const port=server.address().port;
const debugPort=await new Promise((resolve,reject)=>{const probe=http.createServer();probe.once('error',reject);probe.listen(0,'127.0.0.1',()=>{const value=probe.address().port;probe.close(error=>error?reject(error):resolve(value));});});
const profile=await mkdtemp(path.join(os.tmpdir(),'dropdown-smoke-'));
const startUrl=fileAudit?pathToFileURL(path.join(root,'index.html')).href:`http://127.0.0.1:${port}/`;
const chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--allow-file-access-from-files',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,startUrl],{stdio:['ignore','ignore','pipe'],windowsHide:true});
let cdp=null;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function pageTarget(){
  for(let attempt=0;attempt<100;attempt++){
    try{const response=await fetch(`http://127.0.0.1:${debugPort}/json`);const target=(await response.json()).find(item=>item.type==='page');if(target)return target;}catch{}
    await wait(100);
  }
  throw Error('Chrome did not start.');
}
function connect(url){
  const socket=new WebSocket(url),pending=new Map();let nextId=0;
  socket.onmessage=event=>{const message=JSON.parse(String(event.data)),request=pending.get(message.id);if(!request)return;pending.delete(message.id);message.error?request.reject(Error(message.error.message)):request.resolve(message.result);};
  return new Promise((resolve,reject)=>{socket.onerror=reject;socket.onopen=()=>resolve({close:()=>socket.close(),send(method,params={}){return new Promise((res,rej)=>{const id=++nextId;pending.set(id,{resolve:res,reject:rej});socket.send(JSON.stringify({id,method,params}));});}});});
}
async function evaluate(expression){
  const result=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression,attempts=200){
  for(let attempt=0;attempt<attempts;attempt++){
    if(await evaluate(expression).catch(()=>false))return true;
    await wait(25);
  }
  return false;
}
async function keyboardSelect(id,stateExpression){
  const before=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.scrollIntoView({block:'center'});e.focus();const r=e.getBoundingClientRect();return {value:e.value,state:${stateExpression},disabled:e.disabled,options:e.options.length,pointer:getComputedStyle(e).pointerEvents,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.id||''}})()`);
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40,nativeVirtualKeyCode:40});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40,nativeVirtualKeyCode:40});
  const mid=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});return {value:e.value,state:${stateExpression},selectedText:e.options[e.selectedIndex]?.textContent||'',active:document.activeElement===e}})()`);
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
  await wait(150);
  const after=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});return {value:e.value,state:${stateExpression},selectedText:e.options[e.selectedIndex]?.textContent||'',active:document.activeElement===e}})()`);
  return {before,mid,after};
}
async function addAnotherFilter(id,stateExpression){
  const before=await evaluate(stateExpression);
  const chosen=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});const option=[...e.options].find(item=>!item.disabled&&item.value&&!item.value.startsWith('__')&&item.value!==e.value);if(!option)return '';e.value=option.value;e.dispatchEvent(new Event('change',{bubbles:true}));return option.value})()`);
  await wait(300);
  const after=await evaluate(stateExpression);
  return {chosen,before,after};
}
async function auditSelects(ids){
  const result={};
  for(const id of ids)result[id]=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {options:e.options.length,disabled:e.disabled,pointer:getComputedStyle(e).pointerEvents,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.id||''}})()`);
  return result;
}
async function auditDecisionFilterResults(id){
  const selected=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)}),option=[...e.options].find(item=>!item.disabled&&item.value&&!item.value.startsWith('__'));if(!option)return '';e.value=option.value;e.dispatchEvent(new Event('change',{bubbles:true}));return option.value})()`);
  await waitFor(`(()=>{const state=decisionProgressiveSearchStateFinal;return !!state?.finished&&state.baseFilterKey===decisionStableBaseFilterKeyFinal()})()`,400);
  const result=await evaluate(`(()=>{const state=decisionProgressiveSearchStateFinal;return {id:${JSON.stringify(id)},selected:${JSON.stringify(selected)},canonical:decisionCanonicalPreparationReadyFinal(),finished:!!state?.finished,fromTableIndex:!!state?.fromTableIndex,matches:state?.filteredMatches?.length??-1,visible:document.getElementById('decisionBody')?.children.length??-1,status:document.getElementById('decisionPage')?.textContent||''}})()`);
  await evaluate(`(()=>{decisionFilterLocks[${JSON.stringify(id)}]=[];decisionScheduleProgressiveRefreshFinal();return true})()`);
  await waitFor(`(()=>{const state=decisionProgressiveSearchStateFinal;return !!state?.finished&&state.baseFilterKey===decisionStableBaseFilterKeyFinal()})()`,400);
  return result;
}
async function auditCombinedDecisionFilterResults(){
  const selected=await evaluate(`(()=>{const choose=id=>{const e=document.getElementById(id),option=[...e.options].find(item=>!item.disabled&&item.value&&!item.value.startsWith('__'));if(!option)return '';e.value=option.value;e.dispatchEvent(new Event('change',{bubbles:true}));return option.value;};return [choose('decisionOrgan'),choose('decisionParty')]})()`);
  await waitFor(`(()=>{const state=decisionProgressiveSearchStateFinal;return !!state?.finished&&state.baseFilterKey===decisionStableBaseFilterKeyFinal()})()`,400);
  const result=await evaluate(`(()=>{const state=decisionProgressiveSearchStateFinal;return {id:'combined',selected:${JSON.stringify(selected)},canonical:decisionCanonicalPreparationReadyFinal(),finished:!!state?.finished,fromTableIndex:!!state?.fromTableIndex,matches:state?.filteredMatches?.length??-1,visible:document.getElementById('decisionBody')?.children.length??-1,status:document.getElementById('decisionPage')?.textContent||''}})()`);
  await evaluate(`(()=>{decisionFilterLocks.decisionOrgan=[];decisionFilterLocks.decisionParty=[];decisionScheduleProgressiveRefreshFinal();return true})()`);
  await waitFor(`(()=>{const state=decisionProgressiveSearchStateFinal;return !!state?.finished&&state.baseFilterKey===decisionStableBaseFilterKeyFinal()})()`,400);
  return result;
}
async function functionalSelect(id,stateExpression){
  const before=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)}),r=e.getBoundingClientRect();return {value:e.value,state:${stateExpression},disabled:e.disabled,options:e.options.length,pointer:getComputedStyle(e).pointerEvents,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.id||''}})()`);
  const mid=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)}),option=[...e.options].find(item=>item.value&&!item.value.startsWith('__'));e.focus();if(option){e.value=option.value;e.dispatchEvent(new Event('change',{bubbles:true}));}return {value:e.value,state:${stateExpression},selectedText:e.options[e.selectedIndex]?.textContent||'',active:document.activeElement===e}})()`);
  await evaluate(`document.getElementById(${JSON.stringify(id)}).blur()`);
  await wait(150);
  const after=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});return {value:e.value,state:${stateExpression},selectedText:e.options[e.selectedIndex]?.textContent||'',active:document.activeElement===e}})()`);
  return {before,mid,after};
}
async function exerciseSelects(configs){
  const result={};
  for(const config of configs){
    result[config.id]=await functionalSelect(config.id,config.state);
    await evaluate(config.reset);
    await wait(100);
  }
  return result;
}

try{
  cdp=await connect((await pageTarget()).webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await waitFor(`document.readyState==='complete'&&typeof setTopView==='function'&&tabs.length===1`);
  await waitFor(`sessionDataPreloadStartedFinal&&(rawDataPromise||rawReady)&&decisionTableIndexStartedFinal&&(decisionCanonicalMountPromise||decisionCanonicalPreparationReadyFinal())&&(progressiveSearchJobsFinal.has('decision-activity')||decisionActivityProgressiveSearchStateFinal?.complete)`,400);
  await waitFor(`!rawReady&&rawProgressiveSearchStateFinal?.index>0&&document.getElementById('rawYear').options.length>1&&document.getElementById('rawParty').options.length>1`,400);
  const eagerStartup=await evaluate(`(()=>{
    window.__eagerDataRefs={rawLoad:rawDataPromise,rawState:rawProgressiveSearchStateFinal,indexLoad:decisionTableIndexPromiseFinal,canonicalLoad:decisionCanonicalMountPromise,activityState:decisionActivityProgressiveSearchStateFinal};
    return {started:sessionDataPreloadStartedFinal,startedBeforeVisit:currentTopView()==='calculator',historic:!!rawDataPromise||rawReady,decisionIndex:decisionTableIndexStartedFinal&&!!decisionTableIndexPromiseFinal,decisionCanonical:!!decisionCanonicalMountPromise||decisionCanonicalPreparationReadyFinal(),documents:!!decisionActivityProgressiveSearchStateFinal,view:currentTopView()};
  })()`);
  const rawProgressiveFilters=await evaluate(`({whileLoading:!rawReady,yearOptions:document.getElementById('rawYear').options.length,partyOptions:document.getElementById('rawParty').options.length,yearDisabled:document.getElementById('rawYear').disabled,partyDisabled:document.getElementById('rawParty').disabled})`);
  const rawBackgroundLoad=await evaluate(`(async()=>{
    const refs=window.__eagerDataRefs,state=refs.rawState,startIndex=state?.index||0,startedInProgress=!!refs.rawLoad&&!rawReady;
    await setTopView('raw');await new Promise(resolve=>requestAnimationFrame(resolve));
    await setTopView('decision');await new Promise(resolve=>requestAnimationFrame(resolve));
    await setTopView('decisionActivity');await new Promise(resolve=>requestAnimationFrame(resolve));
    await setTopView('calculator');await new Promise(resolve=>setTimeout(resolve,250));
    const awayIndex=state?.index||0,awayReady=rawReady;
    return {startedBeforeVisit:true,startedInProgress,startIndex,awayIndex,continuedWhileAway:awayReady||awayIndex>=startIndex,sameLoadWhileAway:awayReady||rawDataPromise===refs.rawLoad,sameStateWhileAway:awayReady||rawProgressiveSearchStateFinal===state,decisionIndexContinued:decisionTableIndexCompleteFinal||decisionTableIndexPromiseFinal===refs.indexLoad,decisionCanonicalContinued:decisionCanonicalPreparationReadyFinal()||decisionCanonicalMountPromise===refs.canonicalLoad,documentsContinued:decisionActivityProgressiveSearchStateFinal===refs.activityState||!!decisionActivityProgressiveSearchStateFinal?.complete,view:currentTopView()};
  })()`);
  const calculatorTemplate=await evaluate(`(()=>{
    const heading=document.querySelector('#calculatorView > h2'),description=heading?.nextElementSibling;
    const before={tabs:tabs.length,activeTab,role:tabs[0]?.role,title:tabs[0]?.title,heading:heading?.textContent,description:description?.textContent,closeButtons:document.querySelectorAll('.calc-tab-close').length,settingsHidden:document.getElementById('calcSettings').hidden,summaryVisible:!document.getElementById('calcSummary').hidden,templateSummary:document.getElementById('calcSummary').classList.contains('calc-template-summary'),visibleSummaryCards:[...document.querySelectorAll('#calcSummary .card')].filter(card=>getComputedStyle(card).display!=='none').length,initialVotes:document.getElementById('cardVotes').textContent,actionsRemoved:document.getElementById('calcActions').hidden&&getComputedStyle(document.getElementById('calcActions')).display==='none',templateVisible:!document.getElementById('calcTemplateIntro').hidden,addBelowTable:document.querySelector('.mobile-table-scroll')?.nextElementSibling?.contains(document.getElementById('add'))||false};
    closeCalcTab(0);
    const afterClose={tabs:tabs.length,activeTab};
    const templateName=document.querySelectorAll('.p-name')[1],templateRow=templateName.closest('tr');templateName.value='Moderaterna';templateName.dispatchEvent(new Event('input',{bubbles:true}));
    const templateIcon={state:tabs[0].parties[1].icon,select:templateRow.querySelector('.p-icon').value,src:templateRow.querySelector('.logo')?.getAttribute('src')||''};
    const vote=document.querySelector('.p-votes');vote.value='41';vote.dispatchEvent(new Event('input',{bubbles:true}));
    const updatedVotes=document.getElementById('cardVotes').textContent;
    const templateParties=JSON.stringify(tabs[0].parties.map(p=>[p.name,p.votes,p.icon]));
    document.getElementById('newTab').click();
    const afterCreate={tabs:tabs.length,activeTab,role:current()?.role,title:current()?.title,closeButtons:document.querySelectorAll('.calc-tab-close').length,settingsHidden:document.getElementById('calcSettings').hidden,summaryHidden:document.getElementById('calcSummary').hidden,actionsVisible:!document.getElementById('calcActions').hidden&&getComputedStyle(document.getElementById('calcActions')).display!=='none',templateHidden:document.getElementById('calcTemplateIntro').hidden,importVisible:!document.getElementById('calcImportTools').hidden,copied:JSON.stringify(current().parties.map(p=>[p.name,p.votes,p.icon]))===templateParties};
    const calculationName=document.querySelectorAll('.p-name')[2],calculationRow=calculationName.closest('tr');calculationName.value='ÖrP';calculationName.dispatchEvent(new Event('input',{bubbles:true}));
    const calculationIcon={state:current().parties[2].icon,select:calculationRow.querySelector('.p-icon').value,src:calculationRow.querySelector('.logo')?.getAttribute('src')||''};
    return {before,afterClose,afterCreate,templateIcon,calculationIcon,updatedVotes,templateParties};
  })()`);
  const calculator=await keyboardSelect('method',`document.getElementById('method').value`);
  const calculatorIcon=await evaluate(`(()=>{const e=document.querySelector('.p-icon'),before=current().parties[0].icon,option=[...e.options].find(item=>Number(item.value)!==Number(e.value));e.scrollIntoView({block:'center'});e.value=option.value;e.dispatchEvent(new Event('input',{bubbles:true}));const r=e.getBoundingClientRect();return {options:e.options.length,disabled:e.disabled,pointer:getComputedStyle(e).pointerEvents,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.classList.contains('p-icon')||false,before,after:current().parties[0].icon}})()`);
  const calculatorImport=await evaluate(`(()=>{
    document.getElementById('calculate').click();
    const source=current(),sourceId=source.id,expected=calculationMandateRows(source).map(p=>[p.name,p.votes,p.icon]);
    document.getElementById('newTab').click();
    const copiedFromTemplate=JSON.stringify(current().parties.map(p=>[p.name,p.votes,p.icon]))===${JSON.stringify(calculatorTemplate.templateParties)};
    const select=document.getElementById('calcImportSource'),sourceOption=[...select.options].find(option=>Number(option.value)===sourceId);
    if(sourceOption){select.value=sourceOption.value;select.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('calcImportApply').click();}
    return {sourceReady:!!source.result&&!source.dirty,sourceOption:!!sourceOption,copiedFromTemplate,imported:JSON.stringify(current().parties.map(p=>[p.name,p.votes,p.icon]))===JSON.stringify(expected),dirty:current().dirty,resultCleared:current().result===null,notice:document.getElementById('notice').textContent,tabCount:tabs.length,templateRole:tabs[0]?.role};
  })()`);
  await evaluate(`document.getElementById('rawTopTab').click()`);
  await waitFor(`typeof rawReady!=='undefined'&&rawReady&&!!rawProgressiveSearchStateFinal?.complete&&document.getElementById('rawYear').options.length>1`,600);
  rawBackgroundLoad.completed=await evaluate(`rawReady&&!!rawProgressiveSearchStateFinal?.complete`);
  rawBackgroundLoad.sameLoadOnReturn=await evaluate(`rawReady||rawDataPromise===window.__eagerDataRefs.rawLoad`);
  rawBackgroundLoad.sameStateOnReturn=await evaluate(`rawReady||rawProgressiveSearchStateFinal===window.__eagerDataRefs.rawState`);
  rawBackgroundLoad.view=await evaluate(`currentTopView()`);
  const rawSortReuse=await evaluate(`(()=>{
    const state=rawProgressiveSearchStateFinal,resultIds=[...state.matches].map(row=>row.__rawId).sort((a,b)=>a-b).join('|'),overviewCard=document.querySelector('#rawOverview .card'),column=rawSortColumn,beforeDirection=rawSortDir;
    setRawSort(column);
    const ascendingOrDescending={sameState:state===rawProgressiveSearchStateFinal,noScan:!progressiveSearchJobsFinal.has('raw'),directionChanged:rawSortDir!==beforeDirection,sameResults:[...state.matches].map(row=>row.__rawId).sort((a,b)=>a-b).join('|')===resultIds,ordered:state.sortedRows.every((row,index)=>!index||rawProgressiveCompareFinal(state.sortedRows[index-1],row)<=0),sameOverviewCard:overviewCard===document.querySelector('#rawOverview .card')};
    const firstDirection=rawSortDir;
    setRawSort(column);
    return {...ascendingOrDescending,roundTrip:rawSortDir===beforeDirection,secondNoScan:!progressiveSearchJobsFinal.has('raw'),secondSameState:state===rawProgressiveSearchStateFinal,secondOrdered:state.sortedRows.every((row,index)=>!index||rawProgressiveCompareFinal(state.sortedRows[index-1],row)<=0),firstDirection};
  })()`);
  const rawPartyCanonical=await evaluate(`(async()=>{
    buildRawFilters();for(let frame=0;frame<7;frame++)await new Promise(resolve=>requestAnimationFrame(resolve));
    const sourceVariants=[...new Set(rawRows.map(row=>rawValue(row,'party_standard')).filter(value=>/^(?:ÖrP|ÖP|Örebropartiet)$/i.test(value)))].sort();
    const canonicalVariants=[...new Set(rawRows.filter(row=>/^(?:ÖrP|ÖP|Örebropartiet)$/i.test(rawValue(row,'party_standard'))).map(row=>rawComparable(row,'party_standard')))];
    const matchingRows=rawRows.filter(row=>rawComparable(row,'party_standard')==='Örebropartiet');
    const options=[...document.getElementById('rawParty').options].map(option=>option.value).filter(value=>value&&!value.startsWith('__'));
    return {sourceVariants,canonicalVariants,matchingRows:matchingRows.length,canonicalOptionCount:options.filter(value=>value==='Örebropartiet').length,aliasOptionCount:options.filter(value=>value==='ÖrP').length,display:new Set(matchingRows.map(row=>rawDisplay('party_standard',rawValue(row,'party_standard')))).size};
  })()`);
  const rawPartyOrdering=await evaluate(`(async()=>{
    const saved=Object.fromEntries(Object.entries(rawFilterLocks).map(([key,value])=>[key,[...value]]));
    const sample=rawRows.find(row=>String(row.year)==='2022'&&rawComparable(row,'election_type')==='municipal'&&/rebro/i.test(rawComparable(row,'municipality_name')));
    if(!sample)return {ok:false,reason:'missing-context'};
    rawFilterLocks={rawYear:['2022'],rawElection:['municipal'],rawCounty:[rawComparable(sample,'county_name')],rawMunicipality:[rawComparable(sample,'municipality_name')],rawParty:[]};
    buildRawFilters();
    for(let frame=0;frame<7;frame++)await new Promise(resolve=>requestAnimationFrame(resolve));
    const rows=rawRowsForPartyOptions(rawRows),totals=new Map();
    rows.forEach(row=>{const party=rawComparable(row,'party_standard');if(party)totals.set(party,(totals.get(party)||0)+(Number(rawValue(row,'votes'))||0));});
    const expected=[...totals].sort((a,b)=>b[1]-a[1]||rawDisplay('party_standard',a[0]).localeCompare(rawDisplay('party_standard',b[0]),'sv',{numeric:true,sensitivity:'base'})).map(([party])=>party);
    const actual=[...document.getElementById('rawParty').options].map(option=>option.value).filter(value=>value&&!value.startsWith('__'));
    const votes=actual.map(party=>totals.get(party)||0),descending=votes.every((value,index)=>index===0||votes[index-1]>=value);
    rawFilterLocks=saved;buildRawFilters();rawScheduleProgressiveFinal();
    for(let frame=0;frame<7;frame++)await new Promise(resolve=>requestAnimationFrame(resolve));
    return {ok:descending&&JSON.stringify(actual)===JSON.stringify(expected),actual:actual.slice(0,12),votes:votes.slice(0,12),expected:expected.slice(0,12)};
  })()`);
  const rawInventory=await auditSelects(['rawYear','rawElection','rawCounty','rawMunicipality','rawParty']);
  const rawFunctional=await exerciseSelects(['rawYear','rawElection','rawCounty','rawMunicipality','rawParty'].map(id=>({
    id,state:`JSON.stringify(rawFilterLocks[${JSON.stringify(id)}])`,
    reset:`(()=>{rawFilterLocks[${JSON.stringify(id)}]=[];buildRawFilters();rawScheduleProgressiveFinal();return true})()`
  })));
  const raw=await keyboardSelect('rawYear',`JSON.stringify(rawFilterLocks.rawYear)`);
  await evaluate(`document.getElementById('decisionTopTab').click()`);
  await waitFor(`document.getElementById('decisionOrgan').options.length>1`,400);
  const decisionCold=await evaluate(`({options:document.getElementById('decisionOrgan').options.length,bootstrap:!!window.municipalDecisionTableBootstrap?.filterOptions,canonical:decisionCanonicalPreparationReadyFinal()})`);
  const decisionColdFilterResults={
    organ:await auditDecisionFilterResults('decisionOrgan'),
    proposalType:await auditDecisionFilterResults('decisionProposalType'),
    party:await auditDecisionFilterResults('decisionParty'),
    member:await auditDecisionFilterResults('decisionMember'),
    vote:await auditDecisionFilterResults('decisionVote'),
    result:await auditDecisionFilterResults('decisionResult'),
    combined:await auditCombinedDecisionFilterResults()
  };
  const decisionMemberMarkers=await evaluate(`(()=>{
    const id='decisionMember',select=document.getElementById(id);
    decisionFilterLocks[id]=[];decisionReconcileFilterSelectFinal(id);
    const option=[...select.options].find(item=>!item.disabled&&item.value&&!item.value.startsWith('__'));
    if(!option)return {chosen:'',before:[],locks:[],after:[],afterLocks:[]};
    select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));
    const chosen=option.value,before=[...select.querySelectorAll('[data-filter-selected]')].map(item=>item.value),locks=[...decisionFilterLocks[id]];
    document.querySelector('#decisionFilterLocks .raw-filter-chip button[data-id="decisionMember"]')?.click();
    const after=[...select.querySelectorAll('[data-filter-selected]')].map(item=>item.value),afterLocks=[...decisionFilterLocks[id]];
    return {chosen,before,locks,after,afterLocks};
  })()`);
  await evaluate(`document.getElementById('decisionDateToggle').click()`);
  await waitFor(`document.querySelector('.date-calendar-month')?.options.length===12`);
  const calendarBefore=await evaluate(`(()=>{const month=document.querySelector('.date-calendar-month'),year=document.querySelector('.date-calendar-year'),r=month.getBoundingClientRect();return {month:month.value,monthOptions:month.options.length,yearOptions:year.options.length,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.classList.contains('date-calendar-month')||false,canonical:decisionCanonicalPreparationReadyFinal()}})()`);
  const calendarMonthAfter=await evaluate(`(()=>{const month=document.querySelector('.date-calendar-month'),option=[...month.options].find(item=>item.value!==month.value);month.value=option.value;month.dispatchEvent(new Event('change',{bubbles:true}));return decisionCalendarMonth})()`);
  const calendarYearAfter=await evaluate(`(()=>{const year=document.querySelector('.date-calendar-year'),before=year.value,option=[...year.options].find(item=>item.value!==before);year.value=option.value;year.dispatchEvent(new Event('change',{bubbles:true}));return {before,after:decisionCalendarMonth.slice(0,4)}})()`);
  await evaluate(`document.getElementById('decisionDateToggle').click()`);
  const decisionInventory=await auditSelects(['decisionOrgan','decisionProposalType','decisionParty','decisionMember','decisionVote','decisionResult']);
  const decisionFunctional=await exerciseSelects(['decisionOrgan','decisionProposalType','decisionParty','decisionMember','decisionVote','decisionResult'].map(id=>({
    id,state:`JSON.stringify(decisionFilterLocks[${JSON.stringify(id)}])`,
    reset:`(()=>{decisionFilterLocks[${JSON.stringify(id)}]=[];decisionApplyBootstrapFilterOptionsFinal();decisionScheduleProgressiveRefreshFinal();return true})()`
  })));
  await waitFor(`decisionProgressiveStateIsCurrentFinal()`,400);
  const decisionOverviewResume=await evaluate(`(async()=>{
    const state=decisionProgressiveSearchStateFinal,expected=fmtInt(state.summary.tableRows),overview=document.getElementById('decisionOverview');
    await setTopView('calculator');
    overview.querySelector('b').textContent='stale';overview.setAttribute('aria-busy','true');
    await setTopView('decision');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return {expected,actual:overview.querySelector('b')?.textContent||'',busy:overview.getAttribute('aria-busy'),view:currentTopView()};
  })()`);
  const navigationDuringDecisionLoad=await evaluate(`(async()=>{
    const started=performance.now();
    ensureDecisionCanonicalDataFinal().catch(()=>{});
    await new Promise(resolve=>setTimeout(resolve,25));
    const loadingAtSwitch=!decisionCanonicalPreparationReadyFinal();
    document.getElementById('rawTopTab').click();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const result={view:currentTopView(),loadingAtSwitch,totalMs:performance.now()-started,canonicalPending:!!decisionCanonicalMountPromise};
    document.getElementById('decisionTopTab').click();
    return result;
  })()`);
  const decision=await keyboardSelect('decisionOrgan',`JSON.stringify(decisionFilterLocks.decisionOrgan)`);
  await evaluate(`document.getElementById('decisionActivityTopTab').click()`);
  await waitFor(`document.getElementById('decisionActivityType').options.length>1`,400);
  const activityInventory=await auditSelects(['decisionActivityType','decisionActivityParty','decisionActivityPoliticalOwner','decisionActivityOfficialOwner']);
  const activityKeys={decisionActivityType:'type',decisionActivityParty:'party',decisionActivityPoliticalOwner:'politicalOwner',decisionActivityOfficialOwner:'officialOwner'};
  const activityFunctional=await exerciseSelects(Object.entries(activityKeys).map(([id,key])=>({
    id,state:`JSON.stringify(decisionActivityFilters[${JSON.stringify(key)}])`,
    reset:`(()=>{decisionActivityFilters[${JSON.stringify(key)}]=[];buildDecisionActivityFilters();renderDecisionActivityView();return true})()`
  })));
  const navigationDuringActivityLoad=await evaluate(`(async()=>{
    decisionActivitySearchQuery='audit-background-load';
    document.getElementById('decisionActivitySearch').value=decisionActivitySearchQuery;
    scheduleTableSearch('decision-activity','decisionActivitySearch',['decisionActivityBody'],()=>renderDecisionActivityView());
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const loadingAtSwitch=!!decisionActivityProgressiveSearchStateFinal&&!decisionActivityProgressiveSearchStateFinal.complete;
    const started=performance.now();
    document.getElementById('calculatorTopTab').click();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const result={view:currentTopView(),loadingAtSwitch,switchMs:performance.now()-started,jobContinues:!!progressiveSearchJobsFinal.get('decision-activity')};
    decisionActivitySearchQuery='';document.getElementById('decisionActivitySearch').value='';
    document.getElementById('decisionActivityTopTab').click();
    return result;
  })()`);
  const activity=await keyboardSelect('decisionActivityType',`JSON.stringify(decisionActivityFilters.type)`);
  const additive={
    raw:await addAnotherFilter('rawYear',`JSON.stringify(rawFilterLocks.rawYear)`),
    decision:await addAnotherFilter('decisionOrgan',`JSON.stringify(decisionFilterLocks.decisionOrgan)`),
    activity:await addAnotherFilter('decisionActivityType',`JSON.stringify(decisionActivityFilters.type)`)
  };
  const reloadExpected=await evaluate(`({top:currentTopView(),raw:JSON.stringify(rawFilterLocks.rawYear),decision:JSON.stringify(decisionFilterLocks.decisionOrgan),activity:JSON.stringify(decisionActivityFilters.type),calculator:JSON.stringify(tabs.map(tab=>[tab.role,tab.title,tab.dirty,tab.parties.map(party=>[party.name,party.votes,party.icon])]))})`);
  const reloadHash=await evaluate(`(async()=>{await updateUrlHashSession();return location.hash})()`);
  await cdp.send('Page.enable');
  await cdp.send('Page.reload',{ignoreCache:true});
  await waitFor(`document.readyState==='complete'&&typeof currentTopView==='function'&&currentTopView()===${JSON.stringify(reloadExpected.top)}&&JSON.stringify(rawFilterLocks.rawYear)===${JSON.stringify(reloadExpected.raw)}&&JSON.stringify(decisionFilterLocks.decisionOrgan)===${JSON.stringify(reloadExpected.decision)}&&JSON.stringify(decisionActivityFilters.type)===${JSON.stringify(reloadExpected.activity)}&&JSON.stringify(tabs.map(tab=>[tab.role,tab.title,tab.dirty,tab.parties.map(party=>[party.name,party.votes,party.icon])]))===${JSON.stringify(reloadExpected.calculator)}`,500);
  const reload=await evaluate(`({mode:location.protocol==='file:'?'file':'http',hash:location.hash,top:currentTopView(),raw:JSON.stringify(rawFilterLocks.rawYear),decision:JSON.stringify(decisionFilterLocks.decisionOrgan),activity:JSON.stringify(decisionActivityFilters.type),calculator:JSON.stringify(tabs.map(tab=>[tab.role,tab.title,tab.dirty,tab.parties.map(party=>[party.name,party.votes,party.icon])])),activityOptions:document.getElementById('decisionActivityType').options.length,promptDisabled:document.getElementById('decisionActivityType').options[0]?.disabled??true})`);
  const postReload=await addAnotherFilter('decisionActivityType',`JSON.stringify(decisionActivityFilters.type)`);
  const inventory={...rawInventory,...decisionInventory,...activityInventory};
  const functional={...rawFunctional,...decisionFunctional,...activityFunctional};
  const functionalFailures=Object.entries(functional).filter(([,item])=>item.before.disabled||item.before.options<2||item.before.state===item.after.state).map(([id,item])=>({id,mid:item.mid,after:item.after}));
  const result={mode:fileAudit?'file':'http',functionalFailures,eagerStartup,calculatorTemplate,calculatorImport,calculator,calculatorIcon,rawProgressiveFilters,rawBackgroundLoad,rawSortReuse,rawPartyCanonical,rawPartyOrdering,inventory,functional,raw,decisionCold,decisionColdFilterResults,decisionMemberMarkers,decisionOverviewResume,calendar:{before:calendarBefore,monthAfter:calendarMonthAfter,yearAfter:calendarYearAfter},navigationDuringDecisionLoad,navigationDuringActivityLoad,decision,activity,additive,reloadExpected,reloadHashChanged:!!reloadHash,reload,postReload};
  console.log(JSON.stringify(filterResultsOnly?{eagerStartup,calculatorTemplate,rawProgressiveFilters,rawBackgroundLoad,rawSortReuse,rawPartyCanonical,decisionColdFilterResults,decisionMemberMarkers,decisionOverviewResume}:result,null,2));
  if(!eagerStartup.started||!eagerStartup.startedBeforeVisit||!eagerStartup.historic||!eagerStartup.decisionIndex||!eagerStartup.decisionCanonical||!eagerStartup.documents||eagerStartup.view!=='calculator'||!rawBackgroundLoad.startedBeforeVisit||!rawBackgroundLoad.decisionIndexContinued||!rawBackgroundLoad.decisionCanonicalContinued||!rawBackgroundLoad.documentsContinued)process.exitCode=1;
  if(calculatorTemplate.before.tabs!==1||calculatorTemplate.before.activeTab!==0||calculatorTemplate.before.role!=='template'||calculatorTemplate.before.title!=='Huvudvy'||calculatorTemplate.before.heading!=='Kalkylator för mandat'||!calculatorTemplate.before.description?.startsWith('Beräkna och jämför')||calculatorTemplate.before.closeButtons!==0||!calculatorTemplate.before.settingsHidden||!calculatorTemplate.before.summaryVisible||!calculatorTemplate.before.templateSummary||calculatorTemplate.before.visibleSummaryCards!==1||calculatorTemplate.before.initialVotes!=='65'||calculatorTemplate.updatedVotes!=='70'||calculatorTemplate.templateIcon.state!==2||calculatorTemplate.templateIcon.select!=='2'||!calculatorTemplate.templateIcon.src.includes('logo_m')||calculatorTemplate.calculationIcon.state!==9||calculatorTemplate.calculationIcon.select!=='9'||!calculatorTemplate.calculationIcon.src.includes('logo_op')||!calculatorTemplate.before.actionsRemoved||!calculatorTemplate.before.templateVisible||!calculatorTemplate.before.addBelowTable||calculatorTemplate.afterClose.tabs!==1||calculatorTemplate.afterClose.activeTab!==0||calculatorTemplate.afterCreate.tabs!==2||calculatorTemplate.afterCreate.activeTab!==1||calculatorTemplate.afterCreate.role!=='calculation'||calculatorTemplate.afterCreate.closeButtons!==1||calculatorTemplate.afterCreate.settingsHidden||calculatorTemplate.afterCreate.summaryHidden||!calculatorTemplate.afterCreate.actionsVisible||!calculatorTemplate.afterCreate.templateHidden||!calculatorTemplate.afterCreate.importVisible||!calculatorTemplate.afterCreate.copied||!calculatorImport.sourceReady||!calculatorImport.sourceOption||!calculatorImport.copiedFromTemplate||!calculatorImport.imported||!calculatorImport.dirty||!calculatorImport.resultCleared||calculatorImport.tabCount!==3||calculatorImport.templateRole!=='template'||!rawProgressiveFilters.whileLoading||rawProgressiveFilters.yearDisabled||rawProgressiveFilters.partyDisabled||rawProgressiveFilters.yearOptions<2||rawProgressiveFilters.partyOptions<2||!rawBackgroundLoad.startedInProgress||!rawBackgroundLoad.continuedWhileAway||!rawBackgroundLoad.sameLoadWhileAway||!rawBackgroundLoad.sameStateWhileAway||!rawBackgroundLoad.sameLoadOnReturn||!rawBackgroundLoad.sameStateOnReturn||rawBackgroundLoad.view!=='raw'||!rawBackgroundLoad.completed||!rawSortReuse.sameState||!rawSortReuse.noScan||!rawSortReuse.directionChanged||!rawSortReuse.sameResults||!rawSortReuse.ordered||!rawSortReuse.sameOverviewCard||!rawSortReuse.roundTrip||!rawSortReuse.secondNoScan||!rawSortReuse.secondSameState||!rawSortReuse.secondOrdered||rawPartyCanonical.sourceVariants.length!==3||rawPartyCanonical.canonicalVariants.length!==1||rawPartyCanonical.canonicalVariants[0]!=='Örebropartiet'||rawPartyCanonical.matchingRows!==44||rawPartyCanonical.canonicalOptionCount!==1||rawPartyCanonical.aliasOptionCount!==0||rawPartyCanonical.display!==1||!rawPartyOrdering.ok||!decisionCold.bootstrap||decisionCold.options<2||Object.values(decisionColdFilterResults).some(item=>!item.selected||!item.finished||item.matches<=0)||!decisionMemberMarkers.chosen||JSON.stringify(decisionMemberMarkers.before)!==JSON.stringify(decisionMemberMarkers.locks)||decisionMemberMarkers.after.length||decisionMemberMarkers.afterLocks.length||decisionOverviewResume.actual!==decisionOverviewResume.expected||decisionOverviewResume.busy!=='false'||decisionOverviewResume.view!=='decision'||calculatorIcon.disabled||calculatorIcon.pointer==='none'||!calculatorIcon.hit||calculatorIcon.options<2||calculatorIcon.before===calculatorIcon.after||calendarBefore.monthOptions!==12||calendarBefore.yearOptions<2||!calendarBefore.hit||calendarBefore.month===calendarMonthAfter.slice(-2)||calendarYearAfter.before===calendarYearAfter.after||Object.values(inventory).some(item=>item.disabled||item.pointer==='none'||!item.hit||item.options<2)||Object.values(functional).some(item=>item.before.disabled||item.before.options<2||item.before.state===item.after.state)||Object.entries({calculator,raw,decision,activity}).some(([,item])=>item.before.disabled||item.before.pointer==='none'||!item.before.hit||item.before.options<2||item.before.state===item.after.state)||navigationDuringDecisionLoad.view!=='raw'||navigationDuringDecisionLoad.totalMs>1500||navigationDuringActivityLoad.view!=='calculator'||navigationDuringActivityLoad.switchMs>250||!navigationDuringActivityLoad.jobContinues||Object.values(additive).some(item=>!item.chosen||item.before===item.after||JSON.parse(item.after).length<2)||!reloadHash||reload.top!==reloadExpected.top||reload.raw!==reloadExpected.raw||reload.decision!==reloadExpected.decision||reload.activity!==reloadExpected.activity||reload.calculator!==reloadExpected.calculator||reload.activityOptions<2||reload.promptDisabled||!postReload.chosen||JSON.parse(postReload.after).length<3)process.exitCode=1;
}finally{
  cdp?.close();chrome.kill();server.close();
  await wait(300);
  await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
