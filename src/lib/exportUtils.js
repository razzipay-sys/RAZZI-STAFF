import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import logoUrl from '@/assets/logo.jpeg';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  WidthType, TextRun, HeadingLevel, ShadingType,
} from 'docx';

let logoDataUrlCache = null;

const toDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Failed to read image'));
  reader.readAsDataURL(blob);
});

const getLogoDataUrl = async () => {
  if (logoDataUrlCache) return logoDataUrlCache;
  const response = await fetch(logoUrl);
  const blob = await response.blob();
  const dataUrl = await toDataUrl(blob);
  logoDataUrlCache = dataUrl;
  return dataUrl;
};

const getRemoteImageDataUrl = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();
  return toDataUrl(blob);
};

export const exportToCSV = (data, filename) => {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const val = row[header] === null || row[header] === undefined ? '' : row[header];
      return `"${val.toString().replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = async (data, options = {}) => {
  const {
    title = 'RazziStaff Report',
    headers = [],
    filename = 'report',
    companyName = 'RazziPay',
    appName = 'RazziStaff',
    subtitle = 'Internal Ops Platform',
  } = options;

  const doc = new jsPDF();
  let logoDataUrl = null;
  try { logoDataUrl = await getLogoDataUrl(); } catch { logoDataUrl = null; }

  const primary = [32, 178, 170];
  const headerHeight = 30;
  const tableHeaders = headers.length ? headers : Object.keys(data[0] || {});
  const tableData = (data || []).map(row => tableHeaders.map(h => row?.[h] ?? ''));

  const drawHeader = () => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 14;
    const top = 12;
    if (logoDataUrl) doc.addImage(logoDataUrl, 'JPEG', left, top - 4, 14, 14);
    doc.setFontSize(14);
    doc.setTextColor(...primary);
    doc.text(appName, left + 18, top + 2);
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`${companyName} • ${subtitle}`, left + 18, top + 8);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, top + 8, { align: 'right' });
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.6);
    doc.line(left, headerHeight, pageWidth - 14, headerHeight);
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(title, left, headerHeight + 10);
  };

  doc.autoTable({
    startY: headerHeight + 14,
    head: [tableHeaders.map(h => h.replace(/_/g, ' ').toUpperCase())],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: primary },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      drawHeader();
      const pageCount = doc.getNumberOfPages();
      const page = doc.internal.getCurrentPageInfo().pageNumber;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(`${appName} • ${companyName}`, 14, pageHeight - 10);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
    },
  });

  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ─── ID Card – Front ──────────────────────────────────────────────────────────

const ROLE_BADGE_COLORS = {
  super_admin:   [139, 92, 246],
  admin:         [59, 130, 246],
  hr_admin:      [236, 72, 153],
  finance_admin: [245, 158, 11],
  manager:       [16, 185, 129],
  user:          [100, 116, 139],
};

const drawIDCardFront = ({ doc, staff, logoDataUrl, companyName, appName, photoDataUrl }) => {
  const W = 86;
  const H = 54;

  const navy     = [15, 23, 42];
  const teal     = [32, 178, 170];
  const tealSoft = [226, 248, 246];
  const tealMid  = [178, 228, 226];
  const white    = [255, 255, 255];
  const textMain = [15, 23, 42];
  const textSub  = [100, 116, 139];
  const border   = [214, 226, 231];

  const fullName  = (staff?.full_name || 'N/A').toString();
  const role      = (staff?.role || 'Staff').toString();
  const dept      = (staff?.department || 'N/A').toString();
  const email     = (staff?.email || '').toString();
  const empNo     = staff?.id
    ? staff.id.replace(/-/g, '').slice(0, 10).toUpperCase()
    : '----------';
  const roleKey   = role.toLowerCase().replace(/\s+/g, '_');
  const badgeRgb  = ROLE_BADGE_COLORS[roleKey] || teal;
  const roleLabel = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // ── Card background ──────────────────────────────────────────────
  doc.setFillColor(248, 251, 253);
  doc.roundedRect(0, 0, W, H, 4, 4, 'F');

  // Soft geometric circles (top-right accent)
  doc.setFillColor(...tealSoft);
  doc.circle(W + 2, -2, 26, 'F');
  doc.setFillColor(237, 250, 249);
  doc.circle(W + 6, 10, 17, 'F');

  // ── Header strip (navy) ──────────────────────────────────────────
  doc.setFillColor(...navy);
  doc.roundedRect(0, 0, W, 14, 4, 4, 'F');
  doc.rect(0, 10, W, 4, 'F'); // flatten bottom rounded corners

  // Teal accent line
  doc.setFillColor(...teal);
  doc.rect(0, 14, W, 1.4, 'F');

  // Logo
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'JPEG', 4, 3, 8, 8);
  }

  // App name
  doc.setTextColor(...white);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(appName, 14.5, 9.5);

  // "STAFF ID" chip top-right
  doc.setFillColor(...teal);
  doc.roundedRect(W - 22, 4, 18, 5.5, 2, 2, 'F');
  doc.setTextColor(...white);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('STAFF  ID', W - 13, 7.8, { align: 'center' });

  // ── Photo area ───────────────────────────────────────────────────
  const px = 4, py = 18, pw = 20, ph = 20;
  if (photoDataUrl) {
    doc.setFillColor(...white);
    doc.setDrawColor(...tealMid);
    doc.setLineWidth(0.7);
    doc.roundedRect(px, py, pw, ph, 3, 3, 'FD');
    const imgType = photoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    doc.addImage(photoDataUrl, imgType, px + 0.8, py + 0.8, pw - 1.6, ph - 1.6);
  } else {
    const initials = fullName.split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '??';
    doc.setFillColor(...teal);
    doc.roundedRect(px, py, pw, ph, 3, 3, 'F');
    doc.setDrawColor(...tealMid);
    doc.setLineWidth(0.7);
    doc.roundedRect(px, py, pw, ph, 3, 3, 'S');
    doc.setTextColor(...white);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(initials, px + pw / 2, py + ph / 2 + 2.8, { align: 'center' });
  }

  // ── Name & metadata ──────────────────────────────────────────────
  const tx = 27.5;

  doc.setTextColor(...textMain);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  const dispName = fullName.length > 22 ? fullName.slice(0, 21) + '…' : fullName;
  doc.text(dispName, tx, 23);

  // Role badge
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  const dispRole = roleLabel.length > 18 ? roleLabel.slice(0, 17) + '…' : roleLabel;
  const bw = Math.min(doc.getTextWidth(dispRole) + 9, W - tx - 4);
  doc.setFillColor(...badgeRgb);
  doc.roundedRect(tx, 25, bw, 5.5, 2, 2, 'F');
  doc.setTextColor(...white);
  doc.text(dispRole, tx + bw / 2, 28.8, { align: 'center' });

  // Department
  doc.setTextColor(...textSub);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const dispDept = dept.length > 28 ? dept.slice(0, 27) + '…' : dept;
  doc.text(dispDept, tx, 33.5);

  // Email
  doc.setFontSize(7.5);
  const dispEmail = email.length > 30 ? email.slice(0, 29) + '…' : email;
  doc.text(dispEmail, tx, 37.5);

  // ── Divider ──────────────────────────────────────────────────────
  doc.setDrawColor(...border);
  doc.setLineWidth(0.3);
  doc.line(4, 42.5, W - 4, 42.5);

  // ── Footer ───────────────────────────────────────────────────────
  doc.setTextColor(...textSub);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('EMP NO.', 4, 46.5);

  doc.setTextColor(...textMain);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text(empNo, 4, 50.5);

  // Holographic verification strip
  const hx = 46, hy = 43.5, hw = 35, hh = 9.5;
  doc.setFillColor(232, 248, 247);
  doc.roundedRect(hx, hy, hw, hh, 2, 2, 'F');

  const shimColors = [
    [32, 178, 170], [59, 130, 246], [139, 92, 246],
    [236, 72, 153], [245, 158, 11], [16, 185, 129],
  ];
  for (let i = 0; i < 18; i++) {
    const lx = hx + (i / 18) * hw;
    const [r, g, b] = shimColors[i % shimColors.length];
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.45);
    doc.line(lx, hy, lx + 2.5, hy + hh);
  }

  doc.setDrawColor(...tealMid);
  doc.setLineWidth(0.3);
  doc.roundedRect(hx, hy, hw, hh, 2, 2, 'S');

  doc.setTextColor(60, 90, 100);
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.text('VERIFIED', hx + hw / 2, hy + hh / 2 + 1, { align: 'center' });

  // ── Card border ──────────────────────────────────────────────────
  doc.setDrawColor(...border);
  doc.setLineWidth(0.5);
  doc.roundedRect(0.3, 0.3, W - 0.6, H - 0.6, 4, 4, 'S');
};

// ─── ID Card – Back ───────────────────────────────────────────────────────────

const drawIDCardBack = ({ doc, staff, logoDataUrl, companyName, appName }) => {
  const W = 86;
  const H = 54;

  const navy    = [15, 23, 42];
  const teal    = [32, 178, 170];
  const white   = [255, 255, 255];
  const textSub = [148, 163, 184];
  const gridLine = [20, 32, 52];

  // Dark background
  doc.setFillColor(...navy);
  doc.roundedRect(0, 0, W, H, 4, 4, 'F');

  // Subtle grid pattern
  doc.setDrawColor(...gridLine);
  doc.setLineWidth(0.12);
  for (let x = 0; x <= W + 6; x += 6) doc.line(x, 0, x, H);
  for (let y = 0; y <= H + 6; y += 6) doc.line(0, y, W, y);

  // Magnetic stripe
  doc.setFillColor(5, 8, 15);
  doc.rect(0, 2.5, W, 8.5, 'F');
  for (let i = 0; i < 7; i++) {
    doc.setDrawColor(22, 35, 55);
    doc.setLineWidth(0.5);
    doc.line(i * 13, 2.5, i * 13, 11);
  }

  // Teal accent line below stripe
  doc.setFillColor(...teal);
  doc.rect(0, 11, W, 0.8, 'F');

  // Logo
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'JPEG', W / 2 - 4, 14, 8, 8);
  }

  // App name
  doc.setTextColor(...teal);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(appName, W / 2, 28, { align: 'center' });

  // Company name
  doc.setTextColor(...textSub);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(companyName.toUpperCase(), W / 2, 32.5, { align: 'center' });

  // Divider
  doc.setDrawColor(30, 50, 72);
  doc.setLineWidth(0.3);
  doc.line(8, 35, W - 8, 35);

  // Return instruction
  doc.setTextColor(...textSub);
  doc.setFontSize(6.5);
  doc.text(`This card is the property of ${companyName}.`, W / 2, 38.5, { align: 'center' });
  doc.text('If found, please return to the HR Department.', W / 2, 42, { align: 'center' });

  // Serial number
  const serial = staff?.id
    ? 'SN: ' + staff.id.replace(/-/g, '').slice(0, 16).toUpperCase()
    : '';
  doc.setTextColor(40, 65, 85);
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(serial, W / 2, 48, { align: 'center' });

  // Card border (teal)
  doc.setDrawColor(...teal);
  doc.setLineWidth(0.5);
  doc.roundedRect(0.3, 0.3, W - 0.6, H - 0.6, 4, 4, 'S');
};

// ─── Public export functions ──────────────────────────────────────────────────

export const exportIDCardToPDF = async (staff, options = {}) => {
  const {
    companyName = 'RazziPay',
    appName = 'RazziStaff',
    filename,
    includeBack = true,
  } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [86, 54] });

  let logoDataUrl = null;
  try { logoDataUrl = await getLogoDataUrl(); } catch { logoDataUrl = null; }

  let photoDataUrl = null;
  if (staff?.profile_photo_url) {
    try { photoDataUrl = await getRemoteImageDataUrl(staff.profile_photo_url); } catch { photoDataUrl = null; }
  }

  drawIDCardFront({ doc, staff, logoDataUrl, companyName, appName, photoDataUrl });

  if (includeBack) {
    doc.addPage([86, 54], 'landscape');
    drawIDCardBack({ doc, staff, logoDataUrl, companyName, appName });
  }

  const safeName = (staff?.full_name || 'Staff').replace(/\s+/g, '_');
  doc.save(`${filename || `ID_Card_${safeName}`}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportIDCardsToPDF = async (staffList, options = {}) => {
  const list = Array.isArray(staffList) ? staffList : [];
  if (list.length === 0) return;

  const {
    filename = 'ID_Cards',
    companyName = 'RazziPay',
    appName = 'RazziStaff',
    includeBack = true,
  } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [86, 54] });

  let logoDataUrl = null;
  try { logoDataUrl = await getLogoDataUrl(); } catch { logoDataUrl = null; }

  for (let i = 0; i < list.length; i++) {
    if (i > 0) doc.addPage([86, 54], 'landscape');
    const staff = list[i];
    let photoDataUrl = null;
    if (staff?.profile_photo_url) {
      try { photoDataUrl = await getRemoteImageDataUrl(staff.profile_photo_url); } catch { photoDataUrl = null; }
    }
    drawIDCardFront({ doc, staff, logoDataUrl, companyName, appName, photoDataUrl });

    if (includeBack) {
      doc.addPage([86, 54], 'landscape');
      drawIDCardBack({ doc, staff, logoDataUrl, companyName, appName });
    }
  }

  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ─── Single Workflow Report Export ───────────────────────────────────────────

