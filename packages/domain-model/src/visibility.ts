// Modul 3 / specs/visibility-index.md (§8): projektspezifischer Sichtbarkeitsindex
// ("Monitoring-OVI") auf dem eigenen Keyword-Set. Transparente, dokumentierte Formel.

export interface VisibilityScore {
  id: string;
  projectId: string;
  market: string;
  score: number;
  trackedKeywords: number;
  averagePosition: number | null;
  computedAt: string;
}

export interface VisibilityInput {
  positions: Array<number | null>;
}

export interface VisibilityResult {
  score: number;
  trackedKeywords: number;
  averagePosition: number | null;
}

// Positionsgewicht als transparente CTR-ähnliche Kurve: linear von 1.0 (Position 1)
// auf 0 (Position 21+). Kein externes Suchvolumen (DEC-002) — jedes Keyword des Sets
// zählt gleich (Set-Zugehörigkeit). Score = Durchschnitt der Positionsgewichte × 100.
export function positionWeight(position: number): number {
  if (!Number.isFinite(position) || position < 1) return 0;
  if (position >= 21) return 0;
  return (21 - position) / 20;
}

export function computeVisibilityScore(input: VisibilityInput): VisibilityResult {
  const ranked = input.positions.filter((position): position is number => typeof position === "number" && Number.isFinite(position) && position >= 1);
  const trackedKeywords = ranked.length;
  if (trackedKeywords === 0) {
    return { score: 0, trackedKeywords: 0, averagePosition: null };
  }
  const weightSum = ranked.reduce((total, position) => total + positionWeight(position), 0);
  const positionSum = ranked.reduce((total, position) => total + position, 0);
  return {
    score: Math.round((weightSum / trackedKeywords) * 100),
    trackedKeywords,
    averagePosition: Math.round((positionSum / trackedKeywords) * 10) / 10
  };
}
