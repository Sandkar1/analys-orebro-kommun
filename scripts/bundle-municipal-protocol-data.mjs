import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDirectory=path.join(root,'data');
const outputPath=path.join(dataDirectory,'municipal-protocol-data-orebro-v2.js');
const maximumBundleBytes=95_000_000;
const legacyPattern=/^municipal-protocol-data-orebro-v2\.part\d+\.js$/;
const legacyFiles=fs.readdirSync(dataDirectory).filter(file=>legacyPattern.test(file)).sort((left,right)=>left.localeCompare(right,'en',{numeric:true}));
const inputs=legacyFiles.length?legacyFiles:['municipal-protocol-data-orebro-v2.js'];
const context={window:{}};
vm.createContext(context);
for(const file of inputs)vm.runInContext(fs.readFileSync(path.join(dataDirectory,file),'utf8'),context,{filename:file});
const parts=context.window.municipalProtocolPackParts||{};
const orderedParts=Object.keys(parts).map(Number).filter(Number.isFinite).sort((a,b)=>a-b).map(key=>parts[key]);
if(!orderedParts.length)throw Error('No municipal protocol data parts were found.');
const first=orderedParts[0];
const combined={
  ...first,
  d:orderedParts.flatMap(part=>part.d||[]),
  r:orderedParts.flatMap(part=>part.r||[]),
  pr:orderedParts.flatMap(part=>part.pr||[]),
  mr:orderedParts.flatMap(part=>part.mr||[])
};
const output=`window.municipalProtocolPackParts=window.municipalProtocolPackParts||{};window.municipalProtocolPackParts[1]=${JSON.stringify(combined)};\n`;
const bytes=Buffer.byteLength(output);
if(bytes>maximumBundleBytes)throw Error(`Municipal protocol bundle is ${(bytes/1_000_000).toFixed(2)} MB; the configured GitHub-safe limit is 95 MB.`);
fs.writeFileSync(outputPath,output);
console.log(JSON.stringify({output:path.relative(root,outputPath),inputs,bytes,megabytes:Number((bytes/1_000_000).toFixed(3)),maximumMegabytes:95,documents:combined.d.length,voteValues:combined.r.length,positionValues:combined.pr.length,attendanceValues:combined.mr.length}));
