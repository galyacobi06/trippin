import { createWorker } from 'tesseract.js';
const w = await createWorker('eng', 1, { langPath: '/home/claude/trippin/node_modules/@tesseract.js-data/eng/4.0.0_best_int', gzip: true, cachePath: '/tmp/tess' });
const { data } = await w.recognize(process.argv[2]);
console.log(data.text);
await w.terminate();
