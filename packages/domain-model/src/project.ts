import { DomainValidationError } from "./errors.js";

export type ProjectStatus = "draft" | "active" | "archived";
export type SiteScopeType = "domain" | "subdomain" | "folder";
export type MappingConfidence = "exact" | "manifest" | "heuristic" | "unknown";

export interface Market {
  country: string;
  language: string;
  device: "desktop" | "mobile";
  searchEngine: "google" | "bing";
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  defaultLocale: string;
  markets: Market[];
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  id: string;
  projectId: string;
  scopeType: SiteScopeType;
  baseUrl: string;
  crawlFrequency: "manual" | "daily" | "weekly";
  businessValue: number;
}

export interface SourceMapEntry {
  id: string;
  projectId: string;
  urlPattern: string;
  template: string;
  component: string;
  repoPath: string;
  confidence: MappingConfidence;
}

export function validateBusinessValue(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new DomainValidationError("businessValue must be an integer between 1 and 100");
  }
  return value;
}
