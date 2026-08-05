import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createReadStream, stat } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
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
const profile=await mkdtemp(path.join(os.tmpdir(),'decision-interactions-smoke-'));
const chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,`http://127.0.0.1:${port}/`],{stdio:['ignore','ignore','pipe'],windowsHide:true});
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
    const errors=[];
    addEventListener('error',event=>errors.push(String(event.error?.stack||event.message)));
    addEventListener('unhandledrejection',event=>errors.push(String(event.reason?.stack||event.reason)));
    await setTopView('decision');
    for(let attempt=0;attempt<800&&!decisionProgressiveSearchStateFinal?.finished;attempt++)await wait(20);
    const input=document.querySelector('#decisionDecisionSearch');
    const values=['s','sk','sko','skol','skola','skolan','skolans','skolansx','skolansxy','skolansxyz'];
    const samples=[],started=performance.now();
    for(const value of values){
      input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
      for(let frame=0;frame<2;frame++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const pane=document.querySelector('#decisionMasterPane'),first=document.querySelector('#decisionBody tr'),overview=document.querySelector('#decisionOverview');
        samples.push({t:Math.round(performance.now()-started),value,rows:document.querySelectorAll('#decisionBody tr').length,paneHeight:Math.round(pane.getBoundingClientRect().height),paneTop:Math.round(pane.getBoundingClientRect().top),overviewWidth:Math.round(overview.getBoundingClientRect().width),firstTop:first?Math.round(first.getBoundingClientRect().top):null,scrollWidth:document.documentElement.scrollWidth});
      }
    }
    await wait(500);
    const geometryChanges=samples.slice(1).filter((sample,index)=>['paneHeight','paneTop','overviewWidth','firstTop','scrollWidth'].some(key=>sample[key]!==samples[index][key])).length;
    input.value='skola';input.dispatchEvent(new Event('input',{bubbles:true}));
    for(let attempt=0;attempt<800&&!(decisionProgressiveSearchStateFinal?.key==='skola'&&decisionProgressiveSearchStateFinal?.finished);attempt++)await wait(20);
    const searchFinished=decisionProgressiveSearchStateFinal?.key==='skola'&&decisionProgressiveSearchStateFinal?.finished;
    const clicked=document.querySelector('#decisionBody tr');
    const clickKey=clicked?.dataset.proposalKey||'';
    const clickStarted=performance.now();
    clicked?.children[2]?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const clickMs=performance.now()-clickStarted;
    const detailOpened=!document.querySelector('#decisionDetailPane')?.hidden;
    return {clickKey,clickMs,detailOpened,searchFinished,errors,geometryChanges,samples};
  })()`);
  console.log(JSON.stringify(result,null,2));
  if(!result.detailOpened||!result.searchFinished||result.errors.length||result.geometryChanges)process.exitCode=1;
}finally{
  cdp?.close();chrome.kill();server.close();
  await new Promise(resolve=>setTimeout(resolve,500));
  await rm(profile,{recursive:true,force:true,maxRetries:0}).catch(()=>{});
}
