import type { SchoolSettings, Student } from './types';
import { calculateAge, formatDate } from './format';

export interface CardStudent {
  student: Student;
  className: string;
  armName: string;
  token?: string;
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));
const fullName = (s: Student) => [s.last_name, s.first_name, s.other_name].map((part) => (part ?? '').trim()).filter(Boolean).join(' ').toUpperCase();

/** "ABCD-EFGH-JKMN" style grouping so a printed token is easy to read and type. */
export function formatToken(token: string) {
  return token.replace(/(.{4})(?=.)/g, '$1-');
}

function openPrintWindow(title: string, css: string, body: string) {
  const win = window.open('', '_blank');
  if (!win) { alert('Your browser blocked the print window. Please allow pop-ups for this site and try again.'); return; }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    *{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#0f172a}
    @page{size:A4;margin:10mm}${css}</style></head><body>${body}</body></html>`);
  win.document.close();
  win.addEventListener('load', () => setTimeout(() => { win.focus(); win.print(); }, 400));
}

const cardCss = `
.grid{display:grid;grid-template-columns:repeat(2,85.6mm);gap:6mm;justify-content:center}
.card{width:85.6mm;height:54mm;border:0.4mm solid #1e3a8a;border-radius:3mm;overflow:hidden;position:relative;page-break-inside:avoid;background:#fff}
.head{background:#1e3a8a;color:#fff;padding:2mm 3mm;display:flex;align-items:center;gap:2mm;min-height:11mm}
.head img{height:8mm;width:8mm;object-fit:contain;background:#fff;border-radius:1.5mm;padding:0.5mm}
.head .n{font-size:8.5pt;font-weight:700;line-height:1.1;text-transform:uppercase}
.head .m{font-size:5.5pt;opacity:.85;font-style:italic}
.body{display:flex;gap:3mm;padding:2.5mm 3mm}
.photo{width:20mm;height:25mm;border:0.3mm solid #94a3b8;border-radius:1mm;object-fit:cover;background:#f1f5f9;flex:none;display:flex;align-items:center;justify-content:center;font-size:14pt;color:#64748b;font-weight:700}
.info{font-size:6.8pt;line-height:1.45;flex:1;min-width:0}
.info .name{font-size:8.5pt;font-weight:700;margin-bottom:1mm;color:#1e3a8a}
.info b{color:#475569;font-weight:600}
.foot{position:absolute;bottom:0;left:0;right:0;background:#eff6ff;border-top:0.3mm solid #bfdbfe;text-align:center;font-size:5.6pt;padding:1mm 2mm;color:#334155}
.title{position:absolute;right:3mm;bottom:8mm;font-size:6pt;font-weight:700;letter-spacing:.6px;color:#1e3a8a}
`;

/** Prints student identity cards (85.6mm x 54mm, two per row on A4). */
export function printCreditCards(items: CardStudent[], settings: SchoolSettings | null) {
  const school = escapeHtml(settings?.school_name ?? 'School');
  const logo = settings?.logo_url ? `<img src="${escapeHtml(settings.logo_url)}" alt="">` : '';
  const cards = items.map(({ student, className, armName }) => {
    const age = calculateAge(student.date_of_birth);
    const photo = student.photo_url
      ? `<img class="photo" src="${escapeHtml(student.photo_url)}" alt="">`
      : `<div class="photo">${escapeHtml((student.first_name || '?').charAt(0))}</div>`;
    return `<div class="card">
      <div class="head">${logo}<div><div class="n">${school}</div>${settings?.motto ? `<div class="m">${escapeHtml(settings.motto)}</div>` : ''}</div></div>
      <div class="body">${photo}<div class="info">
        <div class="name">${escapeHtml(fullName(student))}</div>
        <div><b>Student ID:</b> ${escapeHtml(student.student_id)}</div>
        <div><b>Class:</b> ${escapeHtml(className)}${armName ? ` (${escapeHtml(armName)})` : ''}</div>
        <div><b>Gender:</b> ${escapeHtml(student.gender ?? '—')}${age !== null ? ` &nbsp; <b>Age:</b> ${age}` : ''}</div>
        <div><b>D.O.B:</b> ${escapeHtml(formatDate(student.date_of_birth))}</div>
      </div></div>
      <div class="title">STUDENT ID CARD</div>
      <div class="foot">${escapeHtml(settings?.address ?? '')}${settings?.phone ? ` · ${escapeHtml(settings.phone)}` : ''}</div>
    </div>`;
  }).join('');
  openPrintWindow('Student ID Cards', cardCss, `<div class="grid">${cards}</div>`);
}

const slipCss = `
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5mm}
.slip{border:0.4mm dashed #475569;border-radius:2mm;padding:4mm;page-break-inside:avoid;min-height:52mm}
.slip .school{font-weight:700;font-size:10pt;text-transform:uppercase;color:#1e3a8a}
.slip .sub{font-size:7.5pt;color:#64748b;margin-bottom:2mm}
.slip .row{font-size:9pt;margin:1mm 0}
.slip .row b{display:inline-block;width:24mm;color:#475569;font-weight:600}
.token{font-family:'Courier New',monospace;font-size:14pt;font-weight:700;letter-spacing:1px;background:#f1f5f9;border:0.3mm solid #cbd5e1;border-radius:1.5mm;padding:1.5mm 2.5mm;display:inline-block;margin-top:1mm}
.how{font-size:7pt;color:#475569;margin-top:2mm;line-height:1.35}
`;

/** Prints result-checker slips: surname (username) + token for each student. */
export function printTokenSlips(items: CardStudent[], settings: SchoolSettings | null, checkerUrl: string) {
  const school = escapeHtml(settings?.school_name ?? 'School');
  const slips = items.filter((item) => item.token).map(({ student, className, armName, token }) => `<div class="slip">
    <div class="school">${school}</div><div class="sub">Online Result Checker</div>
    <div class="row"><b>Student:</b> ${escapeHtml(fullName(student))}</div>
    <div class="row"><b>Class:</b> ${escapeHtml(className)}${armName ? ` (${escapeHtml(armName)})` : ''}</div>
    <div class="row"><b>Username:</b> <span style="font-weight:700">${escapeHtml(student.last_name.toUpperCase())}</span> <span style="color:#64748b">(surname)</span></div>
    <div class="row"><b>Token:</b></div><div class="token">${escapeHtml(formatToken(token as string))}</div>
    <div class="how">Go to <b>${escapeHtml(checkerUrl)}</b>, enter the username and token above, then choose the session and term to view or print the result. Keep this token private.</div>
  </div>`).join('');
  openPrintWindow('Result Checker Tokens', slipCss, `<div class="grid">${slips}</div>`);
}
