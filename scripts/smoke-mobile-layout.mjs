import http from 'node:http';
import {spawn} from 'node:child_process';
import {createReadStream,stat} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

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
const profile=await mkdtemp(path.join(os.tmpdir(),'mobile-layout-smoke-'));
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
  const result=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression,attempts=400){
  for(let attempt=0;attempt<attempts;attempt++){
    if(await evaluate(expression).catch(()=>false))return true;
    await wait(25);
  }
  throw Error(`Timed out waiting for ${expression}`);
}

async function audit(label,width){
  return evaluate(`(()=>{
    const width=${width},viewport=document.documentElement.clientWidth,safeSelector='.raw-table-wrap,.mobile-table-scroll,#resultSections,#stepSections,.tabs';
    const visible=element=>{const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;};
    const outside=[...document.querySelectorAll('main *')].filter(visible).filter(element=>{
      if(element.closest(safeSelector))return false;
      const style=getComputedStyle(element);if(style.position==='fixed')return false;
      const rect=element.getBoundingClientRect();return rect.left<-.75||rect.right>viewport+.75;
    }).slice(0,12).map(element=>({tag:element.tagName,id:element.id,class:String(element.className||'').slice(0,80),rect:[Math.round(element.getBoundingClientRect().left),Math.round(element.getBoundingClientRect().right)]}));
    const tinyControls=[...document.querySelectorAll('button,input,select,textarea')].filter(visible).filter(element=>{const rect=element.getBoundingClientRect();return rect.width<24||rect.height<24;}).slice(0,12).map(element=>element.id||element.className||element.tagName);
    const offCenterHeaders=[...document.querySelectorAll('table thead th')].filter(visible).filter(header=>getComputedStyle(header).textAlign!=='center').map(header=>header.textContent.trim()).slice(0,12);
    return {label:${JSON.stringify(label)},width,innerWidth,clientWidth:document.documentElement.clientWidth,pageScrollWidth:document.documentElement.scrollWidth,outside,tinyControls,offCenterHeaders,active:currentTopView(),mainWidth:Math.round(document.querySelector('main').getBoundingClientRect().width)};
  })()`);
}

