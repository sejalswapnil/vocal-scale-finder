# 🎵 Vocal Scale Finder

AI-powered web app that detects the musical scale of your singing — overall and line-by-line.

---

## 📁 Project Structure

```
vocal-scale-finder/
├── backend/
│   ├── app.py                   ← FastAPI entry point, all routes
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   ├── api/
│   │   └── reddit.py            ← (placeholder, not used here)
│   ├── audio/
│   │   ├── processor.py         ← Load, normalize, HPF audio
│   │   ├── pitch.py             ← YIN pitch detection (librosa.pyin)
│   │   └── segmenter.py         ← Split audio into phrases by silence
│   ├── scales/
│   │   ├── library.py           ← All scales × 12 roots (288 total)
│   │   └── detector.py          ← Match notes → scale with confidence
│   └── utils/
│       └── converter.py         ← Hz ↔ MIDI ↔ Note conversions
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── main.jsx             ← React entry
│       └── App.jsx              ← Complete UI (all components)
│
└── docker-compose.yml
```

---

## 🚀 Quick Start

### Option A — Docker (recommended)
```bash
cd vocal-scale-finder
docker-compose up --build
```
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000

---

### Option B — Manual

**Backend:**
```bash
cd backend

# Install system deps (Ubuntu/Debian)
sudo apt install libsndfile1 ffmpeg

# Install Python packages
pip install -r requirements.txt

# Run
python app.py
# → http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## 🔌 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Health check |
| GET | `/scales` | List all 288 scales in library |
| POST | `/analyze` | Full analysis — upload audio file |
| POST | `/analyze-live` | Quick analysis — short mic recording |

### POST /analyze
**Request:** `multipart/form-data` with `file` field (mp3/wav/ogg/flac)

**Response:**
```json
{
  "filename":     "song.mp3",
  "duration_sec": 24.5,
  "unique_notes": ["C", "E", "G", "A", "D"],
  "overall": {
    "scale":       "C Major",
    "confidence":  91.2,
    "top_matches": [...]
  },
  "pitch_events": [
    { "time": 0.02, "hz": 261.6, "note": "C" },
    ...
  ],
  "lines": [
    { "line": 1, "start": 0.0, "end": 3.1, "notes": ["C","E","G"], "scale": "C Major", "confidence": 95 },
    ...
  ]
}
```

---

## 🧠 How It Works

### 1. Audio Loading (`audio/processor.py`)
- Load any audio format via `librosa.load()`
- Resample to 22050 Hz mono
- Peak-normalize to [-1, 1]
- Optional high-pass filter to cut noise below 80 Hz

### 2. Pitch Detection (`audio/pitch.py`)
- **YIN algorithm** via `librosa.pyin()` — state-of-the-art monophonic pitch tracking
- Detects voiced/unvoiced frames
- Filters range: C2 (65 Hz) → C7 (2093 Hz) — covers all vocal ranges
- Median smoothing over 5 frames to remove noise
- IQR outlier removal for clean pitch tracks

### 3. Hz → Note Conversion (`utils/converter.py`)
- `hz → MIDI = 12 × log₂(hz / 440) + 69`
- `MIDI mod 12 → chromatic index → note name`

### 4. Phrase Segmentation (`audio/segmenter.py`)
- `librosa.effects.split()` finds non-silent intervals
- Merges gaps < 0.4s (natural breath pauses within a phrase)
- Filters segments < 0.8s (too short to analyze)
- Returns (start_sec, end_sec) list for each line

### 5. Scale Detection (`scales/detector.py`)
- Compares detected note set against all 288 scales (24 types × 12 roots)
- **Scoring formula:**
  - `0.50 × coverage` (% of detected notes in scale)
  - `0.25 × completeness` (% of scale's notes found)
  - `+0.15 × root frequency bonus`
  - `+0.05 × tonic-dominant bonus`
  - `-0.08 × foreign notes penalty`
- Returns ranked list with confidence percentages

### 6. Scale Library (`scales/library.py`)
288 scales covering:
- Major, Natural/Harmonic/Melodic Minor
- Major & Minor Pentatonic, Blues
- All 7 Church Modes (Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian)
- Whole Tone, Diminished, Augmented, Double Harmonic, Hungarian Minor, Phrygian Dominant

---

## 🎨 Frontend Features

| Tab | Contents |
|-----|----------|
| **Overview** | Main scale result, confidence bar, top 5 matches, detected notes, stats |
| **Lines** | Per-phrase cards with scale, timestamp, notes, confidence |
| **Pitch** | SVG pitch graph over time + note events table |
| **Piano** | Piano keyboard with detected notes glowing |

**Demo Mode** (toggle top-right): runs without backend — uses synthetic demo data so you can explore the full UI.

---

## 🛠 Extending

- **Add scales:** Edit `SCALE_PATTERNS` in `scales/library.py`
- **Improve pitch:** Replace `pyin` with `crepe` model for neural pitch detection
- **Polyphonic:** Add `librosa.cqt()` chromagram analysis
- **Export PDF:** Add `reportlab` and a `/export` endpoint
- **History:** Add SQLite with `databases` + `aiosqlite`