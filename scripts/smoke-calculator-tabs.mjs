import http from 'node:http';
import {spawn} from 'node:child_process';
import {createReadStream,stat} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const chromePath=process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const mime=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8']]);
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
const profile=await mkdtemp(path.join(os.tmpdir(),'calculator-tabs-smoke-'));
const chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe'],windowsHide:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let cdp=null;

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
  const result=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression,attempts=300){
  for(let attempt=0;attempt<attempts;attempt++){
    if(await evaluate(expression).catch(()=>false))return;
    await wait(25);
  }
  throw Error(`Timed out waiting for ${expression}`);
}

async function tabCenter(index){
  return evaluate(`(()=>{const r=document.querySelectorAll('.tab-wrap')[${index}].querySelector('.tab-select').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
}

async function mouseDrag(from,to){
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:from.x,y:from.y,button:'left',clickCount:1});
  for(let step=1;step<=12;step++)await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:from.x+(to.x-from.x)*step/12,y:from.y+(to.y-from.y)*step/12,button:'left',buttons:1});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:to.x,y:to.y,button:'left',clickCount:1});
  await wait(80);
}

async function touchDrag(from,to){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,radiusX:4,radiusY:4,force:1,id:1}]});
  await wait(60);
  for(let step=1;step<=10;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*step/10,y:from.y+(to.y-from.y)*step/10,radiusX:4,radiusY:4,force:1,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await wait(120);
}

try{
  cdp=await connect((await pageTarget()).webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1100,height:820,deviceScaleFactor:1,mobile:false});
  await cdp.send('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  await waitFor(`document.readyState==='complete'&&typeof renderTabs==='function'&&tabs.length===1`);

  const placement=await evaluate(`(()=>({
    newParent:document.getElementById('newTab').parentElement.id,
    newIsLast:document.getElementById('tabs').lastElementChild.id==='newTab',
    duplicateParent:document.getElementById('duplicateTab').parentElement.id,
    resetParent:document.getElementById('reset').parentElement.id,
    settingsDisplay:getComputedStyle(document.getElementById('calcSettings')).display,
    templateActions:{calculate:document.getElementById('calculate').hidden,reroll:document.getElementById('reroll').hidden,duplicate:document.getElementById('duplicateTab').hidden,reset:document.getElementById('reset').hidden},
    newHeight:Math.round(document.getElementById('newTab').getBoundingClientRect().height)
  }))()`);

  await evaluate(`document.getElementById('newTab').click();document.getElementById('newTab').click();document.getElementById('newTab').click()`);
  const calculatorLayout=await evaluate(`(()=>{
    const method=document.getElementById('method');method.value='adjusted';method.dispatchEvent(new Event('change',{bubbles:true}));
    const controls=['tabTitle','method','factor','seats'].map(id=>{const rect=document.getElementById(id).getBoundingClientRect();return {id,top:rect.top,left:rect.left,right:rect.right};});
    const heading=document.getElementById('calcInputTitle').getBoundingClientRect(),imports=document.getElementById('calcImportMenu').getBoundingClientRect();
    return {controls,controlTopSpread:Math.max(...controls.map(item=>item.top))-Math.min(...controls.map(item=>item.top)),headingCenter:heading.top+heading.height/2,importCenter:imports.top+imports.height/2,columns:getComputedStyle(document.getElementById('calcSettings')).gridTemplateColumns};
  })()`);
  const desktopBefore=await evaluate(`({ids:tabs.map(tab=>tab.id),activeId:current().id,templateFirst:isTemplateTab(tabs[0]),newIsLast:document.getElementById('tabs').lastElementChild.id==='newTab'})`);
  const from=await tabCenter(3),target=await tabCenter(1);
  target.x-=60;
  await mouseDrag(from,target);
  const desktopAfter=await evaluate(`({ids:tabs.map(tab=>tab.id),activeId:current().id,activeTab,templateFirst:isTemplateTab(tabs[0]),domIds:[...document.querySelectorAll('.tab-wrap')].map(node=>Number(node.dataset.tabId))})`);

  const templateOrder=desktopAfter.ids.join(',');
  await mouseDrag(await tabCenter(0),await tabCenter(2));
  const templateLocked=await evaluate(`tabs.map(tab=>tab.id).join(',')===${JSON.stringify(templateOrder)}&&isTemplateTab(tabs[0])`);

  const duplicate=await evaluate(`(()=>{const before=tabs.length,source=current().id;document.getElementById('duplicateTab').click();return {added:tabs.length===before+1,activeIsCopy:current().id!==source&&activeTab===tabs.length-1,newIsLast:document.getElementById('tabs').lastElementChild.id==='newTab'};})()`);
  const closeAfterReorder=await evaluate(`(()=>{const before=tabs.length;document.querySelector('.tab-wrap.active .calc-tab-close').click();return {removed:tabs.length===before-1,templateFirst:isTemplateTab(tabs[0]),activeValid:activeTab>=0&&activeTab<tabs.length};})()`);

  await evaluate(`resetAll();document.getElementById('newTab').click();document.getElementById('newTab').click();document.getElementById('tabs').scrollLeft=document.getElementById('tabs').scrollWidth`);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await wait(100);
  await evaluate(`document.getElementById('method').value='adjusted';syncMethodFields();document.getElementById('tabs').scrollLeft=document.getElementById('tabs').scrollWidth`);
  await evaluate(`window.__calcPointerEvents=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.getElementById('tabs').addEventListener(type,event=>window.__calcPointerEvents.push({type,pointerType:event.pointerType,target:event.target.className}),true)`);
  const mobileBefore=await evaluate(`({ids:tabs.map(tab=>tab.id),activeId:current().id,scrollable:document.getElementById('tabs').scrollWidth>document.getElementById('tabs').clientWidth})`);
  const mobileFrom=await tabCenter(2),mobileTarget=await tabCenter(1);
  mobileTarget.x+=20;
  await touchDrag(mobileFrom,mobileTarget);
  const mobileAfter=await evaluate(`({ids:tabs.map(tab=>tab.id),activeId:current().id,activeTab,templateFirst:isTemplateTab(tabs[0]),domIds:[...document.querySelectorAll('.tab-wrap')].map(node=>Number(node.dataset.tabId)),pageFits:document.documentElement.scrollWidth===document.documentElement.clientWidth,settingsColumns:getComputedStyle(document.getElementById('calcSettings')).gridTemplateColumns,pointerEvents:window.__calcPointerEvents})`);
  await evaluate(`document.getElementById('reset').click()`);
  await waitFor(`!document.getElementById('confirmOverlay').hidden`);
  await evaluate(`document.getElementById('confirmAccept').click()`);
  await waitFor(`tabs.length===1&&activeTab===0`);
  const reset=await evaluate(`({templateOnly:tabs.length===1&&isTemplateTab(tabs[0]),newIsLast:document.getElementById('tabs').lastElementChild.id==='newTab',resetVisible:!document.getElementById('reset').hidden})`);

  const failures=[];
  if(placement.newParent!=='tabs'||!placement.newIsLast||placement.duplicateParent!=='calcActions'||placement.resetParent!=='calcActions'||placement.settingsDisplay!=='none'||!placement.templateActions.calculate||!placement.templateActions.reroll||!placement.templateActions.duplicate||placement.templateActions.reset||placement.newHeight>34)failures.push('button placement');
  if(calculatorLayout.controlTopSpread>2||Math.abs(calculatorLayout.headingCenter-calculatorLayout.importCenter)>2||calculatorLayout.columns.split(' ').length!==4)failures.push('calculator layout');
  if(!desktopBefore.templateFirst||!desktopBefore.newIsLast||desktopAfter.ids[0]!==desktopBefore.ids[0]||desktopAfter.ids[1]!==desktopBefore.ids[3]||desktopAfter.activeId!==desktopBefore.activeId||desktopAfter.activeTab!==1||desktopAfter.ids.join(',')!==desktopAfter.domIds.join(','))failures.push('desktop drag');
  if(!templateLocked)failures.push('template lock');
  if(!duplicate.added||!duplicate.activeIsCopy||!duplicate.newIsLast)failures.push('duplicate');
  if(!closeAfterReorder.removed||!closeAfterReorder.templateFirst||!closeAfterReorder.activeValid)failures.push('close after reorder');
  if(mobileAfter.ids[0]!==mobileBefore.ids[0]||mobileAfter.ids[1]!==mobileBefore.ids[2]||mobileAfter.activeId!==mobileBefore.activeId||mobileAfter.activeTab!==1||mobileAfter.ids.join(',')!==mobileAfter.domIds.join(',')||!mobileAfter.templateFirst||!mobileAfter.pageFits||mobileAfter.settingsColumns.split(' ').length!==1)failures.push('mobile drag');
  if(!reset.templateOnly||!reset.newIsLast||!reset.resetVisible)failures.push('reset');

  const result={placement,calculatorLayout,desktopBefore,desktopDrag:{from,target},desktopAfter,templateLocked,duplicate,closeAfterReorder,mobileBefore,mobileDrag:{from:mobileFrom,target:mobileTarget},mobileAfter,reset,failures};
  console.log(JSON.stringify(result,null,2));
  if(failures.length)process.exitCode=1;
}finally{
  cdp?.close();
  const exited=new Promise(resolve=>chrome.once('exit',resolve));
  chrome.kill();
  await Promise.race([exited,wait(2000)]);
  server.close();
  await rm(profile,{recursive:true,force:true});
}
