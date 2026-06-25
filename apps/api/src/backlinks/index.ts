import type { LinkType, SourceConfidence } from "@seo-tool/domain-model";

// GSC-„Links"-Provider-Vertrag (specs/integrations.md, §4.2). Bis ein echter Authority-/Links-
// Provider (GSC-Links via OAuth oder Drittanbieter) angebunden ist, liefert dieser Provider KEINE
// Links — Backlinks bleiben ein ehrlicher, optionaler Leerzustand. Ein echter Adapter ersetzt nur
// fetch(); Persistenz, Diff und Confidence-Klasse B bleiben gleich.

export interface BacklinkRow {
  sourceUrl: string;
  sourceDomain: string;
  targetUrl: string;
  anchorText: string;
  linkType: LinkType;
}

export interface BacklinkFetchInput {
  baseUrl: string;
  round: number;
}

export interface BacklinkProvider {
  readonly name: string;
  readonly sourceConfidence: SourceConfidence;
  fetch(input: BacklinkFetchInput): BacklinkRow[];
}

// Kein echter Links-Provider verbunden → keine Backlinks. Ein echter Adapter ersetzt nur diese
// fetch()-Implementierung; Persistenz, New/Lost-Diff und Confidence-Klasse B bleiben.
const emptyProvider: BacklinkProvider = {
  name: "unconfigured-backlinks",
  sourceConfidence: "B",
  fetch(_input: BacklinkFetchInput): BacklinkRow[] {
    return [];
  }
};

export function getBacklinkProvider(): BacklinkProvider {
  return emptyProvider;
}
