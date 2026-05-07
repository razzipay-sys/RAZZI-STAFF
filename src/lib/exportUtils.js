import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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
export const exportToPDF = (data, options = {}) => {
  const { title = 'RazziStaff Report', headers = [], filename = 'report' } = options;
  const doc = new jsPDF();

  // Add Branding
  doc.setFontSize(20);
  doc.setTextColor(32, 178, 170); // RazziStaff Primary Color
  doc.text('RazziStaff', 14, 15);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('RazziPay Internal Ops Platform', 14, 22);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 27);

  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(title, 14, 40);

  // Table Data
  const tableHeaders = headers.length ? headers : Object.keys(data[0]);
  const tableData = data.map(row => tableHeaders.map(h => row[h] || ''));

  doc.autoTable({
    startY: 45,
    head: [tableHeaders.map(h => h.replace(/_/g, ' ').toUpperCase())],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [32, 178, 170] },
    styles: { fontSize: 8 },
  });

  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
};
