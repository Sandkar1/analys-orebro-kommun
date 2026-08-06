import http from 'node:http';
import {spawn} from 'node:child_process';
import {createReadStream,stat} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fileAudit=process.argv.includes('--file');
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
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
  await wait(150);
  const after=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});return {value:e.value,state:${stateExpression},selectedText:e.options[e.selectedIndex]?.textContent||'',active:document.activeElement===e}})()`);
  return {before,after};
}
async function addAnotherFilter(id,stateExpression){
  const before=await evaluate(stateExpression);
  const chosen=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});const option=[...e.options].find(item=>item.value&& !item.value.startsWith('__')&&item.value!==e.value);if(!option)return '';e.value=option.value;e.dispatchEvent(new Event('change',{bubbles:true}));return option.value})()`);
  await wait(300);
  const after=await evaluate(stateExpression);
  return {chosen,before,after};
}
async function auditSelects(ids){
  const result={};
  for(const id of ids)result[id]=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {options:e.options.length,disabled:e.disabled,pointer:getComputedStyle(e).pointerEvents,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.id||''}})()`);
  return result;
}

try{
  cdp=await connect((await pageTarget()).webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await waitFor(`document.readyState==='complete'&&typeof setTopView==='function'`);
  const calculator=await keyboardSelect('method',`document.getElementById('method').value`);
  const calculatorIcon=await evaluate(`(()=>{const e=document.querySelector('.p-icon'),before=current().parties[0].icon,option=[...e.options].find(item=>Number(item.value)!==Number(e.value));e.scrollIntoView({block:'center'});e.value=option.value;e.dispatchEvent(new Event('input',{bubbles:true}));const r=e.getBoundingClientRect();return {options:e.options.length,disabled:e.disabled,pointer:getComputedStyle(e).pointerEvents,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.classList.contains('p-icon')||false,before,after:current().parties[0].icon}})()`);
  await evaluate(`document.getElementById('rawTopTab').click()`);
  await waitFor(`typeof rawReady!=='undefined'&&rawReady&&document.getElementById('rawYear').options.length>1`);
  const rawInventory=await auditSelects(['rawYear','rawElection','rawCounty','rawMunicipality','rawParty']);
  const raw=await keyboardSelect('rawYear',`JSON.stringify(rawFilterLocks.rawYear)`);
  await evaluate(`document.getElementById('decisionTopTab').click()`);
  await waitFor(`document.getElementById('decisionOrgan').options.length>1`,400);
  const decisionCold=await evaluate(`({options:document.getElementById('decisionOrgan').options.length,bootstrap:!!window.municipalDecisionTableBootstrap?.filterOptions,canonical:decisionCanonicalPreparationReadyFinal()})`);
  await evaluate(`document.getElementById('decisionDateToggle').click()`);
  await waitFor(`document.querySelector('.date-calendar-month')?.options.length===12`);
  const calendarBefore=await evaluate(`(()=>{const month=document.querySelector('.date-calendar-month'),year=document.querySelector('.date-calendar-year'),r=month.getBoundingClientRect();return {month:month.value,monthOptions:month.options.length,yearOptions:year.options.length,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.classList.contains('date-calendar-month')||false,canonical:decisionCanonicalPreparationReadyFinal()}})()`);
  const calendarAfter=await evaluate(`(()=>{const month=document.querySelector('.date-calendar-month'),option=[...month.options].find(item=>item.value!==month.value);month.value=option.value;month.dispatchEvent(new Event('change',{bubbles:true}));return decisionCalendarMonth})()`);
  await evaluate(`document.getElementById('decisionDateToggle').click()`);
  const decisionInventory=await auditSelects(['decisionOrgan','decisionProposalType','decisionParty','decisionMember','decisionVote','decisionResult']);
  const decision=await keyboardSelect('decisionOrgan',`JSON.stringify(decisionFilterLocks.decisionOrgan)`);
  await evaluate(`document.getElementById('decisionActivityTopTab').click()`);
  await waitFor(`document.getElementById('decisionActivityType').options.length>1`,400);
  const activityInventory=await auditSelects(['decisionActivityType','decisionActivityParty','decisionActivityPoliticalOwner','decisionActivityOfficialOwner']);
  const activity=await keyboardSelect('decisionActivityType',`JSON.stringify(decisionActivityFilters.type)`);
  const additive={
    raw:await addAnotherFilter('rawYear',`JSON.stringify(rawFilterLocks.rawYear)`),
    decision:await addAnotherFilter('decisionOrgan',`JSON.stringify(decisionFilterLocks.decisionOrgan)`),
    activity:await addAnotherFilter('decisionActivityType',`JSON.stringify(decisionActivityFilters.type)`)
  };
  const reloadExpected=await evaluate(`({top:currentTopView(),raw:JSON.stringify(rawFilterLocks.rawYear),decision:JSON.stringify(decisionFilterLocks.decisionOrgan),activity:JSON.stringify(decisionActivityFilters.type)})`);
  const reloadHash=await evaluate(`(async()=>{await updateUrlHashSession();return location.hash})()`);
  await cdp.send('Page.enable');
  await cdp.send('Page.reload',{ignoreCache:true});
  await waitFor(`document.readyState==='complete'&&typeof currentTopView==='function'&&currentTopView()===${JSON.stringify(reloadExpected.top)}&&JSON.stringify(rawFilterLocks.rawYear)===${JSON.stringify(reloadExpected.raw)}&&JSON.stringify(decisionFilterLocks.decisionOrgan)===${JSON.stringify(reloadExpected.decision)}&&JSON.stringify(decisionActivityFilters.type)===${JSON.stringify(reloadExpected.activity)}`,500);
  const reload=await evaluate(`({mode:location.protocol==='file:'?'file':'http',hash:location.hash,top:currentTopView(),raw:JSON.stringify(rawFilterLocks.rawYear),decision:JSON.stringify(decisionFilterLocks.decisionOrgan),activity:JSON.stringify(decisionActivityFilters.type),activityOptions:document.getElementById('decisionActivityType').options.length,promptDisabled:document.getElementById('decisionActivityType').options[0]?.disabled??true})`);
  const postReload=await addAnotherFilter('decisionActivityType',`JSON.stringify(decisionActivityFilters.type)`);
  const inventory={...rawInventory,...decisionInventory,...activityInventory};
  const result={mode:fileAudit?'file':'http',calculator,calculatorIcon,inventory,raw,decisionCold,calendar:{before:calendarBefore,after:calendarAfter},decision,activity,additive,reloadExpected,reloadHashChanged:!!reloadHash,reload,postReload};
  console.log(JSON.stringify(result,null,2));
  if(!decisionCold.bootstrap||decisionCold.options<2||calculatorIcon.disabled||calculatorIcon.pointer==='none'||!calculatorIcon.hit||calculatorIcon.options<2||calculatorIcon.before===calculatorIcon.after||calendarBefore.monthOptions!==12||calendarBefore.yearOptions<2||!calendarBefore.hit||calendarBefore.month===calendarAfter.slice(-2)||Object.values(inventory).some(item=>item.disabled||item.pointer==='none'||!item.hit||item.options<2)||Object.entries({calculator,raw,decision,activity}).some(([,item])=>item.before.disabled||item.before.pointer==='none'||!item.before.hit||item.before.options<2||item.before.state===item.after.state)||Object.values(additive).some(item=>!item.chosen||item.before===item.after||JSON.parse(item.after).length<2)||!reloadHash||reload.top!==reloadExpected.top||reload.raw!==reloadExpected.raw||reload.decision!==reloadExpected.decision||reload.activity!==reloadExpected.activity||reload.activityOptions<2||reload.promptDisabled||!postReload.chosen||JSON.parse(postReload.after).length<3)process.exitCode=1;
}finally{
  cdp?.close();chrome.kill();server.close();
  await wait(300);
  await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
