import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const requests = process.argv.slice(2);
const cache = path.join(os.tmpdir(), 'orebro-protocol-source-audit-v1');
for (const request of requests) {
  const [url, pageSpec = '1'] = request.split('|');
  const name = createHash('sha256').update(url).digest('hex');
  const textFile = path.join(cache, `${name}.txt`);
  console.log(`\n===== ${url} =====`);
  if (!fs.existsSync(textFile)) {
    console.log('No cached text.');
    continue;
  }
  const pages = fs.readFileSync(textFile, 'utf8').split('\f');
  const match = pageSpec.match(/^(\d+)(?:-(\d+))?$/);
  const from = Math.max(1, Number(match?.[1]) || 1), to = Math.max(from, Number(match?.[2]) || from);
  for (let page = from; page <= Math.min(to, pages.length); page++) {
    console.log(`\n--- Page ${page} ---`);
    console.log((pages[page - 1] || '').split(/\r?\n/).slice(0, 200).join('\n'));
  }
}
