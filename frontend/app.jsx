import { useState, useRef, useEffect, useCallback } from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:        "#0e0a1a",
  surface:   "#160e2a",
  card:      "#1d1336",
  border:    "#2a1f4a",
  accent:    "#c084fc",   // violet
  accentAlt: "#818cf8",   // indigo
  gold:      "#fbbf24",
  green:     "#34d399",
  red:       "#f87171",
  cyan:      "#22d3ee",
  text:      "#f0e6ff",
  muted:     "#8b6faa",
  dim:       "#3d2960",
};

const CHROMATIC = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const NOTE_COLORS = {
  "C":"#f87171","C#":"#fb923c","D":"#fbbf24","D#":"#a3e635",
  "E":"#34d399","F":"#22d3ee","F#":"#60a5fa","G":"#818cf8",
  "G#":"#c084fc","A":"#e879f9","A#":"#f472b6","B":"#fb7185",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const BACKEND = "http://localhost:8000";

async function analyzeFile(file, onProgress) {
  const form = new FormData();
  form.append("file", file);
  onProgress?.(10);
  const res  = await fetch(`${BACKEND}/analyze`, { method: "POST", body: form });
  onProgress?.(90);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  onProgress?.(100);
  return data;
}

async function analyzeLive(blob) {
  const form = new FormData();
  form.append("file", new File([blob], "recording.wav", { type: "audio/wav" }));
  const res  = await fetch(`${BACKEND}/analyze-live`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Demo mode (no backend needed) ────────────────────────────────────────────
function getDemoResult(filename = "demo.wav") {
  return {
    filename,
    duration_sec: 12.4,
    unique_notes: ["C", "E", "G", "A", "B", "D"],
    overall: {
      scale: "C Major",
      confidence: 91.2,
      top_matches: [
        { scale: "C Major",          confidence: 91.2, coverage: 100 },
        { scale: "A Natural Minor",  confidence: 84.7, coverage: 85  },
        { scale: "C Major Pentatonic",confidence: 78.3,coverage: 80  },
        { scale: "G Mixolydian",     confidence: 71.0, coverage: 72  },
        { scale: "D Dorian",         confidence: 65.5, coverage: 68  },
      ],
    },
    pitch_events: Array.from({ length: 120 }, (_, i) => ({
      time: i * 0.1,
      hz: 261.63 * Math.pow(2, (Math.sin(i * 0.3) * 4) / 12) + Math.random() * 10,
      note: ["C","E","G","A","D","B"][Math.floor(Math.random()*6)],
    })),
    lines: [
      { line: 1, start: 0,    end: 3.1,  notes: ["C","E","G"],       scale: "C Major",         confidence: 95 },
      { line: 2, start: 3.4,  end: 6.2,  notes: ["A","C","E","G"],   scale: "A Natural Minor",  confidence: 88 },
      { line: 3, start: 6.6,  end: 9.1,  notes: ["F","A","C"],       scale: "F Major",          confidence: 82 },
      { line: 4, start: 9.5,  end: 12.4, notes: ["G","B","D","F"],   scale: "G Mixolydian",     confidence: 76 },
    ],
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NoteChip({ note, active }) {
  const color = NOTE_COLORS[note] || C.accent;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 38, height: 38, borderRadius: "50%",
      background: active ? color + "30" : "transparent",
      border: `2px solid ${active ? color : C.border}`,
      color: active ? color : C.muted,
      fontSize: 11, fontWeight: 700, fontFamily: "monospace",
      transition: "all 0.3s",
      boxShadow: active ? `0 0 12px ${color}44` : "none",
    }}>{note}</span>
  );
}

function ConfidenceBar({ value, color = C.accent, label, max = 100 }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: C.text }}>{label}</span>
        <span style={{ fontSize: 12, color, fontFamily: "monospace", fontWeight: 700 }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, background: C.dim, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${color}, ${color}bb)`, borderRadius: 3, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

function PianoRoll({ notes }) {
  const octaveNotes = CHROMATIC;
  return (
    <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
      {octaveNotes.map(n => {
        const active = notes.includes(n);
        const isBlack = n.includes("#");
        const color = NOTE_COLORS[n];
        return (
          <div key={n} style={{
            width: isBlack ? 28 : 34, height: isBlack ? 60 : 80,
            background: active
              ? `linear-gradient(180deg, ${color}cc, ${color}44)`
              : isBlack ? "#1a1030" : "#241848",
            border: `1px solid ${active ? color : C.border}`,
            borderRadius: "0 0 6px 6px",
            position: "relative",
            boxShadow: active ? `0 0 16px ${color}66` : "none",
            transition: "all 0.3s",
            cursor: "default",
            display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6,
          }}>
            {active && <span style={{ fontSize: 9, color: color, fontFamily: "monospace", fontWeight: 700 }}>{n}</span>}
          </div>
        );
      })}
    </div>
  );
}

function PitchGraph({ events, height = 120 }) {
  if (!events || events.length === 0) return null;
  const maxHz = Math.max(...events.map(e => e.hz));
  const minHz = Math.min(...events.map(e => e.hz));
  const range = maxHz - minHz || 1;
  const w = 600, h = height;
  const pts = events.map((e, i) => {
    const x = (i / (events.length - 1)) * (w - 10) + 5;
    const y = h - ((e.hz - minHz) / range) * (h - 20) - 10;
    return [x, y];
  });
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const fillD = `${pathD} L${pts[pts.length-1][0]},${h} L${pts[0][0]},${h} Z`;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={w} height={h} style={{ display: "block", margin: "0 auto" }}>
        <defs>
          <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity="0.4" />
            <stop offset="100%" stopColor={C.accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <line key={frac} x1={5} y1={h - frac * (h - 20) - 10} x2={w - 5} y2={h - frac * (h - 20) - 10}
            stroke={C.border} strokeWidth={0.5} strokeDasharray="3,4" />
        ))}
        <path d={fillD} fill="url(#pitchGrad)" />
        <path d={pathD} fill="none" stroke={C.accent} strokeWidth={2} strokeLinejoin="round" />
        {/* dots for each event */}
        {pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 40)) === 0).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill={C.accentAlt} />
        ))}
      </svg>
    </div>
  );
}

function LineCard({ line, index }) {
  const colors = [C.accent, C.cyan, C.green, C.gold, C.accentAlt];
  const color = colors[index % colors.length];
  return (
    <div style={{
      background: C.card, border: `1px solid ${color}40`, borderRadius: 12,
      padding: "14px 18px", display: "flex", alignItems: "center", gap: 16,
      boxShadow: `0 0 20px ${color}0a`,
    }}>
      <div style={{ minWidth: 36, height: 36, borderRadius: "50%", background: color + "20", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "monospace" }}>{line.line}</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color }}>{line.scale}</span>
          <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{line.confidence.toFixed(0)}% confidence</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {line.notes.map(n => (
            <span key={n} style={{ fontSize: 11, color: NOTE_COLORS[n] || C.muted, background: (NOTE_COLORS[n] || C.muted) + "20", border: `1px solid ${(NOTE_COLORS[n] || C.muted)}40`, borderRadius: 4, padding: "1px 6px", fontFamily: "monospace" }}>{n}</span>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{line.start.toFixed(1)}s → {line.end.toFixed(1)}s</div>
        <div style={{ marginTop: 6, width: 80, height: 4, background: C.dim, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${line.confidence}%`, height: "100%", background: color }} />
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function VocalScaleFinder() {
  const [mode, setMode]         = useState("upload");   // "upload" | "record"
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [demoMode, setDemoMode] = useState(false);

  const fileRef    = useRef();
  const mediaRef   = useRef();
  const chunksRef  = useRef([]);
  const timerRef   = useRef();

  // ── File analysis ───────────────────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true); setError(""); setResult(null); setProgress(0);
    try {
      if (demoMode) {
        await new Promise(r => setTimeout(r, 1200));
        setResult(getDemoResult(file.name));
      } else {
        const data = await analyzeFile(file, setProgress);
        setResult(data);
      }
      setActiveTab("overview");
    } catch (e) {
      setError(`Analysis failed: ${e.message}. Enable Demo Mode to try without a backend.`);
    } finally {
      setLoading(false); setProgress(0);
    }
  };

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setLoading(true); setError("");
        try {
          if (demoMode) {
            await new Promise(r => setTimeout(r, 800));
            setResult(getDemoResult("recording.wav"));
          } else {
            const data = await analyzeLive(blob);
            setResult({ ...data, filename: "Live Recording", duration_sec: recordSec, lines: [], pitch_events: [] });
          }
          setActiveTab("overview");
        } catch (e) {
          setError("Analysis failed: " + e.message);
        } finally {
          setLoading(false);
        }
      };
      mr.start();
      setRecording(true);
      setRecordSec(0);
      timerRef.current = setInterval(() => setRecordSec(s => s + 1), 1000);
    } catch (e) {
      setError("Microphone access denied: " + e.message);
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const ff = "'Playfair Display', Georgia, serif";
  const fm = "'JetBrains Mono', 'Fira Code', monospace";
  const fs = "'DM Sans', 'Segoe UI', sans-serif";

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: fs }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: ${C.accent}44; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.surface}; }
        ::-webkit-scrollbar-thumb { background: ${C.dim}; border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes waveform {
          0%   { height: 4px }
          25%  { height: 20px }
          50%  { height: 32px }
          75%  { height: 14px }
          100% { height: 4px }
        }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface, padding: "0 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.accent}, ${C.accentAlt})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>♪</div>
            <div>
              <div style={{ fontFamily: ff, fontSize: 18, fontWeight: 700, color: C.text }}>Vocal Scale Finder</div>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, textTransform: "uppercase" }}>AI Music Intelligence</div>
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: C.muted }}>
            <div onClick={() => setDemoMode(d => !d)} style={{
              width: 36, height: 20, borderRadius: 10,
              background: demoMode ? C.accent : C.dim, position: "relative", transition: "background 0.3s",
            }}>
              <div style={{ position: "absolute", top: 2, left: demoMode ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.3s" }} />
            </div>
            Demo Mode {demoMode ? "ON" : "OFF"}
          </label>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── Input Panel ─────────────────────────────────────────────────── */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, marginBottom: 28, animation: "fadeUp 0.5s ease" }}>

          {/* mode tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {["upload", "record"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: "8px 20px", borderRadius: 8, border: `1px solid ${mode === m ? C.accent : C.border}`,
                background: mode === m ? C.accent + "20" : "transparent",
                color: mode === m ? C.accent : C.muted, fontSize: 13, cursor: "pointer",
                fontFamily: fs, fontWeight: 500, transition: "all 0.2s",
              }}>
                {m === "upload" ? "📁 Upload File" : "🎤 Record Live"}
              </button>
            ))}
          </div>

          {mode === "upload" ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${dragOver ? C.accent : C.border}`, borderRadius: 16,
                padding: "48px 24px", textAlign: "center", cursor: "pointer",
                background: dragOver ? C.accent + "08" : "transparent",
                transition: "all 0.3s",
              }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎵</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6, fontFamily: ff }}>Drop your audio file here</div>
              <div style={{ fontSize: 13, color: C.muted }}>MP3, WAV, OGG, FLAC, M4A — or click to browse</div>
              <input ref={fileRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              {/* waveform visualizer */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, height: 48, marginBottom: 20 }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{
                    width: 4, borderRadius: 2,
                    background: recording ? C.accent : C.dim,
                    height: recording ? undefined : "4px",
                    animation: recording ? `waveform ${0.6 + i * 0.07}s ease-in-out ${i * 0.03}s infinite` : "none",
                  }} />
                ))}
              </div>
              {recording && (
                <div style={{ fontSize: 14, color: C.red, fontFamily: fm, marginBottom: 16, animation: "pulse 1s infinite" }}>
                  ● RECORDING — {recordSec}s
                </div>
              )}
              <button onClick={recording ? stopRecording : startRecording} style={{
                padding: "12px 32px", borderRadius: 50,
                background: recording ? `linear-gradient(135deg, ${C.red}, #c0392b)` : `linear-gradient(135deg, ${C.accent}, ${C.accentAlt})`,
                border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                boxShadow: `0 4px 20px ${recording ? C.red : C.accent}44`, fontFamily: fs,
              }}>
                {recording ? "⏹ Stop & Analyze" : "● Start Recording"}
              </button>
            </div>
          )}

          {loading && (
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${C.dim}`, borderTop: `3px solid ${C.accent}`, borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
              <div style={{ fontSize: 13, color: C.muted }}>Analyzing audio{progress > 0 ? ` (${progress}%)` : "…"}</div>
              {progress > 0 && (
                <div style={{ maxWidth: 200, margin: "10px auto 0", height: 4, background: C.dim, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: C.accent, transition: "width 0.3s" }} />
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: C.red + "15", border: `1px solid ${C.red}40`, borderRadius: 10, fontSize: 13, color: C.red }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {result && (
          <div style={{ animation: "fadeUp 0.5s ease" }}>

            {/* file info strip */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "10px 16px", background: C.card, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 18 }}>🎼</span>
              <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{result.filename}</span>
              {result.duration_sec > 0 && <span style={{ fontSize: 12, color: C.muted, fontFamily: fm }}>{result.duration_sec}s</span>}
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {["overview", "lines", "pitch", "piano"].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    padding: "5px 12px", borderRadius: 6, border: `1px solid ${activeTab === tab ? C.accent : C.border}`,
                    background: activeTab === tab ? C.accent + "20" : "transparent",
                    color: activeTab === tab ? C.accent : C.muted, fontSize: 11, cursor: "pointer", fontFamily: fs,
                  }}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
                ))}
              </div>
            </div>

            {/* ── OVERVIEW TAB ───────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

                {/* Main scale result */}
                <div style={{ background: C.card, border: `1px solid ${C.accent}40`, borderRadius: 20, padding: 28, gridColumn: "1 / -1", textAlign: "center", boxShadow: `0 0 40px ${C.accent}15` }}>
                  <div style={{ fontSize: 12, color: C.muted, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Overall Scale Detected</div>
                  <div style={{ fontFamily: ff, fontSize: 48, fontWeight: 900, background: `linear-gradient(135deg, ${C.accent}, ${C.accentAlt})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1, marginBottom: 8 }}>
                    {result.overall.scale}
                  </div>
                  <div style={{ fontSize: 14, color: C.green, fontFamily: fm, marginBottom: 20 }}>
                    {result.overall.confidence.toFixed(1)}% confidence
                  </div>
                  <div style={{ maxWidth: 300, margin: "0 auto" }}>
                    <ConfidenceBar value={result.overall.confidence} color={C.accent} label="" />
                  </div>
                </div>

                {/* Detected notes */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
                  <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Detected Notes</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {(result.unique_notes || []).map(n => <NoteChip key={n} note={n} active />)}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {result.unique_notes?.join(" · ")}
                  </div>
                </div>

                {/* Top matches */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
                  <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Top Scale Matches</div>
                  {(result.overall.top_matches || []).map((m, i) => (
                    <ConfidenceBar key={m.scale}
                      value={m.confidence}
                      label={m.scale}
                      color={i === 0 ? C.accent : i === 1 ? C.accentAlt : C.muted}
                    />
                  ))}
                </div>

                {/* Stats */}
                <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {[
                    { label: "Notes Found",    value: result.unique_notes?.length || 0, color: C.accent, icon: "♩" },
                    { label: "Phrases / Lines", value: result.lines?.length || 0,       color: C.cyan,   icon: "≡" },
                    { label: "Duration",        value: `${result.duration_sec}s`,        color: C.gold,   icon: "⏱" },
                    { label: "Pitch Events",    value: result.pitch_events?.length || 0, color: C.green,  icon: "~" },
                  ].map(s => (
                    <div key={s.label} style={{ background: C.surface, border: `1px solid ${s.color}30`, borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: fm }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── LINES TAB ──────────────────────────────────────────────── */}
            {activeTab === "lines" && (
              <div>
                <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Line-by-Line Scale Detection</div>
                {result.lines?.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {result.lines.map((line, i) => <LineCard key={i} line={line} index={i} />)}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: 40, color: C.muted, background: C.card, borderRadius: 16 }}>
                    No phrase segments detected — try uploading a longer recording with clear pauses between lines.
                  </div>
                )}
              </div>
            )}

            {/* ── PITCH TAB ──────────────────────────────────────────────── */}
            {activeTab === "pitch" && (
              <div>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Real-Time Pitch Graph (Hz)</div>
                  {result.pitch_events?.length > 0
                    ? <PitchGraph events={result.pitch_events} height={140} />
                    : <div style={{ textAlign: "center", padding: 30, color: C.muted }}>No pitch data available</div>}
                </div>
                {result.pitch_events?.length > 0 && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
                    <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Note Events</div>
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: fm }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                            {["Time (s)", "Hz", "Note"].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.pitch_events.filter((_, i) => i % Math.max(1, Math.floor(result.pitch_events.length / 30)) === 0).map((e, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.dim}` }}>
                              <td style={{ padding: "5px 10px", color: C.muted }}>{e.time.toFixed(2)}</td>
                              <td style={{ padding: "5px 10px", color: C.accentAlt }}>{e.hz.toFixed(1)}</td>
                              <td style={{ padding: "5px 10px", color: NOTE_COLORS[e.note] || C.text, fontWeight: 700 }}>{e.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PIANO TAB ──────────────────────────────────────────────── */}
            {activeTab === "piano" && (
              <div>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
                  <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Piano Roll — Highlighted Notes</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
                    Glowing keys = notes detected in your singing
                  </div>
                  <PianoRoll notes={result.unique_notes || []} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20, justifyContent: "center" }}>
                    {(result.unique_notes || []).map(n => (
                      <span key={n} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: NOTE_COLORS[n] || C.muted, display: "inline-block" }} />
                        <span style={{ color: NOTE_COLORS[n] || C.muted, fontFamily: fm }}>{n}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!result && !loading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: C.muted }}>
            <div style={{ fontFamily: ff, fontSize: 22, marginBottom: 8, color: C.dim }}>♪ ♩ ♫ ♬</div>
            <div style={{ fontSize: 14 }}>Upload or record your singing to identify your scale</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Enable <span style={{ color: C.accent }}>Demo Mode</span> above to try without a backend
            </div>
          </div>
        )}
      </div>

      {/* footer */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 32px", textAlign: "center", fontSize: 11, color: C.muted }}>
        Vocal Scale Finder · YIN Pitch Detection · Librosa · FastAPI · React
      </div>
    </div>
  );
}