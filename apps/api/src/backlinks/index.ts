import type { LinkType, SourceConfidence } from "@seo-tool/domain-model";

// GSC-„Links"-Provider-Vertrag (specs/integrations.md, §4.2). V1: ein deterministischer Stub
// statt eines produktiven OAuth-Flows (DEC-002, Confidence-Klasse B). Der Stub VERÄNDERT sich
// je Snapshot-Runde (eine Domain kommt hinzu, eine fällt weg), damit New/Lost messbar ist.
// Ein echter Adapter ersetzt nur fetch(); Persistenz, Diff und Confidence bleiben gleich.

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

const BASE_DOMAIN_COUNT = 12;

function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host || "example.com";
  } catch {
    return "example.com";
  }
}

function brandOf(host: string): string {
  const label = host.split(".")[0] || host;
  return label.replace(/[^a-z0-9]+/gi, " ").trim() || host;
}

const deterministicProvider: BacklinkProvider = {
  name: "deterministic-gsc-links-stub",
  sourceConfidence: "B",
  fetch({ baseUrl, round }) {
    const host = hostOf(baseUrl);
    const brand = brandOf(host);
    const targetPaths = ["", "/pricing", "/blog/seo-guide", "/features", "/about"];
    const targets = targetPaths.map((path) => `https://${host}${path}`);
    const anchors = [brand, "click here", "seo tool", "read more", `${brand} review`];
    const rows: BacklinkRow[] = [];

    // Stabiler Grundbestand; je Runde fällt genau eine bestehende Domain weg (Lost).
    for (let index = 0; index < BASE_DOMAIN_COUNT; index += 1) {
      if (round > 0 && index === round - 1) continue;
      const domain = `ref-${index}.example`;
      rows.push({
        sourceUrl: `https://${domain}/post-${index}`,
        sourceDomain: domain,
        targetUrl: targets[index % targets.length],
        anchorText: anchors[index % anchors.length],
        linkType: index % 4 === 0 ? "nofollow" : "follow"
      });
    }

    // Je Runde kommt genau eine neue Domain hinzu (New); frühere bleiben erhalten.
    for (let k = 0; k <= round; k += 1) {
      const domain = `new-${k}.example`;
      rows.push({
        sourceUrl: `https://${domain}/article`,
        sourceDomain: domain,
        targetUrl: targets[k % targets.length],
        anchorText: anchors[k % anchors.length],
        linkType: "follow"
      });
    }

    return rows;
  }
};

export function getBacklinkProvider(): BacklinkProvider {
  return deterministicProvider;
}
