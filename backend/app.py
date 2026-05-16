"""
app.py — Vocal Scale Finder
FastAPI Backend Entry Point
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import tempfile, os, shutil

from audio.processor   import AudioProcessor
from audio.pitch       import PitchDetector
from audio.segmenter   import AudioSegmenter
from scales.detector   import ScaleDetector
from scales.library    import SCALE_LIBRARY
from utils.converter   import hz_to_note, notes_to_midi

app = FastAPI(title="Vocal Scale Finder", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singletons ─────────────────────────────────────────────────────────────────
processor  = AudioProcessor()
pitcher    = PitchDetector()
segmenter  = AudioSegmenter()
detector   = ScaleDetector()


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "online", "app": "Vocal Scale Finder v1.0"}


@app.get("/scales")
def list_scales():
    """Return the full scale library."""
    return {"scales": list(SCALE_LIBRARY.keys()), "count": len(SCALE_LIBRARY)}


@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    """
    Full analysis pipeline:
    1. Load & preprocess audio
    2. Detect pitches (YIN algorithm via librosa)
    3. Convert Hz → Notes
    4. Match against scale library
    5. Split into segments and detect per-line scale
    """
    # ── Save upload to temp file ───────────────────────────────────────────────
    suffix = os.path.splitext(file.filename)[-1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        # ── 1. Load audio ──────────────────────────────────────────────────────
        y, sr = processor.load(tmp_path)
        duration = len(y) / sr

        # ── 2. Pitch detection ─────────────────────────────────────────────────
        pitches_hz = pitcher.detect(y, sr)           # list of (time, hz)
        pitches_filtered = pitcher.filter_voiced(pitches_hz)  # remove silence/unvoiced

        # ── 3. Hz → Note names ─────────────────────────────────────────────────
        note_events = [
            {"time": round(t, 3), "hz": round(f, 2), "note": hz_to_note(f)}
            for t, f in pitches_filtered
        ]
        note_names = [e["note"] for e in note_events]

        # ── 4. Overall scale detection ─────────────────────────────────────────
        overall = detector.detect(note_names)

        # ── 5. Segment (line-by-line) detection ───────────────────────────────
        segments = segmenter.split(y, sr)
        line_results = []
        for i, (start, end) in enumerate(segments):
            seg_audio = y[int(start * sr): int(end * sr)]
            seg_pitches = pitcher.detect(seg_audio, sr)
            seg_voiced  = pitcher.filter_voiced(seg_pitches)
            seg_notes   = [hz_to_note(f) for _, f in seg_voiced]
            seg_scale   = detector.detect(seg_notes)
            line_results.append({
                "line":       i + 1,
                "start":      round(start, 2),
                "end":        round(end, 2),
                "notes":      list(dict.fromkeys(seg_notes)),   # unique, ordered
                "scale":      seg_scale["best_match"],
                "confidence": seg_scale["confidence"],
                "all_matches":seg_scale["top_matches"][:3],
            })

        return {
            "filename":     file.filename,
            "duration_sec": round(duration, 2),
            "pitch_events": note_events,
            "unique_notes": list(dict.fromkeys(note_names)),
            "overall": {
                "scale":      overall["best_match"],
                "confidence": overall["confidence"],
                "top_matches":overall["top_matches"][:5],
            },
            "lines": line_results,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)


@app.post("/analyze-live")
async def analyze_live(file: UploadFile = File(...)):
    """
    Lightweight endpoint for short mic recordings.
    Same pipeline, no segmentation (treats whole clip as one phrase).
    """
    suffix = ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        y, sr = processor.load(tmp_path)
        pitches_hz = pitcher.detect(y, sr)
        voiced     = pitcher.filter_voiced(pitches_hz)
        note_names = [hz_to_note(f) for _, f in voiced]
        result     = detector.detect(note_names)
        return {
            "notes":      list(dict.fromkeys(note_names)),
            "scale":      result["best_match"],
            "confidence": result["confidence"],
            "top_matches":result["top_matches"][:5],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)