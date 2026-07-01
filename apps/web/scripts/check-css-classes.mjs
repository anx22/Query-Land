/**
 * className↔CSS consistency guard.
 *
 * Cross-checks every static `className` token used in the web app's TSX against
 * the class selectors actually defined in its CSS. A className with no matching
 * rule is invisible to TypeScript, ESLint, the build and the tests — so it
 * silently falls back to default block layout. This is the one check that
 * catches that class of "Unlogik".
 *
 * No dependencies. Resolves paths relative to this file, so it runs from any cwd.
 * Fails (exit 1) only on tokens that are neither defined in CSS nor in the
 * allowlist (apps/web/scripts/css-classes-allowlist.json) — intentionally
 * unstyled / dynamically-styled tokens live there with a reason.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(scriptDir, '..', 'src');
const allowlistPath = join(scriptDir, 'css-classes-allowlist.json');

/** Recursively collect files under `dir` matching one of `exts`. */
function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

const stripCssComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** All class names appearing in any CSS selector (comments removed). */
function collectDefined() {
  const defined = new Set();
  for (const file of walk(srcDir, ['.css'])) {
    const css = stripCssComments(readFileSync(file, 'utf8'));
    for (const m of css.matchAll(/\.([A-Za-z_][\w-]*)/g)) defined.add(m[1]);
  }
  return defined;
}

const CLASS_TOKEN = /^[a-z][a-z0-9_-]*$/; // static, class-like token

/** Read the JSX attribute value that follows `className=` at `from` (balanced braces or quoted). */
function readAttrValue(text, from) {
  let i = from;
  while (i < text.length && /\s/.test(text[i])) i++;
  const ch = text[i];
  if (ch === '{') {
    let depth = 0;
    const start = i;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
    }
    return text.slice(start);
  }
  if (ch === '"' || ch === "'" || ch === '`') {
    const start = i;
    for (i++; i < text.length; i++) if (text[i] === ch) return text.slice(start, i + 1);
  }
  return '';
}

/** All static className tokens used in TSX → Map(token → Set(files)). */
function collectUsed() {
  const used = new Map();
  for (const file of walk(srcDir, ['.tsx'])) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bclass(?:Name)?\s*=/g)) {
      const value = readAttrValue(text, m.index + m[0].length);
      // Pull every string/template literal out of the value; drop ${…} interpolations.
      for (const lit of value.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)) {
        const raw = (lit[1] ?? lit[2] ?? lit[3] ?? '').replace(/\$\{[^}]*\}/g, ' ');
        for (const tok of raw.split(/\s+/)) {
          if (!CLASS_TOKEN.test(tok)) continue;
          // A trailing '-' or '_' means a ${…} modifier was stripped from a
          // dynamic BEM class (e.g. `delta-chip--${dir}`) — the real class is
          // built at runtime, so the dangling prefix is not verifiable. Skip.
          if (tok.endsWith('-') || tok.endsWith('_')) continue;
          if (!used.has(tok)) used.set(tok, new Set());
          used.get(tok).add(file.slice(srcDir.length + 1));
        }
      }
    }
  }
  return used;
}

function loadAllowlist() {
  let raw = [];
  try {
    raw = JSON.parse(readFileSync(allowlistPath, 'utf8')).allow ?? [];
  } catch {
    raw = [];
  }
  const exact = new Set();
  const prefixes = [];
  for (const entry of raw) {
    if (entry.endsWith('*')) prefixes.push(entry.slice(0, -1));
    else exact.add(entry);
  }
  return (token) => exact.has(token) || prefixes.some((p) => token.startsWith(p));
}

const defined = collectDefined();
const used = collectUsed();
const allowed = loadAllowlist();

const offenders = [...used.keys()]
  .filter((t) => !defined.has(t) && !allowed(t))
  .sort();

if (offenders.length > 0) {
  console.error(`className↔CSS check: ${offenders.length} class(es) used in TSX with no CSS rule:\n`);
  for (const t of offenders) {
    console.error(`  .${t}  —  ${[...used.get(t)].sort().join(', ')}`);
  }
  console.error(
    '\nEither add a CSS rule, or (if the class is intentionally unstyled / styled inline)\n' +
      'add it to apps/web/scripts/css-classes-allowlist.json with a reason.'
  );
  process.exit(1);
}

console.log(`className↔CSS check passed (${defined.size} defined, ${used.size} used).`);
