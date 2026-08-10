/* Searchable, progressively enhanced filter dropdowns. The native selects
   remain the source of truth so the existing filtering and session code keeps
   one state path; this layer only provides a better picker UI. */
const searchableFilterSelectIdsFinal=[
  'rawYear','rawElection','rawCounty','rawMunicipality','rawParty',
  'decisionOrgan','decisionProposalType','decisionParty','decisionMember','decisionVote','decisionResult',
  'decisionActivityType','decisionActivityParty','decisionActivityPoliticalOwner','decisionActivityOfficialOwner'
];
const searchableFilterStatesFinal=new Map();
let searchableFilterOpenStateFinal=null;

function searchableFilterPlainLabelFinal(value){
  return String(value||'').replace(/^\s*✓\s*/,'').replace(/\s*\(valt\)\s*$/i,'').trim();
}

function searchableFilterScoreFinal(label,query){
  const text=fuzzySearchNormalize(label),needle=fuzzySearchNormalize(query);
  if(!needle)return 1;
  if(!text)return 0;
  if(text===needle)return 100000;
  if(text.startsWith(needle))return 90000-Math.min(1000,text.length);
  const words=text.split(' ').filter(Boolean),wordIndex=words.findIndex(word=>word.startsWith(needle));
  if(wordIndex>=0)return 80000-wordIndex*100-Math.min(99,words[wordIndex].length);
  const phraseIndex=text.indexOf(needle);
  if(phraseIndex>=0)return 70000-Math.min(1000,phraseIndex*10)-Math.min(99,text.length);
  const fuzzy=fuzzySearchFieldScore(text,needle);
  return fuzzy>0?10000+fuzzy:0;
}

function searchableFilterOptionRecordsFinal(select){
  return [...select.options].map((option,index)=>{
    const value=String(option.value||''),label=String(option.textContent||'').trim();
    const prompt=/^__add_/.test(value)||/^Välj fler/i.test(label);
    const utility=!prompt&&(value===''||value==='__clear_filter__');
    return {value,label,plainLabel:searchableFilterPlainLabelFinal(label),disabled:!!option.disabled,selected:option.dataset.filterSelected==='1',prompt,utility,index};
  }).filter(record=>!record.prompt);
}

function searchableFilterVisibleRecordsFinal(state){
  const query=fuzzySearchNormalize(state.input.value),records=searchableFilterOptionRecordsFinal(state.select);
  if(!query)return records.map(record=>({...record,score:1}));
  return records.map(record=>({...record,score:record.utility?0:searchableFilterScoreFinal(record.plainLabel,query)}))
    .filter(record=>record.score>0)
    .sort((a,b)=>b.score-a.score||a.plainLabel.localeCompare(b.plainLabel,'sv',{numeric:true,sensitivity:'base'})||a.index-b.index);
}

function searchableFilterChooseFinal(state,record){
  if(record.disabled)return;
  state.select.value=record.value;
  state.select.dispatchEvent(new Event('change',{bubbles:true}));
  searchableFilterCloseFinal(state,{restoreFocus:true});
}

function searchableFilterRenderFinal(state){
  const records=searchableFilterVisibleRecordsFinal(state),fragment=document.createDocumentFragment();
  state.list.replaceChildren();
  records.forEach(record=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='searchable-filter-option';
    button.dataset.value=record.value;
    if(record.utility)button.classList.add('is-utility');
    if(record.selected)button.classList.add('is-selected');
    button.textContent=record.label;
    button.disabled=record.disabled;
    button.setAttribute('role','option');
    button.setAttribute('aria-selected',record.selected?'true':'false');
    button.addEventListener('click',()=>searchableFilterChooseFinal(state,record));
    fragment.appendChild(button);
  });
  if(!records.length){
    const empty=document.createElement('div');
    empty.className='searchable-filter-empty';
    empty.textContent='Inga rimliga träffar';
    fragment.appendChild(empty);
  }
  state.list.appendChild(fragment);
  state.resultCount.textContent=state.input.value.trim()?`${records.length} träff${records.length===1?'':'ar'}`:'';
}

function searchableFilterSyncFinal(state){
  const selected=state.select.options[state.select.selectedIndex];
  state.triggerText.textContent=selected?.textContent?.trim()||'Alla';
  state.trigger.disabled=state.select.disabled;
  state.wrapper.classList.toggle('is-disabled',state.select.disabled);
  if(!state.panel.hidden)searchableFilterRenderFinal(state);
}

function searchableFilterCloseFinal(state=searchableFilterOpenStateFinal,{restoreFocus=false}={}){
  if(!state)return;
  state.panel.hidden=true;
  state.trigger.setAttribute('aria-expanded','false');
  state.wrapper.classList.remove('is-open');
  state.input.value='';
  state.resultCount.textContent='';
  if(searchableFilterOpenStateFinal===state)searchableFilterOpenStateFinal=null;
  if(restoreFocus)state.trigger.focus({preventScroll:true});
}

function searchableFilterOpenFinal(state,initialQuery=''){
  if(state.trigger.disabled)return;
  if(searchableFilterOpenStateFinal&&searchableFilterOpenStateFinal!==state)searchableFilterCloseFinal(searchableFilterOpenStateFinal);
  searchableFilterOpenStateFinal=state;
  state.panel.hidden=false;
  state.trigger.setAttribute('aria-expanded','true');
  state.wrapper.classList.add('is-open');
  state.input.value=initialQuery;
  searchableFilterRenderFinal(state);
  state.wrapper.classList.remove('align-right','align-above');
  let panelRect=state.panel.getBoundingClientRect(),triggerRect=state.trigger.getBoundingClientRect();
  if(panelRect.right>window.innerWidth-8)state.wrapper.classList.add('align-right');
  if(panelRect.bottom>window.innerHeight-8&&triggerRect.top-panelRect.height>=8)state.wrapper.classList.add('align-above');
  requestAnimationFrame(()=>{
    state.input.focus({preventScroll:true});
    state.input.setSelectionRange(state.input.value.length,state.input.value.length);
  });
}

