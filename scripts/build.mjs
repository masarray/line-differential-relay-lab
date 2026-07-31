import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'src');
const destination = resolve(root, 'dist');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
await writeFile(resolve(destination, '.nojekyll'), '');
await writeFile(resolve(destination, 'build-info.json'), JSON.stringify({
  name: packageJson.name,
  version: packageJson.version,
  builtAt: new Date().toISOString(),
  license: packageJson.license
}, null, 2));

console.log(`Built static site: ${destination}`);
