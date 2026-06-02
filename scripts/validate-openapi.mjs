import { readFileSync } from 'node:fs';

const path = 'DOCS/openapi/internal-api.yaml';
const text = readFileSync(path, 'utf8');
const requiredSections = ['openapi:', 'info:', 'paths:', 'components:', 'schemas:'];
const missing = requiredSections.filter((section) => !text.includes(section));
if (missing.length > 0) {
  console.error(`OpenAPI file is missing required sections: ${missing.join(', ')}`);
  process.exit(1);
}

const refs = [...text.matchAll(/\$ref:\s*['"]?#\/components\/schemas\/([^'"\n]+)['"]?/g)].map((match) => match[1].trim());
const missingSchemas = refs.filter((schema) => !new RegExp(`^\\s{4}${schema}:`, 'm').test(text));
if (missingSchemas.length > 0) {
  console.error(`OpenAPI schema refs not found: ${[...new Set(missingSchemas)].join(', ')}`);
  process.exit(1);
}

for (const endpoint of ['/health', '/auth/register', '/auth/login', '/auth/logout', '/auth/session', '/projects', '/integrations', '/jobs', '/source-map']) {
  if (!text.includes(`  ${endpoint}:`)) {
    console.error(`OpenAPI path not found: ${endpoint}`);
    process.exit(1);
  }
}

console.log('OpenAPI structural validation passed.');
