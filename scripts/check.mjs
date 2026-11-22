#!/usr/bin/env node
/**
 * EduGlass LMS (Cloudflare Workers) — Syntax, Import, Manifest & Secret Verifier
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, ext = null) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.wrangler', '.git'].includes(entry.name)) continue;
      out.push(...walk(full, ext));
    } else if (!ext || full.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

let jsCount = 0;
for (const dir of [path.join(ROOT, 'worker', 'src'), path.join(ROOT, 'frontend', 'public', 'assets')]) {
  for (const f of walk(dir, '.js')) {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    const src = fs.readFileSync(f, 'utf-8');
    const rx = /from\s+['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = rx.exec(src)) !== null) {
      const target = path.resolve(path.dirname(f), m[1]);
      if (!fs.existsSync(target)) {
        throw new Error(`Broken import in ${path.relative(ROOT, f)}: ${m[1]}`);
      }
    }
    jsCount++;
  }
}
console.log(`[OK] Verified JS syntax & imports (${jsCount} files).`);

const manifests = walk(path.join(ROOT, 'modules'), 'manifest.json');
if (manifests.length !== 12) throw new Error(`Expected 12 module manifests, found ${manifests.length}`);
console.log(`[OK] Verified ${manifests.length} module manifests.`);

const secretPatterns = [/AKIA[0-9A-Z]{16}/, /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, /sk-[A-Za-z0-9]{32,}/];
for (const f of walk(ROOT)) {
  if (f.endsWith('.zip') || f.endsWith('.mp4')) continue;
  const txt = fs.readFileSync(f, 'utf-8');
  for (const rx of secretPatterns) {
    if (rx.test(txt)) throw new Error(`Potential secret leak in ${path.relative(ROOT, f)}`);
  }
}
console.log('[OK] Secret scan passed (0 leaks).');
