/**
 * Wastage Report PDF Generation using jsPDF
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface WastageReportData {
  id: number;
  inwardChallanId: string;
  partyName: string;
  vehicleNo: string;
  date: string;
  mouReport: number[];
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Download wastage report as PDF using jsPDF
 */
export async function downloadWastageReportPDF(data: WastageReportData) {
  // Create new PDF document (A4 size)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  // Calculate totals
  const totalMOU = data.mouReport.reduce((sum, val) => sum + val, 0);
  const mouCount = data.mouReport.length;
  const averageMOU = mouCount > 0 ? (totalMOU / mouCount).toFixed(3) : '0.000';

  // Split MOU data into 3 columns - fill first column fully (max 10), then second, then third
  const maxRowsPerColumn = 10;
  const column1 = data.mouReport.slice(0, maxRowsPerColumn);
  const column2 = data.mouReport.slice(maxRowsPerColumn, maxRowsPerColumn * 2);
  const column3 = data.mouReport.slice(maxRowsPerColumn * 2, maxRowsPerColumn * 3);

  // Page margins and positions
  const leftMargin = 15;
  const rightMargin = 195;
  const pageWidth = 210;
  let yPos = 15;

  // === HEADER SECTION ===
  // Company name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('SatGuru Papers Pvt. Ltd.', leftMargin, yPos);
  yPos += 6;

  // Subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Kraft paper Mill', leftMargin, yPos);
  yPos += 5;

  // Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Plant Address - Sector 3 Pithampur Dhar (M.P.)', leftMargin, yPos);

  // Right side info (Slip No, Date, Net Weight)
  doc.setFontSize(9);
  const rightInfoX = rightMargin - 40;
  let rightYPos = 15;
  
  doc.text('Slip No : ............', rightInfoX, rightYPos);
  rightYPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`Date - ${formatDate(data.date)}`, rightInfoX, rightYPos);
  doc.setFont('helvetica', 'normal');
  rightYPos += 8;
  doc.text('Net Weight : .............', rightInfoX, rightYPos);

  yPos += 15;

  // === WASTAGE REPORT TITLE ===
  doc.setFillColor(85, 85, 85); // #555
  doc.roundedRect((pageWidth - 80) / 2, yPos - 5, 80, 10, 5, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Wastage Report', pageWidth / 2, yPos, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  yPos += 15;

  // === PARTY NAME ROW ===
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Party Name :-', leftMargin, yPos);
  doc.setFont('helvetica', 'normal');
  
  // Party name with underline
  const partyNameX = leftMargin + 30;
  doc.text(data.partyName, partyNameX, yPos);
  doc.line(partyNameX, yPos + 1, partyNameX + 70, yPos + 1);

  // Report label box
  const reportLabelX = partyNameX + 75;
  doc.setFillColor(136, 136, 136); // #888
  doc.rect(reportLabelX, yPos - 4, 15, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('Report :-', reportLabelX + 2, yPos);
  doc.setTextColor(0, 0, 0);

  // Empty report box
  doc.rect(reportLabelX + 17, yPos - 4, 40, 6);

  yPos += 10;

  // === VEHICLE NUMBER ROW ===
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Vehicle No.', leftMargin, yPos);
  doc.setFont('helvetica', 'normal');
  
  const vehicleX = leftMargin + 30;
  doc.text(data.vehicleNo, vehicleX, yPos);
  doc.line(vehicleX, yPos + 1, rightMargin - 15, yPos + 1);

  yPos += 15;

  // === MOU REPORT TABLE ===
  const maxRows = 13;
  const tableBody: any[] = [];

  // Generate table rows
  for (let i = 0; i < maxRows; i++) {
    tableBody.push([
      column1[i] !== undefined ? (i + 1).toString() : '',
      column1[i] !== undefined ? column1[i].toFixed(1) : '',
      column2[i] !== undefined ? (maxRowsPerColumn + i + 1).toString() : '',
      column2[i] !== undefined ? column2[i].toFixed(1) : '',
      column3[i] !== undefined ? (maxRowsPerColumn * 2 + i + 1).toString() : '',
      column3[i] !== undefined ? column3[i].toFixed(1) : ''
    ]);
  }

  // Add total row
  tableBody.push([
    { content: 'Total', styles: { fontStyle: 'bold' } },
    { content: `${totalMOU.toFixed(1)}/${mouCount}`, styles: { fontStyle: 'bold' } },
    { content: 'Total', styles: { fontStyle: 'bold' } },
    { content: '', styles: { fontStyle: 'bold' } },
    { content: 'Total', styles: { fontStyle: 'bold' } },
    { content: `${averageMOU}`, styles: { fontStyle: 'bold' } }
  ]);

  // Calculate table width and center position
  const tableWidth = 15 + 32 + 15 + 32 + 15 + 32; // Total width of all columns
  const tableMarginLeft = (pageWidth - tableWidth) / 2;

  // Draw table using autoTable (centered)
  autoTable(doc, {
    startY: yPos,
    head: [[
      { content: 'S.No.', styles: { halign: 'center', fillColor: [136, 136, 136] } },
      { content: 'MOU Report', styles: { halign: 'center', fillColor: [136, 136, 136] } },
      { content: 'S.No.', styles: { halign: 'center', fillColor: [136, 136, 136] } },
      { content: 'MOU Report', styles: { halign: 'center', fillColor: [136, 136, 136] } },
      { content: 'S.No.', styles: { halign: 'center', fillColor: [136, 136, 136] } },
      { content: 'MOU Report', styles: { halign: 'center', fillColor: [136, 136, 136] } }
    ]],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      halign: 'center',
      valign: 'middle',
      lineColor: [51, 51, 51],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [136, 136, 136],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 15 },  // S.No. columns
      1: { cellWidth: 32 },  // MOU Report columns
      2: { cellWidth: 15 },
      3: { cellWidth: 32 },
      4: { cellWidth: 15 },
      5: { cellWidth: 32 }
    },
    margin: { left: tableMarginLeft }
  });

  // Create blob and open print dialog directly
  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  
  // Open in new window for printing
  const printWindow = window.open(blobUrl, '_blank');
  
  if (printWindow) {
    // Wait for PDF to load, then trigger print dialog
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  } else {
    // Fallback: download the PDF if popup is blocked
    const fileName = `wastage-report-${data.inwardChallanId}-${Date.now()}.pdf`;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }
}