function searchableFilterMoveOptionFocusFinal(state,direction){
  const options=[...state.list.querySelectorAll('.searchable-filter-option:not(:disabled)')];
  if(!options.length)return;
  const current=options.indexOf(document.activeElement);
  const next=direction==='first'?0:direction==='last'?options.length-1:Math.max(0,Math.min(options.length-1,current+(direction==='previous'?-1:1)));
  options[next].focus({preventScroll:true});
}

function searchableFilterEnhanceFinal(select){
  if(!select||searchableFilterStatesFinal.has(select.id))return;
  const wrapper=document.createElement('div');
  wrapper.className='searchable-filter-select';
  wrapper.dataset.searchableSelectFor=select.id;
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.id=`${select.id}Picker`;
  trigger.className='searchable-filter-trigger';
  trigger.setAttribute('role','combobox');
  trigger.setAttribute('aria-haspopup','listbox');
  trigger.setAttribute('aria-expanded','false');
  trigger.innerHTML='<span class="searchable-filter-trigger-text"></span><span class="searchable-filter-chevron" aria-hidden="true"></span>';
  const panel=document.createElement('div');
  panel.id=`${select.id}PickerPanel`;
  panel.className='searchable-filter-panel';
  panel.hidden=true;
  const searchRow=document.createElement('div');
  searchRow.className='searchable-filter-search-row';
  const input=document.createElement('input');
  input.type='search';
  input.className='searchable-filter-search';
  input.autocomplete='off';
  input.spellcheck=false;
  input.placeholder='Skriv för att filtrera…';
  const fieldLabel=document.querySelector(`label[for="${select.id}"]`)?.textContent?.trim()||'filter';
  input.setAttribute('aria-label',`Sök i ${fieldLabel}`);
  const resultCount=document.createElement('span');
  resultCount.className='searchable-filter-result-count';
  resultCount.setAttribute('aria-live','polite');
  searchRow.append(input,resultCount);
  const list=document.createElement('div');
  list.className='searchable-filter-options';
  list.setAttribute('role','listbox');
  list.setAttribute('aria-label',fieldLabel);
  panel.append(searchRow,list);
  trigger.setAttribute('aria-controls',panel.id);
  wrapper.append(trigger,panel);
  select.insertAdjacentElement('afterend',wrapper);
  select.classList.add('visually-hidden','searchable-filter-native');
  select.tabIndex=-1;
  select.setAttribute('aria-hidden','true');
  const label=document.querySelector(`label[for="${select.id}"]`);
  if(label)label.htmlFor=trigger.id;
  const state={select,wrapper,trigger,triggerText:trigger.querySelector('.searchable-filter-trigger-text'),panel,input,resultCount,list,observer:null};
  searchableFilterStatesFinal.set(select.id,state);
  trigger.addEventListener('click',()=>panel.hidden?searchableFilterOpenFinal(state):searchableFilterCloseFinal(state));
  trigger.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();searchableFilterOpenFinal(state);return;}
    if(event.key==='Escape'&&!panel.hidden){event.preventDefault();searchableFilterCloseFinal(state);return;}
    if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();searchableFilterOpenFinal(state,event.key);}
  });
  input.addEventListener('input',()=>searchableFilterRenderFinal(state));
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();searchableFilterCloseFinal(state,{restoreFocus:true});}
    else if(event.key==='ArrowDown'){event.preventDefault();searchableFilterMoveOptionFocusFinal(state,'first');}
    else if(event.key==='ArrowUp'){event.preventDefault();searchableFilterMoveOptionFocusFinal(state,'last');}
    else if(event.key==='Enter'){
      const first=state.list.querySelector('.searchable-filter-option:not(:disabled)');
      if(first){event.preventDefault();first.click();}
    }
  });
  list.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();searchableFilterCloseFinal(state,{restoreFocus:true});}
    else if(event.key==='ArrowDown'){event.preventDefault();searchableFilterMoveOptionFocusFinal(state,'next');}
    else if(event.key==='ArrowUp'){event.preventDefault();searchableFilterMoveOptionFocusFinal(state,'previous');}
    else if(event.key==='Home'){event.preventDefault();searchableFilterMoveOptionFocusFinal(state,'first');}
    else if(event.key==='End'){event.preventDefault();searchableFilterMoveOptionFocusFinal(state,'last');}
  });
  select.addEventListener('change',()=>queueMicrotask(()=>searchableFilterSyncFinal(state)));
  state.observer=new MutationObserver(()=>queueMicrotask(()=>searchableFilterSyncFinal(state)));
  state.observer.observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected','value','data-filter-selected']});
  searchableFilterSyncFinal(state);
}

searchableFilterSelectIdsFinal.forEach(id=>searchableFilterEnhanceFinal($(id)));
document.addEventListener('pointerdown',event=>{
  if(searchableFilterOpenStateFinal&&!event.target.closest('.searchable-filter-select'))searchableFilterCloseFinal(searchableFilterOpenStateFinal);
});
window.addEventListener('resize',()=>searchableFilterCloseFinal(searchableFilterOpenStateFinal),{passive:true});
