import type { SourceConfidence } from "./integrations.js";

// Authority / Backlinks (§5 Modul 5, Welle 5). GSC-„Links"-Report liefert Backlinks und
// verweisende Domains (Klasse B). Daraus: New/Lost-Diff zwischen Snapshots und eine
// Authority-Zusammenfassung (Ref-Domains, Anchor-Verteilung, Follow-Ratio, Top-Targets).

export type LinkType = "follow" | "nofollow";

export interface Backlink {
  id: string;
  projectId: string;
  snapshotId: string;
  sourceUrl: string;
  sourceDomain: string;
  targetUrl: string;
  anchorText: string;
  linkType: LinkType;
  firstSeenAt: string;
  lastSeenAt: string;
  sourceConfidence: SourceConfidence;
}

// Strukturelle Teilmenge für die reinen Funktionen (DB-unabhängig, damit testbar).
export type BacklinkLike = Pick<Backlink, "sourceUrl" | "sourceDomain" | "targetUrl" | "anchorText" | "linkType"> & {
  firstSeenAt?: string;
  lastSeenAt?: string;
};

export interface BacklinkSnapshot {
  id: string;
  projectId: string;
  capturedAt: string;
  totalBacklinks: number;
  referringDomains: number;
  sourceConfidence: SourceConfidence;
}

export interface ReferringDomain {
  domain: string;
  backlinks: number;
  targetUrls: number;
  followShare: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface BacklinkChange {
  sourceUrl: string;
  sourceDomain: string;
  targetUrl: string;
  anchorText: string;
  linkType: LinkType;
}

export interface BacklinkDiff {
  newBacklinks: BacklinkChange[];
  lostBacklinks: BacklinkChange[];
  newReferringDomains: string[];
  lostReferringDomains: string[];
  netBacklinkChange: number;
  netReferringDomainChange: number;
}

export interface AnchorStat {
  anchorText: string;
  count: number;
  share: number;
}

export interface TargetUrlStat {
  targetUrl: string;
  backlinks: number;
  referringDomains: number;
}

export interface AuthoritySummary {
  totalBacklinks: number;
  referringDomains: number;
  followRatio: number;
  topReferringDomains: ReferringDomain[];
  topAnchors: AnchorStat[];
  topTargetUrls: TargetUrlStat[];
}

function backlinkKey(link: BacklinkLike): string {
  return `${link.sourceUrl}\n${link.targetUrl}`;
}

function toChange(link: BacklinkLike): BacklinkChange {
  return { sourceUrl: link.sourceUrl, sourceDomain: link.sourceDomain, targetUrl: link.targetUrl, anchorText: link.anchorText, linkType: link.linkType };
}

// New/Lost-Diff: Identität eines Backlinks = sourceUrl + targetUrl; Domain-Identität = sourceDomain.
export function diffBacklinks(before: BacklinkLike[], after: BacklinkLike[]): BacklinkDiff {
  const beforeKeys = new Map(before.map((link) => [backlinkKey(link), link]));
  const afterKeys = new Map(after.map((link) => [backlinkKey(link), link]));
  const beforeDomains = new Set(before.map((link) => link.sourceDomain));
  const afterDomains = new Set(after.map((link) => link.sourceDomain));

  const newBacklinks = [...afterKeys].filter(([key]) => !beforeKeys.has(key)).map(([, link]) => toChange(link));
  const lostBacklinks = [...beforeKeys].filter(([key]) => !afterKeys.has(key)).map(([, link]) => toChange(link));
  const newReferringDomains = [...afterDomains].filter((domain) => !beforeDomains.has(domain));
  const lostReferringDomains = [...beforeDomains].filter((domain) => !afterDomains.has(domain));

  return {
    newBacklinks,
    lostBacklinks,
    newReferringDomains,
    lostReferringDomains,
    netBacklinkChange: after.length - before.length,
    netReferringDomainChange: afterDomains.size - beforeDomains.size
  };
}

function minIso(current: string | null, candidate?: string): string | null {
  if (!candidate) return current;
  if (current === null) return candidate;
  return candidate < current ? candidate : current;
}

function maxIso(current: string | null, candidate?: string): string | null {
  if (!candidate) return current;
  if (current === null) return candidate;
  return candidate > current ? candidate : current;
}

export function aggregateReferringDomains(backlinks: BacklinkLike[]): ReferringDomain[] {
  const byDomain = new Map<string, { backlinks: number; targets: Set<string>; follow: number; firstSeenAt: string | null; lastSeenAt: string | null }>();
  for (const link of backlinks) {
    let entry = byDomain.get(link.sourceDomain);
    if (!entry) {
      entry = { backlinks: 0, targets: new Set<string>(), follow: 0, firstSeenAt: null, lastSeenAt: null };
      byDomain.set(link.sourceDomain, entry);
    }
    entry.backlinks += 1;
    entry.targets.add(link.targetUrl);
    if (link.linkType === "follow") entry.follow += 1;
    entry.firstSeenAt = minIso(entry.firstSeenAt, link.firstSeenAt);
    entry.lastSeenAt = maxIso(entry.lastSeenAt, link.lastSeenAt);
  }
  return [...byDomain.entries()]
    .map(([domain, entry]) => ({
      domain,
      backlinks: entry.backlinks,
      targetUrls: entry.targets.size,
      followShare: entry.backlinks > 0 ? Number((entry.follow / entry.backlinks).toFixed(4)) : 0,
      firstSeenAt: entry.firstSeenAt,
      lastSeenAt: entry.lastSeenAt
    }))
    .sort((left, right) => right.backlinks - left.backlinks || left.domain.localeCompare(right.domain));
}

export function summarizeAuthority(backlinks: BacklinkLike[], options: { topLimit?: number } = {}): AuthoritySummary {
  const topLimit = options.topLimit ?? 10;
  const total = backlinks.length;
  const follow = backlinks.filter((link) => link.linkType === "follow").length;
  const referringDomains = aggregateReferringDomains(backlinks);

  const anchorCounts = new Map<string, number>();
  for (const link of backlinks) {
    anchorCounts.set(link.anchorText, (anchorCounts.get(link.anchorText) ?? 0) + 1);
  }
  const topAnchors: AnchorStat[] = [...anchorCounts.entries()]
    .map(([anchorText, count]) => ({ anchorText, count, share: total > 0 ? Number((count / total).toFixed(4)) : 0 }))
    .sort((left, right) => right.count - left.count || left.anchorText.localeCompare(right.anchorText))
    .slice(0, topLimit);

  const byTarget = new Map<string, { backlinks: number; domains: Set<string> }>();
  for (const link of backlinks) {
    let entry = byTarget.get(link.targetUrl);
    if (!entry) {
      entry = { backlinks: 0, domains: new Set<string>() };
      byTarget.set(link.targetUrl, entry);
    }
    entry.backlinks += 1;
    entry.domains.add(link.sourceDomain);
  }
  const topTargetUrls: TargetUrlStat[] = [...byTarget.entries()]
    .map(([targetUrl, entry]) => ({ targetUrl, backlinks: entry.backlinks, referringDomains: entry.domains.size }))
    .sort((left, right) => right.backlinks - left.backlinks || left.targetUrl.localeCompare(right.targetUrl))
    .slice(0, topLimit);

  return {
    totalBacklinks: total,
    referringDomains: referringDomains.length,
    followRatio: total > 0 ? Number((follow / total).toFixed(4)) : 0,
    topReferringDomains: referringDomains.slice(0, topLimit),
    topAnchors,
    topTargetUrls
  };
}