export const exportSingleReportToPDF = async (report, options = {}) => {
  const { companyName = 'RazziPay', appName = 'RazziStaff' } = options;

  const doc = new jsPDF();
  let logoDataUrl = null;
  try { logoDataUrl = await getLogoDataUrl(); } catch { logoDataUrl = null; }

  const primary = [32, 178, 170];
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  if (logoDataUrl) doc.addImage(logoDataUrl, 'JPEG', 14, 8, 12, 12);
  doc.setFontSize(13); doc.setTextColor(...primary); doc.setFont('helvetica', 'bold');
  doc.text(appName, 30, 13);
  doc.setFontSize(8); doc.setTextColor(90); doc.setFont('helvetica', 'normal');
  doc.text(`${companyName} • Daily Workflow Report`, 30, 19);
  doc.setFontSize(7); doc.setTextColor(130);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 14, 19, { align: 'right' });
  doc.setDrawColor(...primary); doc.setLineWidth(0.6);
  doc.line(14, 24, pageW - 14, 24);

  // Title
  doc.setFontSize(15); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold');
  doc.text(report.staff_name || 'Staff Report', 14, 33);
  doc.setFontSize(9); doc.setTextColor(100); doc.setFont('helvetica', 'normal');
  const meta = [
    report.report_date,
    report.department,
    report.work_mode_for_day,
    report.hours_worked ? `${report.hours_worked}h` : null,
  ].filter(Boolean).join('  •  ');
  doc.text(meta, 14, 39);

  // Status chips (text)
  let chipX = 14;
  const chipY = 46;
  const chips = [
    { label: report.status, color: [32, 178, 170] },
    { label: report.review_status, color: [59, 130, 246] },
    { label: report.priority, color: [245, 158, 11] },
  ].filter(c => c.label);
  chips.forEach(({ label, color }) => {
    doc.setFillColor(...color);
    const w = doc.getTextWidth(label) + 6;
    doc.roundedRect(chipX, chipY - 3.5, w, 5, 1.5, 1.5, 'F');
    doc.setTextColor(255); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text(label, chipX + w / 2, chipY, { align: 'center' });
    chipX += w + 3;
  });

  let y = 58;
  const checkPage = () => { if (y > 265) { doc.addPage(); y = 20; } };

  const section = (title, content) => {
    if (!content) return;
    checkPage();
    doc.setFontSize(7.5); doc.setTextColor(100); doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), 14, y);
    y += 4;
    doc.setDrawColor(220); doc.setLineWidth(0.2); doc.line(14, y, pageW - 14, y);
    y += 4;
    doc.setFontSize(9); doc.setTextColor(30); doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(content), pageW - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 6;
    checkPage();
  };

  section('Task Assigned', report.assigned_task);
  section('Work Done', report.work_done);
  section('Blockers / Challenges', report.blockers);
  section('Plan for Tomorrow', report.next_action);

  if (report.clock_in_time || report.clock_out_time) {
    section('Time', [
      report.clock_in_time ? `Clock In: ${report.clock_in_time}` : '',
      report.clock_out_time ? `Clock Out: ${report.clock_out_time}` : '',
    ].filter(Boolean).join('   '));
  }

  if (report.proof_link) section('Proof Link', report.proof_link);

  if (report.supervisor_name) {
    checkPage();
    doc.setFontSize(7.5); doc.setTextColor(100); doc.setFont('helvetica', 'bold');
    doc.text('SUPERVISOR REVIEW', 14, y); y += 4;
    doc.setDrawColor(220); doc.setLineWidth(0.2); doc.line(14, y, pageW - 14, y); y += 4;
    doc.setFontSize(9); doc.setTextColor(30); doc.setFont('helvetica', 'normal');
    doc.text(`Reviewed by: ${report.supervisor_name}`, 14, y); y += 6;
    if (report.supervisor_comment) {
      const lines = doc.splitTextToSize(report.supervisor_comment, pageW - 28);
      doc.text(lines, 14, y); y += lines.length * 5 + 4;
    }
  }

  // Evidence image
  if (report.evidence_url) {
    try {
      const imgData = await getRemoteImageDataUrl(report.evidence_url);
      checkPage();
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(7.5); doc.setTextColor(100); doc.setFont('helvetica', 'bold');
      doc.text('EVIDENCE IMAGE', 14, y); y += 4;
      doc.setDrawColor(220); doc.setLineWidth(0.2); doc.line(14, y, pageW - 14, y); y += 4;
      const imgW = pageW - 28;
      const imgH = 65;
      doc.addImage(imgData, 'JPEG', 14, y, imgW, imgH);
      y += imgH + 6;
    } catch { /* skip if image unavailable */ }
  }

  // Footer
  doc.setFontSize(7); doc.setTextColor(160);
  doc.text(`${appName} • ${companyName}`, 14, doc.internal.pageSize.getHeight() - 8);

  const safeName = (report.staff_name || 'Report').replace(/\s+/g, '_');
  const dateStr = report.report_date || new Date().toISOString().split('T')[0];
  doc.save(`Report_${safeName}_${dateStr}.pdf`);
};

