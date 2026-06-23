const exportedAt=window.exportedAt;
const programVersion="v89.0";
const municipalWorkEnabled=true;
const historicPack=window.historicPack;
let decisionPack=window.municipalProtocolPack,documentPack=window.municipalDocumentPack,decisionPackPromise=null;
const stateFormatVersion=1;
const municipalProtocolPackSrcs=[
  `data/municipal-protocol-data-orebro-v2.part1.js?cache=${Date.now()}`,
  `data/municipal-protocol-data-orebro-v2.part2.js?cache=${Date.now()}`
];
async function decodeHistoricPackText(value){if(typeof DecompressionStream!=='function')throw Error('Den komprimerade historikdatan kräver stöd för DecompressionStream.');const bin=atob(String(value||'').replace(/\s+/g,''));const bytes=Uint8Array.from(bin,ch=>ch.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));const out=await new Response(stream).arrayBuffer();return new TextDecoder().decode(out);}
async function inflateHistoricData(p){if(typeof p==='string'){const json=await decodeHistoricPackText(p.startsWith('gz:')?p.slice(3):p);p=JSON.parse(json);}else if(p&&typeof p==='object'&&p.f==='gz'&&typeof p.d==='string'){const json=await decodeHistoricPackText(p.d);p=JSON.parse(json);}const sc=new Set(p.sc||[]);return {schema_version:p.v,columns:p.c,rows:p.r.map(a=>{const o={};for(let i=0;i<p.c.length;i++){const v=a[i];o[p.c[i]]=sc.has(i)&&v!==null?p.s[v]:v;}return o;})};}
function loadScriptOnce(src){return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(s=>s.getAttribute('src')===src);if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}const script=document.createElement('script');script.src=src;script.defer=true;script.onload=resolve;script.onerror=()=>reject(Error(`Kunde inte ladda ${src}`));document.head.appendChild(script);});}
function assembleMunicipalProtocolPackParts(){
  const parts=window.municipalProtocolPackParts||{},part1=parts[1],part2=parts[2];
  if(!part1||!part2)return null;
  return window.municipalProtocolPack={...part1,d:[...(part1.d||[]),...(part2.d||[])],r:part2.r||[],pr:part2.pr||[],mr:part2.mr||[]};
}
async function ensureDecisionPackLoaded(){if(!municipalWorkEnabled)throw Error('Kommunvyn är avstängd.');if(decisionPack?.d?.length)return decisionPack;if(window.municipalProtocolPack?.d?.length&&window.municipalProtocolPack!==decisionPack){decisionPack=window.municipalProtocolPack;return decisionPack;}const assembled=assembleMunicipalProtocolPackParts();if(assembled?.d?.length){decisionPack=assembled;return decisionPack;}if(!decisionPackPromise)decisionPackPromise=Promise.all(municipalProtocolPackSrcs.map(loadScriptOnce)).then(()=>{decisionPack=assembleMunicipalProtocolPackParts()||window.municipalProtocolPack;if(!decisionPack?.d?.length)throw Error('Kommundatan kunde inte läsas in.');return decisionPack;});return decisionPackPromise;}

const tableSearchJobs=new Map();
const prefersReducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
function animateUiRegion(target){
  const element=typeof target==='string'?$(target):target;
  if(!element||prefersReducedMotion?.matches)return;
  element.classList.remove('content-entering');
  void element.offsetWidth;
  element.classList.add('content-entering');
  element.addEventListener('animationend',()=>element.classList.remove('content-entering'),{once:true});
}
function setUiRegionBusy(target,busy){
  const element=typeof target==='string'?$(target):target;
  if(!element)return;
  element.classList.toggle('is-view-loading',busy);
  element.setAttribute('aria-busy',busy?'true':'false');
}
function setTableSearchBusy(inputId,tableIds,busy){
  const input=$(inputId),box=input?.closest('.decision-search-box,.table-search-box');
  if(box)box.classList.toggle('is-searching',busy);
  if(input)input.setAttribute('aria-busy',busy?'true':'false');
  tableIds.forEach(id=>$(id)?.closest('.raw-table-wrap')?.classList.toggle('table-results-updating',busy));
}
function scheduleTableSearch(key,inputId,tableIds,render){
  const previous=tableSearchJobs.get(key);
  if(previous){
    previous.cancelled=true;
    cancelAnimationFrame(previous.frame);
  }
  setTableSearchBusy(inputId,tableIds,true);
  const job={cancelled:false,frame:0};
  job.frame=requestAnimationFrame(()=>{
    if(job.cancelled)return;
    job.frame=requestAnimationFrame(()=>{
      if(job.cancelled)return;
      tableSearchJobs.delete(key);
      render();
      requestAnimationFrame(()=>{
        if(job.cancelled)return;
        setTableSearchBusy(inputId,tableIds,false);
        tableIds.forEach(id=>{
          const wrap=$(id)?.closest('.raw-table-wrap');
          if(!wrap)return;
          wrap.classList.remove('table-results-refreshed');
          void wrap.offsetWidth;
          wrap.classList.add('table-results-refreshed');
        });
      });
    });
  });
  tableSearchJobs.set(key,job);
}

function fuzzySearchNormalize(value){
  return String(value??'').toLocaleLowerCase('sv-SE').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9åäö]+/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function fuzzySearchDistanceWithin(a,b,max){
  if(Math.abs(a.length-b.length)>max)return false;
  const previous=Array(b.length+1).fill(0).map((_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let left=i,diag=i-1,rowMin=left;
    for(let j=1;j<=b.length;j++){
      const up=previous[j]+1;
      const ins=left+1;
      const sub=diag+(a[i-1]===b[j-1]?0:1);
      diag=previous[j];
      left=Math.min(up,ins,sub);
      previous[j]=left;
      if(left<rowMin)rowMin=left;
    }
    if(rowMin>max)return false;
  }
  return previous[b.length]<=max;
}
function fuzzySearchTokenMatches(queryToken,textToken){
  if(textToken.includes(queryToken))return true;
  if(queryToken.length<4||textToken.length<4)return false;
  if(queryToken.length>=6&&textToken.length>=6){
    const stem=Math.min(queryToken.length,textToken.length)>=10?6:5;
    if(queryToken.slice(0,stem)===textToken.slice(0,stem))return true;
  }
  const max=queryToken.length>=8?2:1;
  if(Math.abs(queryToken.length-textToken.length)>max)return false;
  if(queryToken[0]!==textToken[0]&&queryToken[queryToken.length-1]!==textToken[textToken.length-1])return false;
  return fuzzySearchDistanceWithin(queryToken,textToken,max);
}
function fuzzySearchTextMatches(text,query){
  const q=fuzzySearchNormalize(query);
  if(!q)return true;
  const t=fuzzySearchNormalize(text);
  if(t.includes(q))return true;
  const queryTokens=q.split(' ').filter(token=>token.length>=3);
  if(!queryTokens.length||queryTokens.length>6)return false;
  const textTokens=[...new Set(t.split(' ').filter(token=>token.length>=3))];
  return queryTokens.every(queryToken=>textTokens.some(textToken=>fuzzySearchTokenMatches(queryToken,textToken)));
}


