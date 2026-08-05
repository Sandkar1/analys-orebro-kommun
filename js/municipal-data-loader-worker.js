async function municipalWorkerReadText(source,completedBytes,expectedBytes,totalBytes){
  const response=await fetch(source);
  if(!response.ok)throw Error(`Kommundatan kunde inte hämtas (${response.status}).`);
  const reader=response.body?.getReader?.();
  if(!reader){
    const text=await response.text(),loaded=expectedBytes||new TextEncoder().encode(text).byteLength;
    self.postMessage({type:'load-progress',loadedBytes:completedBytes+loaded,totalBytes});
    return {text,loaded};
  }
  const decoder=new TextDecoder(),chunks=[];
  let loaded=0,lastReported=0;
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    loaded+=value.byteLength;
    chunks.push(decoder.decode(value,{stream:true}));
    if(loaded-lastReported>=262144){
      lastReported=loaded;
      self.postMessage({type:'load-progress',loadedBytes:completedBytes+loaded,totalBytes});
    }
  }
  chunks.push(decoder.decode());
  self.postMessage({type:'load-progress',loadedBytes:completedBytes+(expectedBytes||loaded),totalBytes});
  return {text:chunks.join(''),loaded};
}

self.onmessage=async event=>{
  try{
    if(event.data?.mode==='historic'){
      let packed=event.data.packed;
      if(typeof packed==='string'){
        const encoded=packed.startsWith('gz:')?packed.slice(3):packed,bytes=Uint8Array.from(atob(encoded.replace(/\s+/g,'')),character=>character.charCodeAt(0));
        const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        packed=JSON.parse(new TextDecoder().decode(await new Response(stream).arrayBuffer()));
      }
      const columns=packed.c||packed.columns||[],rows=packed.r||packed.rows||[],stringColumns=new Set(packed.sc||[]),strings=packed.s||[];
      const searchConfig=event.data.search||{},hiddenColumns=new Set(searchConfig.hiddenColumns||[]),searchColumns=columns.filter(column=>!hiddenColumns.has(column));
      const electionLabels=searchConfig.electionLabels||{},regionAliases=searchConfig.regionAliases||{};
      const display=(column,value)=>{
        const text=value===null||value===undefined?'':String(value);
        if(column==='election_type')return electionLabels[text]||text;
        if(column==='county_name'){
          const normalized=text.trim().replace(/\s+län$/i,'');
          return regionAliases[normalized]||normalized;
        }
        return text;
      };
      self.postMessage({type:'historic-meta',columns,total:rows.length});
      for(let start=0;start<rows.length;start+=80){
        const chunk=rows.slice(start,start+80).map(source=>{
          let row;
          if(Array.isArray(source)){
            row={};
            for(let index=0;index<columns.length;index++){const value=source[index];row[columns[index]]=stringColumns.has(index)&&value!==null?strings[value]:value;}
          }else row=source;
          row.__searchText=searchColumns.map(column=>display(column,row[column])).join(' ');
          return row;
        });
        self.postMessage({type:'historic-chunk',start,value:chunk});
      }
      self.postMessage({type:'historic-complete'});
      return;
    }
    const sources=event.data?.sources||[],sourceSizes=event.data?.sourceSizes||[];
    const totalBytes=sourceSizes.reduce((sum,size)=>sum+(Math.max(0,Number(size))||0),0);
    let completedBytes=0;
    for(let partIndex=0;partIndex<sources.length;partIndex++){
      const source=sources[partIndex],expectedBytes=Math.max(0,Number(sourceSizes[partIndex]))||0;
      const loaded=await municipalWorkerReadText(source,completedBytes,expectedBytes,totalBytes);
      const text=loaded.text;
      const marker=`window.municipalProtocolPackParts[${partIndex+1}]=`,markerIndex=text.indexOf(marker);
      if(markerIndex<0)throw Error(`Ogiltigt kommunalt datapaket: del ${partIndex+1}`);
      let json=text.slice(markerIndex+marker.length).trim();
      if(json.endsWith(';'))json=json.slice(0,-1);
      const pack=JSON.parse(json),scalars={};
      for(const [key,value] of Object.entries(pack))if(!Array.isArray(value))scalars[key]=value;
      self.postMessage({type:'meta',part:partIndex+1,value:scalars});
      for(const [key,value] of Object.entries(pack)){
        if(!Array.isArray(value))continue;
        const chunkSize=['r','pr','mr'].includes(key)?6000:8;
        for(let start=0;start<value.length;start+=chunkSize){
          self.postMessage({type:'chunk',part:partIndex+1,key,value:value.slice(start,start+chunkSize)});
        }
      }
      self.postMessage({type:'part-complete',part:partIndex+1});
      completedBytes+=expectedBytes||loaded.loaded;
    }
    self.postMessage({type:'complete'});
  }catch(error){
    self.postMessage({type:'error',message:error?.message||String(error)});
  }
};