export const exportSingleReportToDocx = async (report, options = {}) => {
  const { companyName = 'RazziPay', appName = 'RazziStaff' } = options;
  const primary = '20B2AA';

  const field = (label, value) => {
    if (!value) return null;
    return new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 20, color: '444444' }),
        new TextRun({ text: String(value), size: 20 }),
      ],
      spacing: { after: 80 },
    });
  };

  const heading = (text) => new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: primary })],
    spacing: { before: 200, after: 80 },
    border: { bottom: { color: 'DDDDDD', size: 4, space: 4, style: 'single' } },
  });

  const sections = [
    new Paragraph({
      children: [
        new TextRun({ text: appName, bold: true, size: 40, color: primary }),
        new TextRun({ text: `  |  ${companyName}`, size: 24, color: '888888' }),
      ],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 16, color: 'AAAAAA' })],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: `Daily Workflow Report`, bold: true, color: '1A1A2E' })],
    }),
    new Paragraph({ text: '' }),
    field('Staff', report.staff_name),
    field('Department', report.department),
    field('Report Date', report.report_date),
    field('Work Mode', report.work_mode_for_day),
    field('Hours Worked', report.hours_worked ? `${report.hours_worked}h` : null),
    field('Clock In', report.clock_in_time),
    field('Clock Out', report.clock_out_time),
    field('Priority', report.priority),
    field('Status', report.status),
    field('Review Status', report.review_status),
    field('Compliance Status', report.compliance_status),
    new Paragraph({ text: '' }),
    heading('Task & Work'),
    field('Task Assigned', report.assigned_task),
    field('Work Done', report.work_done),
    heading('Blockers & Next Steps'),
    field('Blockers / Challenges', report.blockers || 'None'),
    field('Plan for Tomorrow', report.next_action),
    report.proof_link ? heading('Proof Link') : null,
    field('Proof Link', report.proof_link),
    report.supervisor_name ? heading('Supervisor Review') : null,
    field('Reviewed By', report.supervisor_name),
    field('Supervisor Comment', report.supervisor_comment),
    report.evidence_url ? heading('Evidence') : null,
    report.evidence_url ? new Paragraph({
      children: [new TextRun({ text: `Evidence image: ${report.evidence_url}`, size: 18, color: primary })],
    }) : null,
  ].filter(Boolean);

  const doc = new Document({ sections: [{ children: sections }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = (report.staff_name || 'Report').replace(/\s+/g, '_');
  const dateStr = report.report_date || new Date().toISOString().split('T')[0];
  link.download = `Report_${safeName}_${dateStr}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToDocx = async (data, options = {}) => {
  const {
    title = 'RazziStaff Report',
    headers = [],
    filename = 'report',
    companyName = 'RazziPay',
    appName = 'RazziStaff',
  } = options;

  const tableHeaders = headers.length ? headers : Object.keys(data[0] || {});
  const primary = '20B2AA';

  const headerRow = new TableRow({
    children: tableHeaders.map(h =>
      new TableCell({
        shading: { fill: primary, type: ShadingType.CLEAR, color: 'auto' },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: h.replace(/_/g, ' ').toUpperCase(), bold: true, color: 'FFFFFF', size: 18 }),
            ],
          }),
        ],
      })
    ),
    tableHeader: true,
  });

  const dataRows = (data || []).map((row, idx) =>
    new TableRow({
      children: tableHeaders.map(h =>
        new TableCell({
          shading: idx % 2 === 0 ? undefined : { fill: 'F5FFFE', type: ShadingType.CLEAR, color: 'auto' },
          children: [
            new Paragraph({
              children: [new TextRun({ text: String(row[h] ?? ''), size: 18 })],
            }),
          ],
        })
      ),
    })
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: appName, bold: true, size: 40, color: primary }),
              new TextRun({ text: `  |  ${companyName}`, size: 24, color: '888888' }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 16, color: 'AAAAAA' }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: title, bold: true, color: '1A1A2E' })],
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
