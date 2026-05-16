"""
scales/detector.py
Scale Detection Engine
Matches detected notes against full scale library
Returns ranked list with confidence scores
"""

from collections import Counter
from scales.library import SCALE_LIBRARY, CHROMATIC, normalize_note


class ScaleDetector:

    def detect(self, notes: list[str]) -> dict:
        """
        Given a list of detected note names (e.g. ['C', 'E', 'G', 'A']),
        return the best-matching scale with confidence and ranked alternatives.
        """
        if not notes:
            return {
                "best_match":  "Unknown",
                "confidence":  0.0,
                "top_matches": [],
            }

        # Normalize enharmonics + count note frequency
        normalized = [normalize_note(n) for n in notes if n]
        note_counts = Counter(normalized)
        unique_notes = set(normalized)
        total_notes  = len(normalized)

        if not unique_notes:
            return {"best_match": "Unknown", "confidence": 0.0, "top_matches": []}

        scores = []
        for scale_key, scale_data in SCALE_LIBRARY.items():
            scale_set   = scale_data["note_set"]
            scale_notes = scale_data["notes"]
            n_scale     = len(scale_set)

            # ── Coverage: what fraction of detected notes are in the scale
            notes_in_scale  = unique_notes & scale_set
            coverage        = len(notes_in_scale) / max(len(unique_notes), 1)

            # ── Completeness: what fraction of the scale's notes were found
            completeness    = len(notes_in_scale) / n_scale

            # ── Root emphasis: is the root note frequent?
            root = scale_data["root"]
            root_freq = note_counts.get(root, 0) / total_notes
            root_bonus = root_freq * 0.15

            # ── Tonic-Dominant bonus: first and fifth present?
            fifth_idx   = scale_data["intervals"][4] if len(scale_data["intervals"]) > 4 else 7
            fifth_note  = CHROMATIC[(CHROMATIC.index(root) + fifth_idx) % 12]
            tonal_bonus = 0.05 if (root in unique_notes and fifth_note in unique_notes) else 0.0

            # ── Weighted score
            score = (
                0.50 * coverage
              + 0.25 * completeness
              + root_bonus
              + tonal_bonus
            )

            # ── Penalty for "too many" notes outside scale
            foreign = len(unique_notes - scale_set)
            score  -= foreign * 0.08

            score = max(0.0, min(1.0, score))

            scores.append({
                "scale":       scale_key,
                "score":       round(score, 4),
                "coverage":    round(coverage, 4),
                "completeness":round(completeness, 4),
                "notes_found": sorted(notes_in_scale),
                "root":        root,
                "scale_name":  scale_data["name"],
            })

        # Sort by score descending
        scores.sort(key=lambda x: -x["score"])

        best       = scores[0]
        confidence = round(best["score"] * 100, 1)  # % 0-100

        return {
            "best_match":  best["scale"],
            "confidence":  confidence,
            "root":        best["root"],
            "scale_name":  best["scale_name"],
            "notes_found": best["notes_found"],
            "top_matches": [
                {
                    "scale":      s["scale"],
                    "confidence": round(s["score"] * 100, 1),
                    "coverage":   round(s["coverage"] * 100, 1),
                }
                for s in scores[:10]
            ],
        }

    def suggest_correction(self, notes: list[str], detected_scale: str) -> dict:
        """
        If confidence is low, suggest the closest correct scale
        and which notes are 'wrong'.
        """
        result   = self.detect(notes)
        if result["confidence"] >= 75:
            return {"in_tune": True, "suggestion": None}

        best_scale = SCALE_LIBRARY.get(result["best_match"], {})
        scale_set  = best_scale.get("note_set", set())
        normalized = {normalize_note(n) for n in notes if n}
        foreign    = sorted(normalized - scale_set)

        return {
            "in_tune":   False,
            "suggestion": result["best_match"],
            "off_key_notes": foreign,
            "message": (
                f"You appear to be singing close to {result['best_match']} "
                f"but the note(s) {', '.join(foreign)} don't fit. "
                f"Try staying within: {', '.join(best_scale.get('notes', []))}"
            ) if foreign else f"Close to {result['best_match']} — keep going!",
        }