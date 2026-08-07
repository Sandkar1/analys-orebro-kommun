import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createReadStream, stat } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const useFileUrl=process.argv.includes('--file');
const chromePath=process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const mime=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8'],['.gz','application/gzip']]);
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
const profile=await mkdtemp(path.join(os.tmpdir(),'decision-stream-smoke-'));
const targetUrl=useFileUrl?pathToFileURL(path.join(root,'index.html')).href:`http://127.0.0.1:${port}/`;
const chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,targetUrl],{stdio:['ignore','ignore','pipe'],windowsHide:true});
let chromeError='';
chrome.stderr.on('data',chunk=>{chromeError+=String(chunk);});

async function pageTarget(){
  for(let attempt=0;attempt<100;attempt++){
    try{const response=await fetch(`http://127.0.0.1:${debugPort}/json`);const target=(await response.json()).find(item=>item.type==='page');if(target)return target;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error(`Chrome startade inte. ${chromeError.slice(-1000)}`);
}
function connect(url){
  const socket=new WebSocket(url),pending=new Map();let nextId=0;
  socket.onmessage=event=>{const message=JSON.parse(String(event.data)),request=pending.get(message.id);if(!request)return;pending.delete(message.id);message.error?request.reject(Error(message.error.message)):request.resolve(message.result);};
  return new Promise((resolve,reject)=>{socket.onerror=reject;socket.onopen=()=>resolve({close:()=>socket.close(),send(method,params={}){return new Promise((res,rej)=>{const id=++nextId;pending.set(id,{resolve:res,reject:rej});socket.send(JSON.stringify({id,method,params}));});}});});
}
async function evaluate(cdp,expression){
  const result=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}

let cdp;
try{
  cdp=await connect((await pageTarget()).webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  for(let attempt=0;attempt<200;attempt++){
    if(await evaluate(cdp,'document.readyState==="complete"&&typeof setTopView==="function"'))break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  const result=await evaluate(cdp,`(async()=>{
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const longTasks=[];
    const longTaskObserver=typeof PerformanceObserver==='function'?new PerformanceObserver(list=>list.getEntries().forEach(entry=>longTasks.push({start:Math.round(entry.startTime),duration:Math.round(entry.duration)}))):null;
    try{longTaskObserver?.observe({type:'longtask',buffered:true});}catch{}
    let lastBeat=performance.now(),maxGap=0;
    const heartbeat=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-lastBeat);lastBeat=now;},16);
    const started=performance.now();
    await setTopView('decision');
    const immediateReturnMs=performance.now()-started;
    let firstRowMs=null,firstRowBeforeDetails=false,percentWithNoRows=false;
    const samples=[];
    for(let attempt=0;attempt<600;attempt++){
      const rows=document.querySelectorAll('#decisionBody tr').length;
      const status=document.querySelector('#decisionPage')?.textContent||'';
      const percent=Number(status.match(/(\\d+)\\s*%/)?.[1]||0);
      if(percent>=1&&!rows)percentWithNoRows=true;
      if(rows&&firstRowMs===null){firstRowMs=performance.now()-started;firstRowBeforeDetails=!decisionCanonicalPreparationReadyFinal();}
      if(attempt%10===0)samples.push({ms:Math.round(performance.now()-started),rows,percent,index:decisionProgressiveSearchStateFinal?.index||0,received:decisionTableIndexRowsFinal.length});
      if(decisionTableIndexCompleteFinal&&decisionProgressiveSearchStateFinal?.finished)break;
      await wait(20);
    }
    const initialState=decisionProgressiveSearchStateFinal;
    const initial={received:decisionTableIndexRowsFinal.length,total:decisionTableIndexTotalFinal,processed:initialState?.index||0,visible:document.querySelectorAll('#decisionBody tr').length,finished:!!initialState?.finished};
    const input=document.querySelector('#decisionDecisionSearch');
    input.value='skola';input.dispatchEvent(new Event('input',{bubbles:true}));
    const typedAt=performance.now();let searchStartedMs=null;
    for(let attempt=0;attempt<600;attempt++){
      const state=decisionProgressiveSearchStateFinal;
      if(searchStartedMs===null&&state?.key==='skola'&&state.index>0)searchStartedMs=performance.now()-typedAt;
      if(state?.key==='skola'&&state.finished)break;
      await wait(20);
    }
    clearInterval(heartbeat);
    longTaskObserver?.disconnect();
    const actual=decisionProgressiveSearchStateFinal.sortedRows.map(decisionProposalKey);
    const expected=decisionTableIndexRowsFinal.filter(row=>decisionStableQuickSearchTextFinal(row).includes('skola')||decisionStableSearchMatchesFinal(row,'skola')).sort((a,b)=>{
      const relevance=decisionPointSearchRelevanceFinal(b,'skola')-decisionPointSearchRelevanceFinal(a,'skola');
      return relevance||decisionSortCompare(a,b);
    }).map(decisionProposalKey);
    const relevanceHeaderAria=document.querySelector('#decisionHead [data-decision-sort="date"]')?.getAttribute('aria-sort');
    const resultSet=[...actual].sort().join('|'),stateBeforeSort=decisionProgressiveSearchStateFinal;
    document.querySelector('#decisionHead [data-decision-sort="date"]')?.click();
    const ascendingRows=decisionProgressiveSearchStateFinal.sortedRows,ascendingKeys=ascendingRows.map(decisionProposalKey),ascendingDates=ascendingRows.map(row=>String(row.date||''));
    const ascending={sameState:stateBeforeSort===decisionProgressiveSearchStateFinal,sameResults:[...ascendingKeys].sort().join('|')===resultSet,ordered:ascendingDates.every((date,index)=>!index||ascendingDates[index-1].localeCompare(date,'sv',{numeric:true})<=0),direction:decisionSortDir,manual:decisionManualSortActiveFinal(),query:decisionSearchQuery,aria:document.querySelector('#decisionHead [data-decision-sort="date"]')?.getAttribute('aria-sort'),rescanning:progressiveSearchJobsFinal.has('decision')};
    document.querySelector('#decisionHead [data-decision-sort="date"]')?.click();
    const descendingRows=decisionProgressiveSearchStateFinal.sortedRows,descendingKeys=descendingRows.map(decisionProposalKey),descendingDates=descendingRows.map(row=>String(row.date||''));
    const descending={sameResults:[...descendingKeys].sort().join('|')===resultSet,ordered:descendingDates.every((date,index)=>!index||descendingDates[index-1].localeCompare(date,'sv',{numeric:true})>=0),direction:decisionSortDir,manual:decisionManualSortActiveFinal(),query:decisionSearchQuery,aria:document.querySelector('#decisionHead [data-decision-sort="date"]')?.getAttribute('aria-sort'),rescanning:progressiveSearchJobsFinal.has('decision')};
    await wait(40);
    decisionSearchQuery='';input.value='';decisionManualSortContextFinal='';decisionScheduleProgressiveRefreshFinal();
    const blankRestored=decisionProgressiveSearchStateFinal?.finished&&!progressiveSearchJobsFinal.has('decision');
    const cacheStarted=performance.now();
    decisionSearchQuery='skola';input.value='skola';decisionManualSortContextFinal='';decisionScheduleProgressiveRefreshFinal();
    const cacheRestoreMs=performance.now()-cacheStarted,cachedKeys=decisionProgressiveSearchStateFinal?.sortedRows?.map(decisionProposalKey)||[];
    const cached={blankRestored,restoreMs:cacheRestoreMs,finished:!!decisionProgressiveSearchStateFinal?.finished,noScan:!progressiveSearchJobsFinal.has('decision'),sameResults:[...cachedKeys].sort().join('|')===resultSet,relevance:!decisionManualSortActiveFinal()};
    return {immediateReturnMs,firstRowMs,firstRowBeforeDetails,percentWithNoRows,maxGap,longTasks:longTasks.slice(-12),initial,searchStartedMs,rankingEqual:actual.length===expected.length&&actual.every((key,index)=>key===expected[index]),relevanceHeaderAria,ascending,descending,cached,actual:actual.length,expected:expected.length,samples:samples.slice(0,20)};
  })()`);
  console.log(JSON.stringify(result,null,2));
  if(result.percentWithNoRows||!result.firstRowBeforeDetails||result.firstRowMs>250||!result.initial.finished||result.initial.processed!==result.initial.total||!result.rankingEqual||result.relevanceHeaderAria!=='none'||!result.ascending.sameState||!result.ascending.sameResults||!result.ascending.ordered||result.ascending.direction!=='asc'||!result.ascending.manual||result.ascending.query!=='skola'||result.ascending.aria!=='ascending'||result.ascending.rescanning||!result.descending.sameResults||!result.descending.ordered||result.descending.direction!=='desc'||!result.descending.manual||result.descending.query!=='skola'||result.descending.aria!=='descending'||result.descending.rescanning||!result.cached.blankRestored||!result.cached.finished||!result.cached.noScan||!result.cached.sameResults||!result.cached.relevance||result.cached.restoreMs>175||result.maxGap>250)process.exitCode=1;
}finally{
  cdp?.close();chrome.kill();server.close();
  await new Promise(resolve=>setTimeout(resolve,500));
  await rm(profile,{recursive:true,force:true,maxRetries:0}).catch(()=>{});
}
