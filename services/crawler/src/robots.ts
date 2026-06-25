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

  return {
    fetchedUrl: robotsUrl,
    rules: result.statusCode && result.statusCode >= 200 && result.statusCode < 300
      ? parseRobotsTxt(result.responseBody ?? "")
      : []
  };
}

export function parseRobotsTxt(robotsTxt: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  // Consecutive `User-agent:` lines form a single group that shares the rules
  // that follow (standard robots.txt semantics). We keep accumulating agents
  // until the first allow/disallow line, then a new agent line starts a fresh
  // group.
  let activeUserAgents: string[] = [];
  let groupHasRules = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [rawDirective, ...rawValue] = line.split(":");
    const directive = rawDirective?.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (!directive) continue;

    if (directive === "user-agent") {
      // An agent line after rules begins a new group; reset the accumulator.
      if (groupHasRules) {
        activeUserAgents = [];
        groupHasRules = false;
      }
      activeUserAgents.push(value.toLowerCase() || "*");
      continue;
    }

    if ((directive === "allow" || directive === "disallow") && activeUserAgents.length > 0) {
      groupHasRules = true;
      for (const userAgent of activeUserAgents) {
        rules.push({ userAgent, directive, path: value });
      }
    }
  }
  return rules;
}

export function isRobotsAllowed(candidateUrl: string, policy: RobotsPolicy, userAgent = DEFAULT_CRAWLER_USER_AGENT): boolean {
  const path = pathForRobots(candidateUrl);
  const group = selectRobotsGroup(policy.rules, userAgent);
  const matchingRules = policy.rules
    .filter((rule) => rule.userAgent === group && rule.path !== "" && path.startsWith(rule.path))
    .sort((left, right) => right.path.length - left.path.length);
  const strongestRule = matchingRules[0];
  return strongestRule ? strongestRule.directive === "allow" : true;
}

/**
 * Selects the robots group whose user-agent token is the most specific (longest)
 * case-insensitive prefix of our crawler's user-agent, falling back to `*`.
 * Returns `*` if neither a specific match nor a wildcard group exists (which
 * means no rules apply).
 */
function selectRobotsGroup(rules: RobotsRule[], userAgent: string): string {
  const ua = userAgent.toLowerCase();
  const agents = new Set(rules.map((rule) => rule.userAgent));
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
