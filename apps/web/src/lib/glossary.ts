/**
 * Glossary — single source of truth for term definitions.
 *
 * Feeds both the /glossar page and TermTooltip components.
 * Definitions follow the Berater-Ton: sachlich, ein Satz, Deutsch.
 * Source: ux-ui-sprint.md "Glossar-Seed" table.
 */

export interface GlossaryEntry {
  /** Display term shown to users */
  term: string;
  /** One-sentence advisory definition in German */
  definition: string;
}

/**
 * Ordered list of all glossary terms (preserves spec order for the /glossar page).
 */
export const glossaryEntries: GlossaryEntry[] = [
  {
    term: "Crawl",
    definition:
      "Automatisiertes Abrufen der Seiten einer Website, um Erreichbarkeit, Inhalte und Verlinkung zu erfassen.",
  },
  {
    term: "Indexierbarkeit",
    definition:
      "Ob eine URL in den Suchindex aufgenommen werden darf (nicht durch robots/noindex/Canonical blockiert).",
  },
  {
    term: "Health Score",
    definition:
      "Aggregierter technischer Gesundheitswert einer Site aus offenen Issues und deren Schwere.",
  },
  {
    term: "Meta-Description",
    definition:
      "Kurzbeschreibung einer Seite im <head>, die als Snippet-Vorschlag in den Suchergebnissen dienen kann (ideal ~50–160 Zeichen).",
  },
  {
    term: "H1",
    definition:
      "Die Hauptüberschrift einer Seite; eine Seite sollte genau eine H1 haben, die ihr Thema klar benennt.",
  },
  {
    term: "Thin Content",
    definition:
      "Seiten mit sehr wenig eigenständigem Inhalt, die für Suchende kaum Mehrwert bieten und selten ranken.",
  },
  {
    term: "Canonical",
    definition:
      "Verweis auf die maßgebliche URL eines Inhalts, um Duplikate zu bündeln; www/apex und http/https gelten dabei als gleichwertig.",
  },
  {
    term: "Mixed Content",
    definition:
      "Unsichere http-Ressourcen, die in eine https-Seite geladen werden — ein Sicherheits- und Qualitätsproblem, das Browser blockieren können.",
  },
  {
    term: "hreflang",
    definition:
      "Auszeichnung sprach-/länderspezifischer Alternativversionen einer Seite; fehlerhafte Codes oder Ziele führen zu Fehlinterpretation.",
  },
  {
    term: "Structured Data",
    definition:
      "Maschinenlesbare Auszeichnung (meist JSON-LD/Schema.org), die Suchmaschinen Inhalte präzise erklärt und Rich Results ermöglicht.",
  },
  {
    term: "Viewport",
    definition:
      "Meta-Tag, das die mobile Darstellung steuert; ohne ihn wirkt eine Seite auf Smartphones oft unbrauchbar (Mobile-Signal).",
  },
  {
    term: "Visibility-Index",
    definition:
      "Positionsgewichteter Sichtbarkeitswert über die getrackten Keywords (0–100).",
  },
  {
    term: "Ranking / Position",
    definition:
      "Platz einer URL in den Suchergebnissen für ein Keyword (1 = oben).",
  },
  {
    term: "Keyword / Intent",
    definition:
      "Suchbegriff samt dahinterliegender Absicht (informational, kommerziell, transaktional …).",
  },
  {
    term: "SERP / SERP-Feature",
    definition:
      "Suchergebnisseite; Sonderelemente wie Featured Snippet, People-Also-Ask, Image Pack.",
  },
  {
    term: "Striking Distance",
    definition:
      "Keywords knapp außerhalb der Top-10 (Position 11–20) — die günstigsten Hebel.",
  },
  {
    term: "Funnel-Stage",
    definition:
      "Phase der Kaufentscheidung, die ein Suchbegriff bedient (z. B. Information, Vergleich, Kauf).",
  },
  {
    term: "Quick Win",
    definition:
      "Chance mit hoher Wirkung und geringem Aufwand — lohnt sich zuerst.",
  },
  {
    term: "Big Bet",
    definition:
      "Chance mit hoher Wirkung, aber größerem Aufwand — bewusst einplanen statt nebenbei erledigen.",
  },
  {
    term: "CTR-Gap",
    definition:
      "Abstand zwischen positionsüblicher und tatsächlicher Klickrate — Hinweis auf schwache Snippets.",
  },
  {
    term: "Kannibalisierung",
    definition:
      "Mehrere eigene URLs konkurrieren um dasselbe Keyword.",
  },
  {
    term: "Backlink",
    definition:
      "Link von einer fremden Website auf die eigene.",
  },
  {
    term: "Verweisende Domain",
    definition:
      "Eindeutige Domain, von der mindestens ein Backlink stammt.",
  },
  {
    term: "Follow / Nofollow",
    definition:
      "Ob ein Link Linkkraft weitergibt (follow) oder nicht (nofollow).",
  },
  {
    term: "Follow-Ratio",
    definition:
      "Anteil der follow-Backlinks an allen Backlinks.",
  },
  {
    term: "Authority",
    definition:
      "Grobe Stärke des Linkprofils als Vertrauensindikator.",
  },
  {
    term: "Chance (Opportunity)",
    definition:
      "Zentrale Einheit: belegte Beobachtung → empfohlene Maßnahme → messbare Validierung.",
  },
  {
    term: "Priorität",
    definition:
      "Rangwert einer Chance = Impact × Konfidenz × Business-Value ÷ Aufwand.",
  },
  {
    term: "Evidenz / Konfidenz (A–E)",
    definition:
      "Beleg hinter einer Aussage und dessen Verlässlichkeit (A gesichert … E KI-Hinweis, kein Beleg).",
  },
  {
    term: "Quell-Verknüpfung",
    definition:
      "Zuordnung einer URL zur verantwortlichen Code-/Template-Stelle.",
  },
  {
    term: "Orphan-URL",
    definition:
      "Seite ohne interne eingehende Links — für Nutzer und Crawler schwer auffindbar.",
  },
  {
    term: "Interne Verlinkung",
    definition:
      "Links zwischen eigenen Seiten; verteilen Relevanz und Auffindbarkeit.",
  },
  {
    term: "Crawl-Diff",
    definition:
      "Vergleich zweier Crawls: neue/entfernte URLs und Statuswechsel.",
  },
  {
    term: "Web Vitals (LCP/CLS/INP/TTFB)",
    definition:
      "Kern-Performance-Kennzahlen der Ladeerfahrung.",
  },
  {
    term: "AEO",
    definition:
      "Answer Engine Optimization — Inhalte für Antwort-Engines/KI aufbereiten.",
  },
  {
    term: "AI-Visibility / Citation",
    definition:
      "Ob die eigene Domain in LLM-Antworten genannt/zitiert wird (Konfidenz E — Signal, kein Beleg).",
  },
  {
    term: "Report / Alert",
    definition:
      "Zusammenfassung von Kennzahlen über Zeit; Alert = Schwellwert-Auslöser.",
  },
];

/**
 * Lookup map: lowercased term → definition.
 * Used by TermTooltip to resolve definitions at runtime.
 *
 * Keys are the canonical term strings (lowercased) for case-insensitive lookup.
 */
export const glossary: Record<string, string> = Object.fromEntries(
  glossaryEntries.map((e) => [e.term.toLowerCase(), e.definition])
);

/**
 * Look up a definition by term (case-insensitive).
 * Returns undefined if the term is not in the glossary.
 */
export function lookupGlossaryTerm(term: string): string | undefined {
  return glossary[term.toLowerCase()];
}
