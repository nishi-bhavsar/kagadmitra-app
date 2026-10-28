"use client";
// Main screen. One client component: pick photo -> quality check -> compress -> /api/explain -> show cards.
import { useState, useRef, useEffect } from "react";
import { compressImage, checkPhotoQuality, buildSpeechText, buildShareUrl, pickVoice } from "../lib/helpers";

const SAMPLES = [
  { id: "scheme", label: "योजना सूचना", src: "/samples/scheme.svg" },
  { id: "soil", label: "मृदा आरोग्य पत्रिका", src: "/samples/soil.svg" },
  { id: "bank", label: "बँक कर्ज स्मरणपत्र", src: "/samples/bank.svg" },
];
const LANGS = [{ v: "mr", t: "मराठी" }, { v: "hi", t: "हिन्दी" }, { v: "en", t: "English" }];
const CONF = {
  High: { cls: "bg-leaf text-white", text: "खात्री: जास्त" },
  Medium: { cls: "bg-orange-500 text-white", text: "खात्री: मध्यम" },
  Low: { cls: "bg-red-600 text-white", text: "खात्री: कमी" },
};
// Marathi messages shown when the photo quality check finds a problem.
const QUALITY_MSG = {
  dark: "फोटो खूप अंधारी आहे. जास्त प्रकाशात पुन्हा काढा.",
  blur: "फोटो धूसर (blur) आहे. कॅमेरा स्थिर धरून पुन्हा काढा.",
};

// A reusable result card: coloured left border + icon + Marathi title.
function Card({ icon, title, tone = "border-leaf", bg = "bg-white", children }) {
  return (
    <section className={`${bg} border-l-8 ${tone} rounded-xl p-4 shadow-sm`}>
      <h2 className="text-xl font-bold mb-2"><span aria-hidden="true">{icon}</span> {title}</h2>
      {children}
    </section>
  );
}

