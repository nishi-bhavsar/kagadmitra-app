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
