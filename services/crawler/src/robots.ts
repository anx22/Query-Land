import { DEFAULT_CRAWLER_USER_AGENT } from "./config.js";
import { fetchUrl } from "./fetch-url.js";
import type { FetchWorkerInput, RobotsPolicy, RobotsRule } from "./types.js";
import { normalizeCrawlUrl } from "./url-normalization.js";

export async function loadRobotsPolicy(input: Omit<FetchWorkerInput, "url"> & { baseUrl: string }): Promise<RobotsPolicy> {
  const robotsUrl = normalizeCrawlUrl("/robots.txt", input.baseUrl);
  const result = await fetchUrl({
    url: robotsUrl,
    fetchImpl: input.fetchImpl,
    fetchedAt: input.fetchedAt,
    timeoutMs: input.timeoutMs,
    retry: input.retry,
    userAgent: input.userAgent
  });

  const ok = !!result.statusCode && result.statusCode >= 200 && result.statusCode < 300;
  const parsed = ok ? parseRobots(result.responseBody ?? "") : { rules: [], crawlDelays: {}, sitemaps: [] };
  return {
    fetchedUrl: robotsUrl,
    rules: parsed.rules,
    crawlDelays: parsed.crawlDelays,
    // Resolve Sitemap: URLs against the robots.txt URL so relative entries work.
    sitemaps: parsed.sitemaps.map((sitemap) => safeResolve(sitemap, robotsUrl)).filter((sitemap): sitemap is string => sitemap !== null)
  };
}

interface ParsedRobots {
  rules: RobotsRule[];
  /** Crawl-delay (seconds) per user-agent token (lowercased). */
  crawlDelays: Record<string, number>;
  /** Raw Sitemap: values (resolved/absolutized by the caller). */
  sitemaps: string[];
}

/**
 * Parse robots.txt into rules + per-agent crawl-delay + sitemap declarations.
 * Consecutive `User-agent:` lines form one group that shares the following rules
 * (standard semantics); the first allow/disallow/crawl-delay after a group's
 * agent lines "starts" the group, and the next agent line begins a fresh one.
 */
function parseRobots(robotsTxt: string): ParsedRobots {
  const rules: RobotsRule[] = [];
  const crawlDelays: Record<string, number> = {};
  const sitemaps: string[] = [];
  let activeUserAgents: string[] = [];
  let groupHasRules = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const directive = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!directive) continue;

    // Sitemap is a non-group directive — valid anywhere in the file.
    if (directive === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }

    if (directive === "user-agent") {
      if (groupHasRules) {
        activeUserAgents = [];
        groupHasRules = false;
      }
      activeUserAgents.push(value.toLowerCase() || "*");
      continue;
    }

    if (directive === "crawl-delay" && activeUserAgents.length > 0) {
      const seconds = Number(value.replace(",", "."));
      if (Number.isFinite(seconds) && seconds >= 0) {
        for (const userAgent of activeUserAgents) crawlDelays[userAgent] = seconds;
      }
      groupHasRules = true;
      continue;
    }

    if ((directive === "allow" || directive === "disallow") && activeUserAgents.length > 0) {
      groupHasRules = true;
      for (const userAgent of activeUserAgents) {
        rules.push({ userAgent, directive, path: value });
      }
    }
  }
  return { rules, crawlDelays, sitemaps };
}

/** Backwards-compatible: just the allow/disallow rules. */
export function parseRobotsTxt(robotsTxt: string): RobotsRule[] {
  return parseRobots(robotsTxt).rules;
}

export function isRobotsAllowed(candidateUrl: string, policy: RobotsPolicy, userAgent = DEFAULT_CRAWLER_USER_AGENT): boolean {
  const path = pathForRobots(candidateUrl);
  const group = selectRobotsGroup(policy.rules.map((rule) => rule.userAgent), userAgent);
  const matchingRules = policy.rules
    .filter((rule) => rule.userAgent === group && rule.path !== "" && robotsPathMatches(rule.path, path))
    // Most specific (longest pattern) wins; on a tie, Allow beats Disallow (Google semantics).
    .sort((left, right) => right.path.length - left.path.length || directiveRank(left.directive) - directiveRank(right.directive));
  const strongestRule = matchingRules[0];
  return strongestRule ? strongestRule.directive === "allow" : true;
}

/** Crawl-delay (seconds) for our user-agent's group, or null when none applies. */
export function robotsCrawlDelaySeconds(policy: RobotsPolicy, userAgent = DEFAULT_CRAWLER_USER_AGENT): number | null {
  const delays = policy.crawlDelays;
  if (!delays) return null;
  const group = selectRobotsGroup(Object.keys(delays), userAgent);
  const value = delays[group] ?? delays["*"];
  return typeof value === "number" ? value : null;
}

function directiveRank(directive: RobotsRule["directive"]): number {
  return directive === "allow" ? 0 : 1;
}

/**
 * Match a robots.txt path pattern against a request path. Supports `*` (any
 * sequence) and a trailing `$` (end-of-path anchor); a pattern without
 * wildcards is a prefix match (standard robots semantics).
 */
function robotsPathMatches(pattern: string, path: string): boolean {
  if (pattern === "") return false;
  if (!pattern.includes("*") && !pattern.includes("$")) {
    return path.startsWith(pattern);
  }
  const anchored = pattern.endsWith("$");
  const core = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = core.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  try {
    return new RegExp(`^${escaped}${anchored ? "$" : ""}`).test(path);
  } catch {
    // A pathological pattern degrades to a plain prefix check rather than crashing.
    return path.startsWith(core.replace(/\*/g, ""));
  }
}

/**
 * Selects the group whose user-agent token is the most specific (longest)
 * case-insensitive prefix of our crawler's user-agent, falling back to `*`.
 */
function selectRobotsGroup(agents: Iterable<string>, userAgent: string): string {
  const ua = userAgent.toLowerCase();
  let best: string | null = null;
  for (const agent of agents) {
    if (agent === "*") continue;
    if (ua.startsWith(agent) && (best === null || agent.length > best.length)) {
      best = agent;
    }
  }
  return best ?? "*";
}

function pathForRobots(candidateUrl: string): string {
  const url = new URL(candidateUrl);
  return `${url.pathname}${url.search}` || "/";
}

function safeResolve(rawUrl: string, baseUrl: string): string | null {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return null;
  }
}
