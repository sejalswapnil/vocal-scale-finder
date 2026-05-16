"""
audio/processor.py
Audio loading, normalization, and preprocessing
"""

import librosa
import numpy as np


class AudioProcessor:
    TARGET_SR = 22050   # standard sample rate for pitch analysis

    def load(self, path: str, sr: int = None) -> tuple[np.ndarray, int]:
        """
        Load audio file → mono float32 waveform.
        Resamples to TARGET_SR if needed.
        Supports mp3, wav, ogg, flac, m4a.
        """
        target = sr or self.TARGET_SR
        y, sample_rate = librosa.load(path, sr=target, mono=True)
        y = self._normalize(y)
        return y, sample_rate

    def _normalize(self, y: np.ndarray) -> np.ndarray:
        """Peak-normalize to [-1, 1]."""
        peak = np.max(np.abs(y))
        if peak > 0:
            y = y / peak
        return y

    def trim_silence(self, y: np.ndarray, sr: int, top_db: int = 30) -> np.ndarray:
        """Remove leading/trailing silence."""
        y_trimmed, _ = librosa.effects.trim(y, top_db=top_db)
        return y_trimmed

    def apply_hpf(self, y: np.ndarray, sr: int, cutoff: float = 80.0) -> np.ndarray:
        """
        High-pass filter to remove low rumble below cutoff Hz.
        Helps isolate vocal frequencies.
        """
        from scipy.signal import butter, filtfilt
        b, a = butter(4, cutoff / (sr / 2), btype="high")
        return filtfilt(b, a, y).astype(np.float32)

    def get_rms(self, y: np.ndarray, frame_length: int = 2048, hop_length: int = 512) -> np.ndarray:
        """RMS energy per frame — used to detect voiced vs silent frames."""
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)
        return rms[0]