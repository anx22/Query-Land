// Alerts (§5 Modul 6, Welle 6). Eine Regel beobachtet eine projektweite Kennzahl gegen einen
// Schwellwert; die Auswertung erzeugt nachvollziehbare Events (getriggert oder nicht).

export type AlertMetric = "visibility_score" | "health_score" | "open_opportunities" | "referring_domains";
export type AlertComparator = "lt" | "lte" | "gt" | "gte";

export const ALERT_METRICS: readonly AlertMetric[] = ["visibility_score", "health_score", "open_opportunities", "referring_domains"];
export const ALERT_COMPARATORS: readonly AlertComparator[] = ["lt", "lte", "gt", "gte"];

export interface AlertRule {
  id: string;
  projectId: string;
  metric: AlertMetric;
  comparator: AlertComparator;
  threshold: number;
  createdAt: string;
}

export interface AlertEvent {
  id: string;
  projectId: string;
  ruleId: string;
  metric: AlertMetric;
  comparator: AlertComparator;
  threshold: number;
  observedValue: number;
  triggered: boolean;
  evaluatedAt: string;
}

export function compareAlert(observed: number, comparator: AlertComparator, threshold: number): boolean {
  switch (comparator) {
    case "lt":
      return observed < threshold;
    case "lte":
      return observed <= threshold;
    case "gt":
      return observed > threshold;
    case "gte":
      return observed >= threshold;
    default:
      return false;
  }
}
