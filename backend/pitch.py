"""
audio/pitch.py
Pitch Detection Engine
Uses librosa's YIN algorithm for monophonic pitch tracking.
Converts Hz → MIDI → Note Name
"""

import librosa
import numpy as np
from utils.converter import hz_to_note


class PitchDetector:
    HOP_LENGTH   = 512
    FRAME_LENGTH = 2048
    FMIN         = librosa.note_to_hz("C2")   # ~65 Hz  (low bass)
    FMAX         = librosa.note_to_hz("C7")   # ~2093 Hz (soprano high)
    VOICED_THRESH = 0.4   # YIN aperiodicity threshold for voiced detection
    MIN_HZ       = 80.0   # ignore anything below this (noise / breath)

    def detect(self, y: np.ndarray, sr: int) -> list[tuple[float, float]]:
        """
        Run YIN pitch detection.
        Returns list of (time_seconds, frequency_hz) for all frames.
        """
        f0, voiced_flag, voiced_prob = librosa.pyin(
            y,
            fmin=self.FMIN,
            fmax=self.FMAX,
            sr=sr,
            hop_length=self.HOP_LENGTH,
            frame_length=self.FRAME_LENGTH,
        )

        times = librosa.frames_to_time(
            np.arange(len(f0)), sr=sr, hop_length=self.HOP_LENGTH
        )

        events = []
        for t, f, v in zip(times, f0, voiced_flag):
            if v and f is not None and not np.isnan(f) and f > self.MIN_HZ:
                events.append((float(t), float(f)))

        return events

    def filter_voiced(self, events: list[tuple[float, float]]) -> list[tuple[float, float]]:
        """
        Remove outliers and smooth pitch track with median filter.
        Eliminates single-frame jumps caused by noise.
        """
        if len(events) < 3:
            return events

        times = np.array([e[0] for e in events])
        freqs = np.array([e[1] for e in events])

        # Median smooth over 5 frames
        from scipy.ndimage import median_filter
        freqs_smooth = median_filter(freqs, size=5)

        # IQR outlier removal
        q1, q3 = np.percentile(freqs_smooth, [25, 75])
        iqr = q3 - q1
        mask = (freqs_smooth >= q1 - 2 * iqr) & (freqs_smooth <= q3 + 2 * iqr)

        return [(float(t), float(f)) for t, f, m in zip(times, freqs_smooth, mask) if m]

    def downsample_events(
        self, events: list[tuple[float, float]], target_n: int = 200
    ) -> list[tuple[float, float]]:
        """Reduce number of events for frontend rendering."""
        if len(events) <= target_n:
            return events
        step = len(events) // target_n
        return events[::step][:target_n]

    def to_note_sequence(self, events: list[tuple[float, float]]) -> list[str]:
        """Convert event list to deduplicated note sequence."""
        notes = [hz_to_note(f) for _, f in events]
        # Deduplicate consecutive identical notes
        deduped = []
        for n in notes:
            if not deduped or deduped[-1] != n:
                deduped.append(n)
        return deduped