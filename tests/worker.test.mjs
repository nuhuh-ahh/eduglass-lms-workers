/**
 * Automated Node.js Test Suite for EduGlass LMS Cloudflare Workers Edition
 */
import test from 'node:test';
import assert from 'node:assert/strict';

if (!globalThis.crypto) {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto;
}

import worker from '../worker/src/index.js';
import {
  createAccessToken,
  decodeAccessToken,
  hashPassword,
  sanitizeText,
  verifyPassword,
} from '../worker/src/core/security.js';
import {
  computeTotalWatched,
  computeVerifiedFrontier,
  mergeIntervals,
} from '../worker/src/services/anti_skip.js';
import { computeAccuracyPct, gradeQuestion } from '../worker/src/services/grading.js';
import { exportCsv, exportPdf, exportXlsx } from '../worker/src/services/report_exporter.js';
import { MODULE_MANIFESTS } from '../worker/src/services/module_manager.js';

test('Web Crypto PBKDF2-SHA256 password hashing & verification', async () => {
  const hash = await hashPassword('EduGlass@2026');
  assert.ok(hash.startsWith('pbkdf2_sha256$100000$'));
  assert.equal(await verifyPassword('EduGlass@2026', hash), true);
  assert.equal(await verifyPassword('WrongPass', hash), false);
});

test('Web Crypto HS256 JWT sign, verify, and tamper rejection', async () => {
  const secret = 'test-secret-key-at-least-32-chars-long';
  const { token } = await createAccessToken(secret, 'usr_42', 'teacher', 'jti_99');
  const payload = await decodeAccessToken(secret, token);
  assert.equal(payload.sub, 'usr_42');
  assert.equal(payload.role, 'teacher');
  assert.equal(await decodeAccessToken(secret, token.slice(0, -4) + 'AAAA'), null);
});

test('XSS sanitization strips raw HTML tags', () => {
  const out = sanitizeText('<script>alert(1)</script>Học sinh');
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('Học sinh'));
});

test('Anti-Skip interval merging & verified frontier calculation', () => {
  const merged = mergeIntervals([[0, 5], [4.5, 10], [10.4, 14], [25, 30]]);
  assert.deepEqual(merged, [[0, 14], [25, 30]]);
  assert.equal(computeVerifiedFrontier(merged), 14);
  assert.equal(computeTotalWatched(merged), 19);
  assert.equal(computeVerifiedFrontier([[15, 20]]), 0);
});

test('6-type Grading Engine & exact Accuracy formula', () => {
  assert.equal(gradeQuestion('multiple_choice', 'x = 2', 'x = 2', 2).isCorrect, true);
  assert.equal(gradeQuestion('true_false', 'Đúng', 'Sai', 2).isCorrect, false);
  assert.equal(gradeQuestion('multiple_select', ['A', 'B'], ['b', 'a'], 3).isCorrect, true);
  assert.equal(gradeQuestion('fill_blank', ['4', 'y=4'], '4', 2).isCorrect, true);
  assert.equal(gradeQuestion('matching', { '1': 'A', '2': 'B' }, { '1': 'A', '2': 'B' }, 4).isCorrect, true);
  assert.equal(gradeQuestion('short_answer', null, 'Bài tự luận', 5).requiresManual, true);
  assert.equal(computeAccuracyPct(3, 4), 75);
  assert.equal(computeAccuracyPct(0, 0), 0);
});

test('Zero-dependency pure-JS CSV, XLSX (ZIP OpenXML), and PDF exporters', () => {
  const sample = [{
    full_name: 'Phạm Gia Bảo',
    classroom_name: 'Toán 10A1',
    sessions_count: 3,
    study_minutes: 15.5,
    completed_lessons: 2,
    incomplete_lessons: 1,
    correct_answers: 4,
    wrong_answers: 1,
    accuracy_pct: 80,
  }];
  const csv = new TextDecoder().decode(exportCsv(sample));
  assert.ok(csv.includes('Student Name') && csv.includes('Phạm Gia Bảo'));

  const xlsx = exportXlsx(sample);
  assert.equal(xlsx[0], 0x50); // 'P'
  assert.equal(xlsx[1], 0x4B); // 'K' (valid ZIP magic bytes)

  const pdf = new TextDecoder().decode(exportPdf(sample));
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.includes('%%EOF'));
});

test('12 module manifests & Worker /api/health endpoint', async () => {
  assert.equal(MODULE_MANIFESTS.length, 12);
  const res = await worker.fetch(new Request('https://eduglass.workers.dev/api/health'), {}, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.match(body.runtime, /Cloudflare Workers/);
});