export default function Home() {
  const [language, setLanguage] = useState("mr");
  const [preview, setPreview] = useState(null);      // image URL shown to the user
  const [source, setSource] = useState(null);        // { src, sampleId } what we will compress and send
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [demoFallback, setDemoFallback] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState("");
  const [qualityIssue, setQualityIssue] = useState(null); // "dark" | "blur" | null
  const fileRef = useRef(null);
  const latestUrl = useRef(null); // remembers the newest photo so an old check cannot overwrite it

  // Voices load late on some phones; touching getVoices() early helps.
  useEffect(() => { window.speechSynthesis?.getVoices(); return () => window.speechSynthesis?.cancel(); }, []);

  function resetOutput() { setResult(null); setError(""); setDemoFallback(false); stopSpeaking(); }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // lets the user pick the same file again after retaking
    const url = URL.createObjectURL(file);
    latestUrl.current = url;
    resetOutput(); setQualityIssue(null); setPreview(url); setSource({ src: url, sampleId: null });
    // Check the photo in the browser. Nothing is sent to the server here.
    const q = await checkPhotoQuality(url);
    if (latestUrl.current === url) setQualityIssue(q.issue);
  }
  function onSample(s) {
    latestUrl.current = s.src;
    resetOutput(); setQualityIssue(null); setPreview(s.src); setSource({ src: s.src, sampleId: s.id });
  }

  async function explain() {
    if (!source) return;
    resetOutput(); setQualityIssue(null); setLoading(true);
    try {
      const img = await compressImage(source.src);
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...img, language, sampleId: source.sampleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      setResult(data.result);
      setDemoFallback(!!data.demoFallback);
    } catch (err) {
      setError(err.message && err.message !== "error" ? err.message : "माफ करा, काहीतरी चुकले. पुन्हा प्रयत्न करा.");
    } finally {
      setLoading(false);
    }
  }

  function speak() {
    if (!result || !("speechSynthesis" in window)) { setVoiceMsg("या फोनवर आवाज उपलब्ध नाही"); return; }
    const voice = pickVoice();
    if (!voice) { setVoiceMsg("या फोनवर मराठी आवाज उपलब्ध नाही"); return; }
    setVoiceMsg("");
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(buildSpeechText(result));
    u.voice = voice; u.lang = voice.lang; u.rate = 0.9; // slightly slow for clarity
    u.onend = u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }
  function stopSpeaking() { window.speechSynthesis?.cancel(); setSpeaking(false); }

  const conf = result ? CONF[result.confidence] || CONF.Low : null;

  // The model keeps every list empty when the paper is not a farm / government / bank document.
  // In that case the photo is fine, so we must NOT tell the farmer "photo is blurry".
  const notFarmDoc = result
    ? !result.what_you_must_do.length && !result.documents_needed.length &&
      !result.important_dates.length && !result.red_flags.length
    : false;
  const isLow = result ? (CONF[result.confidence] ? result.confidence === "Low" : true) : false;

  return (
    <main className="max-w-xl mx-auto pb-10">
      {/* Header */}
      <header className="bg-saffron px-4 py-5 text-center">
        <h1 className="text-3xl font-bold text-black">कागदमित्र</h1>
        <p className="text-black/80 font-semibold">कोणताही कागद, सोप्या मराठीत</p>
      </header>

      <div className="px-4 mt-4 space-y-4">
        {/* Language */}
        <label className="flex items-center gap-3 text-lg font-semibold">
          भाषा
          <select value={language} onChange={(e) => setLanguage(e.target.value)}
            className="flex-1 border-2 border-leaf rounded-lg p-2 bg-white text-lg">
            {LANGS.map((l) => <option key={l.v} value={l.v}>{l.t}</option>)}
          </select>
        </label>

        {/* Photo picker: capture="environment" opens the back camera on phones */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()}
          className="w-full bg-leaf text-white text-2xl font-bold rounded-xl py-5 shadow">
          📷 फोटो काढा / Upload
        </button>

        {/* Samples */}
        <div>
          <p className="font-semibold mb-2">किंवा नमुना कागद वापरून पहा (Try sample):</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <button key={s.id} onClick={() => onSample(s)}
                className="border-2 border-saffron bg-white rounded-full px-4 py-2 font-semibold">{s.label}</button>
            ))}
          </div>
        </div>

        {/* Preview + Explain */}
        {preview && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="निवडलेला कागद" className="w-full max-h-80 object-contain rounded-xl border bg-white" />

            {/* Photo quality warning: shown only when the browser check finds a problem */}
            {qualityIssue && (
              <div role="alert" className="bg-orange-50 border-2 border-orange-400 rounded-xl p-4 space-y-3">
                <p className="text-lg font-bold text-orange-900">⚠️ {QUALITY_MSG[qualityIssue]}</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => fileRef.current?.click()}
                    className="flex-1 bg-leaf text-white font-bold rounded-lg px-4 py-2">📷 पुन्हा फोटो काढा</button>
                  <button onClick={() => setQualityIssue(null)}
                    className="flex-1 border-2 border-gray-400 bg-white font-bold rounded-lg px-4 py-2">तरीही समजावून सांगा</button>
                </div>
              </div>
            )}

            <button onClick={explain} disabled={loading}
              className="w-full bg-saffron text-black text-2xl font-bold rounded-xl py-4 shadow disabled:opacity-60">
              {loading ? "वाचत आहे..." : "समजावून सांगा (Explain)"}
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl bg-black/10" />)}
          </div>
        )}

        {/* Friendly error + retry */}
        {error && (
          <div role="alert" className="bg-red-50 border-2 border-red-400 rounded-xl p-4 space-y-3">
            <p className="text-lg font-semibold text-red-800">{error}</p>
            <button onClick={explain} className="bg-red-600 text-white font-bold rounded-lg px-5 py-2">पुन्हा प्रयत्न करा (Retry)</button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`${conf.cls} rounded-full px-4 py-1 font-bold`}>{conf.text}</span>
              {demoFallback && <span className="bg-gray-700 text-white rounded-full px-3 py-1 text-sm">Demo fallback</span>}
            </div>

            {/* Low confidence: show the right reason, not always "photo is blurry" */}
            {notFarmDoc && (
              <p className="bg-blue-50 border border-blue-300 text-blue-900 font-bold rounded-lg p-3">
                हा कागद शेती, सरकारी किंवा बँकेचा दिसत नाही. कृपया योजना सूचना, मृदा आरोग्य पत्रिका किंवा बँक पत्र यांचा फोटो वापरा.
              </p>
            )}
            {!notFarmDoc && isLow && result.unclear_parts.length > 0 && (
              <p className="bg-red-100 text-red-800 font-bold rounded-lg p-3">फोटो अस्पष्ट आहे, पुन्हा काढा</p>
            )}
            {!notFarmDoc && isLow && result.unclear_parts.length === 0 && (
              <p className="bg-orange-100 text-orange-900 font-bold rounded-lg p-3">
                या कागदाबद्दल खात्री कमी आहे. कृपया तालुका कृषी कार्यालय / बँकेत तपासा.
              </p>
            )}

            <Card icon="📄" title="हे काय आहे">
              <p className="text-lg font-semibold">{result.document_type}</p>
              <p className="text-lg">{result.one_line_summary}</p>
            </Card>

            {result.what_you_must_do.length > 0 && (
              <Card icon="✅" title="तुम्हाला काय करायचे आहे">
                <ol className="list-decimal pl-6 space-y-1 text-lg">{result.what_you_must_do.map((s, i) => <li key={i}>{s}</li>)}</ol>
              </Card>
            )}

            {result.documents_needed.length > 0 && (
              <Card icon="📎" title="लागणारी कागदपत्रे">
                <ul className="space-y-1 text-lg">{result.documents_needed.map((s, i) => <li key={i}>☐ {s}</li>)}</ul>
              </Card>
            )}

            {result.important_dates.length > 0 && (
              <Card icon="📅" title="महत्त्वाच्या तारखा" tone="border-saffron" bg="bg-amber-50">
                <ul className="space-y-1 text-lg">
                  {result.important_dates.map((d, i) => (
                    <li key={i}>{d.label}: <mark className="bg-saffron/60 font-bold px-1 rounded">{d.date}</mark></li>
                  ))}
                </ul>
              </Card>
            )}

            {result.red_flags.length > 0 && (
              <Card icon="⚠️" title="सावधान" tone="border-red-600" bg="bg-red-50">
                <ul className="list-disc pl-6 space-y-1 text-lg text-red-900">{result.red_flags.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </Card>
            )}

            {result.unclear_parts.length > 0 && (
              <Card icon="❓" title="अस्पष्ट भाग" tone="border-gray-400">
                <ul className="list-disc pl-6 space-y-1 text-lg">{result.unclear_parts.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </Card>
            )}

            {/* Voice + share */}
            <div className="flex gap-2 flex-wrap">
              {!speaking
                ? <button onClick={speak} className="flex-1 bg-leaf text-white font-bold text-lg rounded-xl py-3">🔊 ऐका</button>
                : <button onClick={stopSpeaking} className="flex-1 bg-gray-700 text-white font-bold text-lg rounded-xl py-3">⏹ थांबवा</button>}
              <a href={buildShareUrl(result)} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center bg-[#25D366] text-black font-bold text-lg rounded-xl py-3">WhatsApp वर शेअर करा</a>
            </div>
            {voiceMsg && <p className="text-sm text-red-700">{voiceMsg}</p>}
          </div>
        )}

        {/* Notices */}
        <p className="bg-yellow-100 border border-yellow-400 rounded-lg p-3 font-semibold">
          हे फक्त समजण्यासाठी आहे. अंतिम खात्री तालुका कृषी कार्यालय / बँकेत करा.
        </p>
        <p className="text-center text-sm text-gray-600">🔒 तुमचा फोटो साठवला जात नाही.</p>
      </div>
    </main>
  );
}