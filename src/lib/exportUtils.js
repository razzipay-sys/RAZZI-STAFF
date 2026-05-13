import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import logoUrl from '@/assets/logo.jpeg';

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

/**
 * Exports data to CSV and triggers download
 * @param {Array} data - Array of objects
 * @param {string} filename - Filename without extension
 */
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

/**
 * Exports data to PDF and triggers download
 * @param {Array} data - Array of objects
 * @param {Object} options - { title, headers, filename }
 */
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
  try {
    logoDataUrl = await getLogoDataUrl();
  } catch {
    logoDataUrl = null;
  }

  const primary = [32, 178, 170];
  const headerHeight = 30;
  const tableHeaders = headers.length ? headers : Object.keys(data[0] || {});
  const tableData = (data || []).map(row => tableHeaders.map(h => row?.[h] ?? ''));

  const drawHeader = () => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 14;
    const top = 12;

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'JPEG', left, top - 4, 14, 14);
    }

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

const drawIDCard = ({ doc, staff, logoDataUrl, companyName, appName, photoDataUrl }) => {
  const primary = [32, 178, 170];
  const accent = [25, 118, 210];

  doc.setFillColor(246, 248, 252);
  doc.roundedRect(1.5, 1.5, 83, 51, 4, 4, 'F');

  doc.setDrawColor(220);
  doc.setLineWidth(0.3);
  doc.roundedRect(1.5, 1.5, 83, 51, 4, 4, 'S');

  doc.setFillColor(...primary);
  doc.roundedRect(1.5, 1.5, 83, 11, 4, 4, 'F');
  doc.setFillColor(...accent);
  doc.rect(1.5, 12.5, 83, 1.2, 'F');

  doc.setFillColor(...primary);
  doc.setDrawColor(...primary);
  doc.triangle(63, 13.7, 84.5, 13.7, 84.5, 33);
  doc.setFillColor(...accent);
  doc.setDrawColor(...accent);
  doc.triangle(68, 13.7, 84.5, 13.7, 84.5, 28);

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'JPEG', 5, 3.2, 7.5, 7.5);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(appName, 14, 8);

  doc.setFontSize(6.5);
  doc.text(companyName, 81.5, 8, { align: 'right' });

  const name = (staff?.full_name || 'N/A').toString();
  const role = (staff?.role || 'N/A').toString();
  const department = (staff?.department || 'N/A').toString();
  const staffId = (staff?.staff_id || 'N/A').toString();

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(225);
  doc.roundedRect(5, 17, 21, 21, 5, 5, 'FD');

  if (photoDataUrl) {
    const type = photoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
    doc.addImage(photoDataUrl, type, 6, 18, 19, 19);
  } else {
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    doc.setTextColor(90);
    doc.setFontSize(14);
    doc.text(initials || '??', 15.5, 30, { align: 'center' });
  }

  doc.setTextColor(20);
  doc.setFontSize(10.5);
  doc.text(name, 29, 23, { maxWidth: 52 });

  doc.setTextColor(80);
  doc.setFontSize(8);
  doc.text(role, 29, 28, { maxWidth: 52 });

  doc.setTextColor(110);
  doc.setFontSize(7.5);
  doc.text(department, 29, 32, { maxWidth: 52 });

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(230);
  doc.roundedRect(29, 36, 52, 10.5, 3, 3, 'FD');

  doc.setTextColor(...primary);
  doc.setFontSize(7);
  doc.text('STAFF ID', 32, 40);
  doc.setTextColor(25);
  doc.setFontSize(9.5);
  doc.text(staffId, 32, 45);

  doc.setDrawColor(180);
  for (let i = 0; i < 18; i += 1) {
    const x = 61 + i * 1.1;
    const h = i % 3 === 0 ? 6 : 4;
    doc.setLineWidth(i % 2 === 0 ? 0.5 : 0.25);
    doc.line(x, 39.5, x, 39.5 + h);
  }

  doc.setTextColor(130);
  doc.setFontSize(6.5);
  doc.text('Property of the company • If found, return to HR', 5, 50.5);
};

export const exportIDCardToPDF = async (staff, options = {}) => {
  const {
    companyName = 'RazziPay',
    appName = 'RazziStaff',
    filename,
  } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [86, 54] });

  let logoDataUrl = null;
  try {
    logoDataUrl = await getLogoDataUrl();
  } catch {
    logoDataUrl = null;
  }

  let photoDataUrl = null;
  if (staff?.profile_photo_url) {
    try {
      photoDataUrl = await getRemoteImageDataUrl(staff.profile_photo_url);
    } catch {
      photoDataUrl = null;
    }
  }

  drawIDCard({ doc, staff, logoDataUrl, companyName, appName, photoDataUrl });

  const staffId = staff?.staff_id || 'N/A';
  doc.save(`${filename || `ID_Card_${staffId}`}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportIDCardsToPDF = async (staffList, options = {}) => {
  const list = Array.isArray(staffList) ? staffList : [];
  if (list.length === 0) return;

  const { filename = 'ID_Cards', companyName = 'RazziPay', appName = 'RazziStaff' } = options;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [86, 54] });

  let logoDataUrl = null;
  try {
    logoDataUrl = await getLogoDataUrl();
  } catch {
    logoDataUrl = null;
  }

  for (let i = 0; i < list.length; i += 1) {
    if (i > 0) doc.addPage([86, 54], 'landscape');
    const staff = list[i];
    let photoDataUrl = null;
    if (staff?.profile_photo_url) {
      try {
        photoDataUrl = await getRemoteImageDataUrl(staff.profile_photo_url);
      } catch {
        photoDataUrl = null;
      }
    }
    drawIDCard({ doc, staff, logoDataUrl, companyName, appName, photoDataUrl });
  }

  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
};