try{
  cdp=await connect((await pageTarget()).webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await cdp.send('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  await waitFor(`document.readyState==='complete'&&typeof setTopView==='function'&&tabs.length===1`);
  const results=[];
  results.push(await audit('calculator-template',390));
  await evaluate(`document.getElementById('newTab').click();document.getElementById('calculate').click()`);await wait(100);
  results.push(await audit('calculator',390));
  const calculatorScroll=await evaluate(`(()=>{const input=document.querySelector('.mobile-table-scroll'),result=document.getElementById('resultSections');return {wrapperDisplay:getComputedStyle(input).display,inputScrollable:input.scrollWidth>input.clientWidth,resultScrollable:result.scrollWidth>result.clientWidth};})()`);

  await evaluate(`document.getElementById('rawTopTab').click()`);
  await waitFor(`typeof rawReady!=='undefined'&&rawReady&&document.getElementById('rawEligibleBody').children.length>0`);
  results.push(await audit('historic',390));
  await evaluate(`(()=>{const state=searchableFilterStatesFinal.get('rawMunicipality');state.trigger.scrollIntoView({block:'end'});searchableFilterOpenFinal(state);state.input.value='öre';state.input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  await waitFor(`!searchableFilterStatesFinal.get('rawMunicipality').panel.hidden&&searchableFilterStatesFinal.get('rawMunicipality').list.children.length>0`);
  results.push(await audit('historic-searchable-dropdown',390));
  const searchableDropdownRect=await evaluate(`(()=>{const state=searchableFilterStatesFinal.get('rawMunicipality'),panel=state.panel.getBoundingClientRect(),input=state.input.getBoundingClientRect();return {left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom,viewportWidth:innerWidth,viewportHeight:innerHeight,inputFont:Number.parseFloat(getComputedStyle(state.input).fontSize),results:state.list.querySelectorAll('.searchable-filter-option').length};})()`);
  await evaluate(`searchableFilterCloseFinal(searchableFilterStatesFinal.get('rawMunicipality'))`);

  const mobileDropdownTrigger=await evaluate(`(()=>{const state=searchableFilterStatesFinal.get('rawMunicipality');state.trigger.scrollIntoView({block:'center',inline:'nearest'});const rect=state.trigger.getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mobileDropdownTrigger.x,y:mobileDropdownTrigger.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await waitFor(`!searchableFilterStatesFinal.get('rawMunicipality').panel.hidden&&document.activeElement===searchableFilterStatesFinal.get('rawMunicipality').input`);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:500,deviceScaleFactor:1,mobile:true});await wait(100);
  await cdp.send('Input.insertText',{text:'ore'});await wait(50);
  const mobileKeyboardDropdown=await evaluate(`(()=>{const state=searchableFilterStatesFinal.get('rawMunicipality'),panel=state.panel.getBoundingClientRect(),viewport=visualViewport;return {open:!state.panel.hidden,expanded:state.trigger.getAttribute('aria-expanded')==='true',inputFocused:document.activeElement===state.input,query:state.input.value,results:state.list.querySelectorAll('.searchable-filter-option').length,panelTop:panel.top,panelBottom:panel.bottom,viewportTop:viewport?.offsetTop||0,viewportBottom:(viewport?.offsetTop||0)+(viewport?.height||innerHeight)};})()`);
  const mobileDropdownOption=await evaluate(`(()=>{const option=searchableFilterStatesFinal.get('rawMunicipality').list.querySelector('.searchable-filter-option:not(:disabled)'),rect=option.getBoundingClientRect();return {value:option.dataset.value,x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mobileDropdownOption.x,y:mobileDropdownOption.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await waitFor(`searchableFilterStatesFinal.get('rawMunicipality').panel.hidden`);
  mobileKeyboardDropdown.touchSelection=await evaluate(`selectedRawValues('rawMunicipality').includes(${JSON.stringify(mobileDropdownOption.value)})`);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await wait(50);

  await evaluate(`document.getElementById('decisionTopTab').click()`);
  await waitFor(`document.getElementById('decisionBody').children.length>0`,800);
  results.push(await audit('decisions-list',390));
  await waitFor(`decisionCanonicalPreparationReadyFinal()&&decisionProgressiveStateIsCurrentFinal()&&!progressiveSearchJobsFinal.has('decision')`,800);
  const decisionSwitchStability=await evaluate(`(async()=>{
    const waitFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const originalState=decisionProgressiveSearchStateFinal,originalRows=document.getElementById('decisionBody').children.length,cycles=[];
    for(const target of ['calculator','raw','decisionActivity','calculator']){
      await setTopView(target);await waitFrame();
      await setTopView('decision');await waitFrame();
      const state=decisionProgressiveSearchStateFinal;
      cycles.push({target,sameState:state===originalState,current:decisionProgressiveStateIsCurrentFinal(),job:progressiveSearchJobsFinal.has('decision'),finished:!!state?.finished,rows:document.getElementById('decisionBody').children.length,status:document.getElementById('decisionPage').textContent});
    }
    return {originalRows,cycles};
  })()`);
  const decisionLayout=await evaluate(`(()=>{const ids=['decisionView','decisionFilters','decisionMasterPane'];const metric=element=>{const r=element.getBoundingClientRect(),s=getComputedStyle(element);return {id:element.id||element.tagName,left:r.left,right:r.right,width:r.width,clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,overflowX:s.overflowX,contain:s.contain,minWidth:s.minWidth,maxWidth:s.maxWidth};};return {elements:ids.map(id=>metric(document.getElementById(id))),table:metric(document.querySelector('#decisionMasterPane table')),body:{clientWidth:document.body.clientWidth,scrollWidth:document.body.scrollWidth},document:{clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,innerWidth}};})()`);
  await evaluate(`document.getElementById('decisionDateToggle').click()`);await waitFor(`!document.getElementById('decisionDateCalendar').hidden`);
  results.push(await audit('decision-calendar',390));
  const calendarRect=await evaluate(`(()=>{const r=document.getElementById('decisionDateCalendar').getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,viewport:innerWidth};})()`);
  await evaluate(`document.getElementById('decisionDateToggle').click();document.querySelector('#decisionBody tr')?.click()`);
  await waitFor(`!document.getElementById('decisionDetailPane').hidden`,800);
  results.push(await audit('decision-detail',390));

  await evaluate(`document.getElementById('decisionActivityTopTab').click()`);
  await waitFor(`document.getElementById('decisionActivityBody').children.length>0`,800);
  results.push(await audit('documents-list',390));
  await evaluate(`document.querySelector('#decisionActivityBody tr')?.click()`);
  await waitFor(`!document.getElementById('decisionActivityDetailPane').hidden`,800);
  results.push(await audit('document-detail',390));

  await evaluate(`document.getElementById('aboutPageButton').click()`);await waitFor(`!document.getElementById('aboutOverlay').hidden`);
  results.push(await audit('about-dialog',390));
  const dialogRect=await evaluate(`(()=>{const r=document.querySelector('#aboutOverlay .confirm-dialog').getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,viewportHeight:innerHeight,overlayScroll:document.getElementById('aboutOverlay').scrollHeight>document.getElementById('aboutOverlay').clientHeight};})()`);
  await evaluate(`document.getElementById('aboutClose').click()`);

  const mobileFacetedFilters=await evaluate(`(async()=>{
    const waitUntil=async predicate=>{for(let attempt=0;attempt<900;attempt++){if(predicate())return true;await new Promise(resolve=>setTimeout(resolve,10));}return false;};
    await setTopView('raw');Object.keys(rawFilterLocks).forEach(key=>{rawFilterLocks[key]=[];});rawFilterLocks.rawYear=rawFilterOptionsFinal().years.slice(0,2).map(String);rawFilterLocks.rawParty=['S','M'];buildRawFilters();rawScheduleProgressiveFinal();await waitUntil(()=>rawProgressiveSearchStateFinal?.complete&&rawProgressiveSearchStateFinal.key===rawProgressiveSearchKeyFinal());
    const filters={years:selectedRawValues('rawYear'),elections:[],counties:[],municipalities:[],parties:selectedRawValues('rawParty')},raw={matches:rawProgressiveSearchStateFinal.matches.length,expected:rawRows.filter(row=>rawProgressivePredicateFinal(row,filters,'')).length,clearVisible:!!document.querySelector('#rawFilterLocks [data-clear-all-filters]')};
    const controls={raw:document.querySelectorAll('#rawView [data-filter-mode-toggle],#rawView .filter-mode-toggle').length};
    await setTopView('decision');controls.decision=document.querySelectorAll('#decisionView [data-filter-mode-toggle],#decisionView .filter-mode-toggle').length;
    await setTopView('decisionActivity');controls.activity=document.querySelectorAll('#decisionActivityView [data-filter-mode-toggle],#decisionActivityView .filter-mode-toggle').length;
    return {raw,controls,sameCategoryOr:filterValueSetsMatch([{values:['S','M'],matches:value=>value==='M'}]),crossCategoryAndRejects:!filterValueSetsMatch([{values:['2014'],matches:value=>value==='2014'},{values:['S'],matches:value=>value==='M'}])};
  })()`);

  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await wait(100);
  const zoomFilterControl=await evaluate(`(async()=>{await setTopView('raw');const control=document.querySelector('#rawFilterLocks [data-clear-all-filters]');control.scrollIntoView({block:'center',inline:'nearest'});await new Promise(resolve=>requestAnimationFrame(resolve));const rect=control.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return {hit:hit===control||control.contains(hit),width:rect.width,height:rect.height};})()`);
  await evaluate(`const state=searchableFilterStatesFinal.get('rawMunicipality');state.trigger.scrollIntoView({block:'center',inline:'nearest'});searchableFilterOpenFinal(state)`);await wait(100);
  const zoomAudit=await evaluate(`(()=>{const viewport=visualViewport,panel=searchableFilterStatesFinal.get('rawMunicipality').panel.getBoundingClientRect();return {scale:viewport?.scale||1,visualWidth:viewport?.width||innerWidth,layoutWidth:document.documentElement.clientWidth,pageScrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth,panelLeft:panel.left,panelRight:panel.right,panelWithinLayout:panel.left>=0&&panel.right<=document.documentElement.clientWidth+1};})()`);
  Object.assign(zoomAudit,{filterControlHit:zoomFilterControl.hit,filterControlWidth:zoomFilterControl.width,filterControlHeight:zoomFilterControl.height});
  await evaluate(`searchableFilterCloseFinal(searchableFilterStatesFinal.get('rawMunicipality'))`);await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});

  await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});await wait(100);
  results.push(await audit('document-detail-small',320));
  await evaluate(`setTopView('calculator')`);await wait(50);
  results.push(await audit('calculator-small',320));

  await cdp.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});await wait(50);
  await evaluate(`setTopView('decision');if(!document.getElementById('decisionDetailPane').hidden)document.getElementById('decisionBack').click()`);await wait(50);
  results.push(await audit('decisions-landscape',844));

  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await wait(50);
  const desktopWrapper=await evaluate(`getComputedStyle(document.querySelector('.mobile-table-scroll')).display`);
  const failures=results.filter(item=>item.innerWidth!==item.width||item.pageScrollWidth>item.clientWidth+1||item.outside.length||item.tinyControls.length||item.offCenterHeaders.length);
  const output={failures,calculatorScroll,searchableDropdownRect,mobileKeyboardDropdown,decisionSwitchStability,decisionLayout,calendarRect,dialogRect,mobileFacetedFilters,zoomAudit,desktopWrapper,results};
  console.log(JSON.stringify(output,null,2));
  const facetedFilterFailure=mobileFacetedFilters.raw.matches<=0||mobileFacetedFilters.raw.matches!==mobileFacetedFilters.raw.expected||!mobileFacetedFilters.raw.clearVisible||Object.values(mobileFacetedFilters.controls).some(Boolean)||!mobileFacetedFilters.sameCategoryOr||!mobileFacetedFilters.crossCategoryAndRejects;
  if(failures.length||!calculatorScroll.inputScrollable||!calculatorScroll.resultScrollable||searchableDropdownRect.left<0||searchableDropdownRect.right>searchableDropdownRect.viewportWidth+1||searchableDropdownRect.top<0||searchableDropdownRect.bottom>searchableDropdownRect.viewportHeight+1||searchableDropdownRect.inputFont<16||searchableDropdownRect.results<=0||!mobileKeyboardDropdown.open||!mobileKeyboardDropdown.expanded||!mobileKeyboardDropdown.inputFocused||mobileKeyboardDropdown.query!=='ore'||mobileKeyboardDropdown.results<=0||mobileKeyboardDropdown.panelTop<mobileKeyboardDropdown.viewportTop-1||mobileKeyboardDropdown.panelBottom>mobileKeyboardDropdown.viewportBottom+1||!mobileKeyboardDropdown.touchSelection||decisionSwitchStability.originalRows<=0||decisionSwitchStability.cycles.some(cycle=>!cycle.sameState||!cycle.current||cycle.job||!cycle.finished||cycle.rows<=0)||calendarRect.left<0||calendarRect.right>calendarRect.viewport+1||dialogRect.top<0||dialogRect.bottom>dialogRect.viewportHeight+1||facetedFilterFailure||zoomAudit.scale<1.9||zoomAudit.pageScrollWidth>zoomAudit.layoutWidth+1||zoomAudit.bodyScrollWidth>zoomAudit.layoutWidth+1||!zoomAudit.panelWithinLayout||!zoomAudit.filterControlHit||zoomAudit.filterControlWidth<44||zoomAudit.filterControlHeight<24||desktopWrapper!=='contents')process.exitCode=1;
}finally{
  cdp?.close();chrome.kill();server.close();await wait(300);await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
