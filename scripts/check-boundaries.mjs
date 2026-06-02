import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files', '*.ts', '*.tsx'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const violations = [];
for (const file of files) {
  if (!file.startsWith('packages/')) continue;
  const text = readFileSync(file, 'utf8');
  const importMatches = text.matchAll(/from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g);
  for (const match of importMatches) {
    const specifier = match[1] ?? match[2];
    if (specifier?.startsWith('../../apps') || specifier?.startsWith('../apps') || specifier?.startsWith('../../services') || specifier?.startsWith('../services')) {
      violations.push(`${file} imports forbidden workspace path: ${specifier}`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('Workspace boundary check passed.');
