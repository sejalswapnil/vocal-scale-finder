"""
utils/converter.py
Musical unit converters
Hz ↔ MIDI ↔ Note Name ↔ Octave
"""

import math

CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
A4_HZ    = 440.0
A4_MIDI  = 69


def hz_to_midi(hz: float) -> float:
    """Convert frequency in Hz to MIDI note number (float)."""
    if hz <= 0:
        return 0.0
    return 12 * math.log2(hz / A4_HZ) + A4_MIDI


def midi_to_hz(midi: float) -> float:
    """Convert MIDI note number to frequency in Hz."""
    return A4_HZ * (2 ** ((midi - A4_MIDI) / 12))


def midi_to_note(midi: float) -> str:
    """Convert MIDI number to note name (e.g. 69 → 'A')."""
    idx = round(midi) % 12
    return CHROMATIC[idx]


def hz_to_note(hz: float) -> str:
    """Convert Hz directly to note name."""
    if hz <= 0:
        return "?"
    midi = hz_to_midi(hz)
    return midi_to_note(midi)


def hz_to_note_with_octave(hz: float) -> str:
    """Convert Hz to note name + octave (e.g. 'A4')."""
    if hz <= 0:
        return "?"
    midi  = round(hz_to_midi(hz))
    note  = CHROMATIC[midi % 12]
    octave = (midi // 12) - 1
    return f"{note}{octave}"


def notes_to_midi(notes: list[str]) -> list[int]:
    """Convert list of note names to semitone indices 0-11."""
    result = []
    for n in notes:
        if n in CHROMATIC:
            result.append(CHROMATIC.index(n))
    return result


def note_to_chromatic_idx(note: str) -> int:
    """Return 0-11 index of a note name."""
    return CHROMATIC.index(note) if note in CHROMATIC else -1


def cents_offset(hz: float) -> float:
    """How many cents off from nearest note (± 50 = in tune)."""
    midi_exact  = hz_to_midi(hz)
    midi_round  = round(midi_exact)
    return (midi_exact - midi_round) * 100