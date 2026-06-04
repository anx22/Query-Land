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
    retry: input.retry
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
  let activeUserAgents: string[] = [];
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [rawDirective, ...rawValue] = line.split(":");
    const directive = rawDirective?.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (!directive) continue;

    if (directive === "user-agent") {
      activeUserAgents = [value.toLowerCase() || "*"];
      continue;
    }

    if ((directive === "allow" || directive === "disallow") && activeUserAgents.length > 0) {
      for (const userAgent of activeUserAgents) {
        rules.push({ userAgent, directive, path: value });
      }
    }
  }
  return rules;
}

export function isRobotsAllowed(candidateUrl: string, policy: RobotsPolicy, userAgent = "*"): boolean {
  const path = pathForRobots(candidateUrl);
  const matchingRules = policy.rules
    .filter((rule) => (rule.userAgent === "*" || rule.userAgent === userAgent.toLowerCase()) && rule.path !== "" && path.startsWith(rule.path))
    .sort((left, right) => right.path.length - left.path.length);
  const strongestRule = matchingRules[0];
  return strongestRule ? strongestRule.directive === "allow" : true;
}

function pathForRobots(candidateUrl: string): string {
  const url = new URL(candidateUrl);
  return `${url.pathname}${url.search}` || "/";
}
