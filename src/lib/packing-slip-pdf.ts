import jsPDF from 'jspdf';

export interface QualityCheckData {
  barcode_id: string;
  gsm: string | null;
  bf: string | null;
  cobb_value: string | null;
}

export interface PackingSlipItem {
  sno: number;
  gsm: string | number;
  bf: string | number;
  size: string | number; // width_inches
  reel: string | number; // barcode_id or qr_code identifier
  weight: number;
  natgold: string;
  order_frontend_id?:string;
  barcode_id?: string; // Original barcode for QC lookup
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
  qualityCheckData?: QualityCheckData[]; // Added QC data
}

/**
 * Generate a packing slip PDF for dispatch
 */
export const generatePackingSlipPDF = async (data: PackingSlipData, returnDoc: boolean = false, printMode: boolean = false): Promise<jsPDF | void> => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 0;

    // Header - Add packing image
    const headerImg = new Image();
    headerImg.src = '/packing.png';
    await new Promise((resolve) => {
      headerImg.onload = resolve;
    });

    // Calculate image dimensions maintaining aspect ratio
    const imgWidth = pageWidth; // Full width
    const aspectRatio = headerImg.naturalHeight / headerImg.naturalWidth;
    const imgHeight = imgWidth * aspectRatio; // Calculate height based on aspect ratio
    doc.addImage(headerImg, 'PNG', 0, yPosition, imgWidth, imgHeight);

    yPosition += imgHeight + 5; // Move position down after image

    // Dispatch Information
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');

    const leftMargin = 2;
    const rightMargin = 2;
    const usableWidth = pageWidth - leftMargin - rightMargin;
    const bottomMargin = 20;
    const midColX = pageWidth / 2 + 10; // Middle-right position
    const rightColX = pageWidth - 55; // Far right position

    // Row 1: Party (left), Date (middle-right), Dispatch No (far right)
    doc.text(`Party :- ${data.client.company_name || 'N/A'}`, leftMargin, yPosition + 3);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Date :- ${new Date(data.dispatch_date).toLocaleDateString('en-GB')}`, midColX, yPosition);
    doc.text(`Dispatch No : ${data.dispatch_number}`, rightColX, yPosition);

    yPosition += 7;

    // Row 2: Address (left), Vehicle (middle-right), Driver (far right)
    // let formatAddress = '';
    // if (data.client.address && data.client.address.length > 0) {
    //   formatAddress = data.client.address.length > 50
    //     ? data.client.address.substring(0, 48) + '...'
    //     : data.client.address;
    // }
    // doc.text(`Address :- ${formatAddress}`, leftMargin, yPosition);
    doc.text(`Vehicle :- ${data.vehicle_number || 'N/A'}`, midColX, yPosition);
    doc.text(`Driver : ${data.driver_name || 'N/A'}`, rightColX, yPosition);

    yPosition += 10;
    

    // Calculate totals
    const totalWeight = data.items.reduce((sum, item) => sum + item.weight, 0);
    const totalItems = data.items.length;

    const tableHeaders = ['S.No', 'GSM', 'BF', 'Size', 'Reel', 'Weight', 'Shade', 'Order Id'];

    // Calculate dimensions for two tables
    const tableGap = 2; // Gap between two tables
    const singleTableWidth = (pageWidth - tableGap) / 2;

    const colWidths = [
        singleTableWidth * 0.08,
        singleTableWidth * 0.10,
        singleTableWidth * 0.10,
        singleTableWidth * 0.10,
        singleTableWidth * 0.15,
        singleTableWidth * 0.11,
        singleTableWidth * 0.15,
        singleTableWidth * 0.20
      ];
    const rowHeight = 8;
    const headerHeight = 10;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);

    // Calculate max rows that can fit on current page
    const footerSpaceNeeded = 40; // Space for totals + footer
    const availableHeightFirstPage = pageHeight - yPosition - footerSpaceNeeded;
    const maxRowsFirstPage = Math.floor((availableHeightFirstPage - headerHeight) / rowHeight);

    // For subsequent pages (if needed)
    const topMarginNewPage = 10;
    const availableHeightNewPage = pageHeight - topMarginNewPage - footerSpaceNeeded;
    const maxRowsPerNewPage = Math.floor((availableHeightNewPage - headerHeight) / rowHeight);

    // Sort items
    const sortedItems = data.items.sort((a:any, b:any) => {
      const sizeA = parseFloat(String(a.size)) || 0;
      const sizeB = parseFloat(String(b.size)) || 0;
      if (sizeA !== sizeB) return sizeA - sizeB;

      const gsmA = parseFloat(String(a.gsm)) || 0;
      const gsmB = parseFloat(String(b.gsm)) || 0;
      if (gsmA !== gsmB) return gsmA - gsmB;

      const bfA = parseFloat(String(a.bf)) || 0;
      const bfB = parseFloat(String(b.bf)) || 0;
      if (bfA !== bfB) return bfA - bfB;

      const shadeA = a.natgold ? a.natgold.toString().toLowerCase() : '';
      const shadeB = b.natgold ? b.natgold.toString().toLowerCase() : '';
      if (shadeA !== shadeB) return shadeA.localeCompare(shadeB);

      const reelA = parseFloat(String(a.reel)) || 0;
      const reelB = parseFloat(String(b.reel)) || 0;
      return reelA - reelB;
    });

    // Prepare table data
    const tableData = sortedItems.map((item, index) => [
      (index + 1).toString(),
      item.gsm.toString() || '',
      item.bf.toString() || '',
      item.size.toString() || '',
      item.reel.toString() || '',
      item.weight.toString(),
      item.natgold || '',
      item.order_frontend_id || ''
    ]);

    // Calculate total rows needed for both tables combined
    const totalRowsNeeded = Math.ceil(totalItems / 2);
    const rows = Math.max(totalRowsNeeded, 23);

    // Determine rows per table on first page
    const rowsPerTableFirstPage = Math.min(maxRowsFirstPage, totalRowsNeeded);

    // Split data into two tables - fill first table first, then second
    const leftTableData: any[] = [];
    const rightTableData: any[] = [];

    for (let i = 0; i < rows; i++) {
      leftTableData.push(tableData[i] || ['', '', '', '', '', '', '', '']);
      rightTableData.push(tableData[i + rows] || ['', '', '', '', '', '', '', '']);
    }

    // Helper to draw table header
    const drawTableHeader = (startX: number, startY: number) => {
      doc.setFillColor(240, 240, 240);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);

      doc.rect(startX, startY, tableWidth, headerHeight, 'F');

      let currentX = startX;
      tableHeaders.forEach((header, i) => {
        doc.text(header, currentX + colWidths[i] / 2, startY + headerHeight / 2 + 2, { align: 'center' });
        currentX += colWidths[i];
      });
    };

    // Helper to draw table rows with alternating colors
    const drawTableRows = (startX: number, startY: number, data: any[]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);

      let currentY = startY + headerHeight;

      data.forEach((row, rowIndex) => {
        // Alternating row colors - white and light gray
        if (rowIndex % 2 === 1) {
          doc.setFillColor(230, 230, 230); // Light gray for odd rows
          doc.rect(startX, currentY, tableWidth, rowHeight, 'F');
        }

        let currentX = startX;
        row.forEach((cell: string, colIndex: number) => {
          doc.text(cell, currentX + colWidths[colIndex] / 2, currentY + rowHeight / 2 + 1, { align: 'center' });
          currentX += colWidths[colIndex];
        });
        currentY += rowHeight;
      });
    };

    // Helper to draw table borders
    const drawTableBorders = (startX: number, startY: number, numRows: number) => {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);

      const tableHeight = headerHeight + (numRows * rowHeight);

      // Outer border
      doc.rect(startX, startY, tableWidth, tableHeight, 'S');

      // Vertical lines between columns
      let x = startX;
      for (let i = 0; i < colWidths.length - 1; i++) {
        x += colWidths[i];
        doc.line(x, startY, x, startY + tableHeight);
      }

      // Only horizontal line after header (no lines between rows)
      doc.line(startX, startY + headerHeight, startX + tableWidth, startY + headerHeight);
    };

    // Pagination logic - draw tables with page breaks
    const leftTableX = 0;
    const rightTableX = tableWidth + tableGap;

    let currentRowIndex = 0;
    let currentPage = 1;
    let currentYPosition = yPosition;

    while (currentRowIndex < rows) {
      // Calculate available space on current page
      const availableSpace = currentPage === 1
        ? availableHeightFirstPage
        : availableHeightNewPage;

      const maxRowsThisPage = Math.floor((availableSpace - headerHeight) / rowHeight);
      const rowsToDrawThisPage = Math.min(maxRowsThisPage, rows - currentRowIndex);

      // Get data slice for this page
      const leftDataSlice = leftTableData.slice(currentRowIndex, currentRowIndex + rowsToDrawThisPage);
      const rightDataSlice = rightTableData.slice(currentRowIndex, currentRowIndex + rowsToDrawThisPage);

      const tableStartY = currentYPosition;

      // Draw left table
      drawTableHeader(leftTableX+1, tableStartY);
      drawTableRows(leftTableX+1, tableStartY, leftDataSlice);
      drawTableBorders(leftTableX+1, tableStartY, rowsToDrawThisPage);

      // Draw right table
      drawTableHeader(rightTableX, tableStartY);
      drawTableRows(rightTableX, tableStartY, rightDataSlice);
      drawTableBorders(rightTableX, tableStartY, rowsToDrawThisPage);

      // Update position
      const tableHeight = headerHeight + (rowsToDrawThisPage * rowHeight);
      currentYPosition = tableStartY + tableHeight;
      currentRowIndex += rowsToDrawThisPage;

      // If more rows remain, add a new page
      if (currentRowIndex < rows) {
        doc.addPage();
        currentPage++;
        currentYPosition = topMarginNewPage;
      }
    }

    yPosition = currentYPosition;

    // Helper function to calculate GSM/BF/Shade-wise totals
    const calculateGsmBfTotals = (tableData: any[]) => {
      const totalsMap = new Map<string, { gsm: string, bf: string, shade: string, items: number, weight: number }>();

      tableData.forEach(row => {
        if (row[0] !== '') { // Skip empty rows
          const gsm = row[1];
          const bf = row[2];
          const shade = row[6]; // Shade column
          const weight = parseFloat(row[5]) || 0;
          const key = `${gsm}-${bf}-${shade}`;

          if (totalsMap.has(key)) {
            const existing = totalsMap.get(key)!;
            existing.items += 1;
            existing.weight += weight;
          } else {
            totalsMap.set(key, { gsm, bf, shade, items: 1, weight });
          }
        }
      });

      return Array.from(totalsMap.values());
    };

    // Calculate GSM/BF-wise totals for both tables
    const leftTotals = calculateGsmBfTotals(leftTableData);
    const rightTotals = calculateGsmBfTotals(rightTableData);

    // Add TOTAL rows - 2 GSM/BF combinations per row
    const totalRowHeight = 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    // Combine totals from both tables
    const allTotals = [...leftTotals, ...rightTotals];

    // Remove duplicates by creating a new map
    const uniqueTotalsMap = new Map<string, { gsm: string, bf: string, shade: string, items: number, weight: number }>();
    allTotals.forEach(total => {
      const key = `${total.gsm}-${total.bf}-${total.shade}`;
      if (uniqueTotalsMap.has(key)) {
        const existing = uniqueTotalsMap.get(key)!;
        existing.items += total.items;
        existing.weight += total.weight;
      } else {
        uniqueTotalsMap.set(key, { ...total });
      }
    });

    const uniqueTotals = Array.from(uniqueTotalsMap.values());

    // Draw total rows - 3 combinations per row
    const totalRows = Math.ceil(uniqueTotals.length / 3);
    for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
      const currentY = yPosition + (rowIndex * totalRowHeight);
      const firstTotal = uniqueTotals[rowIndex * 3];
      const secondTotal = uniqueTotals[rowIndex * 3 + 1];
      const thirdTotal = uniqueTotals[rowIndex * 3 + 2];

      // First combination
      if (firstTotal) {
        const firstText = `${firstTotal.gsm}gsm, ${firstTotal.bf}bf, ${firstTotal.shade} : ${firstTotal.items} | ${Math.round(firstTotal.weight)} kg`;
        doc.text(firstText, 2, currentY + totalRowHeight / 2 + 1);
      }

      // Second combination
      if (secondTotal) {
        const secondText = `${secondTotal.gsm}gsm, ${secondTotal.bf}bf, ${secondTotal.shade} : ${secondTotal.items} | ${Math.round(secondTotal.weight)} kg`;
        doc.text(secondText, pageWidth / 3, currentY + totalRowHeight / 2 + 1);
      }

      // Third combination
      if (thirdTotal) {
        const thirdText = `${thirdTotal.gsm}gsm, ${thirdTotal.bf}bf, ${thirdTotal.shade} : ${thirdTotal.items} | ${Math.round(thirdTotal.weight)} kg`;
        doc.text(thirdText, (pageWidth / 3) * 2, currentY + totalRowHeight / 2 + 1);
      }
    }

    // Update yPosition after TOTAL rows
    yPosition += totalRows * totalRowHeight;

    // Footer table with 3 columns (half width)
    const footerStartY = yPosition +1;
    const footerHeight = 12;
    const footerTotalWidth = tableWidth; // Half the page width
    const footerColWidth = footerTotalWidth / 3;

    // Draw footer boxes and labels (no borders)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    // Column headers and values
    const footerHeaders = ['Total Items', 'Total Weight', 'Freight'];
    const footerValues = [totalItems.toString(), `${totalWeight} kg`, ''];

    for (let i = 0; i < 3; i++) {
      const x = i * footerColWidth;

      // Header box - Total Weight (index 1) is light gray, others are medium gray
      if (i === 1) {
        doc.setFillColor(180, 180, 180); // Light gray for Total Weight
      } else {
        doc.setFillColor(140, 140, 140); // Medium gray for Total Items and Freight
      }
      doc.rect(x+1, footerStartY, footerColWidth, footerHeight, 'F');

      // Header text (white)
      doc.setTextColor(255, 255, 255);
      doc.text(footerHeaders[i], x + footerColWidth / 2, footerStartY + footerHeight / 2 + 1, { align: 'center' });

      // Value box - Total Weight (index 1) is medium gray, others are light gray
      if (i === 1) {
        doc.setFillColor(140, 140, 140); // Medium gray for Total Weight
      } else {
        doc.setFillColor(220, 220, 220); // Light gray for Total Items and Freight
      }
      doc.rect(x+1, footerStartY + footerHeight, footerColWidth, footerHeight, 'F');

      // Value text (black)
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text(footerValues[i], x + footerColWidth / 2, footerStartY + footerHeight + footerHeight / 2 + 1, { align: 'center' });
      doc.setFont('helvetica', 'bold');
    }

    // Add Manager and In-charge labels in the right half
    const rightHalfStartX = footerTotalWidth + 10; // Start after the boxes with some gap
    const rightHalfWidth = pageWidth - footerTotalWidth;
    const labelSpacing = rightHalfWidth / 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);

    // Manager label
    doc.text('Manager', rightHalfStartX + labelSpacing / 2-20, footerStartY + footerHeight, { align: 'center' });

    // In-charge label
    doc.text('In-charge', rightHalfStartX + labelSpacing - 10 + labelSpacing / 2, footerStartY + footerHeight, { align: 'center' });

    // Add Quality Check Data section if available
    if (data.qualityCheckData && data.qualityCheckData.length > 0) {
      yPosition = footerStartY + footerHeight * 2 + 10;
      
      // Check if we need a new page
      if (yPosition + 40 > pageHeight - bottomMargin) {
        doc.addPage();
        yPosition = 20;
      }

      // Quality Check Title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('QC Parameters', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;

      // QC Table configuration - Two tables side by side
      const qcHeaders = ['Reel No', 'GSM', 'BF', 'Cobb'];
      const qcTableGap = 2;
      const qcSingleTableWidth = (pageWidth - qcTableGap) / 2;
      
      const qcColWidths = [
        qcSingleTableWidth * 0.40, // Barcode ID
        qcSingleTableWidth * 0.20, // GSM
        qcSingleTableWidth * 0.20, // BF
        qcSingleTableWidth * 0.20  // Cobb
      ];
      
      const qcTableWidth = qcColWidths.reduce((a, b) => a + b, 0);
      const qcHeaderHeight = 8;
      const qcRowHeight = 7;

      // Split QC data into two halves
      const qcMidpoint = Math.ceil(data.qualityCheckData.length / 2);
      const leftQCData = data.qualityCheckData.slice(0, qcMidpoint);
      const rightQCData = data.qualityCheckData.slice(qcMidpoint);

      // Prepare table data
      const leftQCTableData = leftQCData.map(qc => [
        extractReelNumber(qc.barcode_id),
        qc.gsm || '-',
        qc.bf || '-',
        qc.cobb_value || '-'
      ]);

      const rightQCTableData = rightQCData.map(qc => [
        extractReelNumber(qc.barcode_id),
        qc.gsm || '-',
        qc.bf || '-',
        qc.cobb_value || '-'
      ]);

      // Helper to draw QC table headers
      const drawQCHeaders = (startX: number, startY: number) => {
        doc.setFillColor(140, 140, 140);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);

        // Draw all header rectangles first
        let currentX = startX;
        qcHeaders.forEach((header, i) => {
          doc.rect(currentX, startY, qcColWidths[i], qcHeaderHeight, 'F');
          currentX += qcColWidths[i];
        });

        // Then draw all header text
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        currentX = startX;
        qcHeaders.forEach((header, i) => {
          doc.text(header, currentX + qcColWidths[i] / 2, startY + qcHeaderHeight / 2 + 1, { align: 'center' });
          currentX += qcColWidths[i];
        });
      };

      // Helper to draw QC table rows
      const drawQCRows = (startX: number, startY: number, tableData: string[][]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);

        let currentY = startY + qcHeaderHeight;
        tableData.forEach((row, rowIndex) => {
          // Alternating row colors - white and light gray
          if (rowIndex % 2 === 1) {
            doc.setFillColor(230, 230, 230); // Light gray for odd rows
            doc.rect(startX, currentY, qcTableWidth, qcRowHeight, 'F');
          }

          let currentX = startX;
          row.forEach((cell, colIndex) => {
            doc.text(cell, currentX + qcColWidths[colIndex] / 2, currentY + qcRowHeight / 2 + 1, { align: 'center' });
            currentX += qcColWidths[colIndex];
          });
          currentY += qcRowHeight;
        });
      };

      // Helper to draw QC table borders
      const drawQCTableBorders = (startX: number, startY: number, numRows: number) => {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);

        const tableHeight = qcHeaderHeight + (numRows * qcRowHeight);

        // Outer border
        doc.rect(startX, startY, qcTableWidth, tableHeight, 'S');

        // Vertical lines between columns
        let x = startX;
        for (let i = 0; i < qcColWidths.length - 1; i++) {
          x += qcColWidths[i];
          doc.line(x, startY, x, startY + tableHeight);
        }

        // Horizontal line after header
        doc.line(startX, startY + qcHeaderHeight, startX + qcTableWidth, startY + qcHeaderHeight);
      };

      // Calculate positions for both tables
      const leftQCTableX = 0;
      const rightQCTableX = qcTableWidth + qcTableGap;

      // Calculate available space
      const qcAvailableHeightFirstPage = pageHeight - bottomMargin - yPosition;
      const qcAvailableHeightNewPage = pageHeight - 20 - bottomMargin;

      let currentQCRowIndex = 0;
      let currentQCPage = 1;
      let currentQCYPosition = yPosition;
      const qcTotalRows = Math.max(leftQCTableData.length, rightQCTableData.length);

      while (currentQCRowIndex < qcTotalRows) {
        // Calculate available space
        const qcAvailableSpace = currentQCPage === 1
          ? qcAvailableHeightFirstPage
          : qcAvailableHeightNewPage;

        const maxQCRowsThisPage = Math.floor((qcAvailableSpace - qcHeaderHeight) / qcRowHeight);
        const qcRowsToDrawThisPage = Math.min(maxQCRowsThisPage, qcTotalRows - currentQCRowIndex);

        // Get data slices
        const leftQCSlice = leftQCTableData.slice(currentQCRowIndex, currentQCRowIndex + qcRowsToDrawThisPage);
        const rightQCSlice = rightQCTableData.slice(currentQCRowIndex, currentQCRowIndex + qcRowsToDrawThisPage);

        // Draw left table
        if (leftQCSlice.length > 0) {
          drawQCHeaders(leftQCTableX, currentQCYPosition);
          drawQCRows(leftQCTableX, currentQCYPosition, leftQCSlice);
          drawQCTableBorders(leftQCTableX, currentQCYPosition, leftQCSlice.length);
        }

        // Draw right table
        if (rightQCSlice.length > 0) {
          drawQCHeaders(rightQCTableX, currentQCYPosition);
          drawQCRows(rightQCTableX, currentQCYPosition, rightQCSlice);
          drawQCTableBorders(rightQCTableX, currentQCYPosition, rightQCSlice.length);
        }

        currentQCRowIndex += qcRowsToDrawThisPage;
        currentQCYPosition += qcHeaderHeight + (qcRowsToDrawThisPage * qcRowHeight);

        // Add new page if more rows remain
        if (currentQCRowIndex < qcTotalRows) {
          doc.addPage();
          currentQCPage++;
          currentQCYPosition = 20;
        }
      }
    }

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
    order_frontend_id: item.order_frontend_id,
    barcode_id: item.barcode_id // Keep original barcode for QC lookup
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
    items,
    qualityCheckData: dispatch.qualityCheckData || [] // Include QC data if available
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