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

export async function readImages(files, onProgress) {
  progressFn = onProgress;
  const w = await getWorker();
  let text = '';
  for (let i = 0; i < files.length; i++) {
    onProgress && onProgress({ status: `Reading screenshot ${i + 1} of ${files.length}`, progress: i / files.length });
    const { data } = await w.recognize(files[i]);
    text += data.text + '\n';
  }
  progressFn = null;
  return text;
}
