import jsPDF from 'jspdf';

export interface ChallanOrderItem {
  id: string;
  frontend_id: string;
  order_items: Array<{
    id: string;
    paper: {
      name: string;
      gsm: number;
      bf: number;
      shade?: string;
    };
    width_inches: number;
    quantity_rolls: number;
    rate?: number;
    amount: number;
    quantity_kg?: number;
  }>;
  client: {
    company_name: string;
    contact_person?: string;
    address?: string;
    phone?: string;
    email?: string;
    gst_number?: string;
  };
  payment_type: string;
  delivery_date?: string;
  created_at: string;
}

export interface ChallanData {
  type: 'cash' | 'bill';
  orders: ChallanOrderItem[];
  invoice_number?: string;
  invoice_date: string;
  vehicle_number?: string;
  transport_mode?: string;
  po_number?: string;
  po_date?: string;
  state?: string;
  vehicle_info?: {
    vehicle_number?: string;
    driver_name?: string;
    driver_mobile?: string;
    dispatch_date?: string;
    dispatch_number?: string;
    reference_number?: string;
  };
}

/**
 * Generate Cash Challan PDF
 */
export const generateCashChallanPDF = (data: ChallanData): void => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 15;

    // Original Copy watermark
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('ORIGINAL COPY', pageWidth - 15, 12, { align: 'right' });

    // Header Section - Compact
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, pageWidth - 20, 35);
    
    // Company Header
    doc.setFillColor(240, 240, 240);
    doc.rect(10, 10, pageWidth - 20, 35, 'F');
    doc.rect(10, 10, pageWidth - 20, 35);

    // Company Name
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SATGURU PAPER PRIVATE LIMITED', pageWidth / 2, 20, { align: 'center' });

    // Company Details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Plot no 528,533,534 Sector - 3, Pithampur, Distt. Dhar (M.P.) | Tel. +07292-400430', pageWidth / 2, 27, { align: 'center' });

    // GSTIN
    doc.setFont('helvetica', 'bold');
    doc.text('GSTIN : 23ABJCS6590E1Z6', pageWidth / 2, 40, { align: 'center' });

    yPosition = 50;

    // Invoice Information Section - Compact
    doc.setFillColor(249, 249, 249);
    doc.rect(10, yPosition, pageWidth - 20, 20, 'F');
    doc.rect(10, yPosition, pageWidth - 20, 20);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    
    // Compact info layout
    doc.text('Challan: ' + (data.invoice_number || 'CASH/25-26/001'), 12, yPosition + 6);
    doc.text('Date: ' + new Date(data.invoice_date).toLocaleDateString('en-GB'), 12, yPosition + 12);
    
    doc.text('Transport: ' + (data.transport_mode || 'By Road'), 80, yPosition + 6);
    doc.text('Vehicle: ' + (data.vehicle_info?.vehicle_number || data.vehicle_number || 'N/A'), 80, yPosition + 12);
    
    doc.text('PO NO: ' + (data.orders[0]?.frontend_id || 'N/A'), 140, yPosition + 6);
    doc.text('State: ' + (data.state || 'M.P'), 140, yPosition + 12);

    yPosition += 25;

    // Client Details Section - Compact
    if (data.orders.length > 0) {
      const firstOrder = data.orders[0];
      const client = firstOrder.client;

      doc.rect(10, yPosition, pageWidth - 20, 25);
      
      // Bill To section
      doc.rect(10, yPosition, (pageWidth - 20) / 2, 25);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('BILL TO', 12, yPosition + 6);
      doc.setFont('helvetica', 'normal');
      doc.text('M/s. ' + client.company_name.substring(0, 25), 12, yPosition + 12);
      if (client.address) {
        const address = client.address.substring(0, 40);
        doc.text(address, 12, yPosition + 18);
      }

      // Ship To section
      doc.setFont('helvetica', 'bold');
      doc.text('CONSIGNEE (SHIP TO)', pageWidth / 2 + 12, yPosition + 6);
      doc.setFont('helvetica', 'normal');
      doc.text('M/s. ' + client.company_name.substring(0, 25), pageWidth / 2 + 12, yPosition + 12);
      if (client.address) {
        const address = client.address.substring(0, 40);
        doc.text(address, pageWidth / 2 + 12, yPosition + 18);
      }
    }

    yPosition += 30;

    // Items Table Header - Compact with GST columns
    const rowHeight = 10;
    const colWidths = [12, 40, 15, 15, 18, 18, 15, 15, 15, 20];
    let currentX = 10;

    // Draw table header
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, rowHeight, 'F');
    doc.rect(10, yPosition, pageWidth - 20, rowHeight);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    
    const headers = ['S.No.', 'Description', 'UOM', 'QTY', 'Rate', 'Taxable', 'CGST', 'SGST', 'Tax Amt', 'Total'];
    headers.forEach((header, index) => {
      doc.text(header, currentX + colWidths[index] / 2, yPosition + 6, { align: 'center' });
      if (index < headers.length - 1) {
        doc.line(currentX + colWidths[index], yPosition, currentX + colWidths[index], yPosition + rowHeight);
      }
      currentX += colWidths[index];
    });

    yPosition += rowHeight;
    let itemNumber = 1;
    let totalTaxableAmount = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let grandTotal = 0;

    // Add items from all orders - Compact with GST calculations
    data.orders.forEach(order => {
      order.order_items.forEach(item => {
        if (yPosition + rowHeight > pageHeight - 60) {
          // Start new page if needed
          doc.addPage();
          yPosition = 20;
        }

        // Calculate GST amounts
        const taxableValue = item.amount;
        const cgstRate = 6;
        const sgstRate = 6;
        const cgstAmount = (taxableValue * cgstRate) / 100;
        const sgstAmount = (taxableValue * sgstRate) / 100;
        const totalTaxAmount = cgstAmount + sgstAmount;
        const totalItemAmount = taxableValue + cgstAmount + sgstAmount;

        // Draw row
        doc.rect(10, yPosition, pageWidth - 20, rowHeight);
        currentX = 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);

        // S. No.
        doc.text(itemNumber.toString(), currentX + colWidths[0] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[0];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Description - Compact
        const paperName = item.paper.name;
        doc.setFont('helvetica', 'bold');
        doc.text(paperName, currentX + 1, yPosition + 3);
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // UOM
        doc.text('KGS', currentX + colWidths[2] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[2];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // QTY
        const qty = item.quantity_kg || (item.quantity_rolls * 50);
        doc.text(qty.toString(), currentX + colWidths[3] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[3];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Rate
        const rate = item.rate || (item.amount / qty);
        doc.text(rate.toFixed(1), currentX + colWidths[4] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[4];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Taxable Value (previously Amount)
        doc.text(taxableValue.toFixed(0), currentX + colWidths[5] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[5];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // CGST (6%)
        doc.text('6%', currentX + colWidths[6] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[6];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // SGST (6%)
        doc.text('6%', currentX + colWidths[7] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[7];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Tax Amount (CGST + SGST)
        doc.text(totalTaxAmount.toFixed(0), currentX + colWidths[8] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[8];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Total (Taxable + CGST + SGST)
        doc.text(totalItemAmount.toFixed(0), currentX + colWidths[9] / 2, yPosition + 6, { align: 'center' });

        // Update totals
        totalTaxableAmount += taxableValue;
        totalCGST += cgstAmount;
        totalSGST += sgstAmount;
        grandTotal += totalItemAmount;
        itemNumber++;
        yPosition += rowHeight;
      });
    });

    // Totals Section - Compact with GST breakdown
    yPosition += 5;
    doc.rect(10, yPosition, pageWidth - 20, 40);
    
    // Amount in words (left side)
    doc.rect(10, yPosition, (pageWidth - 20) * 0.6, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Total Invoice Amount in Words:', 12, yPosition + 8);

    // Amount summary (right side) with GST breakdown
    const summaryX = 10 + (pageWidth - 20) * 0.6;
    doc.rect(summaryX, yPosition, (pageWidth - 20) * 0.4, 40);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Before Tax:', summaryX + 2, yPosition + 8);
    doc.text('Rs. ' + totalTaxableAmount.toFixed(2), summaryX + 30, yPosition + 8);
    
    doc.text('CGST (6%):', summaryX + 2, yPosition + 16);
    doc.text('Rs. ' + totalCGST.toFixed(2), summaryX + 30, yPosition + 16);
    
    doc.text('SGST (6%):', summaryX + 2, yPosition + 24);
    doc.text('Rs. ' + totalSGST.toFixed(2), summaryX + 30, yPosition + 24);
    
    doc.text('Round Off:', summaryX + 2, yPosition + 32);
    doc.text('Rs. 0.00', summaryX + 30, yPosition + 32);
    
    doc.setFont('helvetica', 'bold');
    doc.text('GRAND TOTAL:', summaryX + 2, yPosition + 38);
    doc.text('Rs. ' + grandTotal.toFixed(2), summaryX + 30, yPosition + 38);

    yPosition += 45;

    // Footer Section - Compact
    doc.rect(10, yPosition, pageWidth - 20, 35);
    
    // Combined Bank Details and Terms
    doc.rect(10, yPosition, (pageWidth - 80)*2 / 3, 35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Bank Details:', 12, yPosition + 6);
    doc.setFont('helvetica', 'normal');
    doc.text('A/c: 657105601626', 12, yPosition + 12);
    doc.text('IFSC: ICIC0006571', 12, yPosition + 18);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions:', 12, yPosition + 24);
    doc.setFont('helvetica', 'normal');
    doc.text('Payment on delivery', 12, yPosition + 28);

    doc.text('Common Seal', 108, yPosition + 25);

    // Signature
    const signX = 10 + (pageWidth - 20) * 2 / 3;
    doc.rect(signX, yPosition, (pageWidth - 20) / 3, 35);
    doc.setFont('helvetica', 'bold');
    doc.text('Certified that the particulars given above are', signX + 3, yPosition + 6);
    doc.text('true and correct.', signX + 3, yPosition + 10);
    doc.text('For SATGURU PAPER PVT. LTD.', signX + 13, yPosition + 14);
    

    // Save the PDF
    const fileName = `cash_challan_${data.invoice_number || 'CASH001'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

  } catch (error) {
    console.error('Error generating Cash Challan PDF:', error);
    throw error;
  }
};

/**
 * Generate Bill/Invoice PDF (GST Tax Invoice) - Compact
 */
export const generateBillInvoicePDF = (data: ChallanData): void => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 15;

    // Original Copy watermark
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('ORIGINAL COPY', pageWidth - 15, 12, { align: 'right' });

    // Header Section - Compact
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, pageWidth - 20, 35);
    
    // Company Header
    doc.setFillColor(240, 240, 240);
    doc.rect(10, 10, pageWidth - 20, 35, 'F');
    doc.rect(10, 10, pageWidth - 20, 35);

    // Company Name
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SATGURU PAPER PRIVATE LIMITED', pageWidth / 2, 20, { align: 'center' });

    // Company Details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Plot no 528,533,534 Sector - 3, Pithampur, Distt. Dhar (M.P.) | Tel. +07292-400430', pageWidth / 2, 27, { align: 'center' });

    // GSTIN
    doc.setFont('helvetica', 'bold');
    doc.text('GSTIN : 23ABJCS6590E1Z6', pageWidth / 2, 40, { align: 'center' });

    yPosition = 50;

    // Invoice Information Section - Compact
    doc.setFillColor(249, 249, 249);
    doc.rect(10, yPosition, pageWidth - 20, 20, 'F');
    doc.rect(10, yPosition, pageWidth - 20, 20);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    
    // Compact info layout - Same as Cash Challan but with "Tax Invoice" instead of "Cash Challan"
    doc.text('Tax Invoice: ' + (data.invoice_number || 'GST/25-26/001'), 12, yPosition + 6);
    doc.text('Date: ' + new Date(data.invoice_date).toLocaleDateString('en-GB'), 12, yPosition + 12);
    
    doc.text('Transport: ' + (data.transport_mode || 'By Road'), 80, yPosition + 6);
    doc.text('Vehicle: ' + (data.vehicle_info?.vehicle_number || data.vehicle_number || 'N/A'), 80, yPosition + 12);
    
    doc.text('PO NO: ' + (data.orders[0]?.frontend_id || 'N/A'), 140, yPosition + 6);
    doc.text('State: ' + (data.state || 'M.P'), 140, yPosition + 12);

    yPosition += 25;

    // Client Details Section - Compact - Same as Cash Challan
    if (data.orders.length > 0) {
      const firstOrder = data.orders[0];
      const client = firstOrder.client;

      doc.rect(10, yPosition, pageWidth - 20, 25);
      
      // Bill To section
      doc.rect(10, yPosition, (pageWidth - 20) / 2, 25);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('BILL TO', 12, yPosition + 6);
      doc.setFont('helvetica', 'normal');
      doc.text('M/s. ' + client.company_name.substring(0, 25), 12, yPosition + 12);
      if (client.address) {
        const address = client.address.substring(0, 40);
        doc.text(address, 12, yPosition + 18);
      }

      // Ship To section
      doc.setFont('helvetica', 'bold');
      doc.text('CONSIGNEE (SHIP TO)', pageWidth / 2 + 12, yPosition + 6);
      doc.setFont('helvetica', 'normal');
      doc.text('M/s. ' + client.company_name.substring(0, 25), pageWidth / 2 + 12, yPosition + 12);
      if (client.address) {
        const address = client.address.substring(0, 40);
        doc.text(address, pageWidth / 2 + 12, yPosition + 18);
      }
    }

    yPosition += 30;

    // Items Table Header - Exact same as Cash Challan
    const rowHeight = 10;
    const colWidths = [12, 40, 15, 15, 18, 18, 15, 15, 15, 20];
    let currentX = 10;

    // Draw table header
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, rowHeight, 'F');
    doc.rect(10, yPosition, pageWidth - 20, rowHeight);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    
    const headers = ['S.No.', 'Description', 'UOM', 'QTY', 'Rate', 'Taxable', 'CGST', 'SGST', 'Tax Amt', 'Total'];
    headers.forEach((header, index) => {
      doc.text(header, currentX + colWidths[index] / 2, yPosition + 6, { align: 'center' });
      if (index < headers.length - 1) {
        doc.line(currentX + colWidths[index], yPosition, currentX + colWidths[index], yPosition + rowHeight);
      }
      currentX += colWidths[index];
    });

    yPosition += rowHeight;
    let itemNumber = 1;
    let totalTaxableAmount = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let grandTotal = 0;

    // Add items from all orders - Exact same as Cash Challan
    data.orders.forEach(order => {
      order.order_items.forEach(item => {
        if (yPosition + rowHeight > pageHeight - 60) {
          // Start new page if needed
          doc.addPage();
          yPosition = 20;
        }

        // Calculate GST amounts
        const taxableValue = item.amount;
        const cgstRate = 6;
        const sgstRate = 6;
        const cgstAmount = (taxableValue * cgstRate) / 100;
        const sgstAmount = (taxableValue * sgstRate) / 100;
        const totalTaxAmount = cgstAmount + sgstAmount;
        const totalItemAmount = taxableValue + cgstAmount + sgstAmount;

        // Draw row
        doc.rect(10, yPosition, pageWidth - 20, rowHeight);
        currentX = 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);

        // S. No.
        doc.text(itemNumber.toString(), currentX + colWidths[0] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[0];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Description - Compact
        const paperName = item.paper.name.substring(0, 10);
        doc.setFont('helvetica', 'bold');
        doc.text(paperName, currentX + 1, yPosition + 3);
        doc.setFont('helvetica', 'normal');
        doc.text(`G${item.paper.gsm}`, currentX + 1, yPosition + 7);
        currentX += colWidths[1];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // UOM
        doc.text('KGS', currentX + colWidths[2] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[2];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // QTY
        const qty = item.quantity_kg || (item.quantity_rolls * 50);
        doc.text(qty.toString(), currentX + colWidths[3] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[3];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Rate
        const rate = item.rate || (item.amount / qty);
        doc.text(rate.toFixed(1), currentX + colWidths[4] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[4];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Taxable Value (previously Amount)
        doc.text(taxableValue.toFixed(0), currentX + colWidths[5] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[5];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // CGST (6%)
        doc.text('6%', currentX + colWidths[6] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[6];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // SGST (6%)
        doc.text('6%', currentX + colWidths[7] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[7];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Tax Amount (CGST + SGST)
        doc.text(totalTaxAmount.toFixed(0), currentX + colWidths[8] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[8];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Total (Taxable + CGST + SGST)
        doc.text(totalItemAmount.toFixed(0), currentX + colWidths[9] / 2, yPosition + 6, { align: 'center' });

        // Update totals
        totalTaxableAmount += taxableValue;
        totalCGST += cgstAmount;
        totalSGST += sgstAmount;
        grandTotal += totalItemAmount;
        itemNumber++;
        yPosition += rowHeight;
      });
    });

    // Totals Section - Exact same as Cash Challan
    yPosition += 5;
    doc.rect(10, yPosition, pageWidth - 20, 40);
    
    // Amount in words (left side)
    doc.rect(10, yPosition, (pageWidth - 20) * 0.6, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Total Invoice Amount in Words:', 12, yPosition + 8);

    // Amount summary (right side) with GST breakdown
    const summaryX = 10 + (pageWidth - 20) * 0.6;
    doc.rect(summaryX, yPosition, (pageWidth - 20) * 0.4, 40);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Before Tax:', summaryX + 2, yPosition + 8);
    doc.text('Rs. ' + totalTaxableAmount.toFixed(2), summaryX + 30, yPosition + 8);
    
    doc.text('CGST (6%):', summaryX + 2, yPosition + 16);
    doc.text('Rs. ' + totalCGST.toFixed(2), summaryX + 30, yPosition + 16);
    
    doc.text('SGST (6%):', summaryX + 2, yPosition + 24);
    doc.text('Rs. ' + totalSGST.toFixed(2), summaryX + 30, yPosition + 24);
    
    doc.text('Round Off:', summaryX + 2, yPosition + 32);
    doc.text('Rs. 0.00', summaryX + 30, yPosition + 32);
    
    doc.setFont('helvetica', 'bold');
    doc.text('GRAND TOTAL:', summaryX + 2, yPosition + 38);
    doc.text('Rs. ' + grandTotal.toFixed(2), summaryX + 30, yPosition + 38);

    yPosition += 45;

    // Footer Section - Exact same as Cash Challan
    doc.rect(10, yPosition, pageWidth - 20, 35);
    
    // Combined Bank Details and Terms
    doc.rect(10, yPosition, (pageWidth - 80)*2 / 3, 35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Bank Details:', 12, yPosition + 6);
    doc.setFont('helvetica', 'normal');
    doc.text('A/c: 657105601626', 12, yPosition + 12);
    doc.text('IFSC: ICIC0006571', 12, yPosition + 18);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions:', 12, yPosition + 24);
    doc.setFont('helvetica', 'normal');
    doc.text('Payment on delivery', 12, yPosition + 28);

    doc.text('Common Seal', 108, yPosition + 25);

    // Signature - Exact same as Cash Challan
    const signX = 10 + (pageWidth - 20) * 2 / 3;
    doc.rect(signX, yPosition, (pageWidth - 20) / 3, 35);
    doc.setFont('helvetica', 'bold');
    doc.text('Certified that the particulars given above are ', signX + 3, yPosition + 6);
    doc.text('true and correct.', signX + 3, yPosition + 10);
    doc.text('For SATGURU PAPER PVT. LTD.', signX + 13, yPosition + 14);

    // Save the PDF - Different filename for tax invoice
    const fileName = `tax_invoice_${data.invoice_number || 'GST001'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

  } catch (error) {
    console.error('Error generating GST Tax Invoice PDF:', error);
    throw error;
  }
};

/**
 * Convert selected orders to challan data format
 */
export const convertOrdersToChallanData = (orders: any[], type: 'cash' | 'bill', dispatchInfo?: any): ChallanData => {
  return {
    type,
    orders,
    invoice_number: type === 'cash' ? 'CASH/25-26/001' : 'GST/25-26/001',
    invoice_date: new Date().toISOString(),
    vehicle_number: dispatchInfo?.vehicle_number || '',
    transport_mode: 'By Road',
    po_number: '',
    po_date: new Date().toISOString(),
    state: 'M.P',
    vehicle_info: dispatchInfo ? {
      vehicle_number: dispatchInfo.vehicle_number,
      driver_name: dispatchInfo.driver_name,
      driver_mobile: dispatchInfo.driver_mobile,
      dispatch_date: dispatchInfo.dispatch_date,
      dispatch_number: dispatchInfo.dispatch_number,
      reference_number: dispatchInfo.reference_number
    } : undefined
  };
};

export function convertDispatchToChallanData(
  dispatchDetails: any, 
  type: 'cash' | 'bill', 
  customAmount?: number
): ChallanData {
  const items = dispatchDetails.items || [];

  // Group dispatch items by paper specifications for proper display
  const paperGroups = items.reduce((groups: any, item: any) => {
    if (!item.paper_spec) return groups;
    
    // Parse paper_specs string format: "180gsm, 18.00bf, Golden"
    const specsString = item.paper_spec.toString();
    const parts = specsString.split(', ');

    if (parts.length < 3) return groups;
    
    const gsm = parseInt(parts[0].replace('gsm', ''));
    const bf = parseFloat(parts[1].replace('bf', ''));
    const shade = parts[2];
    
    const key = `${gsm}_${bf}_${shade}`;
    
    if (!groups[key]) {
      groups[key] = {
        paper: {
          name: `${gsm}GSM ${bf}BF ${shade}`,
          gsm: gsm,
          bf: bf,
          shade: shade
        },
        items: [],
        totalRolls: 0,
        totalWeight: 0,
        totalWidth: 0
      };
    }
    
    groups[key].items.push(item);
    groups[key].totalRolls += 1;
    groups[key].totalWeight += item.weight_kg || 0;
    groups[key].totalWidth += item.width_inches || 0;
    
    return groups;
  }, {});
  
  // Create order items from grouped paper specifications
  const orderItems = Object.values(paperGroups).map((group: any) => {
    const avgWidth = group.totalWidth / group.totalRolls;
    const groupAmount = customAmount 
      ? (customAmount / 1.12) * (group.totalWeight / dispatchDetails.total_weight_kg)
      : group.totalWeight * 50;
    
    return {
      id: `${dispatchDetails.id}_${group.paper.gsm}_${group.paper.bf}_${group.paper.shade}`,
      paper: group.paper,
      width_inches: avgWidth,
      quantity_rolls: group.totalRolls,
      rate: customAmount ? (groupAmount / group.totalWeight) : 50,
      amount: groupAmount,
      quantity_kg: group.totalWeight
    };
  });
  
  // Fallback for dispatches without proper item data
  if (orderItems.length === 0) {
    orderItems.push({
      id: dispatchDetails.id,
      paper: {
        name: 'Paper Products',
        gsm: 0,
        bf: 0,
        shade: 'Mixed'
      },
      width_inches: 0,
      quantity_rolls: dispatchDetails.total_items,
      rate: customAmount ? (customAmount / (1.12 * dispatchDetails.total_weight_kg)) : 50,
      amount: customAmount ? (customAmount / 1.12) : (dispatchDetails.total_weight_kg * 50),
      quantity_kg: dispatchDetails.total_weight_kg
    });
  }
  
  // Create order item with proper paper specifications
  const orderItem: ChallanOrderItem = {
    id: dispatchDetails.id,
    frontend_id: dispatchDetails.dispatch_number,
    order_items: orderItems,
    client: {
      company_name: dispatchDetails.client.company_name,
      contact_person: dispatchDetails.client.contact_person,
      address: dispatchDetails.client.address,
      phone: dispatchDetails.client.mobile,
      email: dispatchDetails.client.email,
      gst_number: dispatchDetails.client.gst_number
    },
    payment_type: dispatchDetails.payment_type,
    delivery_date: dispatchDetails.dispatch_date,
    created_at: dispatchDetails.created_at
  };

  const challanData: ChallanData = {
    type: type,
    orders: [orderItem],
    invoice_number: `INV-${dispatchDetails.dispatch_number}`,
    invoice_date: new Date().toISOString().split('T')[0],
    vehicle_number: dispatchDetails.vehicle_number,
    transport_mode: 'By Road',
    state: 'Gujarat',
    vehicle_info: {
      vehicle_number: dispatchDetails.vehicle_number,
      driver_name: dispatchDetails.driver_name,
      driver_mobile: dispatchDetails.driver_mobile,
      dispatch_date: dispatchDetails.dispatch_date,
      dispatch_number: dispatchDetails.dispatch_number,
      reference_number: dispatchDetails.reference_number
    }
  };

  return challanData;
};