import jsPDF from 'jspdf';

export interface PackingSlipItem {
  sno: number;
  gsm: string | number;
  bf: string | number;
  size: string | number; // width_inches
  reel: string | number; // barcode_id or qr_code identifier
  weight: number;
  natgold: string;
  order_frontend_id?:string;
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
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 13;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Satguru Papers Pvt. Ltd.', pageWidth/2, yPosition, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Kraft paper Mill', pageWidth/2 + 45, yPosition-2, { align: 'left' });

    // Plant address
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Address - Pithampur Dhar(M.P.)', pageWidth/2 + 45, yPosition+3, { align: 'left' });


    yPosition+=12

    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal')
    doc.text(`Date: ${new Date(data.dispatch_date).toLocaleDateString('en-GB')}`, 155, yPosition,{align:'left'});

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PACKING SLIP', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;

    // Dispatch Information Section - 3 columns layout
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    // Define margins
    const leftMargin = 15;
    const rightMargin = 35;
    const usableWidth = pageWidth - leftMargin - rightMargin;
    const bottomMargin = 20;

    // Three columns
    const col1X = leftMargin;
    const col2X = leftMargin + (usableWidth / 3);
    const col3X = leftMargin + (2 * usableWidth / 3);
    
    // Row 1
   
    doc.text(`Dispatch No: ${data.dispatch_number}`, 155, yPosition-3,{align:'left'});
    doc.text(`Party: ${data.client.company_name}`, col1X, yPosition);
    
    yPosition += 10;
    
    // Row 2
    if (data.reference_number) {
      doc.text(`Reference No: ${data.reference_number}`, 155, (yPosition-6));
    }
    doc.text(`Vehicle No.: ${data.vehicle_number}`, 155, yPosition+1);
    let formatAddress = ''
    if(data.client.address && data.client.address?.length > 0 ){
        formatAddress = data.client.address?.length > 36 ?data.client.address?.substring(0,35)+'...': data.client.address
    }

    doc.text(`Address: ${formatAddress}`, leftMargin, yPosition);
    yPosition += 14;
    

    // Calculate totals
    const totalWeight = data.items.reduce((sum, item) => sum + item.weight, 0);
    const totalItems = data.items.length;

    // Prepare table data
    const tableHeaders = ['S.No', 'GSM', 'BF', 'Size', 'Reel', 'Weight', 'Nat/Gold', 'Order Id'];

    const sortedItems = data.items.sort((a:any, b:any) => {
      // Sort by size first
      const sizeA = parseFloat(String(a.size)) || 0;
      const sizeB = parseFloat(String(b.size)) || 0;
      if (sizeA !== sizeB) return sizeA - sizeB;
      
      // Then by GSM
      const gsmA = parseFloat(String(a.gsm)) || 0;
      const gsmB = parseFloat(String(b.gsm)) || 0;
      if (gsmA !== gsmB) return gsmA - gsmB;
      
      // Then by BF
      const bfA = parseFloat(String(a.bf)) || 0;
      const bfB = parseFloat(String(b.bf)) || 0;
      if (bfA !== bfB) return bfA - bfB;
      
      // Finally by reel
      const reelA = parseFloat(String(a.reel)) || 0;
      const reelB = parseFloat(String(b.reel)) || 0;
      return reelA - reelB;
    });
    
    const tableData = sortedItems.map((item, index) => [
      (index + 1).toString(), // Regenerate S.No after sorting
      item.gsm.toString() || '',
      item.bf.toString() || '',
      item.size.toString() || '',
      item.reel.toString() || '',
      item.weight.toString(),
      item.natgold || '',
      item.order_frontend_id || ''
    ]);

    

    // Add totals row
    tableData.push([
      'Total',
      '',
      '',
      '',
      totalItems.toString(),
      totalWeight.toString(),
      '',
      ''
    ]);

    // Draw table manually with pagination support
    const totalTableWidth = usableWidth - 10; // Leave some extra space on right
    const colWidths = [totalTableWidth * 0.08, totalTableWidth * 0.12, totalTableWidth * 0.10, totalTableWidth * 0.12, totalTableWidth * 0.20, totalTableWidth * 0.18, totalTableWidth * 0.20, totalTableWidth * 0.20]; // Responsive column widths
    const rowHeight = 8;
    const headerHeight = 10;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const leftColX = col1X; // Use col1X for table alignment

    // Helper function to draw table headers
    const drawTableHeader = (startY: number) => {
      doc.setFillColor(240, 240, 240);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);

      let currentX = leftColX;
      // Draw header background
      doc.rect(currentX, startY, tableWidth, headerHeight, 'F');

      // Draw header text
      tableHeaders.forEach((header, i) => {
        doc.text(header, currentX + colWidths[i] / 2, startY + headerHeight / 2 + 2, { align: 'center' });
        currentX += colWidths[i];
      });

      return startY + headerHeight;
    };

    // Helper function to draw table borders for a section
    const drawTableBorders = (startY: number, endY: number, rowCount: number) => {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);

      const sectionHeight = endY - startY;

      // Outer border
      doc.rect(leftColX, startY, tableWidth, sectionHeight, 'S');

      // Vertical lines
      let x = leftColX;
      for (let i = 0; i < colWidths.length - 1; i++) {
        x += colWidths[i];
        doc.line(x, startY, x, endY);
      }

      // Horizontal lines (header line + row lines)
      doc.line(leftColX, startY + headerHeight, leftColX + tableWidth, startY + headerHeight);
      for (let i = 1; i < rowCount; i++) {
        const y = startY + headerHeight + (i * rowHeight);
        if (y < endY) {
          doc.line(leftColX, y, leftColX + tableWidth, y);
        }
      }
    };

    let currentY = yPosition;
    let tableStartY = currentY;
    let rowsInCurrentPage = 0;

    // Draw initial header
    currentY = drawTableHeader(currentY);

    // Draw data rows with pagination
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    tableData.forEach((row, rowIndex) => {
      // Check if this is the total row (last row)
      const isTotalRow = rowIndex === tableData.length - 1;

      // Check if we need a new page (leave space for footer if it's the last row)
      const spaceNeeded = isTotalRow ? rowHeight + 60 : rowHeight; // Extra space for footer on last row
      if (currentY + spaceNeeded > pageHeight - bottomMargin) {
        // Draw borders for current table section
        drawTableBorders(tableStartY, currentY, rowsInCurrentPage);

        // Add new page
        doc.addPage();

        // Reset Y position and redraw header
        currentY = 20;
        tableStartY = currentY;
        currentY = drawTableHeader(currentY);
        rowsInCurrentPage = 0;
      }

      let currentX = leftColX;

      if (isTotalRow) {
        doc.setFillColor(250, 250, 250);
        doc.setFont('helvetica', 'bold');
        doc.rect(currentX, currentY, tableWidth, rowHeight, 'F');
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
      rowsInCurrentPage++;
    });

    // Draw final table borders
    drawTableBorders(tableStartY, currentY, rowsInCurrentPage);

    // Footer
    const finalY = currentY + 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Summary
    doc.text(`Total Items: ${totalItems}`, col1X, finalY);
    doc.text(`Total Weight: ${totalWeight} kg`, col3X, finalY);
    
    // Signature lines
    const signatureY = finalY + 30;
    doc.text('_________________________', col1X, signatureY);
    doc.text('_________________________', col3X, signatureY);
    doc.text('Prepared By', col1X + 25, signatureY + 10);
    doc.text('Received By', col3X + 25, signatureY + 10);

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
  // console.log(dispatch)
  
  const items: PackingSlipItem[] = itemsArray.map((item: any, index: number) => ({
    sno: index + 1,
    gsm: extractGSMFromSpec(item.paper_spec) || '',
    bf: extractBFFromSpec(item.paper_spec) || '',
    size: parseFloat(item.width_inches) || '',
    reel: extractReelNumber(item.barcode_id) || item.qr_code || item.barcode_id || '',
    weight: Math.round(parseFloat(item.weight_kg) || 0),
    natgold: extractShadeFromSpec(item.paper_spec) || '',
    order_frontend_id:item.order_frontend_id
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

  // Remove prefix like "CR_", "JR_", "SET_" etc., but keep the year suffix
  // Examples:
  // "CR_08001-25" -> "08001-25"
  // "CR_08001" -> "08001"
  // "3387" -> "3387"
  return barcode.replace(/^[A-Z]+_/, '');
};