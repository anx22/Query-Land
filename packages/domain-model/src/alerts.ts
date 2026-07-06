// Alerts (§5 Modul 6, Welle 6). Eine Regel beobachtet eine projektweite Kennzahl gegen einen
// Schwellwert; die Auswertung erzeugt nachvollziehbare Events (getriggert oder nicht).

export type AlertMetric = "visibility_score" | "health_score" | "open_opportunities" | "referring_domains" | "search_clicks";
export type AlertComparator = "lt" | "lte" | "gt" | "gte";

// `search_clicks` is total GSC clicks at the latest snapshot — thresholded with `lt` it is the
// classic "traffic drop" alert (fire when clicks fall below X).
export const ALERT_METRICS: readonly AlertMetric[] = ["visibility_score", "health_score", "open_opportunities", "referring_domains", "search_clicks"];
export const ALERT_COMPARATORS: readonly AlertComparator[] = ["lt", "lte", "gt", "gte"];

/** Where a triggered alert is delivered. Mirrors the report delivery channels. */
export type AlertChannel = "webhook" | "email" | "slack";
export const ALERT_CHANNELS: readonly AlertChannel[] = ["webhook", "email", "slack"];

export interface AlertRule {
  id: string;
  projectId: string;
  metric: AlertMetric;
  comparator: AlertComparator;
  threshold: number;
  /** Optional delivery channel for a triggered alert; null → record the event only. */
  channel: AlertChannel | null;
  /** Delivery target (webhook/Slack URL or email address); null when no channel. */
  target: string | null;
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
