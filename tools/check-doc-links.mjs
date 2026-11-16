#!/usr/bin/env node
/**
 * Checks the relative links in the repository's Markdown: every link to a
 * file or folder in this repository must point at something that exists.
 * Web links (http, https, mailto) and in-page anchors are not checked.
 *
 *   node tools/check-doc-links.mjs    # exits 1 and lists each broken link
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'site', '.claude', 'vendor']);
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

// The src/ folders of the generated document sets hold fragments whose links
// are written relative to the generated document one level up, so their
// links are checked there instead.
const GENERATED_SOURCES = new Set(['docs/apx-specification/src', 'docs/apds-submission/src']);

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      const repoPath = relative(ROOT, path).replaceAll('\\', '/');
      return SKIP_DIRS.has(name) || GENERATED_SOURCES.has(repoPath) ? [] : markdownFiles(path);
    }
    return name.endsWith('.md') ? [path] : [];
  });
}

// Links inside fenced code blocks are examples, not links.
const withoutCode = (text) => text.replace(/^```[\s\S]*?^```/gm, '');

function brokenLinks(file) {
  const broken = [];
  for (const [, target] of withoutCode(readFileSync(file, 'utf8')).matchAll(LINK)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
    const path = decodeURIComponent(target.split('#')[0]);
    if (!path) continue;
    const resolved = path.startsWith('/') ? join(ROOT, path) : resolve(dirname(file), path);
    if (!existsSync(resolved)) broken.push(target);
  }
  return broken;
}

const files = markdownFiles(ROOT);
const problems = files.flatMap((file) => brokenLinks(file).map((target) => `${relative(ROOT, file)}: ${target}`));
if (problems.length) {
  console.error(`[docs:links] ${problems.length} broken link(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`[docs:links] ${files.length} Markdown files, no broken relative links`);
