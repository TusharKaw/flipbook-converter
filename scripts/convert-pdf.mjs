import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';

const input = process.argv[2];
if (!input) throw new Error('Usage: npm run convert -- "/absolute/path/to/book.pdf"');
const source = resolve(input);
const info = execFileSync('pdfinfo', [source], { encoding: 'utf8' });
const pages = Number(info.match(/Pages:\s+(\d+)/)?.[1]);
if (!pages) throw new Error('Could not read page count. Install Poppler (brew install poppler).');
const output = resolve('public/book');
const temporary = resolve('tmp/convert');
await mkdir(output, { recursive: true });
await mkdir(temporary, { recursive: true });
let next = 1;
let completed = 0;
async function convert() {
  while (next <= pages) {
    const page = next++;
    const name = String(page).padStart(3, '0');
    const prefix = join(temporary, name);
    await new Promise((done, fail) => {
      const child = spawn('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-scale-to', '2000', '-png', source, prefix], { stdio: ['ignore', 'ignore', 'pipe'] });
      let error = '';
      child.stderr.on('data', value => { error += value; });
      child.on('error', fail);
      child.on('exit', code => code === 0 ? done() : fail(new Error(error)));
    });
    const image = await readFile(prefix + '.png');
    await sharp(image).webp({ quality: 82 }).toFile(join(output, `${name}.webp`));
    await rm(prefix + '.png');
    completed++;
    if (completed % 20 === 0 || completed === pages) console.log(`Converted ${completed}/${pages} pages`);
  }
}
await Promise.all(Array.from({ length: 4 }, convert));
await writeFile(join(output, 'manifest.json'), JSON.stringify({ title: 'Vidhan Chetna', issue: 'No. 3 · August–October 2026', subtitle: 'Veer Vithalbhai Patel Smarnanjali Ank', pages, width: 477, height: 702 }, null, 2));
console.log('Flipbook assets ready in public/book');
