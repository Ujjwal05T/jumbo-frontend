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
    doc.text('Cash Challan: ' + (data.invoice_number || 'CASH/25-26/001'), 12, yPosition + 6);
    doc.text('Date: ' + new Date(data.invoice_date).toLocaleDateString('en-GB'), 12, yPosition + 12);
    
    doc.text('Transport: ' + (data.transport_mode || 'By Road'), 80, yPosition + 6);
    doc.text('Vehicle: ' + (data.vehicle_number || 'N/A'), 80, yPosition + 12);
    
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

    // Items Table Header - Compact
    const rowHeight = 10;
    const colWidths = [12, 45, 18, 15, 20, 20, 25, 35];
    let currentX = 10;

    // Draw table header
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, rowHeight, 'F');
    doc.rect(10, yPosition, pageWidth - 20, rowHeight);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    
    const headers = ['S.No.', 'Description', 'UOM', 'QTY', 'Rate', 'Amount', 'Total', 'Order ID'];
    headers.forEach((header, index) => {
      // Truncate header if too long
      const truncatedHeader = header.length > 8 ? header.substring(0, 8) : header;
      doc.text(truncatedHeader, currentX + colWidths[index] / 2, yPosition + 6, { align: 'center' });
      if (index < headers.length - 1) {
        doc.line(currentX + colWidths[index], yPosition, currentX + colWidths[index], yPosition + rowHeight);
      }
      currentX += colWidths[index];
    });

    yPosition += rowHeight;
    let itemNumber = 1;
    let totalAmount = 0;

    // Add items from all orders - Compact
    data.orders.forEach(order => {
      order.order_items.forEach(item => {
        if (yPosition + rowHeight > pageHeight - 60) {
          // Start new page if needed
          doc.addPage();
          yPosition = 20;
        }

        // Draw row
        doc.rect(10, yPosition, pageWidth - 20, rowHeight);
        currentX = 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);

        // S. No.
        doc.text(itemNumber.toString(), currentX + colWidths[0] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[0];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Description - Compact
        const paperName = item.paper.name.substring(0, 12);
        doc.setFont('helvetica', 'bold');
        doc.text(paperName, currentX + 1, yPosition + 3);
        doc.setFont('helvetica', 'normal');
        doc.text(`G${item.paper.gsm} B${item.paper.bf}`, currentX + 1, yPosition + 7);
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

        // Amount
        doc.text(item.amount.toFixed(0), currentX + colWidths[5] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[5];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Total
        doc.text(item.amount.toFixed(0), currentX + colWidths[6] / 2, yPosition + 6, { align: 'center' });
        currentX += colWidths[6];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Order ID - Truncated
        const orderId = order.frontend_id;
        doc.text(orderId, currentX + colWidths[7] / 2, yPosition + 6, { align: 'center' });

        totalAmount += item.amount;
        itemNumber++;
        yPosition += rowHeight;
      });
    });

    // Totals Section - Compact
    yPosition += 5;
    doc.rect(10, yPosition, pageWidth - 20, 30);
    
    // Amount in words (left side)
    doc.rect(10, yPosition, (pageWidth - 20) * 0.65, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Total Amount in Words:', 12, yPosition + 8);

    // Amount summary (right side)
    const summaryX = 10 + (pageWidth - 20) * 0.65;
    doc.setFontSize(9);
    doc.text('Total Amount:', summaryX + 3, yPosition + 10);
    doc.text('Rs. '+ totalAmount.toFixed(2), summaryX + 35, yPosition + 10);
    
    doc.setFont('helvetica', 'bold');
    doc.text('GRAND TOTAL:', summaryX + 3, yPosition + 22);
    doc.text('Rs. '+ totalAmount.toFixed(2), summaryX + 35, yPosition + 22);

    yPosition += 35;

    // Footer Section - Compact
    doc.rect(10, yPosition, pageWidth - 20, 30);
    
    // Combined Bank Details and Terms
    doc.rect(10, yPosition, (pageWidth - 80)*2 / 3, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
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
    doc.rect(signX, yPosition, (pageWidth - 20) / 3, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Certified that the particulars given above are true', signX + 3, yPosition + 6);
    doc.text('and correct.', signX + 3, yPosition + 10);
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
    
    // Compact info layout
    doc.text('Tax Invoice: ' + (data.invoice_number || 'GST/25-26/001'), 12, yPosition + 6);
    doc.text('Date: ' + new Date(data.invoice_date).toLocaleDateString('en-GB'), 12, yPosition + 12);
    
    doc.text('Transport: ' + (data.transport_mode || 'By Road'), 80, yPosition + 6);
    doc.text('Vehicle: ' + (data.vehicle_number || 'N/A'), 80, yPosition + 12);
    
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
      doc.text('BILL TO CONSIGNEE', 12, yPosition + 6);
      doc.setFont('helvetica', 'normal');
      doc.text('M/s. ' + client.company_name.substring(0, 25), 12, yPosition + 12);
      if (client.address) {
        doc.text(client.address.substring(0, 40), 12, yPosition + 18);
      }

      // Ship To section
      doc.setFont('helvetica', 'bold');
      doc.text('(SHIP TO)', pageWidth / 2 + 12, yPosition + 6);
      doc.setFont('helvetica', 'normal');
      doc.text('M/s. ' + client.company_name.substring(0, 25), pageWidth / 2 + 12, yPosition + 12);
      if (client.address) {
        doc.text(client.address.substring(0, 40), pageWidth / 2 + 12, yPosition + 18);
      }
    }

    yPosition += 30;

    // GST Items Table Header - Ultra compact
    const rowHeight = 12;
    const colWidths = [8, 28, 12, 8, 10, 10, 8, 15, 8, 10, 8, 10, 15];
    let currentX = 10;

    // Draw table header
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, rowHeight, 'F');
    doc.rect(10, yPosition, pageWidth - 20, rowHeight);

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    
    const headers = ['S.No', 'Description', 'HSN', 'UOM', 'QTY', 'Rate', 'Disc', 'Taxable', 'CGST%', 'CGST₹', 'SGST%', 'SGST₹', 'Total'];
    headers.forEach((header, index) => {
      doc.text(header, currentX + colWidths[index] / 2, yPosition + 7, { align: 'center' });
      if (index < headers.length - 1) {
        doc.line(currentX + colWidths[index], yPosition, currentX + colWidths[index], yPosition + rowHeight);
      }
      currentX += colWidths[index];
    });

    yPosition += rowHeight;
    let itemNumber = 1;
    let totalTaxableValue = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let grandTotal = 0;

    // Add items from all orders - Ultra compact
    data.orders.forEach(order => {
      order.order_items.forEach(item => {
        if (yPosition + rowHeight > pageHeight - 70) {
          doc.addPage();
          yPosition = 20;
        }

        // Calculate tax
        const taxableValue = item.amount;
        const cgstRate = 6;
        const sgstRate = 6;
        const cgstAmount = (taxableValue * cgstRate) / 100;
        const sgstAmount = (taxableValue * sgstRate) / 100;
        const totalItemAmount = taxableValue + cgstAmount + sgstAmount;

        // Draw row
        doc.rect(10, yPosition, pageWidth - 20, rowHeight);
        currentX = 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);

        // S. No.
        doc.text(itemNumber.toString(), currentX + colWidths[0] / 2, yPosition + 7, { align: 'center' });
        currentX += colWidths[0];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Description - Very compact
        const paperName = item.paper.name.substring(0, 8);
        doc.setFont('helvetica', 'bold');
        doc.text(paperName, currentX + 1, yPosition + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`G${item.paper.gsm}`, currentX + 1, yPosition + 8);
        currentX += colWidths[1];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // HSN/SAC
        doc.text('4804', currentX + colWidths[2] / 2, yPosition + 7, { align: 'center' });
        currentX += colWidths[2];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // UOM
        doc.text('KGS', currentX + colWidths[3] / 2, yPosition + 7, { align: 'center' });
        currentX += colWidths[3];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // QTY
        const qty = item.quantity_kg || (item.quantity_rolls * 50);
        doc.text(qty.toString(), currentX + colWidths[4] / 2, yPosition + 7, { align: 'center' });
        currentX += colWidths[4];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Rate
        const rate = item.rate || (item.amount / qty);
        doc.text(rate.toFixed(1), currentX + colWidths[5] / 2, yPosition + 7, { align: 'center' });
        currentX += colWidths[5];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Discount
        doc.text('0', currentX + colWidths[6] / 2, yPosition + 7, { align: 'center' });
        currentX += colWidths[6];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Taxable Value
        doc.text(taxableValue.toFixed(0), currentX + colWidths[7] / 2, yPosition + 7, { align: 'center' });
        currentX += colWidths[7];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // CGST Rate
        doc.text('6%', currentX + colWidths[8] / 2, yPosition + 7, { align: 'center' });
        currentX += colWidths[8];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // CGST Amount
        doc.text(cgstAmount.toFixed(0), currentX + colWidths[9] / 2, yPosition + 7, { align: 'center' });
        currentX += colWidths[9];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // SGST Rate
        doc.text('6%', currentX + colWidths[10] / 2, yPosition + 7, { align: 'center' });
        currentX += colWidths[10];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // SGST Amount
        doc.text(sgstAmount.toFixed(0), currentX + colWidths[11] / 2, yPosition + 7, { align: 'center' });
        currentX += colWidths[11];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Total
        doc.text(totalItemAmount.toFixed(0), currentX + colWidths[12] / 2, yPosition + 7, { align: 'center' });

        totalTaxableValue += taxableValue;
        totalCGST += cgstAmount;
        totalSGST += sgstAmount;
        grandTotal += totalItemAmount;
        itemNumber++;
        yPosition += rowHeight;
      });
    });

    // Totals Section - Compact
    yPosition += 5;
    doc.rect(10, yPosition, pageWidth - 20, 35);
    
    // Amount in words (left side)
    doc.rect(10, yPosition, (pageWidth - 20) * 0.6, 35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Total Invoice Amount in Words:', 12, yPosition + 8);
    
    // Amount summary (right side)
    const summaryX = 10 + (pageWidth - 20) * 0.6;
    doc.rect(summaryX, yPosition, (pageWidth - 20) * 0.4, 35);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Before Tax:', summaryX + 2, yPosition + 6);
    doc.text('₹' + totalTaxableValue.toFixed(2), summaryX + 30, yPosition + 6);
    
    doc.text('CGST (6%):', summaryX + 2, yPosition + 12);
    doc.text('₹' + totalCGST.toFixed(2), summaryX + 30, yPosition + 12);
    
    doc.text('SGST (6%):', summaryX + 2, yPosition + 18);
    doc.text('₹' + totalSGST.toFixed(2), summaryX + 30, yPosition + 18);
    
    doc.text('ROUND Off:', summaryX + 2, yPosition + 24);
    doc.text('₹0.00', summaryX + 30, yPosition + 24);
    
    doc.setFont('helvetica', 'bold');
    doc.text('GRAND TOTAL:', summaryX + 2, yPosition + 32);
    doc.text('₹' + grandTotal.toFixed(2), summaryX + 30, yPosition + 32);

    yPosition += 40;

    // Footer Section - Compact
    doc.rect(10, yPosition, pageWidth - 20, 30);
    
    // Bank Details
    doc.rect(10, yPosition, (pageWidth - 20) / 3, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('Bank Details:', 12, yPosition + 6);
    doc.setFont('helvetica', 'normal');
    doc.text('A/c: 657105601626', 12, yPosition + 12);
    doc.text('IFSC: ICIC0006571', 12, yPosition + 18);

    // Terms
    const termsX = 10 + (pageWidth - 20) / 3;
    doc.rect(termsX, yPosition, (pageWidth - 20) / 3, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions', termsX + 3, yPosition + 6);
    doc.setFont('helvetica', 'normal');
    doc.text('Payment Terms Days', termsX + 3, yPosition + 12);
    doc.text('GST no Reverse Charges', termsX + 3, yPosition + 18);

    // Signature
    const signX = 10 + (pageWidth - 20) * 2 / 3;
    doc.rect(signX, yPosition, (pageWidth - 20) / 3, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('For SATGURU PAPER', signX + 3, yPosition + 12);
    doc.text('Common Seal', signX + 3, yPosition + 25);

    // Save the PDF
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
export const convertOrdersToChallanData = (orders: any[], type: 'cash' | 'bill'): ChallanData => {
  return {
    type,
    orders,
    invoice_number: type === 'cash' ? 'CASH/25-26/001' : 'GST/25-26/001',
    invoice_date: new Date().toISOString(),
    vehicle_number: '',
    transport_mode: 'By Road',
    po_number: '',
    po_date: new Date().toISOString(),
    state: 'M.P'
  };
};