// Reads the text in screenshots on the phone itself (free, nothing is uploaded anywhere).
// The reading engine (~4 MB) downloads the first time it's used, then works offline.
let workerP = null;
let progressFn = null;

async function getWorker() {
  if (!workerP) {
    const { createWorker } = await import('tesseract.js');
    const base = new URL('./ocr/', document.baseURI).href;
    workerP = createWorker('eng', 1, {
      workerPath: base + 'worker.min.js',
      corePath: base,
      langPath: base + 'lang',
      gzip: true,
      logger: (m) => progressFn && progressFn(m)
    }).catch((e) => { workerP = null; throw e; });
  }
  return workerP;
}

// A second, inverted high-contrast copy helps with white text on photos (airline and train apps).
async function contrastCopy(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const g = 255 - (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]); gray[j] = g; hist[g | 0]++; }
  let lo = 0, hi = 255, acc = 0; const cut = gray.length * 0.02;
  for (; lo < 255 && (acc += hist[lo]) < cut; lo++);
  acc = 0; for (; hi > 0 && (acc += hist[hi]) < cut; hi--);
  const k = 255 / Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = (gray[j] - lo) * k; d[i] = d[i + 1] = d[i + 2] = v; }
  ctx.putImageData(img, 0, 0);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

export async function readImages(files, onProgress) {
  progressFn = onProgress;
  const w = await getWorker();
  let text = '';
  for (let i = 0; i < files.length; i++) {
    onProgress && onProgress({ status: `Reading screenshot ${i + 1} of ${files.length}`, progress: i / files.length });
    const { data } = await w.recognize(files[i]);
    text += data.text + '\n';
    try {
      const inv = await contrastCopy(files[i]);
      if (inv) {
        await w.setParameters({ tessedit_pageseg_mode: '11' }); // sparse text: finds big, isolated words like airport codes
        const r2 = await w.recognize(inv);
        text += r2.data.text + '\n';
      }
    } catch (e) { /* first pass is enough */ }
    finally { try { await w.setParameters({ tessedit_pageseg_mode: '6' }); } catch (e) {} }
  }
  progressFn = null;
  try { if (localStorage.getItem('trippinDebug')) console.info('OCR TEXT\n' + text); } catch (e) {}
  return text;
}
