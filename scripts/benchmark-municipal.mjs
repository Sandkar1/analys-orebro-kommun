import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fileUrlMode = process.argv.includes('--file-url');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg']
]);

function serveFile(req, res) {
  const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  import('node:fs').then(({ createReadStream, stat }) => {
    stat(file, (error, info) => {
      if (error || !info.isFile()) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, {
        'content-type': mime.get(path.extname(file).toLowerCase()) || 'application/octet-stream',
        'content-length': info.size,
        'cache-control': 'public, max-age=3600'
      });
      createReadStream(file).pipe(res);
    });
  });
}

function connectCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let id = 0;
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  };
  return new Promise((resolve, reject) => {
    socket.onerror = () => reject(new Error('Could not connect to Chrome DevTools.'));
    socket.onopen = () => resolve({
      close: () => socket.close(),
      send(method, params = {}) {
        return new Promise((requestResolve, requestReject) => {
          const requestId = ++id;
          pending.set(requestId, { resolve: requestResolve, reject: requestReject });
          socket.send(JSON.stringify({ id: requestId, method, params }));
        });
      }
    });
  });
}

async function waitForPage(debugPort) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const pages = await fetch(`http://127.0.0.1:${debugPort}/json`);
      if (pages.ok) {
        const page = (await pages.json()).find(item => item.type === 'page');
        if (page?.webSocketDebuggerUrl) return page;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Chrome did not expose a debuggable page.');
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

const server = http.createServer(serveFile);
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const sitePort = server.address().port;
const debugPort = await new Promise((resolve, reject) => {
  const probe = http.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const port = probe.address().port;
    probe.close(error => error ? reject(error) : resolve(port));
  });
});
const profile = await mkdtemp(path.join(os.tmpdir(), 'municipal-benchmark-'));
const pageUrl = fileUrlMode ? pathToFileURL(path.join(root, 'index.html')).href : `http://127.0.0.1:${sitePort}/`;
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${debugPort}`,
  pageUrl
], { stdio: 'ignore', windowsHide: true });

let cdp;
try {
  const page = await waitForPage(debugPort);
  cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await evaluate(cdp, 'document.readyState === "complete" && typeof setTopView === "function"')) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const result = await evaluate(cdp, `(async()=>{
    const twicePainted=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const start=performance.now();
    await setTopView('decision');
    await twicePainted();
    const initialLoadMs=performance.now()-start;
    const tracked=[
      'ensureDecisionData','buildDecisionFilters','filteredDecisionRows','filteredDecisionPointRows',
      'decisionProposalRowByKeyAnyFinal','decisionDetailPayload','decisionDetailRows',
      'decisionHydrateTextFieldsFinal','decisionTextWithReferenceLinksActive',
      'decisionReferenceResolveFinal','renderDecisionDetailView','renderDecisionView'
    ];
    const stats={};
    for(const name of tracked){
      const original=window[name];
      if(typeof original!=='function')continue;
      window[name]=function(...args){
        const before=performance.now();
        try{return original.apply(this,args);}
        finally{
          const entry=stats[name]||(stats[name]={calls:0,totalMs:0,maxMs:0});
          const elapsed=performance.now()-before;
          entry.calls++;
          entry.totalMs+=elapsed;
          entry.maxMs=Math.max(entry.maxMs,elapsed);
        }
      };
    }
    const rows=[...document.querySelectorAll('#decisionBody tr.decision-selectable-row')];
    const indexes=[0,Math.floor(rows.length/3),Math.floor(rows.length*2/3),rows.length-1]
      .filter((value,index,list)=>value>=0&&list.indexOf(value)===index);
    const clicks=[];
    for(const index of indexes){
      decisionActiveTab=0;
      renderDecisionView();
      await twicePainted();
      for(const key of Object.keys(stats))delete stats[key];
      const row=document.querySelectorAll('#decisionBody tr.decision-selectable-row')[index];
      const before=performance.now();
      row.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
      await twicePainted();
      clicks.push({index,elapsedMs:performance.now()-before,stats:structuredClone(stats)});
    }
    let linkNavigation={found:false,navigated:false};
    for(const sourceRow of decisionAllPointRows){
      if(sourceRow.isMeeting)continue;
      decisionHydrateTextFieldsFinal(sourceRow);
      const values=[sourceRow.abstractText,sourceRow.description,sourceRow.yrkandeText,sourceRow.propositionText,sourceRow.fullDecisionText];
      if(!values.some(value=>decisionTextWithReferenceLinksActive(value,sourceRow).includes('decision-text-ref')))continue;
      openDecisionDetail(sourceRow.id,decisionProposalKey(sourceRow));
      await twicePainted();
      const button=document.querySelector('#decisionDetailGroups .decision-text-ref');
      if(!button)continue;
      const targetId=button.dataset.id,targetProposalKey=button.dataset.proposalKey;
      button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
      await twicePainted();
      const active=decisionTabs[decisionActiveTab];
      linkNavigation={
        found:true,
        sourceId:sourceRow.id,
        targetId,
        targetProposalKey,
        navigated:active?.id===targetId&&active?.proposalKey===targetProposalKey
      };
      break;
    }
    const voteRegressionId='case_body_kommunfullmaktige_2024_03_20_66';
    const voteRegressionRow=decisionAllPointRows.find(row=>row.id===voteRegressionId&&String(row.point)==='66');
    let voteRegression={found:false,noNamed:0,noMeaning:'',sections:[]};
    if(voteRegressionRow){
      decisionFilterLocks.decisionVote=['Ja'];
      openDecisionDetail(voteRegressionRow.id,decisionProposalKey(voteRegressionRow));
      await twicePainted();
      const sections=[...document.querySelectorAll('#decisionDetailGroups .decision-vote-type')];
      const noSection=sections.find(section=>/^Nej\\b/.test(section.querySelector('h4')?.textContent||''));
      const noMeaning=[...document.querySelectorAll('#decisionDetailGroups .decision-vote-meaning-detail p')]
        .find(paragraph=>/^Nej:/i.test(paragraph.textContent.trim()))?.textContent.replace(/^Nej:\s*/i,'').trim()||'';
      voteRegression={
        found:true,
        noNamed:noSection?.querySelectorAll('li').length||0,
        noMeaning,
        sections:sections.map(section=>({heading:section.querySelector('h4')?.textContent.trim()||'',named:section.querySelectorAll('li').length}))
      };
      decisionFilterLocks.decisionVote=[];
    }
    return {
      initialLoadMs,
      counts:{
        documents:decisionPack?.d?.length||0,
        pointRows:decisionAllPointRows.length,
        voteRows:decisionRows.length,
        positionRows:decisionPositionRows?.length||0,
        memberRows:decisionMemberRows?.length||0,
        visibleRows:rows.length
      },
      clicks,
      linkNavigation,
      voteRegression
    };
  })()`);
  console.log(JSON.stringify(result, null, 2));
  const slowestClick = Math.max(0, ...result.clicks.map(click => click.elapsedMs));
  const voteRegressionSections=result.voteRegression?.sections||[];
  const voteRegressionOk=result.voteRegression?.found&&result.voteRegression.noNamed===16&&voteRegressionSections.some(section=>section.heading==='Frånvarande 1'&&section.named===1)&&result.voteRegression.noMeaning==='bifall till Markus Allards (ÖrP) m.fl. yrkande om bifall till motionen';
  const clickThresholdMs=fileUrlMode?300:150;
  if (slowestClick > clickThresholdMs || !result.linkNavigation.found || !result.linkNavigation.navigated || !voteRegressionOk) {
    throw new Error(`Municipal interaction benchmark failed (slowest click ${slowestClick.toFixed(1)} ms).`);
  }
} finally {
  try { await cdp?.send('Browser.close'); } catch {}
  if (chrome.exitCode === null) {
    await Promise.race([once(chrome, 'exit'), new Promise(resolve => setTimeout(resolve, 3000))]);
  }
  if (chrome.exitCode === null) {
    chrome.kill();
    await Promise.race([once(chrome, 'exit'), new Promise(resolve => setTimeout(resolve, 2000))]);
  }
  cdp?.close();
  server.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
