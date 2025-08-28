import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface OrderPDFData {
  frontend_id?: string;
  id: string;
  created_at: string;
  payment_type: string;
  priority?: string;
  client?: {
    company_name: string;
    contact_person?: string;
  };
  order_items: Array<{
    paper?: {
      name: string;
      gsm: number;
      bf: number;
      shade: string;
    };
    width_inches: number;
    quantity_rolls: number;
    quantity_kg: number;
    rate: number;
  }>;
}

export const generateOrderPDF = (order: OrderPDFData, includeRates: boolean = true): void => {
  const doc = new jsPDF();
  
  // Header - Order Details (Line 1)
  doc.setFontSize(12);
  doc.text(`Order ID: ${order.frontend_id || order.id}`, 20, 20);
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 120, 20);
  doc.text(`${order.payment_type.toUpperCase()}`, 170, 20);
  
  // Priority (Line 2)
  doc.text(`Priority: ${order.priority || 'Normal'}`, 20, 35);
  
  // Client (Line 3) - moved to new row to prevent overflow
  doc.text(`Client: ${order.client?.company_name || 'N/A'}`, 20, 50);
  if (order.client?.contact_person) {
    doc.text(`Contact: ${order.client.contact_person}`, 120, 50);
  }
  
  // Calculate totals
  const totalRolls = order.order_items?.reduce((sum, item) => sum + (item.quantity_rolls || 0), 0) || 0;
  const totalWeight = order.order_items?.reduce((sum, item) => sum + (item.quantity_kg || 0), 0) || 0;
  
  // Prepare table headers and data based on includeRates
  let headers, tableData, columnStyles;
  
  if (includeRates) {
    headers = ['#', 'Paper', 'GSM', 'BF', 'Shade', 'Width', 'Qty', 'Weight', 'Rate'];
    tableData = order.order_items?.map((item, index) => [
      index + 1,
      item.paper?.name || 'N/A',
      `${item.paper?.gsm || 0}gsm`,
      `${item.paper?.bf || 0}`,
      item.paper?.shade || 'N/A',
      `${item.width_inches || 0}"`,
      item.quantity_rolls || 0,
      `${item.quantity_kg || 0}kg`,
      (item.rate || 0).toFixed(2)
    ]) || [];
    
    // Add totals row
    tableData.push([
      '',
      'TOTAL',
      '',
      '',
      '',
      '',
      totalRolls,
      `${totalWeight.toFixed(2)}kg`,
      ''
    ]);
    
    columnStyles = {
      0: { halign: 'center', cellWidth: 15 },
      1: { cellWidth: 40 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 15 },
      4: { cellWidth: 25 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'center', cellWidth: 15 },
      7: { halign: 'center', cellWidth: 25 },
      8: { halign: 'center', cellWidth: 20 }
    };
  } else {
    headers = ['#', 'Paper', 'GSM', 'BF', 'Shade', 'Width', 'Qty', 'Weight'];
    tableData = order.order_items?.map((item, index) => [
      index + 1,
      item.paper?.name || 'N/A',
      `${item.paper?.gsm || 0}gsm`,
      `${item.paper?.bf || 0}`,
      item.paper?.shade || 'N/A',
      `${item.width_inches || 0}"`,
      item.quantity_rolls || 0,
      `${item.quantity_kg || 0}kg`
    ]) || [];
    
    // Add totals row
    tableData.push([
      '',
      'TOTAL',
      '',
      '',
      '',
      '',
      totalRolls,
      `${totalWeight.toFixed(2)}kg`
    ]);
    
    columnStyles = {
      0: { halign: 'center', cellWidth: 15 },
      1: { cellWidth: 50 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 15 },
      4: { cellWidth: 35 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 22 }
    };
  }
  
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 65,
    styles: {
      fontSize: 9,
      cellPadding: 2,
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255]
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8
    },
    columnStyles: columnStyles as any,
    margin: { left: 10, right: 10 },
    didParseCell: function (data) {
      // Style the totals row
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
    }
  });
  
  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, pageHeight - 10);
  
  // Save the PDF
  const rateText = includeRates ? 'with-rates' : 'without-rates';
  const filename = `order-${order.frontend_id || order.id}-${rateText}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};