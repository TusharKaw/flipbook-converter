import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// Extract locally: no reader has to download OCR software or upload the book.
const manifest = JSON.parse(await readFile('public/book/manifest.json', 'utf8'));
await mkdir('tmp/narration', { recursive: true });
let next = 1;
let completed = 0;
const pages = new Array(manifest.pages);
async function worker() {
  while (next <= manifest.pages) {
    const page = next++;
    const name = String(page).padStart(3, '0');
    const image = `tmp/narration/${name}.png`;
    await sharp(`public/book/${name}.webp`).png().toFile(image);
    const text = await new Promise((resolve, reject) => {
      const child = spawn('tesseract', [image, 'stdout', '-l', 'hin+eng', '--psm', '3'], {
        env: { ...process.env, OMP_THREAD_LIMIT: '1' },
      });
      let output = '', error = '';
      child.stdout.on('data', data => { output += data; });
      child.stderr.on('data', data => { error += data; });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve(output) : reject(new Error(error)));
    });
    pages[page - 1] = text.normalize('NFC').replace(/\u00ad/g, '')
      .replace(/([A-Za-z])-\n(?=[a-z])/g, '$1').replace(/\s+/g, ' ').trim();
    completed++;
    if (completed % 20 === 0 || completed === manifest.pages) console.log(`Extracted ${completed}/${manifest.pages} pages`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
await writeFile('public/book/narration.json', JSON.stringify({ source: 'OCR (Hindi and English)', pages }));
console.log('Narration text ready. Review OCR text when making editorial corrections.');
