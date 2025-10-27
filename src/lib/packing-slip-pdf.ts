import jsPDF from 'jspdf';

export interface PackingSlipItem {
  sno: number;
  gsm: string | number;
  bf: string | number;
  size: string | number; // width_inches
  reel: string | number; // barcode_id or qr_code identifier
  weight: number;
  natgold: string;
}

export interface PackingSlipData {
  dispatch_number: string;
  reference_number?: string;
  dispatch_date: string;
  client: {
    company_name: string;
    contact_person?: string;
    address?: string;
    mobile?: string;
  };
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  items: PackingSlipItem[];
}

/**
 * Generate a packing slip PDF for dispatch
 */
export const generatePackingSlipPDF = (data: PackingSlipData, returnDoc: boolean = false, printMode: boolean = false): jsPDF | void => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PACKING SLIP', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Dispatch Information Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    // Define margins
    const leftMargin = 20;
    const rightMargin = 20;
    const usableWidth = pageWidth - leftMargin - rightMargin;

    // Left column - Dispatch details
    const leftColX = leftMargin;
    const rightColX = pageWidth / 2 + 10;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Dispatch Details:', leftColX, yPosition);
    doc.setFont('helvetica', 'normal');
    yPosition += 8;
    
    doc.text(`Dispatch No: ${data.dispatch_number}`, leftColX, yPosition);
    yPosition += 6;
    
    if (data.reference_number) {
      doc.text(`Reference No: ${data.reference_number}`, leftColX, yPosition);
      yPosition += 6;
    }
    
    doc.text(`Date: ${new Date(data.dispatch_date).toLocaleDateString('en-GB')}`, leftColX, yPosition);
    yPosition += 6;

    // Reset yPosition for right column
    let rightYPos = yPosition - (data.reference_number ? 20 : 14);
    
    // Right column - Client details
    doc.setFont('helvetica', 'bold');
    doc.text('Client Details:', rightColX, rightYPos);
    doc.setFont('helvetica', 'normal');
    rightYPos += 8;
    
    doc.text(`Company: ${data.client.company_name}`, rightColX, rightYPos);
    rightYPos += 6;
    
    yPosition = Math.max(yPosition, rightYPos) + 10;

    // Transport Details
    doc.setFont('helvetica', 'bold');
    doc.text('Transport Details:', leftColX, yPosition);
    doc.setFont('helvetica', 'normal');
    yPosition += 8;
    
    doc.text(`Vehicle: ${data.vehicle_number}`, leftColX, yPosition);
    doc.text(`Driver: ${data.driver_name}`, rightColX, yPosition);
    yPosition += 6;
    
    doc.text(`Driver Mobile: ${data.driver_mobile}`, leftColX, yPosition);
    yPosition += 15;

    // Items Table
    doc.setFont('helvetica', 'bold');
    doc.text('Items:', leftColX, yPosition);
    yPosition += 10;

    // Calculate totals
    const totalWeight = data.items.reduce((sum, item) => sum + item.weight, 0);
    const totalItems = data.items.length;

    // Prepare table data
    const tableHeaders = ['S.No', 'GSM', 'BF', 'Size', 'Reel', 'Weight', 'Nat/Gold'];
    const tableData = data.items.map(item => [
      item.sno.toString(),
      item.gsm.toString() || '',
      item.bf.toString() || '',
      item.size.toString() || '',
      item.reel.toString() || '',
      item.weight.toString(),
      item.natgold || ''
    ]);

    // Add totals row
    tableData.push([
      'Total',
      '',
      '',
      '',
      totalItems.toString(),
      totalWeight.toString(),
      ''
    ]);

    // Draw table manually
    const totalTableWidth = usableWidth - 10; // Leave some extra space on right
    const colWidths = [totalTableWidth * 0.08, totalTableWidth * 0.12, totalTableWidth * 0.10, totalTableWidth * 0.12, totalTableWidth * 0.20, totalTableWidth * 0.18, totalTableWidth * 0.20]; // Responsive column widths
    const rowHeight = 8;
    const headerHeight = 10;
    let currentY = yPosition;
    
    // Draw header row
    doc.setFillColor(240, 240, 240);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    
    let currentX = leftColX;
    // Draw header background
    doc.rect(currentX, currentY, colWidths.reduce((a, b) => a + b, 0), headerHeight, 'F');
    
    // Draw header text
    tableHeaders.forEach((header, i) => {
      doc.text(header, currentX + colWidths[i] / 2, currentY + headerHeight / 2 + 2, { align: 'center' });
      currentX += colWidths[i];
    });
    
    currentY += headerHeight;
    
    // Draw data rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    
    tableData.forEach((row, rowIndex) => {
      currentX = leftColX;
      
      // Check if this is the total row (last row)
      const isTotalRow = rowIndex === tableData.length - 1;
      
      if (isTotalRow) {
        doc.setFillColor(250, 250, 250);
        doc.setFont('helvetica', 'bold');
        doc.rect(currentX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
      }
      
      // Draw cell data
      row.forEach((cell, colIndex) => {
        doc.text(cell, currentX + colWidths[colIndex] / 2, currentY + rowHeight / 2 + 1, { align: 'center' });
        currentX += colWidths[colIndex];
      });
      
      if (isTotalRow) {
        doc.setFont('helvetica', 'normal');
      }
      
      currentY += rowHeight;
    });
    
    // Draw table borders
    currentX = leftColX;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const tableHeight = headerHeight + (tableData.length * rowHeight);
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    
    // Outer border
    doc.rect(currentX, yPosition, tableWidth, tableHeight, 'S');
    
    // Vertical lines
    let x = currentX;
    for (let i = 0; i < colWidths.length - 1; i++) {
      x += colWidths[i];
      doc.line(x, yPosition, x, yPosition + tableHeight);
    }
    
    // Horizontal lines  
    doc.line(currentX, yPosition + headerHeight, currentX + tableWidth, yPosition + headerHeight);
    for (let i = 1; i < tableData.length; i++) {
      const y = yPosition + headerHeight + (i * rowHeight);
      doc.line(currentX, y, currentX + tableWidth, y);
    }
    
    currentY = yPosition + tableHeight;

    // Footer
    const finalY = currentY + 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Summary
    doc.text(`Total Items: ${totalItems}`, leftColX, finalY);
    doc.text(`Total Weight: ${totalWeight} kg`, rightColX, finalY);
    
    // Signature lines
    const signatureY = finalY + 30;
    doc.text('_________________________', leftColX, signatureY);
    doc.text('_________________________', rightColX, signatureY);
    doc.text('Prepared By', leftColX + 25, signatureY + 10);
    doc.text('Received By', rightColX + 25, signatureY + 10);

    // Save or return the PDF
    if (returnDoc) {
      return doc;
    } else if (printMode) {
      // Open print dialog
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          URL.revokeObjectURL(pdfUrl);
        };
      }
    } else {
      const fileName = `packing_slip_${data.dispatch_number}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    }
    
  } catch (error) {
    console.error('Error generating packing slip PDF:', error);
    throw new Error('Failed to generate packing slip PDF');
  }
};

/**
 * Convert dispatch data to packing slip format
 */
export const convertDispatchToPackingSlip = (dispatch: any): PackingSlipData => {
  // Handle both 'items' and 'dispatch_items' field names
  const itemsArray = dispatch.items || dispatch.dispatch_items || [];
  
  const items: PackingSlipItem[] = itemsArray.map((item: any, index: number) => ({
    sno: index + 1,
    gsm: extractGSMFromSpec(item.paper_spec) || '',
    bf: extractBFFromSpec(item.paper_spec) || '',
    size: parseFloat(item.width_inches) || '',
    reel: extractReelNumber(item.barcode_id) || item.qr_code || item.barcode_id || '',
    weight: Math.round(parseFloat(item.weight_kg) || 0),
    natgold: extractShadeFromSpec(item.paper_spec) || ''
  }));

  return {
    dispatch_number: dispatch.dispatch_number || '',
    reference_number: dispatch.reference_number,
    dispatch_date: dispatch.dispatch_date || new Date().toISOString(),
    client: {
      company_name: dispatch.client?.company_name || 'Unknown Client',
      contact_person: dispatch.client?.contact_person || '',
      address: dispatch.client?.address || '',
      mobile: dispatch.client?.mobile
    },
    vehicle_number: dispatch.vehicle_number || '',
    driver_name: dispatch.driver_name || '',
    driver_mobile: dispatch.driver_mobile || '',
    items
  };
};

// Helper functions to extract paper specifications
const extractGSMFromSpec = (spec: string): string => {
  if (!spec) return '';
  const match = spec.match(/(\d+)gsm/i);
  return match ? match[1] : '';
};

const extractBFFromSpec = (spec: string): string => {
  if (!spec) return '';
  const match = spec.match(/(\d+(?:\.\d+)?)bf/i);
  return match ? match[1] : '';
};

const extractShadeFromSpec = (spec: string): string => {
  if (!spec) return '';
  const parts = spec.split(',').map(p => p.trim());
  // Look for shade in the last part or parts that don't contain numbers
  const shadePart = parts.find(part => 
    !part.toLowerCase().includes('gsm') && 
    !part.toLowerCase().includes('bf') &&
    !part.match(/^\d/)
  );
  return shadePart || '';
};

const extractReelNumber = (barcode: string): string => {
  if (!barcode) return '';
  // Extract just the numeric part from barcode like "CR_25.0_90_ABC123" -> "ABC123"
  // or from patterns like "3387", "3385" etc.
  const match = barcode.match(/(\d+)$/);
  return match ? match[1] : barcode;
};