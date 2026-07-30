import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'src');
const destination = resolve(root, 'dist');

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
await writeFile(resolve(destination, '.nojekyll'), '');
await writeFile(resolve(destination, 'build-info.json'), JSON.stringify({
  name: 'line-differential-relay-lab',
  version: '0.1.0',
  builtAt: new Date().toISOString(),
  license: 'GPL-3.0-only'
}, null, 2));

console.log(`Built static site: ${destination}`);
