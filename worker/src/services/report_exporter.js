/**
 * EduGlass LMS (Cloudflare Workers) — Zero-Dependency Real CSV, XLSX & PDF Exporter
 * Runs 100% natively in V8 Isolates without Node fs or native binaries.
 */

const enc = new TextEncoder();

const HEADERS = [
  ['full_name', 'Student Name'],
  ['classroom_name', 'Classroom'],
  ['sessions_count', 'Sessions'],
  ['study_minutes', 'Study Time (min)'],
  ['completed_lessons', 'Completed'],
  ['incomplete_lessons', 'Incomplete'],
  ['correct_answers', 'Correct'],
  ['wrong_answers', 'Wrong'],
  ['accuracy_pct', 'Accuracy (%)'],
];

function xmlEscape(val) {
  return String(val ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function exportCsv(rows) {
  const lines = [HEADERS.map(([, label]) => `"${label}"`).join(',')];
  for (const r of rows) {
    lines.push(HEADERS.map(([key]) => `"${String(r[key] ?? '').replaceAll('"', '""')}"`).join(','));
  }
  return enc.encode('\uFEFF' + lines.join('\r\n'));
}

// ── Minimal Valid Uncompressed ZIP Builder (Store Mode + CRC32) for Real .xlsx ──
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function buildZipStore(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, content } of entries) {
    const nameBytes = enc.encode(name);
    const dataBytes = typeof content === 'string' ? enc.encode(content) : content;
    const crc = crc32(dataBytes);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true); // store
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    localParts.push(local, dataBytes);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const totalLen = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

export function exportXlsx(rows) {
  const rowXml = [];
  const headerCells = HEADERS.map(([, label]) => `<c t="inlineStr"><is><t>${xmlEscape(label)}</t></is></c>`).join('');
  rowXml.push(`<row r="1">${headerCells}</row>`);

  rows.forEach((r, idx) => {
    const cells = HEADERS.map(([key]) => {
      const val = r[key];
      if (typeof val === 'number') return `<c><v>${val}</v></c>`;
      return `<c t="inlineStr"><is><t>${xmlEscape(val ?? '')}</t></is></c>`;
    }).join('');
    rowXml.push(`<row r="${idx + 2}">${cells}</row>`);
  });

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${rowXml.join('')}</sheetData>
</worksheet>`;

  return buildZipStore([
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Student Analytics" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml },
  ]);
}

function pdfEscape(str) {
  return String(str ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

export function exportPdf(rows) {
  const lines = [
    'EduGlass LMS - Student Analytics Report (Cloudflare Workers D1)',
    'Formula: Accuracy = Correct Answers / Total Answered Questions * 100%',
    '----------------------------------------------------------------------------------------------------',
    'Student | Classroom | Sessions | Study(m) | Done | Left | Correct | Wrong | Accuracy%',
  ];
  for (const r of rows.slice(0, 40)) {
    lines.push(
      `${r.full_name} | ${r.classroom_name} | ${r.sessions_count} | ${r.study_minutes} | ${r.completed_lessons} | ${r.incomplete_lessons} | ${r.correct_answers} | ${r.wrong_answers} | ${r.accuracy_pct}%`
    );
  }
  if (!rows.length) lines.push('No student analytics records found.');

  const textOps = lines.map((line, i) => `1 0 0 1 36 ${760 - i * 16} Tm (${pdfEscape(line)}) Tj`).join('\n');
  const stream = `BT\n/F1 10 Tf\n${textOps}\nET`;
  const objs = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objs) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return enc.encode(pdf);
}
