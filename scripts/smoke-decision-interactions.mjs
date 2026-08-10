import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createReadStream, stat } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const deepAudit=process.argv.includes('--deep');
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
const profile=await mkdtemp(path.join(os.tmpdir(),'decision-interactions-smoke-'));
const targetUrl=fileAudit?pathToFileURL(path.join(root,'index.html')).href:`http://127.0.0.1:${port}/`;
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
    const errors=[];
    addEventListener('error',event=>errors.push(String(event.error?.stack||event.message)));
    addEventListener('unhandledrejection',event=>errors.push(String(event.reason?.stack||event.reason)));
    const initialLoadStarted=performance.now();
    await setTopView('decision');
    for(let attempt=0;attempt<800&&!decisionProgressiveSearchStateFinal?.finished;attempt++)await wait(20);
    const initialLoadMs=performance.now()-initialLoadStarted;
    const input=document.querySelector('#decisionDecisionSearch');
    document.querySelector('#decisionMasterPane').scrollIntoView({block:'center'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
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
    const incrementalCounts=[];
    for(let attempt=0;attempt<800;attempt++){
      const state=decisionProgressiveSearchStateFinal;
      if(state?.key==='skola'){
        if(!state.finished)incrementalCounts.push(document.querySelectorAll('#decisionBody tr').length);
        if(state.finished)break;
      }
      await wait(20);
    }
    const positiveIncrementalCounts=incrementalCounts.filter(count=>count>0);
    const incrementalSteps=[...new Set(positiveIncrementalCounts)];
    const incrementalRendered=incrementalSteps.length>=2&&positiveIncrementalCounts.every((count,index)=>index===0||count>=positiveIncrementalCounts[index-1]);
    const searchFinished=decisionProgressiveSearchStateFinal?.key==='skola'&&decisionProgressiveSearchStateFinal?.finished;
    const auditKey='case_body_kommunfullmaktige_2024_05_14_123|p|123';
    const auditRow=decisionTableIndexRowsFinal.find(row=>decisionProposalKey(row)===auditKey);
    const clicked=${deepAudit?'true':'false'}?{dataset:{id:auditRow?.id||'',proposalKey:auditKey},children:[null,null,{dispatchEvent(event){return this.parent.dispatchEvent(event);},parent:null}],dispatchEvent(event){decisionOpenStableRowFinal(this);return true;}}:document.querySelector('#decisionBody tr');
    if(clicked?.children?.[2]&&${deepAudit?'true':'false'})clicked.children[2].parent=clicked;
    const clickKey=clicked?.dataset.proposalKey||'';
    const clickStarted=performance.now();
    clicked?.children[2]?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const clickMs=performance.now()-clickStarted;
    const detailOpened=!document.querySelector('#decisionDetailPane')?.hidden;
    let deep=null;
    if(${deepAudit?'true':'false'}){
      const indexedHeadings=[...document.querySelectorAll('#decisionDetailGroups h3')].map(node=>node.textContent.trim());
      const indexedVoteSections=[...document.querySelectorAll('#decisionDetailGroups .decision-vote-type')];
      const indexedYesSection=indexedVoteSections.find(section=>section.querySelector('h4')?.textContent.trim().startsWith('Ja'))||null;
      const indexedContext=document.querySelector('#decisionDetailContext');
      const indexedHeader=document.querySelector('.decision-detail-head');
      const indexedOverview=document.querySelector('#decisionDetailOverview');
      const indexedContextRect=indexedContext?.getBoundingClientRect(),indexedHeaderRect=indexedHeader?.getBoundingClientRect(),indexedOverviewRect=indexedOverview?.getBoundingClientRect();
      const coldDetail={
        canonicalReady:decisionCanonicalPreparationReadyFinal(),
        hasFastDetail:!!auditRow?.fastDetail,
        pendingCanonical:!!decisionActiveTabState()?.pendingCanonical,
        completeHeadings:['Ärendebeskrivning','Beslutsunderlag','Förslag till beslut','Yrkanden','Proposition','Beslut','Votering','Mötesnärvaro'].every(heading=>indexedHeadings.some(value=>value.startsWith(heading))),
        reference:!!document.querySelector('#decisionDetailGroups .decision-text-ref'),
        attendance:!!document.querySelector('#decisionDetailGroups .meeting-attendance-panel'),
        attendanceCount:Number(document.querySelector('#decisionDetailGroups .meeting-attendance h3 b')?.textContent||0),
        attendanceRoles:Object.fromEntries([...document.querySelectorAll('#decisionDetailGroups .meeting-attendance-group')].map(group=>[group.dataset.attendanceRole,Number(group.querySelector('h4 b')?.textContent||0)])),
        itemVoteAttendance:document.querySelector('#decisionDetailGroups .meeting-attendance-item-note')?.textContent.trim()||'',
        standaloneMuhammed:[...document.querySelectorAll('#decisionDetailGroups .meeting-attendance li strong')].some(node=>node.textContent.trim()==='Muhammed'),
        partyCards:indexedYesSection?.querySelectorAll('.decision-point-party').length||0,
        contextVisible:!!indexedContext&&!indexedContext.hidden,
        contextInHeader:indexedContext?.parentElement===indexedHeader&&indexedContextRect.bottom<=indexedOverviewRect.top&&indexedContextRect.top>=indexedHeaderRect.top,
        contextInGroups:!!document.querySelector('#decisionDetailGroups .meeting-context')
      };
      decisionActiveTab=0;renderDecisionView();
      const canonicalStarted=performance.now();
      await ensureDecisionCanonicalDataFinal();
      await wait(50);
      const canonicalMs=performance.now()-canonicalStarted;
      const delayedActiveKind=decisionActiveTabState()?.kind||'';
      const tabIndex=decisionTabs.findIndex(tab=>tab.proposalKey===auditKey);
      const hydratedTab=tabIndex>=0?decisionTabs[tabIndex]:null;
      if(tabIndex>=0){decisionActiveTab=tabIndex;renderDecisionView();}
      const payload=hydratedTab?decisionDetailPayload(hydratedTab):null;
      const proposal=payload?.proposal||null;
      const sourceDoc=proposal?(decisionPack?.d||[])[proposal.docIndex]||{}:{};
      const finalHeadings=[...document.querySelectorAll('#decisionDetailGroups h3')].map(node=>node.textContent.trim());
      const finalAttendanceCount=Number(document.querySelector('#decisionDetailGroups .meeting-attendance h3 b')?.textContent||0);
      const finalAttendanceRoles=Object.fromEntries([...document.querySelectorAll('#decisionDetailGroups .meeting-attendance-group')].map(group=>[group.dataset.attendanceRole,Number(group.querySelector('h4 b')?.textContent||0)]));
      const finalItemVoteAttendance=document.querySelector('#decisionDetailGroups .meeting-attendance-item-note')?.textContent.trim()||'';
      const descriptionText=document.querySelector('#decisionDetailGroups .decision-text-card')?.textContent.trim().slice(0,300)||'';
      const meetingLinkFound=!!document.querySelector('#decisionDetailContext [data-open-meeting]');
      const attendanceFound=!!document.querySelector('#decisionDetailGroups .meeting-attendance-panel');
      const voteSections=[...document.querySelectorAll('#decisionDetailGroups .decision-vote-type')];
      const yesSection=voteSections.find(section=>section.querySelector('h4')?.textContent.trim().startsWith('Ja'))||null;
      const noSection=voteSections.find(section=>section.querySelector('h4')?.textContent.trim().startsWith('Nej'))||null;
      const voteLayout={partyCards:yesSection?.querySelectorAll('.decision-point-party').length||0,yesBottom:yesSection?Math.round(yesSection.getBoundingClientRect().bottom):0,noTop:noSection?Math.round(noSection.getBoundingClientRect().top):0};
      const reference=[...document.querySelectorAll('#decisionDetailGroups .decision-text-ref')].find(node=>node.textContent.includes('7 maj 2024'))||null;
      const originalTabIndex=decisionActiveTab;
      const beforeReferenceTab=decisionActiveTab;
      reference?.click();
      const afterReferenceTab=decisionActiveTab;
      const referenceTargetTab=decisionActiveTabState();
      const referenceTargetProposal=referenceTargetTab?.kind==='decision'?decisionDetailPayload(referenceTargetTab)?.proposal:null;
      decisionActiveTab=originalTabIndex;renderDecisionView();
      const meetingButton=document.querySelector('#decisionDetailContext [data-open-meeting]');
      meetingButton?.click();
      const meetingTargetTab=decisionActiveTabState();
      const meetingTargetProposal=meetingTargetTab?.kind==='decision'?decisionDetailPayload(meetingTargetTab)?.proposal:null;
      const meetingView={
        isMeeting:!!meetingTargetProposal?.isMeeting,
        title:document.querySelector('#decisionDetailTitle')?.textContent||'',
        protocolCard:!!document.querySelector('#decisionDetailGroups .meeting-protocol-card'),
        attendance:!!document.querySelector('#decisionDetailGroups .meeting-attendance-panel'),
        contextHidden:!!document.querySelector('#decisionDetailContext')?.hidden,
        meta:document.querySelector('#decisionDetailMeta')?.textContent||''
      };
      const sameMeetingKey='case_body_bygg_och_miljonamnden_2023_01_12_6|p|6';
      const sameMeetingRow=decisionAllPointRows.find(row=>decisionProposalKey(row)===sameMeetingKey)||null;
      if(sameMeetingRow)openDecisionDetail(sameMeetingRow.id,sameMeetingKey);
      const sameMeetingReference=[...document.querySelectorAll('#decisionDetailGroups .decision-text-ref')].find(node=>node.textContent.trim()==='2023-01-12')||null;
      const beforeSameMeetingTab=decisionActiveTab;
      sameMeetingReference?.click();
      const sameMeetingTargetTab=decisionActiveTabState();
      const sameMeetingTargetProposal=sameMeetingTargetTab?.kind==='decision'?decisionDetailPayload(sameMeetingTargetTab)?.proposal:null;
      const sameMeetingReferenceResult={
        found:!!sameMeetingReference,
        opened:decisionActiveTab!==beforeSameMeetingTab,
        isMeeting:!!sameMeetingTargetProposal?.isMeeting,
        date:sameMeetingTargetProposal?.date||'',
        body:sameMeetingTargetProposal?.body||'',
        protocolCard:!!document.querySelector('#decisionDetailGroups .meeting-protocol-card')
      };
      const missingRow=decisionAllPointRows.find(row=>{
        if(row.isMeeting)return false;
        const doc=(decisionPack?.d||[])[row.docIndex]||{};
        return !String(row.abstractText||doc.ad||'').trim()&&!String(row.description||'').trim()&&!String(row.fullDecisionText||doc.bd||'').trim()&&!String(doc.pd||'').trim()&&!String(doc.yd||'').trim();
      })||null;
      if(missingRow)openDecisionDetail(missingRow.id,decisionProposalKey(missingRow));
      const missingDescriptionFallback=!!document.querySelector('#decisionDetailGroups .decision-description-unavailable');
      deep={
        canonicalMs,delayedActiveKind,indexedHeadings,finalHeadings,finalAttendanceCount,finalAttendanceRoles,finalItemVoteAttendance,coldDetail,
        hydratedTab:hydratedTab?{point:hydratedTab.point||'',sourcePoint:hydratedTab.sourcePoint||'',sourcePoints:hydratedTab.sourcePoints||[]}:null,
        canonicalKeyMatches:decisionAllPointRows.filter(row=>decisionProposalKey(row)===auditKey).length,
        canonicalIdPoints:decisionAllPointRows.filter(row=>row.id==='case_body_kommunfullmaktige_2024_05_14_123').map(row=>String(row.point)).slice(0,20),
        runtimeKeyMatch:!!decisionRuntimeIndexesFinal?.proposalByKey?.get(auditKey),
        proposalFields:proposal?{docIndex:proposal.docIndex,abstractLength:String(proposal.abstractText||'').length,descriptionLength:String(proposal.description||'').length,decisionLength:String(proposal.fullDecisionText||'').length,docAbstractLength:String(sourceDoc.ad||'').length,docDecisionLength:String(sourceDoc.bd||'').length,textHtmlLength:String(decisionDetailTextHtml(proposal)||'').length,rowCount:payload?.rows?.length||0}:null,
        descriptionText,voteLayout,
        referenceFound:!!reference,referenceOpened:afterReferenceTab!==beforeReferenceTab,
        referenceTarget:referenceTargetProposal?{date:referenceTargetProposal.date,body:referenceTargetProposal.body,point:String(referenceTargetProposal.point)}:null,
        meetingLinkFound,attendanceFound,meetingView,sameMeetingReferenceResult,
        missingDescriptionKey:missingRow?decisionProposalKey(missingRow):'',missingDescriptionFallback
      };
    }
    return {mode:location.protocol==='file:'?'file':'http',initialLoadMs,clickKey,clickMs,detailOpened,searchFinished,incrementalRendered,incrementalSteps,errors,geometryChanges,samples,deep};
  })()`);
  const reloadSetup=await evaluate(cdp,`(()=>{const input=document.querySelector('#decisionDecisionSearch'),hash=location.hash;input.value='reload-persistence-check';input.dispatchEvent(new Event('input',{bubbles:true}));return {value:input.value,hash}})()`);
  let hashAfterInput=reloadSetup.hash;
  for(let attempt=0;attempt<100&&hashAfterInput===reloadSetup.hash;attempt++){
    await new Promise(resolve=>setTimeout(resolve,25));
    hashAfterInput=await evaluate(cdp,'location.hash');
  }
  result.reloadHashChanged=hashAfterInput!==reloadSetup.hash;
  await cdp.send('Page.enable');
  await cdp.send('Page.reload',{ignoreCache:true});
  for(let attempt=0;attempt<200;attempt++){
    const ready=await evaluate(cdp,`document.readyState==='complete'&&typeof restoreDecisionSearchAfterReload==='function'&&decisionSearchQuery==='reload-persistence-check'&&document.querySelector('#decisionDecisionSearch')?.value==='reload-persistence-check'&&document.querySelector('#decisionDecisionSearch')?.dataset.reloadRestored==='true'`).catch(()=>false);
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  result.reloadSearch=await evaluate(cdp,`({field:document.querySelector('#decisionDecisionSearch')?.value||'',query:decisionSearchQuery,restoredFromSnapshot:document.querySelector('#decisionDecisionSearch')?.dataset.reloadRestored==='true'})`);
  console.log(JSON.stringify(result,null,2));
  if(!result.detailOpened||!result.searchFinished||!result.incrementalRendered||result.errors.length||result.geometryChanges||!result.reloadHashChanged||result.reloadSearch?.field!=='reload-persistence-check'||result.reloadSearch?.query!=='reload-persistence-check'||!result.reloadSearch?.restoredFromSnapshot)process.exitCode=1;
  if(deepAudit&&(
    result.deep?.delayedActiveKind!=='list'||
    result.deep?.finalAttendanceCount!==82||
    result.deep?.finalAttendanceRoles?.councillors!==56||result.deep?.finalAttendanceRoles?.['serving-substitutes']!==17||result.deep?.finalAttendanceRoles?.substitutes!==9||
    !result.deep?.finalItemVoteAttendance?.includes('64 personer')||
    result.deep?.coldDetail?.canonicalReady||
    !result.deep?.coldDetail?.hasFastDetail||result.deep?.coldDetail?.pendingCanonical||
    !result.deep?.coldDetail?.completeHeadings||!result.deep?.coldDetail?.reference||!result.deep?.coldDetail?.attendance||result.deep?.coldDetail?.attendanceCount!==82||result.deep?.coldDetail?.standaloneMuhammed||
    result.deep?.coldDetail?.attendanceRoles?.councillors!==56||result.deep?.coldDetail?.attendanceRoles?.['serving-substitutes']!==17||result.deep?.coldDetail?.attendanceRoles?.substitutes!==9||!result.deep?.coldDetail?.itemVoteAttendance?.includes('64 personer')||
    result.deep?.coldDetail?.partyCards!==8||!result.deep?.coldDetail?.contextVisible||!result.deep?.coldDetail?.contextInHeader||result.deep?.coldDetail?.contextInGroups||
    result.deep?.hydratedTab?.sourcePoints?.[0]!=='123'||
    !result.deep?.proposalFields?.abstractLength||
    !result.deep?.descriptionText||
    !result.deep?.referenceFound||!result.deep?.referenceOpened||
    result.deep?.referenceTarget?.date!=='2024-05-07'||
    !result.deep?.meetingLinkFound||!result.deep?.attendanceFound||
    !result.deep?.meetingView?.isMeeting||!result.deep?.meetingView?.protocolCard||!result.deep?.meetingView?.attendance||!result.deep?.meetingView?.contextHidden||
    !result.deep?.sameMeetingReferenceResult?.found||!result.deep?.sameMeetingReferenceResult?.opened||!result.deep?.sameMeetingReferenceResult?.isMeeting||result.deep?.sameMeetingReferenceResult?.date!=='2023-01-12'||!result.deep?.sameMeetingReferenceResult?.body?.startsWith('Bygg- och milj')||!result.deep?.sameMeetingReferenceResult?.protocolCard||
    !result.deep?.missingDescriptionKey||!result.deep?.missingDescriptionFallback||
    result.deep?.voteLayout?.partyCards!==8||
    result.deep?.voteLayout?.noTop-result.deep?.voteLayout?.yesBottom>30
  ))process.exitCode=1;
}finally{
  cdp?.close();chrome.kill();server.close();
  await new Promise(resolve=>setTimeout(resolve,500));
  await rm(profile,{recursive:true,force:true,maxRetries:0}).catch(()=>{});
}
