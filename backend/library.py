"""
scales/library.py
Complete Musical Scale Library
Each scale defined by semitone intervals from root.
"""

# Chromatic note names
CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Enharmonic equivalents
ENHARMONIC = {
    "Db": "C#", "Eb": "D#", "Fb": "E",  "Gb": "F#",
    "Ab": "G#", "Bb": "A#", "Cb": "B",
}

# Scale name → interval pattern (semitones from root)
SCALE_PATTERNS = {
    # ── Major / Minor ──────────────────────────────────────────────────────────
    "Major":               [0, 2, 4, 5, 7, 9, 11],
    "Natural Minor":       [0, 2, 3, 5, 7, 8, 10],
    "Harmonic Minor":      [0, 2, 3, 5, 7, 8, 11],
    "Melodic Minor":       [0, 2, 3, 5, 7, 9, 11],

    # ── Pentatonic ─────────────────────────────────────────────────────────────
    "Major Pentatonic":    [0, 2, 4, 7, 9],
    "Minor Pentatonic":    [0, 3, 5, 7, 10],
    "Blues":               [0, 3, 5, 6, 7, 10],

    # ── Church Modes ──────────────────────────────────────────────────────────
    "Dorian":              [0, 2, 3, 5, 7, 9, 10],
    "Phrygian":            [0, 1, 3, 5, 7, 8, 10],
    "Lydian":              [0, 2, 4, 6, 7, 9, 11],
    "Mixolydian":          [0, 2, 4, 5, 7, 9, 10],
    "Aeolian":             [0, 2, 3, 5, 7, 8, 10],   # same as Natural Minor
    "Locrian":             [0, 1, 3, 5, 6, 8, 10],

    # ── Exotic ────────────────────────────────────────────────────────────────
    "Whole Tone":          [0, 2, 4, 6, 8, 10],
    "Diminished":          [0, 2, 3, 5, 6, 8, 9, 11],
    "Augmented":           [0, 3, 4, 7, 8, 11],
    "Double Harmonic":     [0, 1, 4, 5, 7, 8, 11],
    "Hungarian Minor":     [0, 2, 3, 6, 7, 8, 11],
    "Phrygian Dominant":   [0, 1, 4, 5, 7, 8, 10],
}

# Build full library: every scale × 12 roots
SCALE_LIBRARY = {}
for root_idx, root in enumerate(CHROMATIC):
    for scale_name, intervals in SCALE_PATTERNS.items():
        notes = [CHROMATIC[(root_idx + i) % 12] for i in intervals]
        key = f"{root} {scale_name}"
        SCALE_LIBRARY[key] = {
            "root":      root,
            "name":      scale_name,
            "intervals": intervals,
            "notes":     notes,
            "note_set":  set(notes),
        }

def normalize_note(note: str) -> str:
    """Convert enharmonic spellings to sharp notation."""
    return ENHARMONIC.get(note, note)

def get_scale_notes(root: str, scale_name: str) -> list[str]:
    key = f"{root} {scale_name}"
    return SCALE_LIBRARY.get(key, {}).get("notes", [])