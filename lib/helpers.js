// Small helper functions used by the page. Kept separate so page.js stays readable.

// Shrink the image in the browser (max 1200px wide, JPEG 0.7) so the request stays small.
// "src" can be a blob URL (uploaded photo) or a path like /samples/bank.svg.
export function compressImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1200 / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; // white background (needed for SVG samples)
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      resolve({ imageBase64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

// Limits for the photo quality check. Change these numbers if the check is too strict or too loose.
const DARK_LIMIT = 60;       // average brightness (0 = black, 255 = white) below this means "too dark"
const BLUR_LIMIT = 150;      // sharpness of the sharpest text areas below this means "too blurry"
const GRID = 10;             // the photo is split into GRID x GRID small blocks
const TEXT_CONTRAST = 12;    // a block counts as "has text" if its pixel spread is above this
const MIN_TEXT_BLOCKS = 3;   // if fewer blocks have text, we cannot judge blur, so we skip it

// Checks an uploaded photo in the browser BEFORE sending it to the server.
// Returns { issue: "dark" | "blur" | null, brightness, sharpness }.
// Idea: in a sharp photo, the blocks that contain text have strong edges.
// Empty white paper blocks are ignored, so a clean document is not called blurry by mistake.
export function checkPhotoQuality(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Work on a small copy (max 500px wide) so the check is fast even on cheap phones.
      const scale = Math.min(1, 500 / img.naturalWidth);
      const w = Math.max(GRID * 4, Math.round(img.naturalWidth * scale));
      const h = Math.max(GRID * 4, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);

      // Step 1: convert every pixel to grayscale and find the average brightness.
      const gray = new Float32Array(w * h);
      let sum = 0;
      for (let i = 0; i < w * h; i++) {
        const g = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
        gray[i] = g;
        sum += g;
      }
      const brightness = sum / (w * h);

      // Step 2: look at each block. For blocks with text, measure edge strength
      // (variance of the Laplacian, a standard sharpness measure).
      const bw = Math.floor(w / GRID);
      const bh = Math.floor(h / GRID);
      const scores = [];
      for (let by = 0; by < GRID; by++) {
        for (let bx = 0; bx < GRID; bx++) {
          const x0 = bx * bw;
          const y0 = by * bh;

          // How much do the pixels in this block differ? Low spread = empty paper, skip it.
          let bSum = 0;
          let bSq = 0;
          for (let y = y0; y < y0 + bh; y++) {
            for (let x = x0; x < x0 + bw; x++) {
              const g = gray[y * w + x];
              bSum += g;
              bSq += g * g;
            }
          }
          const n = bw * bh;
          const bMean = bSum / n;
          const spread = Math.sqrt(Math.max(0, bSq / n - bMean * bMean));
          if (spread < TEXT_CONTRAST) continue;

          // Edge strength inside this block (skip the 1-pixel border).
          let lapSum = 0;
          let lapSq = 0;
          let cnt = 0;
          for (let y = y0 + 1; y < y0 + bh - 1; y++) {
            for (let x = x0 + 1; x < x0 + bw - 1; x++) {
              const i = y * w + x;
              const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
              lapSum += lap;
              lapSq += lap * lap;
              cnt++;
            }
          }
          const lapMean = lapSum / cnt;
          scores.push(lapSq / cnt - lapMean * lapMean);
        }
      }

      // Step 3: take the sharpest 10% of the text blocks (90th percentile) as the photo's score.
      let sharpness = null;
      if (scores.length >= MIN_TEXT_BLOCKS) {
        scores.sort((a, b) => a - b);
        sharpness = scores[Math.floor(0.9 * (scores.length - 1))];
      }

      let issue = null;
      if (brightness < DARK_LIMIT) issue = "dark";
      else if (sharpness !== null && sharpness < BLUR_LIMIT) issue = "blur";

      // Numbers are printed in the browser console so you can tune the limits above.
      console.log("Photo quality:", {
        brightness: Math.round(brightness),
        sharpness: sharpness === null ? "not enough text" : Math.round(sharpness),
        textBlocks: scores.length,
        issue,
      });
      resolve({ issue, brightness, sharpness });
    };
    // If the image cannot be read, do not block the user: just skip the check.
    img.onerror = () => resolve({ issue: null, brightness: 0, sharpness: 0 });
    img.src = src;
  });
}

// Text we read aloud: only the summary + action steps (short and useful).
export function buildSpeechText(r) {
  return [r.one_line_summary, ...(r.what_you_must_do || []).map((s, i) => `${i + 1}. ${s}`)].join(". ");
}

// Marathi summary for WhatsApp. wa.me opens WhatsApp with this text pre-filled.
export function buildShareUrl(r) {
  const lines = [`*${r.document_type}*`, r.one_line_summary];
  if (r.what_you_must_do?.length) lines.push("", "*काय करायचे:*", ...r.what_you_must_do.map((s, i) => `${i + 1}. ${s}`));
  if (r.important_dates?.length) lines.push("", "*तारखा:*", ...r.important_dates.map((d) => `${d.label}: ${d.date}`));
  if (r.red_flags?.length) lines.push("", "*सावधान:*", ...r.red_flags.map((s) => `⚠️ ${s}`));
  lines.push("", "via KagadMitra");
  return "https://wa.me/?text=" + encodeURIComponent(lines.join("\n"));
}

// Pick a voice: Marathi first, then Hindi, then any voice. Returns null if the phone has none.
export function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const find = (prefix) => voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(prefix));
  return find("mr") || find("hi") || voices[0];
}