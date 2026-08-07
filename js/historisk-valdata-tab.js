let rawRows=[],rawColumns=[],rawReady=false,rawSelected=new Set(),rawEligiblePage=0,rawIneligiblePage=0,rawSortColumn='votes',rawSortDir='desc',rawDraftItems=[],rawDraftSelectedId=null,rawNextDraftId=1,rawDataPromise=null,rawPageSizeValue=500,rawFilterLocks={rawYear:[],rawElection:[],rawCounty:[],rawMunicipality:[],rawParty:[]};
let groupResolver=null,groupKeyHandler=null,groupLastFocus=null;
const rawInvalidPartyCodes=new Set(['BLANK','OG','OGEJ']);
const rawHiddenColumns=new Set(['source_file','turnout_source_file','county_code','municipality_code','municipality_full_code','total_votes_cast','valid_votes_cast','total_eligible_voters','election_participation_percent']);
const rawColumnLabels={year:'År',election_type:'Valtyp',county_name:'Region',municipality_name:'Kommun',party_standard:'Parti (standardiserat)',party_raw:'Parti (rådata)',votes:'Röster',percent:'Procent',total_votes_cast:'Totala röster',valid_votes_cast:'Giltiga röster',total_eligible_voters:'Röstberättigade',election_participation_percent:'Valdeltagande'};
const rawElectionLabels={municipal:'Kommunval',regional:'Regionval',parliamentary:'Riksdagsval'};
const rawFilterIds=['rawYear','rawElection','rawCounty','rawMunicipality','rawParty'];
const rawFilterClearValue='__clear_filter__';
const rawFilterPromptValue='__add_raw_filter__';
function closeGroupDialog(result){const overlay=$('groupOverlay');if(groupKeyHandler){document.removeEventListener('keydown',groupKeyHandler);groupKeyHandler=null;}overlay.hidden=true;document.body.style.overflow='';if(groupLastFocus&&typeof groupLastFocus.focus==='function')groupLastFocus.focus();const resolve=groupResolver;groupResolver=null;groupLastFocus=null;if(resolve)resolve(result);}
async function openGroupNameDialog(initialValue='Samverkansgrupp'){if(groupResolver)return Promise.resolve(null);const overlay=$('groupOverlay'),field=$('groupNameField'),accept=$('groupAccept'),cancel=$('groupCancel');field.value=initialValue;groupLastFocus=document.activeElement;overlay.hidden=false;document.body.style.overflow='hidden';return new Promise(resolve=>{groupResolver=resolve;groupKeyHandler=e=>{if(e.key==='Escape'){e.preventDefault();closeGroupDialog(null);}if(e.key==='Enter'){e.preventDefault();closeGroupDialog(field.value);}};document.addEventListener('keydown',groupKeyHandler);setTimeout(()=>{field.focus();field.select();accept.disabled=false;},0);});}
const rawRegionAliases={'Blekinge':'Blekinge','Blekinges':'Blekinge','Dalarna':'Dalarna','Dalarnas':'Dalarna','Gotland':'Gotland','Gotlands':'Gotland','Gävleborg':'Gävleborg','Gävleborgs':'Gävleborg','Halland':'Halland','Hallands':'Halland','Jämtland':'Jämtland','Jämtlands':'Jämtland','Jönköping':'Jönköping','Jönköpings':'Jönköping','Kalmar':'Kalmar','Kronoberg':'Kronoberg','Kronobergs':'Kronoberg','Norrbotten':'Norrbotten','Norrbottens':'Norrbotten','Skåne':'Skåne','Stockholm':'Stockholm','Stockholms':'Stockholm','Södermanland':'Södermanland','Södermanlands':'Södermanland','Uppsala':'Uppsala','Värmland':'Värmland','Värmlands':'Värmland','Västerbotten':'Västerbotten','Västerbottens':'Västerbotten','Västernorrland':'Västernorrland','Västernorrlands':'Västernorrland','Västmanland':'Västmanland','Västmanlands':'Västmanland','Västra Götaland':'Västra Götaland','Västra Götalands':'Västra Götaland','Örebro':'Örebro','Örebro län':'Örebro','Östergötland':'Östergötland','Östergötlands':'Östergötland'};
function normalizeRawSelectionState(value){if(Array.isArray(value))return value.map(String).filter(Boolean);if(value===null||value===undefined||value==='')return[];return [String(value)];}
async function applyRawState(state){if(!state)return;if(state.r&&!rawReady)await ensureRawData();if(!rawReady)return;rawSortColumn=state.sc||'votes';rawSortDir=state.sd==='asc'?'asc':'desc';rawSelected=new Set(Array.isArray(state.s)?state.s.map(Number):[]);rawDraftItems=(Array.isArray(state.d)?copy(state.d):[]).map(item=>{const party=item.type!=='group',memberKeys=[...new Set((item.memberKeys||[]).map(normalizeRawPartyName).filter(Boolean))],members=[...new Set((item.members||[]).map(normalizeRawPartyName).filter(Boolean))];return {...item,name:party?normalizeRawPartyName(item.name):item.name,memberKeys,members};});rawDraftSelectedId=state.di??null;rawPageSizeValue=Number(state.ps)||500;rawFilterLocks={rawYear:normalizeRawSelectionState(state.y),rawElection:normalizeRawSelectionState(state.e),rawCounty:normalizeRawSelectionState(state.c),rawMunicipality:normalizeRawSelectionState(state.m),rawParty:normalizeRawSelectionState(state.p).map(normalizeRawPartyName)};buildRawFilters();$('rawSearch').value=state.q||'';rawEligiblePage=Math.max(0,Number(state.ep)||0);rawIneligiblePage=Math.max(0,Number(state.ip)||0);renderRawTable();renderRawDraft();if(state.rs)$('rawStatus').textContent=state.rs;}
function exportRawState(){if(!rawReady)return {r:0};return {r:1,y:selectedRawValues('rawYear'),e:selectedRawValues('rawElection'),c:selectedRawValues('rawCounty'),m:selectedRawValues('rawMunicipality'),p:selectedRawValues('rawParty'),q:$('rawSearch').value||'',ps:rawPageSize(),ep:rawEligiblePage,ip:rawIneligiblePage,sc:rawSortColumn,sd:rawSortDir,s:[...rawSelected],d:copy(rawDraftItems),di:rawDraftSelectedId,rs:$('rawStatus').textContent||''};}
async function ensureRawData(){if(rawReady)return;if(!rawDataPromise){rawDataPromise=(async()=>{try{const payload=await inflateHistoricData(historicPack);const rows=Array.isArray(payload)?payload:(payload.rows||[]);const sourceColumns=(payload.columns&&payload.columns.length)?payload.columns:Object.keys(rows[0]||{});rawColumns=sourceColumns.filter(c=>!rawHiddenColumns.has(c));rawRows=rows.map((r,i)=>{const row=Array.isArray(r)?Object.fromEntries(sourceColumns.map((c,j)=>[c,r[j]])):r;row.__rawId=i+1;return row;});rawReady=true;buildRawFilters();renderRawTable();}catch(e){$('rawStatus').textContent='Den inbäddade JSON-datan kunde inte läsas: '+e.message;throw e;}finally{rawDataPromise=null;}})();}return rawDataPromise;}
async function initRawData(){return ensureRawData();}
function rawValue(row,col){const v=row[col];return v===null||v===undefined?'':String(v);}
function normalizeRegionName(value){const text=String(value||'').trim().replace(/\s+län$/i,'');return rawRegionAliases[text]||text;}
function normalizeRawPartyName(value){
  const text=String(value||'').trim();
  const folded=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  return ['orp','op','orebropartiet'].includes(folded)?'Örebropartiet':text;
}
function rawComparable(row,col){const text=rawValue(row,col);if(col==='county_name')return normalizeRegionName(text);if(col==='party_standard')return normalizeRawPartyName(text);return text;}
function rawDisplay(col,value){const text=rawValue({[col]:value},col);if(col==='election_type')return rawElectionLabels[text]||text;if(col==='county_name')return normalizeRegionName(text);if(col==='party_standard')return normalizeRawPartyName(text);return text;}
function rawExportValue(row,col){if(['year','votes','percent'].includes(col)){const n=Number(rawValue(row,col));if(Number.isFinite(n))return n;}return rawDisplay(col,rawValue(row,col));}
function rawLabel(col){return rawColumnLabels[col]||col.replaceAll('_',' ');}
function rawInvalidVoteCell(row,col){const value=esc(rawDisplay(col,rawValue(row,col))),markerColumn=rawColumns.includes('party_standard')?'party_standard':rawColumns.includes('party_raw')?'party_raw':rawColumns[0];return col===markerColumn?`${value}<sup class="raw-invalid-vote-marker" title="Ingår i valdeltagandet, men inte i giltiga partiröster eller partiernas procentandelar">*</sup>`:value;}
function fmtInt(value){const n=Number(value);return Number.isFinite(n)?n.toLocaleString('sv-SE'):'—';}
function rawSelectedRows(){return rawRows.filter(r=>rawSelected.has(r.__rawId));}
function selectedRawCount(){return rawSelectedRows().length;}
function guessIconId(name,isGroup=false){if(isGroup)return 14;const text=String(name||'').toLowerCase();if(text==='socialdemokraterna'||text==='s')return 1;if(text==='moderaterna'||text==='m')return 2;if(text==='sverigedemokraterna'||text==='sd')return 3;if(text==='centerpartiet'||text==='c')return 4;if(text==='vänsterpartiet'||text==='v')return 5;if(text==='kristdemokraterna'||text==='kd')return 6;if(text==='liberalerna'||text==='l')return 7;if(text==='miljöpartiet'||text==='mp')return 8;if(text==='örebropartiet'||text==='öp')return 9;if(text==='alternativ för sverige'||text==='afs')return 10;if(text==='feministiskt initiativ'||text==='fi')return 11;if(text==='medborgerlig samling'||text==='med')return 12;if(text==='partiet nyans'||text==='pn')return 13;return 15;}
function currentRawContextTitle(){const yearLabel=selectedRawLabels('rawYear').join(', ');const electionLabel=selectedRawLabels('rawElection').join(', ');const countyLabel=selectedRawLabels('rawCounty').join(', ');const municipalityLabel=selectedRawLabels('rawMunicipality').join(', ');const parts=[countyLabel,municipalityLabel,yearLabel,electionLabel].filter(Boolean);return parts.join(' ');}
function isRawInvalidVoteRow(row){return rawInvalidPartyCodes.has(rawComparable(row,'party_standard'));}
function rawEligibleRows(rows){return rows.filter(r=>!isRawInvalidVoteRow(r));}
function rawIneligibleRows(rows){return rows.filter(r=>isRawInvalidVoteRow(r));}
function rawMeta(rows){const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};const groups=new Map();rows.forEach(row=>{const key=[rawComparable(row,'year'),rawComparable(row,'election_type'),rawComparable(row,'county_name'),rawComparable(row,'municipality_name')].join('|');if(!groups.has(key))groups.set(key,{totalVotesCast:n(row.total_votes_cast),validVotesCast:n(row.valid_votes_cast),totalEligibleVoters:n(row.total_eligible_voters),participation:n(row.election_participation_percent)});});let totalVotesCast=0,validVotesCast=0,totalEligibleVoters=0;for(const meta of groups.values()){totalVotesCast+=meta.totalVotesCast;validVotesCast+=meta.validVotesCast;totalEligibleVoters+=meta.totalEligibleVoters;}const participation=totalEligibleVoters>0?(totalVotesCast/totalEligibleVoters)*100:(groups.values().next().value?.participation||0);return {totalVotesCast,validVotesCast,totalEligibleVoters,participation};}
function aggregateRawParties(rows){const groups=new Map();rows.forEach(r=>{const key=rawComparable(r,'party_standard');if(!groups.has(key))groups.set(key,{key,name:rawDisplay('party_standard',rawValue(r,'party_standard')),votes:0,icon:guessIconId(rawDisplay('party_standard',rawValue(r,'party_standard')),false)});groups.get(key).votes+=Number(rawValue(r,'votes'))||0;});return [...groups.values()].sort((a,b)=>b.votes-a.votes||a.name.localeCompare(b.name,'sv',{numeric:true,sensitivity:'base'}));}
function aggregateRawSelection(){return aggregateRawParties(rawSelectedRows());}function eligibleVoteTotal(rows){const meta=rawMeta(rows);if(meta.validVotesCast>0)return meta.validVotesCast;const top=rows.reduce((best,row)=>{const votes=Number(rawValue(row,'votes'))||0;if(!best||votes>best.votes)return {row,votes};return best;},null)?.row;if(!top)return 0;const votes=Number(rawValue(top,'votes'))||0;const percent=Number(rawValue(top,'percent'))||0;if(!Number.isFinite(percent)||percent<=0)return votes;const scale=percent>1?100:1;return Math.ceil(votes*scale/percent);}
function renderRawDraft(){const body=$('rawDraftBody');if(!body)return;body.innerHTML=rawDraftItems.map(item=>`<tr><td><input type="radio" name="rawDraftPick" data-id="${item.id}" ${rawDraftSelectedId===item.id?'checked':''}></td><td>${esc(item.type==='group'?'Samverkansgrupp':'Parti')}</td><td>${esc(item.name)}</td><td class="num">${item.votes}</td><td>${esc(item.type==='group'?item.members.join(', '):item.name)}</td></tr>`).join('');body.querySelectorAll('input[type=\"radio\"]').forEach(r=>r.onchange=()=>{rawDraftSelectedId=Number(r.dataset.id);});$('rawDraftStatus').textContent=rawDraftItems.length?`Poster i uppställningen: ${rawDraftItems.length}.`:'Ingen uppställning skapad ännu.';}
function consumeRawSelection(){rawSelected.clear();renderRawTable();}
function addRawSelectionToDraft(asGroup=false,groupName=''){const picked=aggregateRawSelection();if(!picked.length){$('rawStatus').textContent='Markera minst en rad i tabellen först.';return;}const cleanedGroupName=String(groupName||'').trim();if(asGroup){const name=cleanedGroupName||'Samverkansgrupp';rawDraftItems.push({id:Date.now(),type:'group',name,votes:picked.reduce((sum,p)=>sum+p.votes,0),icon:guessIconId(name,true),members:picked.map(p=>p.name),memberKeys:picked.map(p=>p.key)});}else{picked.forEach((p,i)=>rawDraftItems.push({id:Date.now()+i,type:'party',name:p.name,votes:p.votes,icon:p.icon,members:[p.name],memberKeys:[p.key]}));}rawDraftSelectedId=rawDraftItems.length?rawDraftItems[rawDraftItems.length-1].id:null;renderRawDraft();consumeRawSelection();$('rawStatus').textContent=asGroup?'Valda partier lades till som samverkansgrupp i uppställningen.':'Valda partier lades till som enskilda poster i uppställningen.';}
function removeRawDraftItem(){if(rawDraftSelectedId===null)return;rawDraftItems=rawDraftItems.filter(item=>item.id!==rawDraftSelectedId);rawDraftSelectedId=rawDraftItems.length?rawDraftItems[0].id:null;renderRawDraft();}
function clearRawDraft(){rawDraftItems=[];rawDraftSelectedId=null;renderRawDraft();}
function createRawCalculationTab(){if(!rawDraftItems.length){$('rawDraftStatus').textContent='Lägg först till partier eller samverkansgrupper i uppställningen.';return;}const currentRows=rawEligibleRows(filteredRawRows());const totals=aggregateRawParties(currentRows);if(!totals.length){$('rawDraftStatus').textContent='Den aktuella vyn innehåller inga giltiga partier att skapa en beräkning från.';return;}const totalMap=new Map(totals.map(p=>[p.key,p]));const parties=[];rawDraftItems.forEach(item=>{if(item.type==='group'){const keys=[...new Set((item.memberKeys||[]).map(normalizeRawPartyName))].filter(k=>totalMap.has(k));const votes=keys.reduce((sum,k)=>sum+totalMap.get(k).votes,0);parties.push({id:Date.now()+parties.length,name:item.name,votes:votes||item.votes,icon:item.icon,order:parties.length});}else{const key=normalizeRawPartyName((item.memberKeys&&item.memberKeys[0])||item.name);const match=totalMap.get(key);parties.push({id:Date.now()+parties.length,name:normalizeRawPartyName(item.name),votes:match?match.votes:item.votes,icon:item.icon,order:parties.length});}});const title=currentRawContextTitle()||`Beräkning ${tabs.length+1}`;const data={title,method:initialState.method,factor:initialState.factor,seats:initialState.seats,memberSeats:initialState.memberSeats??initialState.seats,substituteSeats:initialState.substituteSeats??initialState.seats,seed:newSeed(),sourceTotalVotes:eligibleVoteTotal(currentRows),parties};const tab=makeTab(data,title);tab.dirty=true;tabs.push(tab);activeTab=tabs.length-1;clearRawDraft();setTopView('calculator');renderAll();showNotice('Uppställningen fördes över till en ny beräkning. Totalt antal giltiga röster hämtas från hela den aktuella vyn. Tryck Beräkna mandat för att uppdatera resultatet.');}
function rawSortValue(row,col){if(['year','votes','percent'].includes(col)){const n=Number(rawValue(row,col));if(Number.isFinite(n))return n;}return rawDisplay(col,rawValue(row,col));}
function rawSortedRows(rows){return [...rows].sort((a,b)=>{const av=rawSortValue(a,rawSortColumn),bv=rawSortValue(b,rawSortColumn);let cmp=0;if(typeof av==='number'&&typeof bv==='number')cmp=av-bv;else cmp=String(av).localeCompare(String(bv),'sv',{numeric:true,sensitivity:'base'});if(cmp===0)cmp=String(rawDisplay('party_standard',rawValue(a,'party_standard'))).localeCompare(String(rawDisplay('party_standard',rawValue(b,'party_standard'))),'sv',{numeric:true,sensitivity:'base'});return rawSortDir==='asc'?cmp:-cmp;});}
function rawSortIndicator(col){if(rawSortColumn!==col)return '';return rawSortDir==='asc'?' ▲':' ▼';}
function setRawSort(col){if(rawSortColumn===col)rawSortDir=rawSortDir==='asc'?'desc':'asc';else{rawSortColumn=col;rawSortDir=col==='votes'?'desc':'asc';}resetRawPage();renderRawTable();}
function uniqueRaw(col){return [...new Set(rawRows.map(r=>rawComparable(r,col)).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'sv',{numeric:true}));}
function uniqueRawFromRows(rows,col){return [...new Set(rows.map(r=>rawComparable(r,col)).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'sv',{numeric:true}));}
function uniqueRawElectionTypes(){const order=['parliamentary','regional','municipal'];const values=new Set(rawRows.map(r=>rawComparable(r,'election_type')).filter(Boolean));return order.filter(v=>values.has(v));}
function uniqueRawPartiesByVotes(rows){const totals=new Map();rows.forEach(r=>{const key=rawComparable(r,'party_standard');if(!key)return;totals.set(key,(totals.get(key)||0)+(Number(rawValue(r,'votes'))||0));});return [...totals.entries()].sort((a,b)=>b[1]-a[1]||rawDisplay('party_standard',a[0]).localeCompare(rawDisplay('party_standard',b[0]),'sv',{numeric:true,sensitivity:'base'})).map(([key])=>key);}
function rawRowsForPartyOptions(rows=rawRows){const years=selectedRawValues('rawYear'),elections=selectedRawValues('rawElection'),counties=selectedRawValues('rawCounty'),municipalities=selectedRawValues('rawMunicipality');return rows.filter(r=>(!years.length||years.includes(String(rawComparable(r,'year'))))&&(!elections.length||elections.includes(rawComparable(r,'election_type')))&&(!counties.length||counties.includes(rawComparable(r,'county_name')))&&(!municipalities.length||municipalities.includes(rawComparable(r,'municipality_name'))));}
function rawPartyOptionsByCurrentContext(rows=rawRows){return uniqueRawPartiesByVotes(rawRowsForPartyOptions(rows));}
function selectedRawValues(id){
  const values=rawFilterLocks[id]||[];
  if(id!=='rawParty')return values;
  const normalized=[...new Set(values.map(normalizeRawPartyName).filter(Boolean))];
  if(normalized.length!==values.length||normalized.some((value,index)=>value!==values[index]))rawFilterLocks[id]=normalized;
  return normalized;
}
function selectedRawLabels(id){const sel=$(id),col=sel?.dataset.col;return selectedRawValues(id).map(v=>col?rawDisplay(col,v):v);}
function setSelectOptions(id,values,selected=[],col='',allLabel='Alla'){const sel=$(id);rawFilterLocks[id]=normalizeRawSelectionState(selected.length?selected:rawFilterLocks[id]).filter(v=>values.map(String).includes(String(v)));const locked=new Set(rawFilterLocks[id].map(String));const allOption=locked.size?`<option value="${rawFilterPromptValue}" selected>Välj fler...</option><option value="${rawFilterClearValue}">${esc(allLabel)}</option>`:`<option value="">${esc(allLabel)}</option>`;const options=[allOption,...values.map(v=>{const chosen=locked.has(String(v)),label=col?rawDisplay(col,v):v;return `<option value="${esc(v)}" ${chosen?'disabled data-filter-selected="1"':''}>${esc(chosen?`✓ ${label} (valt)`:label)}</option>`;})].join('');sel.dataset.col=col;sel.innerHTML=options;sel.value=locked.size?rawFilterPromptValue:'';}
function rawFilterLabel(id,col,value){const prefix={rawYear:'År',rawElection:'Valtyp',rawCounty:'Region',rawMunicipality:'Kommun',rawParty:'Parti'}[id]||'Filter';return `${prefix}: ${col?rawDisplay(col,value):value}`;}
function renderRawFilterLocks(){document.querySelectorAll('#rawDataView .raw-toolbar .field > .raw-filter-lock').forEach(lock=>lock.remove());const host=$('rawFilterLocks');if(!host)return;const chips=[];rawFilterIds.forEach(id=>{const sel=$(id);if(!sel)return;const col=sel.dataset.col||'';selectedRawValues(id).forEach(value=>chips.push({id,value,label:rawFilterLabel(id,col,value)}));});host.hidden=!chips.length;host.innerHTML=chips.map(chip=>`<span class="raw-filter-chip"><span>${esc(chip.label)}</span><button type="button" data-id="${esc(chip.id)}" data-value="${esc(chip.value)}" title="Rensa filter" aria-label="Rensa filter">×</button></span>`).join('');if(chips.length)host.insertAdjacentHTML('beforeend','<button type="button" class="filter-clear-all" data-clear-all-filters title="Rensa alla filter" aria-label="Rensa alla filter">× Rensa alla</button>');host.querySelectorAll('.raw-filter-chip button').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.id;rawFilterLocks[id]=selectedRawValues(id).filter(value=>value!==btn.dataset.value);buildRawFilters();resetRawPage();renderRawTable();});host.querySelector('[data-clear-all-filters]')?.addEventListener('click',()=>{rawFilterIds.forEach(id=>{rawFilterLocks[id]=[];});buildRawFilters();resetRawPage();renderRawTable();});}
function buildRawFilters(){const selectedCounties=selectedRawValues('rawCounty');setSelectOptions('rawYear',uniqueRaw('year'),rawFilterLocks.rawYear,'year');setSelectOptions('rawElection',uniqueRawElectionTypes(),rawFilterLocks.rawElection,'election_type');setSelectOptions('rawCounty',uniqueRaw('county_name'),rawFilterLocks.rawCounty,'county_name');const countyRows=selectedCounties.length?rawRows.filter(r=>selectedCounties.includes(rawComparable(r,'county_name'))):rawRows;setSelectOptions('rawMunicipality',uniqueRawFromRows(countyRows,'municipality_name'),rawFilterLocks.rawMunicipality,'municipality_name');setSelectOptions('rawParty',rawPartyOptionsByCurrentContext(),rawFilterLocks.rawParty,'party_standard');renderRawFilterLocks();}
function handleRawFilterChange(id){const sel=$(id),value=sel?.value;if(value===rawFilterPromptValue)return;if(value===rawFilterClearValue)rawFilterLocks[id]=[];else if(value){if(!selectedRawValues(id).includes(value))rawFilterLocks[id]=[...selectedRawValues(id),value];}else rawFilterLocks[id]=[];if(id==='rawCounty')rawFilterLocks.rawMunicipality=rawFilterLocks.rawMunicipality.filter(v=>uniqueRawFromRows(rawFilterLocks.rawCounty.length?rawRows.filter(r=>rawFilterLocks.rawCounty.includes(rawComparable(r,'county_name'))):rawRows,'municipality_name').includes(v));buildRawFilters();resetRawPage();renderRawTable();}
function filteredRawRows(){const years=selectedRawValues('rawYear'),elections=selectedRawValues('rawElection'),counties=selectedRawValues('rawCounty'),municipalities=selectedRawValues('rawMunicipality'),parties=selectedRawValues('rawParty'),q=fuzzySearchNormalize($('rawSearch').value);return rawRows.filter(r=>(!years.length||years.includes(String(rawComparable(r,'year'))))&&(!elections.length||elections.includes(rawComparable(r,'election_type')))&&(!counties.length||counties.includes(rawComparable(r,'county_name')))&&(!municipalities.length||municipalities.includes(rawComparable(r,'municipality_name')))&&(!parties.length||parties.includes(rawComparable(r,'party_standard')))&&(!q||fuzzySearchTextMatches(r.__searchText||(r.__searchText=rawColumns.map(c=>rawDisplay(c,rawValue(r,c))).join(' ')),q)));}
function rawPageSize(){return rawPageSizeValue||500;}
function setRawPageSize(size){const value=[100,250,500,1000,2500].includes(Number(size))?Number(size):500;rawPageSizeValue=value;renderRawPageSizeControls();resetRawPage();renderRawTable();}
function renderRawPageSizeControls(){const value=rawPageSize();document.querySelectorAll('.raw-page-size-options').forEach(group=>{group.querySelectorAll('.raw-page-size-option').forEach(btn=>{const active=Number(btn.dataset.size)===value;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',active?'true':'false');});});}
function resetRawPage(){rawEligiblePage=0;rawIneligiblePage=0;}
function pageSlice(rows,page,size){const start=Math.min(page,Math.max(0,Math.ceil(rows.length/size)-1))*size;return {start,rows:rows.slice(start,start+size),page:Math.min(page,Math.max(0,Math.ceil(rows.length/size)-1)),pages:Math.max(1,Math.ceil(rows.length/size))};}
function syncRawSelectionUi(){const body=$('rawEligibleBody');if(!body)return;body.querySelectorAll('.raw-selectable-row').forEach(row=>{const id=Number(row.dataset.id);const selected=rawSelected.has(id);row.classList.toggle('selected',selected);const box=row.querySelector('.raw-pick');if(box)box.checked=selected;});}
function renderRawTable(){renderRawFilterLocks();renderRawPageSizeControls();if(!rawRows.length){rawLastEligibleCount=0;rawLastIneligibleCount=0;$('rawEligibleHead').innerHTML='';$('rawEligibleBody').innerHTML='';$('rawIneligibleHead').innerHTML='';$('rawIneligibleBody').innerHTML='';$('rawOverview').innerHTML='';$('rawCount').textContent='Ingen historisk data är inbäddad.';$('rawEligiblePage').textContent='';$('rawIneligiblePage').textContent='';return;}const rows=rawSortedRows(filteredRawRows()),eligible=rawEligibleRows(rows),ineligible=rawIneligibleRows(rows),meta=rawMeta(rows),size=rawPageSize(),eligiblePage=pageSlice(eligible,rawEligiblePage,size),ineligiblePage=pageSlice(ineligible,rawIneligiblePage,size);rawEligiblePage=eligiblePage.page;rawIneligiblePage=ineligiblePage.page;rawLastEligibleCount=eligible.length;rawLastIneligibleCount=ineligible.length;const shownEligible=eligiblePage.rows,shownIneligible=ineligiblePage.rows,from=shownEligible.length?eligiblePage.start+1:0,to=eligiblePage.start+shownEligible.length;const invalidTotal=meta.totalVotesCast&&meta.validVotesCast?Math.max(0,meta.totalVotesCast-meta.validVotesCast):ineligible.reduce((sum,row)=>sum+(Number(rawValue(row,'votes'))||0),0);$('rawOverview').innerHTML=[[ 'Totalt röstberättigade',fmtInt(meta.totalEligibleVoters)],[ 'Avgivna röster',fmtInt(meta.totalVotesCast)],[ 'Giltiga röster',fmtInt(meta.validVotesCast||eligible.reduce((sum,row)=>sum+(Number(rawValue(row,'votes'))||0),0))],[ 'Ogiltiga röster',fmtInt(invalidTotal)],[ 'Valdeltagande',meta.participation?meta.participation.toFixed(2)+'%':'—']].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');$('rawCount').textContent=`Giltiga rader: ${fmtInt(eligible.length)}. Ogiltiga rader: ${fmtInt(ineligible.length)}. Valda rader: ${fmtInt(selectedRawCount())}.`;$('rawEligibleCount').textContent=`Visar ${fmtInt(from)}-${fmtInt(to)} av ${fmtInt(eligible.length)} giltiga rader.`;$('rawIneligibleCount').textContent=`Visar ${fmtInt(ineligiblePage.rows.length?ineligiblePage.start+1:0)}-${fmtInt(ineligiblePage.start+ineligiblePage.rows.length)} av ${fmtInt(ineligible.length)} ogiltiga rader.`;$('rawEligiblePage').textContent=`Sida ${fmtInt(eligiblePage.page+1)} av ${fmtInt(eligiblePage.pages)}`;$('rawIneligiblePage').textContent=`Sida ${fmtInt(ineligiblePage.page+1)} av ${fmtInt(ineligiblePage.pages)}`;$('rawEligiblePrev').disabled=eligiblePage.page<=0;$('rawEligibleNext').disabled=eligiblePage.page>=eligiblePage.pages-1;$('rawIneligiblePrev').disabled=ineligiblePage.page<=0;$('rawIneligibleNext').disabled=ineligiblePage.page>=ineligiblePage.pages-1;const head='<tr><th>Val</th>'+rawColumns.map(c=>`<th data-col="${esc(c)}" style="cursor:pointer">${esc(rawLabel(c)+rawSortIndicator(c))}</th>`).join('')+'</tr>';$('rawEligibleHead').innerHTML=head;$('rawIneligibleHead').innerHTML='<tr>'+rawColumns.map(c=>`<th>${esc(rawLabel(c))}</th>`).join('')+'</tr>';$('rawEligibleHead').querySelectorAll('th[data-col]').forEach(th=>th.onclick=()=>setRawSort(th.dataset.col));$('rawEligibleBody').innerHTML=shownEligible.map(r=>`<tr class="raw-selectable-row ${rawSelected.has(r.__rawId)?'selected':''}" data-id="${r.__rawId}"><td><input class="raw-pick" type="checkbox" data-id="${r.__rawId}" ${rawSelected.has(r.__rawId)?'checked':''}></td>${rawColumns.map(c=>`<td>${esc(rawDisplay(c,rawValue(r,c)))}</td>`).join('')}</tr>`).join('');$('rawIneligibleBody').innerHTML=shownIneligible.map(r=>`<tr>${rawColumns.map(c=>`<td>${esc(rawDisplay(c,rawValue(r,c)))}</td>`).join('')}</tr>`).join('');syncRawSelectionUi();$('rawEligibleBody').onclick=e=>{const row=e.target.closest('.raw-selectable-row');if(!row)return;if(e.target.closest('input,button,a,label,select,textarea'))return;const id=Number(row.dataset.id);if(rawSelected.has(id))rawSelected.delete(id);else rawSelected.add(id);syncRawSelectionUi();};$('rawEligibleBody').onchange=e=>{const box=e.target.closest('.raw-pick');if(!box)return;const id=Number(box.dataset.id);if(box.checked)rawSelected.add(id);else rawSelected.delete(id);syncRawSelectionUi();};}
function selectRawPage(){const rows=rawEligibleRows(rawSortedRows(filteredRawRows())),size=rawPageSize(),pageRows=pageSlice(rows,rawEligiblePage,size).rows;pageRows.forEach(r=>rawSelected.add(r.__rawId));syncRawSelectionUi();}
function clearRawSelection(){rawSelected.clear();syncRawSelectionUi();}
async function exportRawXlsx(){if(!rawReady)await initRawData();if(!rawRows.length){$('rawStatus').textContent='Det finns ingen historisk valdata att exportera.';return;}const rows=rawSortedRows(filteredRawRows());const data=[rawColumns.map(rawLabel),...rows.map(r=>rawColumns.map(c=>rawExportValue(r,c)))];const files=[];files.push({name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'});files.push({name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});files.push({name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Historisk valdata" sheetId="1" r:id="rId1"/></sheets></workbook>'});files.push({name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'});files.push({name:'xl/worksheets/sheet1.xml',data:sheetXml(data)});const blob=zip(files),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='historisk_valdata.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

/* Infinite-scroll table rendering for the two historic-data main tables. */
function rawVisibleCount(page,total){
  return Math.min(total,(Math.max(0,Number(page)||0)+1)*rawPageSize());
}
function rawMaybeLoadMore(kind){
  const wrap=$(kind==='eligible'?'rawEligibleBody':'rawIneligibleBody')?.closest('.raw-table-wrap');
  if(!wrap||wrap.dataset.rawInfiniteBound==='1')return;
  wrap.dataset.rawInfiniteBound='1';
  wrap.addEventListener('scroll',()=>{
    if(wrap.scrollTop+wrap.clientHeight<wrap.scrollHeight-180)return;
    const rows=rawSortedRows(filteredRawRows()),total=(kind==='eligible'?rawEligibleRows(rows):rawIneligibleRows(rows)).length;
    if(kind==='eligible'){
      if(rawVisibleCount(rawEligiblePage,total)>=total)return;
      rawEligiblePage++;
    }else{
      if(rawVisibleCount(rawIneligiblePage,total)>=total)return;
      rawIneligiblePage++;
    }
    renderRawTable();
  },{passive:true});
}
function resetRawPage(){rawEligiblePage=0;rawIneligiblePage=0;}
function renderRawTable(){
  renderRawFilterLocks();
  renderRawPageSizeControls();
  rawMaybeLoadMore('eligible');
  rawMaybeLoadMore('ineligible');
  if(!rawRows.length){
    rawLastEligibleCount=0;rawLastIneligibleCount=0;
    $('rawEligibleHead').innerHTML='';
    $('rawEligibleBody').innerHTML='';
    $('rawIneligibleHead').innerHTML='';
    $('rawIneligibleBody').innerHTML='';
    $('rawOverview').innerHTML='';
    $('rawCount').textContent='Ingen historisk data är inbäddad.';
    $('rawEligiblePage').textContent='';
    $('rawIneligiblePage').textContent='';
    $('rawInvalidVoteNote').hidden=true;
    return;
  }
  const rows=rawSortedRows(filteredRawRows()),eligible=rawEligibleRows(rows),ineligible=rawIneligibleRows(rows),meta=rawMeta(rows);
  rawLastEligibleCount=eligible.length;
  rawLastIneligibleCount=ineligible.length;
  const eligibleTo=rawVisibleCount(rawEligiblePage,eligible.length),ineligibleTo=rawVisibleCount(rawIneligiblePage,ineligible.length),shownEligible=eligible.slice(0,eligibleTo),shownIneligible=ineligible.slice(0,ineligibleTo);
  const invalidTotal=meta.totalVotesCast&&meta.validVotesCast?Math.max(0,meta.totalVotesCast-meta.validVotesCast):ineligible.reduce((sum,row)=>sum+(Number(rawValue(row,'votes'))||0),0);
  $('rawOverview').innerHTML=[
    ['Totalt röstberättigade',fmtInt(meta.totalEligibleVoters)],
    ['Avgivna röster',fmtInt(meta.totalVotesCast)],
    ['Giltiga röster',fmtInt(meta.validVotesCast||eligible.reduce((sum,row)=>sum+(Number(rawValue(row,'votes'))||0),0))],
    ['Ogiltiga röster',fmtInt(invalidTotal)],
    ['Valdeltagande',meta.participation?meta.participation.toFixed(2)+'%':'—']
  ].map(([k,v])=>`<div class="card">${esc(k)}<b>${esc(String(v))}</b></div>`).join('');
  $('rawCount').textContent=`Totalt i filtrerad vy: ${fmtInt(rows.length)} rader. Giltiga: ${fmtInt(eligible.length)}. Ogiltiga: ${fmtInt(ineligible.length)}. Valda rader: ${fmtInt(selectedRawCount())}.`;
  $('rawEligibleCount').textContent=eligible.length?'':'Inga giltiga rader matchar filtren.';
  $('rawEligibleCount').hidden=!!eligible.length;
  $('rawIneligibleCount').textContent=ineligible.length?'':'Inga ogiltiga rader matchar filtren.';
  $('rawIneligibleCount').hidden=!!ineligible.length;
  $('rawInvalidVoteNote').hidden=!ineligible.length;
  $('rawEligiblePage').textContent=eligible.length?`Visar ${fmtInt(shownEligible.length)} / ${fmtInt(eligible.length)}`:'';
  $('rawIneligiblePage').textContent=ineligible.length?`Visar ${fmtInt(shownIneligible.length)} / ${fmtInt(ineligible.length)}`:'';
  $('rawEligiblePrev').hidden=true;
  $('rawEligibleNext').hidden=true;
  $('rawIneligiblePrev').hidden=true;
  $('rawIneligibleNext').hidden=true;
  const head='<tr><th>Val</th>'+rawColumns.map(c=>`<th data-col="${esc(c)}" style="cursor:pointer">${esc(rawLabel(c)+rawSortIndicator(c))}</th>`).join('')+'</tr>';
  $('rawEligibleHead').innerHTML=head;
  $('rawIneligibleHead').innerHTML='<tr>'+rawColumns.map(c=>`<th>${esc(rawLabel(c))}</th>`).join('')+'</tr>';
  $('rawEligibleHead').querySelectorAll('th[data-col]').forEach(th=>th.onclick=()=>setRawSort(th.dataset.col));
  $('rawEligibleBody').innerHTML=shownEligible.map(r=>`<tr class="raw-selectable-row ${rawSelected.has(r.__rawId)?'selected':''}" data-id="${r.__rawId}"><td><input class="raw-pick" type="checkbox" data-id="${r.__rawId}" ${rawSelected.has(r.__rawId)?'checked':''}></td>${rawColumns.map(c=>`<td>${esc(rawDisplay(c,rawValue(r,c)))}</td>`).join('')}</tr>`).join('');
  $('rawIneligibleBody').innerHTML=shownIneligible.map(r=>`<tr aria-describedby="rawInvalidVoteNote">${rawColumns.map(c=>`<td>${rawInvalidVoteCell(r,c)}</td>`).join('')}</tr>`).join('');
  syncRawSelectionUi();
  $('rawEligibleBody').onclick=e=>{
    const row=e.target.closest('.raw-selectable-row');
    if(!row||e.target.closest('input,button,a,label,select,textarea'))return;
    const id=Number(row.dataset.id);
    if(rawSelected.has(id))rawSelected.delete(id);else rawSelected.add(id);
    syncRawSelectionUi();
  };
  $('rawEligibleBody').onchange=e=>{
    const box=e.target.closest('.raw-pick');
    if(!box)return;
    const id=Number(box.dataset.id);
    if(box.checked)rawSelected.add(id);else rawSelected.delete(id);
    syncRawSelectionUi();
  };
}
function selectRawPage(){
  rawEligibleRows(rawSortedRows(filteredRawRows())).slice(0,rawVisibleCount(rawEligiblePage,rawLastEligibleCount)).forEach(r=>rawSelected.add(r.__rawId));
  syncRawSelectionUi();
}

/* Final defaults and loading affordance for infinite-scroll table chunks. */
if(rawPageSizeValue===500)rawPageSizeValue=250;
rawPageSize=function(){return rawPageSizeValue||250;};
setRawPageSize=function(size){const value=[100,250,500,1000,2500].includes(Number(size))?Number(size):250;rawPageSizeValue=value;renderRawPageSizeControls();resetRawPage();renderRawTable();};
const applyRawStateBeforeDefaultStepFinal=applyRawState;
applyRawState=async function(state){
  await applyRawStateBeforeDefaultStepFinal(state);
  if(!state?.ps&&rawPageSizeValue===500){
    rawPageSizeValue=250;
    renderRawPageSizeControls();
    resetRawPage();
    renderRawTable();
  }
};
function rawLoadMoreWithSpinnerFinal(wrap,update){
  if(!wrap||wrap.dataset.infiniteLoading==='1')return;
  if(update&&update()===false)return;
  wrap.dataset.infiniteLoading='1';
  wrap.classList.add('table-results-updating','table-infinite-loading');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      wrap.classList.remove('table-results-updating','table-infinite-loading');
      delete wrap.dataset.infiniteLoading;
      wrap.classList.remove('table-results-refreshed');
      void wrap.offsetWidth;
      wrap.classList.add('table-results-refreshed');
    });
  }));
}
rawMaybeLoadMore=function(kind){
  const wrap=$(kind==='eligible'?'rawEligibleBody':'rawIneligibleBody')?.closest('.raw-table-wrap');
  if(!wrap||wrap.dataset.rawInfiniteBound==='1')return;
  wrap.dataset.rawInfiniteBound='1';
  wrap.addEventListener('scroll',()=>{
    if(wrap.scrollTop+wrap.clientHeight<wrap.scrollHeight-180)return;
    const rows=rawSortedRows(filteredRawRows()),total=(kind==='eligible'?rawEligibleRows(rows):rawIneligibleRows(rows)).length;
    if(kind==='eligible'){
      if(rawVisibleCount(rawEligiblePage,total)>=total)return;
      rawLoadMoreWithSpinnerFinal(wrap,()=>{
        if(rawVisibleCount(rawEligiblePage,total)>=total)return false;
        rawEligiblePage++;
        renderRawTable();
        return true;
      });
    }else{
      if(rawVisibleCount(rawIneligiblePage,total)>=total)return;
      rawLoadMoreWithSpinnerFinal(wrap,()=>{
        if(rawVisibleCount(rawIneligiblePage,total)>=total)return false;
        rawIneligiblePage++;
        renderRawTable();
        return true;
      });
    }
  },{passive:true});
};

/* Compact URL-session representation for selected raw row ids. */
function rawEncodeRanges(values){
  const sorted=[...new Set((values||[]).map(Number).filter(Number.isFinite))].sort((a,b)=>a-b),ranges=[];
  for(let i=0;i<sorted.length;i++){
    const start=sorted[i];
    let end=start;
    while(i+1<sorted.length&&sorted[i+1]===end+1)end=sorted[++i];
    ranges.push(end===start?start:[start,end-start+1]);
  }
  return ranges;
}
function rawDecodeRanges(ranges){
  const out=[];
  (ranges||[]).forEach(item=>{
    if(Array.isArray(item)){
      const start=Number(item[0])||0,len=Number(item[1])||0;
      for(let i=0;i<len;i++)out.push(start+i);
    }else{
      const id=Number(item);
      if(Number.isFinite(id))out.push(id);
    }
  });
  return out;
}
const exportRawStateBeforeCompactUrlFinal=exportRawState;
exportRawState=function(){
  const state=exportRawStateBeforeCompactUrlFinal();
  if(Array.isArray(state.s)){
    state.sr=rawEncodeRanges(state.s);
    delete state.s;
  }
  return state;
};
const applyRawStateBeforeCompactUrlFinal=applyRawState;
applyRawState=async function(state){
  const expanded=state&&Array.isArray(state.sr)&&!Array.isArray(state.s)?{...state,s:rawDecodeRanges(state.sr)}:state;
  return applyRawStateBeforeCompactUrlFinal(expanded);
};

