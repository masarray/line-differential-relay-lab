import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'src');
const destination = resolve(root, 'dist');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });

const pageUrl = 'https://masarray.github.io/line-differential-relay-lab/';
const previewSourcePath = resolve(root, 'docs/assets/simulator-preview.png');
const previewBytes = await readFile(previewSourcePath);
const previewHash = createHash('sha256').update(previewBytes).digest('hex').slice(0, 12);
const previewFileName = `social-preview-${previewHash}.png`;
const previewUrl = `${pageUrl}${previewFileName}`;
const previewTitle = 'Can 87L Trip Without a Power-System Fault?';
const previewDescription = 'Explore how communication jitter, one-way delay asymmetry, packet disorder, and unstable recovery can misalign local and remote waveforms and create false differential current.';
const previewAlt = '87L line differential simulator showing communication-induced waveform behavior and protection supervision';
const indexPath = resolve(destination, 'index.html');
let indexHtml = await readFile(indexPath, 'utf8');
indexHtml = indexHtml
  .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${previewDescription}">`)
  .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${previewTitle}">`)
  .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${previewDescription}">`)
  .replace(
    '<meta property="og:type" content="website">',
    [
      '<meta property="og:type" content="website">',
      '<meta property="og:locale" content="en_US">',
      '<meta property="og:site_name" content="87L Algorithm Laboratory">',
      `<meta property="og:url" content="${pageUrl}">`,
      `<meta property="og:image" content="${previewUrl}">`,
      `<meta property="og:image:secure_url" content="${previewUrl}">`,
      '<meta property="og:image:type" content="image/png">',
      '<meta property="og:image:width" content="1366">',
      '<meta property="og:image:height" content="768">',
      `<meta property="og:image:alt" content="${previewAlt}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${previewTitle}">`,
      `<meta name="twitter:description" content="${previewDescription}">`,
      `<meta name="twitter:image" content="${previewUrl}">`,
      `<meta name="twitter:image:alt" content="${previewAlt}">`
    ].join('')
  );
await writeFile(indexPath, indexHtml);

await writeFile(resolve(destination, previewFileName), previewBytes);

await writeFile(resolve(destination, '.nojekyll'), '');
await writeFile(resolve(destination, 'build-info.json'), JSON.stringify({
  name: packageJson.name,
  version: packageJson.version,
  builtAt: new Date().toISOString(),
  license: packageJson.license,
  socialPreview: previewFileName
}, null, 2));

console.log(`Built static site: ${destination}`);
