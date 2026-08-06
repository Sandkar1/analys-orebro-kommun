let confirmResolver=null,confirmKeyHandler=null,confirmLastFocus=null;
function closeConfirm(result){const overlay=$('confirmOverlay');if(confirmKeyHandler){document.removeEventListener('keydown',confirmKeyHandler);confirmKeyHandler=null;}overlay.hidden=true;document.body.style.overflow='';if(confirmLastFocus&&typeof confirmLastFocus.focus==='function')confirmLastFocus.focus();const resolve=confirmResolver;confirmResolver=null;confirmLastFocus=null;if(resolve)resolve(result);}
function openResetConfirm(){if(confirmResolver)return Promise.resolve(false);const overlay=$('confirmOverlay');const accept=$('confirmAccept');const cancel=$('confirmCancel');confirmLastFocus=document.activeElement;overlay.hidden=false;document.body.style.overflow='hidden';return new Promise(resolve=>{confirmResolver=resolve;confirmKeyHandler=e=>{if(e.key==='Escape'){e.preventDefault();closeConfirm(false);}};document.addEventListener('keydown',confirmKeyHandler);accept.focus();});}
let sessionResolver=null,sessionKeyHandler=null,sessionLastFocus=null,decisionViewMounted=false,decisionViewMountPromise=null,decisionViewMountScheduled=false,decisionCanonicalMountPromise=null,decisionSearchInputTimer=null;
const decisionSearchReloadStorageKey='municipal-decision-search-reload-v1';
function persistDecisionSearchForReload(value){
  try{
    window.sessionStorage?.setItem(decisionSearchReloadStorageKey,JSON.stringify({path:`${location.pathname}${location.search}`,value:String(value||'')}));
  }catch{}
}
function decisionNavigationIsReload(){
  const navigation=performance.getEntriesByType?.('navigation')?.[0];
  if(navigation)return navigation.type==='reload';
  if(typeof performance.navigation?.type==='number')return performance.navigation.type===1;
  return true;
}
function restoreDecisionSearchAfterReload(){
  try{
    const record=JSON.parse(window.sessionStorage?.getItem(decisionSearchReloadStorageKey)||'null');
    if(!decisionNavigationIsReload()||!record||record.path!==`${location.pathname}${location.search}`)return false;
    decisionSearchQuery=String(record.value||'');
    syncDecisionSearchControl();
    const input=$('decisionDecisionSearch');
    if(input)input.dataset.reloadRestored='true';
    return true;
  }catch{return false;}
}
function closeSessionDialog(result){const overlay=$('sessionOverlay');if(sessionKeyHandler){document.removeEventListener('keydown',sessionKeyHandler);sessionKeyHandler=null;}overlay.hidden=true;document.body.style.overflow='';if(sessionLastFocus&&typeof sessionLastFocus.focus==='function')sessionLastFocus.focus();const resolve=sessionResolver;sessionResolver=null;sessionLastFocus=null;if(resolve)resolve(result);}
function setSessionMessage(message){$('sessionMessage').textContent=message;}
function selectEntireSessionField(){const field=$('sessionField');field.focus();field.setSelectionRange(0,field.value.length);}
let aboutKeyHandler=null,aboutLastFocus=null;
function closeAboutDialog(){const overlay=$('aboutOverlay');if(aboutKeyHandler){document.removeEventListener('keydown',aboutKeyHandler);aboutKeyHandler=null;}overlay.hidden=true;document.body.style.overflow='';if(aboutLastFocus&&typeof aboutLastFocus.focus==='function')aboutLastFocus.focus();aboutLastFocus=null;}
function openAboutDialog(){if(aboutKeyHandler)return;const overlay=$('aboutOverlay');aboutLastFocus=document.activeElement;overlay.hidden=false;document.body.style.overflow='hidden';aboutKeyHandler=e=>{if(e.key==='Escape'){e.preventDefault();closeAboutDialog();}};document.addEventListener('keydown',aboutKeyHandler);setTimeout(()=>$('aboutClose')?.focus(),0);}
let sessionValidationSeq=0,sessionValidatedValue='',sessionValidatedPayload=null;
function setSessionStatus(kind,text){const status=$('sessionStatus');const check=$('sessionStatusCheck');const label=$('sessionStatusText');status.hidden=false;status.classList.remove('is-success','is-error');check.textContent='•';if(kind==='success'){status.classList.add('is-success');check.textContent='✓';}else if(kind==='error'){status.classList.add('is-error');check.textContent='!';}label.textContent=text;}
function setSessionCopyState(copied){setSessionStatus(copied?'success':'neutral',copied?'Kopierad':'Inte kopierad');}
async function validateImportSession(value){const accept=$('sessionAccept');const trimmed=String(value||'').trim();const seq=++sessionValidationSeq;sessionValidatedValue='';sessionValidatedPayload=null;if(!trimmed){accept.disabled=true;setSessionStatus('error','Ingen giltig session inklistrad');return;}try{const payload=await decodeStateString(trimmed);normalizeImportedPayload(payload);if(seq!==sessionValidationSeq)return;sessionValidatedValue=trimmed;sessionValidatedPayload=payload;accept.disabled=false;setSessionStatus('success','Giltig session');}catch{if(seq!==sessionValidationSeq)return;accept.disabled=true;setSessionStatus('error','Ogiltig session');}}
function openSessionDialog({title,message,value='',readOnly=false,acceptText='Spara',cancelText='Avbryt',showCopy=false,requireValid=false}){if(sessionResolver)return Promise.resolve(null);const overlay=$('sessionOverlay'),field=$('sessionField'),accept=$('sessionAccept'),cancel=$('sessionCancel'),copyBtn=$('sessionCopy'),status=$('sessionStatus');$('sessionTitle').textContent=title;setSessionMessage(message);field.value=value;field.readOnly=!!readOnly;field.dataset.exportMode=readOnly?'1':'0';field.dataset.requireValid=requireValid?'1':'0';accept.textContent=acceptText;cancel.textContent=cancelText;accept.disabled=false;cancel.hidden=readOnly&&acceptText===cancelText;copyBtn.hidden=!showCopy;status.hidden=false;sessionValidationSeq++;sessionValidatedValue='';sessionValidatedPayload=null;if(showCopy)setSessionCopyState(false);else if(requireValid){accept.disabled=true;setSessionStatus('error','Ingen giltig session inklistrad');}else status.hidden=true;sessionLastFocus=document.activeElement;overlay.hidden=false;document.body.style.overflow='hidden';return new Promise(resolve=>{sessionResolver=resolve;sessionKeyHandler=e=>{if(e.key==='Escape'){e.preventDefault();closeSessionDialog(null);}if(e.key==='Enter'&&e.ctrlKey&&!field.readOnly&&!accept.disabled){e.preventDefault();closeSessionDialog(field.value);}if(field.dataset.exportMode==='1'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();selectEntireSessionField();}};document.addEventListener('keydown',sessionKeyHandler);setTimeout(()=>{if(field.dataset.exportMode==='1')selectEntireSessionField();else field.focus();if(requireValid)validateImportSession(field.value);},0);});}
function cleanTabState(t){const snapshot=compactSnapshot(expandSnapshot(t.snapshot||buildResultSnapshot(t)));return {i:t.id,t:t.title,m:t.method,f:t.factor,s:t.seats,ms:t.memberSeats,ss:t.substituteSeats,sd:t.seed,stv:t.sourceTotalVotes??null,d:!!t.dirty,p:(t.parties||[]).map(p=>[p.id,p.name,Number(p.votes)||0,Number(p.icon)||15]),sn:snapshot};}
function captureUrlUiState(){const wrap=id=>Math.round($(id)?.closest('.raw-table-wrap')?.scrollTop||0);return {wy:Math.round(window.scrollY||0),raw:{e:wrap('rawEligibleBody'),i:wrap('rawIneligibleBody')},decision:{m:wrap('decisionBody'),a:wrap('decisionActivityBody')}};}
function restoreUrlUiState(ui){if(!ui)return;requestAnimationFrame(()=>requestAnimationFrame(()=>{const set=(id,value)=>{const wrap=$(id)?.closest('.raw-table-wrap');if(wrap)wrap.scrollTop=Number(value)||0;};set('rawEligibleBody',ui.raw?.e);set('rawIneligibleBody',ui.raw?.i);set('decisionBody',ui.decision?.m);set('decisionActivityBody',ui.decision?.a);window.scrollTo(0,Number(ui.wy)||0);}));}
function exportStatePayload(){readInputs(false);return {f:'m',v:stateFormatVersion,p:programVersion,a:activeTab,t:tabs.map(cleanTabState),tv:currentTopView(),rv:exportRawState(),dv:municipalWorkEnabled?exportDecisionState():null,ui:captureUrlUiState()};}
function toBase64Url(bytes){let binary='';const chunkSize=0x8000;for(let i=0;i<bytes.length;i+=chunkSize)binary+=String.fromCharCode(...bytes.subarray(i,i+chunkSize));return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function fromBase64Url(text){const normalized=text.replace(/-/g,'+').replace(/_/g,'/');const padded=normalized+'==='.slice((normalized.length+3)%4);const binary=atob(padded);return Uint8Array.from(binary,ch=>ch.charCodeAt(0));}
async function gzipBytes(bytes){if(typeof CompressionStream!=='function')return bytes;const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));return new Uint8Array(await new Response(stream).arrayBuffer());}
async function gunzipBytes(bytes){if(typeof DecompressionStream!=='function')return bytes;const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return new Uint8Array(await new Response(stream).arrayBuffer());}
async function encodeStateString(payload){const rawBytes=new TextEncoder().encode(JSON.stringify(payload));if(typeof CompressionStream!=='function')return 'MFD3:'+toBase64Url(rawBytes);const gzBytes=await gzipBytes(rawBytes);return 'MFD4:'+toBase64Url(gzBytes);}
async function decodeStateString(text){const trimmed=String(text||'').trim();if(trimmed.startsWith('MFD4:'))return JSON.parse(new TextDecoder().decode(await gunzipBytes(fromBase64Url(trimmed.slice(5)))));if(trimmed.startsWith('MFD3:'))return JSON.parse(new TextDecoder().decode(fromBase64Url(trimmed.slice(5))));if(trimmed.startsWith('MFD2:'))return JSON.parse(decodeURIComponent(trimmed.slice(5)));if(trimmed.startsWith('MFD1:')){const binary=atob(trimmed.slice(5));const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));}throw Error('Ogiltigt format på sessionen.');}
function normalizeImportedPayload(payload){if(payload?.f==='m'&&Array.isArray(payload.t))return {activeTab:Number(payload.a)||0,topView:payload.tv==='raw'?'raw':['decision','decisionActivity'].includes(payload.tv)&&municipalWorkEnabled?payload.tv:'calculator',rawState:payload.rv||null,decisionState:payload.dv||null,tabs:payload.t.map((tab,i)=>({id:Number(tab.i)||0,title:tab.t||`Beräkning ${i+1}`,method:tab.m||'dhondt',factor:tab.f||'1.2',seats:Number(tab.s)||17,memberSeats:Number(tab.ms??tab.s)||17,substituteSeats:Number(tab.ss)||11,seed:String(tab.sd||newSeed()),sourceTotalVotes:tab.stv??null,dirty:!!tab.d,parties:Array.isArray(tab.p)?tab.p.map((p,j)=>({id:Number(p?.[0])||Date.now()+j,name:p?.[1]||`Parti eller samverkansgrupp ${j+1}`,votes:Number(p?.[2])||0,icon:Number(p?.[3])||15,order:j})):[],snapshot:expandSnapshot(tab.sn)}))};if(payload?.format==='mandatfordelning-state'&&Array.isArray(payload.tabs))return {activeTab:Number(payload.activeTab)||0,topView:'calculator',rawState:null,decisionState:null,tabs:payload.tabs.map((tab,i)=>({...tab,title:tab.title||`Beräkning ${i+1}`,snapshot:expandSnapshot(tab.snapshot)}))};throw Error('Sessionen innehåller ingen giltig beräkningsdata.');}
function hydrateImportedTab(tab,i){const made=makeTab(tab,tab.title||`Beräkning ${i+1}`);made.id=Number(tab.id)||made.id;made.dirty=!!tab.dirty;made.result=null;made.snapshot=expandSnapshot(tab.snapshot||buildResultSnapshot(made));if(!made.dirty){try{made.result=runCalculation(made);made.snapshot=buildResultSnapshot(made);}catch{}}return made;}
async function applyImportedState(payload){const normalized=normalizeImportedPayload(payload);if(!normalized.tabs.length)throw Error('Sessionen saknar flikar.');tabs=normalized.tabs.map(hydrateImportedTab);nextTabId=tabs.reduce((max,t)=>Math.max(max,Number(t.id)||0),0)+1;activeTab=Math.max(0,Math.min(Number(normalized.activeTab)||0,tabs.length-1));if(municipalWorkEnabled)applyDecisionState(normalized.decisionState);renderAll();await setTopView(normalized.topView||'calculator');await applyRawState(normalized.rawState);restoreUrlUiState(payload?.ui);}
async function exportStateString(){try{const value=await encodeStateString(exportStatePayload());urlHashLast=value;replaceUrlHash(value);await openSessionDialog({title:'Exportera session',message:'Kopiera sessionen nedan för att spara dina beräkningar.',value,readOnly:true,acceptText:'Stäng',cancelText:'Stäng',showCopy:true});}catch(e){showError(e.message);}}
async function importStateString(){try{const value=await openSessionDialog({title:'Importera session',message:'Klistra in en tidigare exporterad session för att återställa dina beräkningar.',value:'',readOnly:false,acceptText:'Importera',cancelText:'Avbryt',showCopy:false,requireValid:true});if(value===null)return;await applyImportedState(sessionValidatedValue===String(value).trim()&&sessionValidatedPayload?sessionValidatedPayload:await decodeStateString(value));clearError();showNotice('Sessionen importerades.');scheduleUrlHashUpdate(0);}catch(e){showError(e.message);}}
let urlHashTimer=0,urlHashApplying=false,urlHashLast='';
function urlHashSessionValue(){const value=decodeURIComponent(String(location.hash||'').replace(/^#/,''));return /^MFD[1-4]:/.test(value)?value:'';}
function replaceUrlHash(value){const next=`${location.pathname}${location.search}#${encodeURIComponent(value)}`;history.replaceState(null,'',next);}
function scheduleUrlHashUpdate(delay=500){if(urlHashApplying)return;clearTimeout(urlHashTimer);urlHashTimer=setTimeout(updateUrlHashSession,delay);}
async function updateUrlHashSession(){if(urlHashApplying)return;try{const value=await encodeStateString(exportStatePayload());if(value===urlHashLast||value===urlHashSessionValue())return;urlHashLast=value;replaceUrlHash(value);}catch{}}
async function applyUrlHashSession(){const value=urlHashSessionValue();if(!value)return false;urlHashApplying=true;try{const payload=await decodeStateString(value);await applyImportedState(payload);urlHashLast=value;clearError();return true;}catch(e){showError(`Kunde inte läsa sessionen i URL: ${e.message}`);return false;}finally{urlHashApplying=false;}}
function xesc(v){return esc(v);}
function colName(n){let s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
function cell(v,s=0){return {v,s};}
function sheetXml(rows){let xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultColWidth="12" defaultRowHeight="18"/><cols><col min="1" max="64" width="12" customWidth="1"/></cols><sheetData>';rows.forEach((row,r)=>{xml+=`<row r="${r+1}">`;row.forEach((cellValue,c)=>{if(cellValue===undefined||cellValue===null)return;const data=typeof cellValue==='object'&&'v'in cellValue?cellValue:{v:cellValue,s:0};const ref=colName(c+1)+(r+1);const style=data.s??0;const v=data.v;xml+=typeof v==='number'?`<c r="${ref}" s="${style}"><v>${v}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t>${xesc(v??'')}</t></is></c>`;});xml+='</row>';});return xml+'</sheetData></worksheet>';}
function crc32(bytes){let c=~0;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^(0xedb88320&-(c&1));}return ~c>>>0;}
function u16(a,v){a.push(v&255,(v>>8)&255);}
function u32(a,v){u16(a,v&65535);u16(a,(v>>>16)&65535);}
function bytes(s){return [...new TextEncoder().encode(s)];}
function zip(files){const out=[],central=[];let offset=0;for(const f of files){const name=bytes(f.name),data=bytes(f.data),crc=crc32(data);u32(out,0x04034b50);u16(out,20);u16(out,0);u16(out,0);u16(out,0);u16(out,0);u32(out,crc);u32(out,data.length);u32(out,data.length);u16(out,name.length);u16(out,0);out.push(...name,...data);const head=[];u32(head,0x02014b50);u16(head,20);u16(head,20);u16(head,0);u16(head,0);u16(head,0);u16(head,0);u32(head,crc);u32(head,data.length);u32(head,data.length);u16(head,name.length);u16(head,0);u16(head,0);u16(head,0);u16(head,0);u32(head,0);u32(head,offset);head.push(...name);central.push(...head);offset=out.length;}const centralOffset=out.length;out.push(...central);u32(out,0x06054b50);u16(out,0);u16(out,0);u16(out,files.length);u16(out,files.length);u32(out,central.length);u32(out,centralOffset);u16(out,0);return new Blob([new Uint8Array(out)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
function startDecisionViewMount(){
  if(decisionViewMounted)return Promise.resolve();
  if(decisionViewMountPromise)return decisionViewMountPromise;
  decisionViewMountPromise=Promise.resolve().then(()=>{
    decisionApplyBootstrapFilterOptionsFinal();
    decisionStartTableIndexLoadFinal();
    decisionScheduleProgressiveRefreshFinal();
    decisionViewMounted=true;
  }).catch(error=>{
    if(currentTopView()==='decision'){
      $('decisionStatus').hidden=false;
      $('decisionStatus').textContent=error?.message||'Kunde inte ladda kommunal data.';
    }
  }).finally(()=>{decisionViewMountPromise=null;});
  return decisionViewMountPromise;
}
function ensureDecisionCanonicalDataFinal(){
  if(decisionCanonicalPreparationReadyFinal())return Promise.resolve();
  if(decisionCanonicalMountPromise)return decisionCanonicalMountPromise;
  decisionRequestCanonicalDetailsFinal();
  decisionCanonicalMountPromise=(async()=>{
    await ensureDecisionPackLoaded();
    await ensureDecisionDataProgressively();
    await decisionHydrateFilterOptionsAfterPreparationFinal();
  })().finally(()=>{decisionCanonicalMountPromise=null;});
  return decisionCanonicalMountPromise;
}
function scheduleDecisionViewMountAfterPaint(){
  if(decisionViewMounted||decisionViewMountPromise||decisionViewMountScheduled)return;
  decisionViewMountScheduled=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    decisionViewMountScheduled=false;
    if(currentTopView()==='decision')startDecisionViewMount();
  }));
}
async function setTopView(name){
  if(['decision','decisionActivity'].includes(name)&&!municipalWorkEnabled)name='calculator';
  const calc=name==='calculator',raw=name==='raw',decision=name==='decision',decisionActivity=name==='decisionActivity',activeView=calc?$('calculatorView'):raw?$('rawDataView'):decision?$('decisionView'):$('decisionActivityView');
  $('calculatorView').classList.toggle('active',calc);$('rawDataView').classList.toggle('active',raw);$('decisionView').classList.toggle('active',decision);$('decisionActivityView').classList.toggle('active',decisionActivity);
  $('calculatorTopTab').classList.toggle('active',calc);$('rawTopTab').classList.toggle('active',raw);$('decisionTopTab').classList.toggle('active',decision);$('decisionActivityTopTab').classList.toggle('active',decisionActivity);
  animateUiRegion(activeView);
  if(raw&&!rawReady){setUiRegionBusy(activeView,true);try{await ensureRawData();}finally{setUiRegionBusy(activeView,false);}}
  if(decision){
    renderMunicipalTableShellFinal('decision');
    if(decisionReady)renderDecisionView();
    scheduleDecisionViewMountAfterPaint();
  }else if(decisionActivity){
    renderMunicipalTableShellFinal('decisionActivity');
    renderDecisionActivityView();
  }
}
function setExportXlsxBusy(busy){const btn=$('exportViewXlsx');if(!btn)return;if(busy){btn.dataset.previousHtml=btn.innerHTML;btn.dataset.previousDisabled=btn.disabled?'1':'0';btn.disabled=true;btn.classList.add('is-exporting');btn.setAttribute('aria-busy','true');btn.innerHTML='<span class="decision-load-spinner" aria-hidden="true"></span><span>Exporterar...</span>';return;}btn.classList.remove('is-exporting');btn.removeAttribute('aria-busy');btn.disabled=btn.dataset.previousDisabled==='1';btn.innerHTML=btn.dataset.previousHtml||'Exportera till Excel';delete btn.dataset.previousHtml;delete btn.dataset.previousDisabled;}
function waitForExportPaint(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
async function exportCurrentViewXlsx(){const btn=$('exportViewXlsx');if(btn?.classList.contains('is-exporting'))return;setExportXlsxBusy(true);try{await waitForExportPaint();const view=currentTopView();if(view==='raw')await exportRawXlsx();else if(view==='calculator')await exportXlsx();else if(view==='decision')await exportDecisionXlsx();else if(view==='decisionActivity')await exportDecisionActivityXlsx();else showError('Export till Excel är inte tillgänglig för den aktiva vyn.');}finally{setExportXlsxBusy(false);}}
$('calculate').onclick=calculateCurrent;$('reroll').onclick=()=>{readInputs(false);current().seed=newSeed();calculateCurrent();};$('add').onclick=()=>{readInputs(true);const t=current();t.parties.push({id:Date.now(),name:'Nytt parti eller grupp',votes:0,icon:15,order:t.parties.length});renderAll();showNotice('Ändringar väntar. Tryck Beräkna mandat för att uppdatera resultatet.');};$('reset').onclick=async()=>{if(await openResetConfirm())resetAll();};
$('confirmAccept').onclick=()=>closeConfirm(true);$('confirmCancel').onclick=()=>closeConfirm(false);$('confirmOverlay').onclick=e=>{if(e.target===e.currentTarget)closeConfirm(false);};
$('sessionAccept').onclick=()=>closeSessionDialog($('sessionField').readOnly?null:$('sessionField').value);$('sessionCancel').onclick=()=>closeSessionDialog(null);$('sessionCopy').onclick=async()=>{try{const value=$('sessionField').value;if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(value);else{selectEntireSessionField();document.execCommand('copy');}setSessionCopyState(true);}catch{setSessionMessage('Kunde inte kopiera automatiskt. Kopiera sessionen manuellt med hela markeringen i fältet nedan.');selectEntireSessionField();setSessionCopyState(false);}};
$('sessionField').onfocus=()=>{if($('sessionField').dataset.exportMode==='1')selectEntireSessionField();};$('sessionField').oninput=()=>{if($('sessionField').dataset.requireValid==='1')validateImportSession($('sessionField').value);};$('sessionField').onmouseup=e=>{if(e.currentTarget.dataset.exportMode==='1'){e.preventDefault();selectEntireSessionField();}};$('sessionField').onselect=()=>{if($('sessionField').dataset.exportMode==='1'&&($('sessionField').selectionStart!==0||$('sessionField').selectionEnd!==$('sessionField').value.length))setTimeout(selectEntireSessionField,0);};$('sessionField').oncopy=()=>{if($('sessionField').dataset.exportMode==='1')setSessionCopyState(true);};$('sessionOverlay').onclick=e=>{if(e.target===e.currentTarget)closeSessionDialog(null);};
$('aboutPageButton').onclick=openAboutDialog;$('aboutClose').onclick=closeAboutDialog;$('aboutOverlay').onclick=e=>{if(e.target===e.currentTarget)closeAboutDialog();};
$('groupCancel').onclick=()=>closeGroupDialog(null);$('groupAccept').onclick=()=>closeGroupDialog($('groupNameField').value);$('groupNameField').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();closeGroupDialog($('groupNameField').value);}};$('groupOverlay').onclick=e=>{if(e.target===e.currentTarget)closeGroupDialog(null);};
$('exportViewXlsx').onclick=exportCurrentViewXlsx;$('exportState').onclick=exportStateString;$('importState').onclick=importStateString;
$('newTab').onclick=()=>{readInputs(false);tabs.push(makeTab(initialState,`Beräkning ${tabs.length+1}`));activeTab=tabs.length-1;renderAll();};$('duplicateTab').onclick=()=>{readInputs(false);const src=copy(current());src.title=src.title+' – kopia';src.result=null;src.dirty=true;tabs.push(src);activeTab=tabs.length-1;renderAll();};if($('closeTab'))$('closeTab').onclick=()=>closeCalculatorTab(activeTab);
$('rawSelectPage').onclick=selectRawPage;$('rawClearSelection').onclick=clearRawSelection;$('rawAddParties').onclick=()=>addRawSelectionToDraft(false);$('rawAddGroup').onclick=async()=>{const name=await openGroupNameDialog('Samverkansgrupp');if(name===null)return;addRawSelectionToDraft(true,name);};$('rawCreateTab').onclick=createRawCalculationTab;$('rawRemoveDraft').onclick=removeRawDraftItem;$('rawClearDraft').onclick=clearRawDraft;
$('rawEligiblePrev').onclick=()=>{rawEligiblePage=Math.max(0,rawEligiblePage-1);renderRawTable();};$('rawEligibleNext').onclick=()=>{rawEligiblePage++;renderRawTable();};$('rawIneligiblePrev').onclick=()=>{rawIneligiblePage=Math.max(0,rawIneligiblePage-1);renderRawTable();};$('rawIneligibleNext').onclick=()=>{rawIneligiblePage++;renderRawTable();};document.querySelectorAll('.raw-page-size-option').forEach(btn=>btn.onclick=()=>setRawPageSize(Number(btn.dataset.size)));
$('decisionPrev').onclick=()=>{const tab=decisionActiveTabState();if(tab&&tab.kind==='decision')tab.page=Math.max(0,(tab.page||0)-1);else decisionTabs[0].page=Math.max(0,(decisionTabs[0].page||0)-1);renderDecisionView();};$('decisionNext').onclick=()=>{const tab=decisionActiveTabState();if(tab&&tab.kind==='decision')tab.page=(tab.page||0)+1;else decisionTabs[0].page=(decisionTabs[0].page||0)+1;renderDecisionView();};$('decisionBack').onclick=()=>{decisionActiveTab=0;renderDecisionView();};document.querySelectorAll('.decision-page-size-option').forEach(btn=>btn.onclick=()=>setDecisionPageSize(Number(btn.dataset.size)));
$('calculatorTopTab').onclick=()=>setTopView('calculator');$('rawTopTab').onclick=()=>setTopView('raw');$('decisionTopTab').hidden=!municipalWorkEnabled;$('decisionActivityTopTab').hidden=!municipalWorkEnabled;$('decisionTopTab').onclick=()=>setTopView('decision');$('decisionActivityTopTab').onclick=()=>setTopView('decisionActivity');
rawFilterIds.forEach(id=>{$(id).onchange=()=>handleRawFilterChange(id);});decisionFilterIds.forEach(id=>{$(id).onchange=()=>handleDecisionFilterChange(id);});
bindMunicipalDocumentsTabControls();
$('decisionDateToggle').onclick=e=>{e.stopPropagation();toggleDecisionDatePicker();};
document.addEventListener('click',e=>{if(decisionDatePickerOpen&&!e.target.closest('#decisionView .date-range'))closeDecisionDatePicker();});
$('decisionDecisionSearch').oninput=()=>{decisionSearchQuery=$('decisionDecisionSearch')?.value||'';persistDecisionSearchForReload(decisionSearchQuery);decisionActiveTab=0;resetDecisionPage();if(typeof decisionCancelProgressiveSearchForTypingFinal==='function')decisionCancelProgressiveSearchForTypingFinal();clearTimeout(decisionSearchInputTimer);decisionSearchInputTimer=setTimeout(()=>{decisionSearchInputTimer=null;scheduleTableSearch('decision','decisionDecisionSearch',['decisionBody'],()=>renderDecisionView());},100);};if($('decisionDecisionClear'))$('decisionDecisionClear').onclick=()=>{clearTimeout(decisionSearchInputTimer);decisionSearchInputTimer=null;decisionSearchQuery='';persistDecisionSearchForReload('');decisionActiveTab=0;resetDecisionPage();scheduleTableSearch('decision','decisionDecisionSearch',['decisionBody'],()=>renderDecisionView());};
$('rawSearch').oninput=()=>{resetRawPage();scheduleTableSearch('raw','rawSearch',['rawEligibleBody','rawIneligibleBody'],()=>renderRawTable());};
document.querySelector('.grid').addEventListener('input',()=>{readInputs(true);markDirtyUi();syncMethodFields();showNotice('Ändringar väntar. Tryck Beräkna mandat för att uppdatera resultatet.');});document.querySelector('.grid').addEventListener('change',()=>{readInputs(true);markDirtyUi();syncMethodFields();showNotice('Ändringar väntar. Tryck Beräkna mandat för att uppdatera resultatet.');});
document.addEventListener('input',()=>scheduleUrlHashUpdate(),true);
document.addEventListener('change',()=>scheduleUrlHashUpdate(),true);
document.addEventListener('click',()=>setTimeout(()=>scheduleUrlHashUpdate(),0),true);
document.addEventListener('scroll',()=>scheduleUrlHashUpdate(800),true);
window.addEventListener('hashchange',async()=>{if(urlHashApplying)return;const value=urlHashSessionValue();if(!value||value===urlHashLast)return;await applyUrlHashSession();});
async function initAppFromUrlHash(){
  /* The compressed URL state can take noticeable time to decode. Restore the
     small reload-only search snapshot first so the field is already populated
     on the first paint, then reapply it after URL state has finished. */
  const immediateSearch=restoreDecisionSearchAfterReload();
  const restored=await applyUrlHashSession();
  const restoredSearch=restoreDecisionSearchAfterReload()||immediateSearch;
  if(!restored){
    tabs=[makeTab(initialState,'Beräkning 1')];
    activeTab=0;
    renderAll();
    renderRawDraft();
    scheduleUrlHashUpdate(0);
  }else if(restoredSearch&&currentTopView()==='decision'){
    renderDecisionView();
  }
  // Municipal datasets are loaded on demand after their table shell has painted.
}
initAppFromUrlHash();






