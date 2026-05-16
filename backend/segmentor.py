"""
audio/segmenter.py
Audio Segmentation — splits audio into vocal phrases/lines
Uses silence detection to find natural phrase boundaries
"""

import librosa
import numpy as np


class AudioSegmenter:
    """
    Splits a vocal audio track into segments representing
    individual lines/phrases using silence detection.
    """

    def split(
        self,
        y: np.ndarray,
        sr: int,
        top_db: int = 28,          # silence threshold in dB below peak
        min_silence_sec: float = 0.4,   # min gap to count as phrase boundary
        min_phrase_sec:  float = 0.8,   # ignore segments shorter than this
        max_phrases:     int   = 20,    # cap for very long recordings
    ) -> list[tuple[float, float]]:
        """
        Returns list of (start_sec, end_sec) tuples, one per phrase.
        """
        # Get non-silent intervals
        intervals = librosa.effects.split(
            y,
            top_db=top_db,
            frame_length=2048,
            hop_length=512,
        )

        if len(intervals) == 0:
            return [(0.0, len(y) / sr)]

        # Convert frames → seconds
        raw_segments = [
            (float(s / sr), float(e / sr))
            for s, e in intervals
        ]

        # Merge segments separated by less than min_silence_sec
        merged = [raw_segments[0]]
        for start, end in raw_segments[1:]:
            prev_start, prev_end = merged[-1]
            if start - prev_end < min_silence_sec:
                merged[-1] = (prev_start, end)   # extend
            else:
                merged.append((start, end))

        # Filter too-short segments
        filtered = [
            (s, e) for s, e in merged
            if (e - s) >= min_phrase_sec
        ]

        if not filtered:
            return [(0.0, len(y) / sr)]

        return filtered[:max_phrases]

    def get_segment_audio(
        self,
        y: np.ndarray,
        sr: int,
        start_sec: float,
        end_sec: float,
    ) -> np.ndarray:
        """Slice waveform array to a time range."""
        return y[int(start_sec * sr): int(end_sec * sr)]