/**
 * Plan Details page - Comprehensive view of a specific cutting plan
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, PRODUCTION_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  AlertCircle, 
  Play, 
  CheckCircle, 
  Factory, 
  QrCode,
  ScanLine, 
  Search, 
  Package, 
  Weight, 
  Ruler, 
  ArrowLeft,
  Calendar,
  User,
  Clock,
  MapPin,
  Download,
  FileText,
  BarChart3,
  Printer
} from "lucide-react";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import BarcodeDisplay from "@/components/BarcodeDisplay";
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

// Sequential transformation function to convert "INV-367" format to "JR-001", "JR-002", etc.
const transformJumboId = (jumboFrontendId: string | undefined, allJumboIds: string[]): string => {
  if (!jumboFrontendId) return "Unknown";
  
  // Create a sorted list of unique jumbo IDs to ensure consistent ordering
  const uniqueJumboIds = [...new Set(allJumboIds.filter(id => id && id !== 'ungrouped'))].sort();
  
  // Find the index of this jumbo ID in the sorted list
  const index = uniqueJumboIds.indexOf(jumboFrontendId);
  
  if (index >= 0) {
    // Convert to JR-00001, JR-00002, etc. format
    return `JR-${(index + 1).toString().padStart(5, '0')}`;
  }
  
  // Fallback: return as-is if not found
  return jumboFrontendId;
};

// Group cut rolls by jumbo roll with sequential display IDs
const groupCutRollsByJumboWithSequential = (cutRolls: CutRollItem[]): Record<string, { displayId: string; rolls: CutRollItem[] }> => {
  // Get all unique jumbo IDs first
  const allJumboIds = cutRolls.map(item => item.jumbo_roll_frontend_id || 'ungrouped');
  
  const grouped: Record<string, { displayId: string; rolls: CutRollItem[] }> = {};
  
  cutRolls.forEach(item => {
    const originalJumboId = item.jumbo_roll_frontend_id || 'ungrouped';
    const transformedId = originalJumboId === 'ungrouped' ? 'Ungrouped Items' : transformJumboId(originalJumboId, allJumboIds);
    
    if (!grouped[originalJumboId]) {
      grouped[originalJumboId] = {
        displayId: transformedId,
        rolls: []
      };
    }
    grouped[originalJumboId].rolls.push(item);
  });
  
  return grouped;
};

interface Plan {
  id: string;
  name: string;
  status: string;
  expected_waste_percentage: number;
  actual_waste_percentage?: number;
  created_at: string;
  executed_at?: string;
  completed_at?: string;
  created_by_id: string;
  created_by?: {
    name: string;
    username: string;
  };
  cut_pattern?: any[];
}

interface ProductionSummary {
  plan_id: string;
  plan_name: string;
  plan_status: string;
  executed_at?: string;
  production_summary: {
    total_cut_rolls: number;
    total_weight_kg: number;
    average_weight_per_roll: number;
    status_breakdown: Record<string, {
      count: number;
      total_weight: number;
      widths: number[];
    }>;
    paper_specifications: {
      gsm: number;
      bf: number;
      shade: string;
      roll_count: number;
    }[];
  };
  detailed_items: CutRollItem[];
}

interface CutRollItem {
  inventory_id: string;
  width_inches: number;
  weight_kg: number;
  status: string;
  location: string;
  qr_code: string;
  barcode_id?: string;
  created_at: string;
  paper_specs?: {
    gsm: number;
    bf: number;
    shade: string;
  };
  client_name?: string;
  order_date?: string;
  // Jumbo roll hierarchy fields
  jumbo_roll_frontend_id?: string;
  jumbo_roll_id?: string;
  individual_roll_number?: number;
  parent_jumbo_id?: string;
  parent_118_roll_id?: string;
  roll_sequence?: number;
}

interface User {
  id: string;
  name: string;
  username: string;
}

export default function PlanDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [productionSummary, setProductionSummary] = useState<ProductionSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQRCode, setSelectedQRCode] = useState<string | null>(null);
  
  // Filter states for cut rolls
  const [cutRollSearchTerm, setCutRollSearchTerm] = useState("");
  const [cutRollStatusFilter, setCutRollStatusFilter] = useState<string>("all");

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (planId) {
      loadPlanDetails();
      loadProductionSummary();
    }
  }, [planId]);

  const loadPlanDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${MASTER_ENDPOINTS.PLANS}/${planId}`, createRequestOptions('GET'));

      if (!response.ok) {
        throw new Error('Failed to load plan details');
      }

      const data = await response.json();
      setPlan(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load plan details';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProductionSummary = async () => {
    try {
      setLoadingSummary(true);
      setProductionSummary(null);
      
      console.log(`Loading production summary for plan: ${planId}`);
      
      const response = await fetch(PRODUCTION_ENDPOINTS.CUT_ROLLS_PLAN(planId), createRequestOptions('GET'));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Failed to load production summary: ${response.status}`);
      }

      const data = await response.json();
      console.log('Production summary data:', data);
      
      setProductionSummary(data);
      
      if (data.detailed_items && data.detailed_items.length > 0) {
        toast.success(`Loaded ${data.detailed_items.length} cut rolls for this plan`);
      } else {
        toast.info('No cut rolls found for this plan yet');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cut roll details';
      console.error('Error loading production summary:', err);
      toast.error(errorMessage);
      setProductionSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(MASTER_ENDPOINTS.USERS, createRequestOptions('GET'));
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const getUserById = (userId: string): User | null => {
    return users.find(user => user.id === userId) || null;
  };

  const createSampleData = async () => {
    try {
      const response = await fetch(`${PRODUCTION_ENDPOINTS.CUT_ROLLS_PLAN(planId).replace('/production/', '/create-sample-data/')}`, 
        createRequestOptions('POST')
      );

      if (!response.ok) {
        throw new Error('Failed to create sample data');
      }

      const data = await response.json();
      toast.success(data.message);
      
      // Reload the production summary to show the new data
      loadProductionSummary();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create sample data';
      toast.error(errorMessage);
      console.error('Error creating sample data:', err);
    }
  };

  const updatePlanStatus = async (status: string) => {
    try {
      const response = await fetch(PRODUCTION_ENDPOINTS.PLAN_STATUS(planId), createRequestOptions('PUT', { status }));

      if (!response.ok) {
        throw new Error('Failed to update plan status');
      }

      await loadPlanDetails(); // Refresh the plan data
      toast.success("Plan status updated successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update plan status';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error(err);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'planned': return 'outline';
      case 'in_progress': return 'secondary';
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      case 'available': return 'default';
      case 'cutting': return 'secondary';
      case 'allocated': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <Play className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleShowQRCode = (qrCode: string) => {
    setSelectedQRCode(qrCode);
  };

  // Helper function to generate barcode as canvas
  const generateBarcodeCanvas = (value: string): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    try {
      JsBarcode(canvas, value, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 12,
        textAlign: "center",
        textPosition: "bottom"
      });
    } catch (error) {
      console.error('Error generating barcode:', error);
      // Fallback: create a simple canvas with text
      canvas.width = 200;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'black';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(value, canvas.width / 2, canvas.height / 2);
      }
    }
    return canvas;
  };

  // Print Function
  const printPlanDetails = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please check your browser settings.');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Plan Details - ${plan?.name || 'Unnamed Plan'}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              font-size: 14px; 
              line-height: 1.4;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
            }
            .header h1 { 
              margin: 0; 
              font-size: 24px; 
              color: #333; 
            }
            .header p { 
              margin: 5px 0; 
              color: #666; 
            }
            .section { 
              margin-bottom: 25px; 
            }
            .section h2 { 
              font-size: 18px; 
              color: #333; 
              border-bottom: 1px solid #ccc;
              padding-bottom: 5px;
            }
            .info-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
              gap: 15px; 
              margin-bottom: 20px; 
            }
            .info-item { 
              padding: 10px; 
              background: #f8f9fa; 
              border-radius: 5px;
            }
            .info-item label { 
              font-weight: bold; 
              color: #555; 
              font-size: 12px;
              text-transform: uppercase;
            }
            .info-item value { 
              display: block; 
              font-size: 16px; 
              color: #333; 
              margin-top: 3px;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              margin: 20px 0;
            }
            .stat-card {
              text-align: center;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 5px;
              border: 1px solid #e9ecef;
            }
            .stat-value {
              font-size: 24px;
              font-weight: bold;
              color: #333;
            }
            .stat-label {
              font-size: 12px;
              color: #666;
              margin-top: 5px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 15px 0;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: left; 
            }
            th { 
              background-color: #f8f9fa; 
              font-weight: bold;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #666;
              border-top: 1px solid #ccc;
              padding-top: 15px;
            }
            @media print {
              body { margin: 0; }
              .header, .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${plan?.name || 'Plan Details'}</h1>
            <p>Production Planning Report</p>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>

          <div class="section">
            <h2>Plan Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <label>Status</label>
                <value>${plan?.status.replace('_', ' ') || 'Unknown'}</value>
              </div>
              <div class="info-item">
                <label>Expected Waste</label>
                <value>${plan?.expected_waste_percentage || 0}%</value>
              </div>
              ${plan?.actual_waste_percentage ? `
              <div class="info-item">
                <label>Actual Waste</label>
                <value>${plan.actual_waste_percentage}%</value>
              </div>` : ''}
              <div class="info-item">
                <label>Created</label>
                <value>${plan?.created_at ? new Date(plan.created_at).toLocaleString() : 'Unknown'}</value>
              </div>
              <div class="info-item">
                <label>Created By</label>
                <value>${(() => {
                  const user = getUserById(plan?.created_by_id || '');
                  return user?.name || plan?.created_by?.name || 'Unknown';
                })()}</value>
              </div>
            </div>
          </div>

          ${productionSummary ? `
          <div class="section">
            <h2>Production Summary</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">${productionSummary.production_summary.total_cut_rolls}</div>
                <div class="stat-label">Total Rolls</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${productionSummary.production_summary.total_weight_kg}kg</div>
                <div class="stat-label">Total Weight</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${productionSummary.production_summary.average_weight_per_roll.toFixed(1)}kg</div>
                <div class="stat-label">Avg Weight per Roll</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${productionSummary.production_summary.paper_specifications.length}</div>
                <div class="stat-label">Paper Types</div>
              </div>
            </div>

            <h3>Status Breakdown</h3>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                  <th>Weight (kg)</th>
                  <th>Widths</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(productionSummary.production_summary.status_breakdown)
                  .map(([status, data]) => `
                    <tr>
                      <td>${status.replace('_', ' ')}</td>
                      <td>${data.count}</td>
                      <td>${data.total_weight.toFixed(1)}</td>
                      <td>${[...new Set(data.widths)].join('", ')}"</td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>

            ${filteredCutRolls.length > 0 ? `
            <h3>Cut Rolls Details (${filteredCutRolls.length} items grouped by jumbo rolls)</h3>
            ${Object.entries(groupCutRollsByJumboWithSequential(filteredCutRolls)).map(([originalJumboId, jumboGroup]) => {
              const { displayId: jumboDisplayName, rolls: jumboRolls } = jumboGroup;
              
              return `
              <div style="margin-bottom: 25px; page-break-inside: avoid;">
                <h4 style="color: #333; margin-bottom: 10px; padding: 8px; background: #f0f0f0; border-radius: 4px;">
                  ${jumboDisplayName} (${jumboRolls.length} cut rolls - ${jumboRolls.reduce((sum, roll) => sum + roll.weight_kg, 0).toFixed(1)} kg)
                </h4>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                  <thead>
                    <tr style="background: #f8f9fa;">
                      <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">S.No</th>
                      <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Barcode</th>
                      <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Width</th>
                      <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Weight</th>
                      <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Paper Specs</th>
                      <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Status</th>
                      <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${jumboRolls.map((item, index) => `
                      <tr>
                        <td style="border: 1px solid #ddd; padding: 6px;">${index + 1}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; font-family: monospace; font-size: 11px;">${item.barcode_id || item.qr_code}</td>
                        <td style="border: 1px solid #ddd; padding: 6px;">${item.width_inches}"</td>
                        <td style="border: 1px solid #ddd; padding: 6px;">${item.weight_kg}kg</td>
                        <td style="border: 1px solid #ddd; padding: 6px;">${item.paper_specs ? `${item.paper_specs.gsm}gsm, BF:${item.paper_specs.bf}, ${item.paper_specs.shade}` : 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 6px;">${item.status.replace('_', ' ')}</td>
                        <td style="border: 1px solid #ddd; padding: 6px;">${item.location}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>`;
            }).join('')}` : ''}
          </div>` : ''}

          <div class="footer">
            <p>This document was generated from the Production Planning System</p>
            <p>Plan ID: ${planId}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.addEventListener('load', () => {
      printWindow.print();
      printWindow.close();
    });

    toast.success('Print preview opened');
  };

  // PDF Export Functions
  const exportBarcodesToPDF = () => {
    try {
      if (!productionSummary || filteredCutRolls.length === 0) {
        toast.error('No cut rolls available for export');
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Group cut rolls by jumbo for organized PDF output
      const jumboGroups = groupCutRollsByJumboWithSequential(filteredCutRolls);
      
      // Single column layout configuration
      const marginX = 20;
      const marginY = 20;
      const labelWidth = pageWidth - (marginX * 2);
      const itemsPerPage = 8; // Fewer items per page for grouping headers
      
      let yPosition = marginY;
      let itemCount = 0;
      let pageCount = 1;

      // Title on first page
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Barcode Labels - ${plan?.name || 'Plan Details'}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      doc.text(`Total Items: ${filteredCutRolls.length}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
      
      // Process each jumbo group
      Object.entries(jumboGroups).forEach(([originalJumboId, jumboGroup]) => {
        const { displayId: jumboDisplayName, rolls: jumboRolls } = jumboGroup;
        
        // Check if we need a new page for jumbo header
        if (itemCount >= itemsPerPage || yPosition > pageHeight - 100) {
          doc.addPage();
          pageCount++;
          yPosition = marginY;
          itemCount = 0;
        }
        
        // Jumbo roll header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(jumboDisplayName, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`${jumboRolls.length} cut rolls - Total Weight: ${jumboRolls.reduce((sum, roll) => sum + roll.weight_kg, 0).toFixed(1)} kg`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;
        
        // Process each cut roll in this jumbo group
        jumboRolls.forEach((item, index) => {
          // Check if we need a new page for this item
          if (itemCount >= itemsPerPage || yPosition > pageHeight - 80) {
            doc.addPage();
            pageCount++;
            yPosition = marginY;
            itemCount = 0;
          }

          const barcodeValue = item.barcode_id || item.qr_code;
          
          // Generate and add barcode image
          try {
            const canvas = generateBarcodeCanvas(barcodeValue);
            const barcodeDataUrl = canvas.toDataURL('image/png');
            
            // Barcode at full width, centered
            const barcodeWidth = labelWidth * 0.8; // 80% of available width
            const barcodeHeight = 25;
            const barcodeX = marginX + (labelWidth - barcodeWidth) / 2;
            const barcodeY = yPosition;
            
            doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
            yPosition += barcodeHeight + 8;
            
          } catch (error) {
            console.error('Error adding barcode:', error);
            // Fallback: text representation
            doc.setFontSize(12);
            doc.setFont('courier', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(`|||| ${barcodeValue} ||||`, pageWidth / 2, yPosition, { align: 'center' });
            yPosition += 12;
          }

          // Paper specifications and dimensions (only if available)
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          
          let infoLine = `${item.width_inches}" x ${item.weight_kg}kg`;
          if (item.paper_specs) {
            infoLine += ` | ${item.paper_specs.gsm}gsm, BF:${item.paper_specs.bf}, ${item.paper_specs.shade}`;
          }
          
          doc.text(infoLine, pageWidth / 2, yPosition, { align: 'center' });
          yPosition += 12;

          // Separation line (except for last item in group)
          if (index < jumboRolls.length - 1) {
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(marginX + 40, yPosition, pageWidth - marginX - 40, yPosition);
            yPosition += 10;
          }

          itemCount++;
        });
        
        // Larger separation between jumbo groups
        yPosition += 20;
      });

      // Add page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
      }

      doc.save(`barcode-labels-${plan?.name || 'plan'}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Barcode labels exported to PDF successfully!');
    } catch (error) {
      console.error('Error exporting barcode PDF:', error);
      toast.error('Failed to export barcode PDF');
    }
  };

 const exportProductionSummaryToPDF = () => {
  try {
    if (!plan || !productionSummary) {
      toast.error('Production data not available for export');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // Helper function to check if we need a new page
    const checkPageBreak = (height:any) => {
      if (yPosition + height > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    };

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text("Production Summary", pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Plan name and date
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Plan: ${plan.name}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Production Summary Section
    checkPageBreak(50);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text("Summary", margin, yPosition);
    yPosition += 12;

    // Summary stats in grid format
    const summaryData = [
      [`Total Cut Rolls: ${productionSummary.production_summary.total_cut_rolls}`, `Total Weight: ${productionSummary.production_summary.total_weight_kg} kg`],
      [`Average Weight: ${productionSummary.production_summary.average_weight_per_roll.toFixed(1)} kg/roll`, `Paper Types: ${productionSummary.production_summary.paper_specifications.length}`]
    ];

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    
    summaryData.forEach(row => {
      doc.text(row[0], margin + 5, yPosition);
      doc.text(row[1], pageWidth / 2 + 5, yPosition);
      yPosition += 8;
    });
    yPosition += 10;

    // Status Breakdown Section
    checkPageBreak(80);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text("Status Breakdown", margin, yPosition);
    yPosition += 12;

    // FIXED: Render table header FIRST, before the data
    const statusTableHeaders = ['Status', 'Count', 'Weight (kg)', 'Widths'];
    const colWidths = [40, 25, 35, 80];

    // Table header with borders
    doc.setFillColor(248, 249, 250);
    doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), 12, 'F');
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), 12, 'S');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    
    // Add column separators for header
    let colX = margin;
    for (let i = 0; i < colWidths.length - 1; i++) {
      colX += colWidths[i];
      doc.line(colX, yPosition - 2, colX, yPosition + 10);
    }
    
    let xPos = margin + 3;
    statusTableHeaders.forEach((header, index) => {
      doc.text(header, xPos, yPosition + 6);
      xPos += colWidths[index];
    });
    yPosition += 12;

    // NOW render the status breakdown table data
    const statusTableData = Object.entries(productionSummary.production_summary.status_breakdown).map(([status, data]) => {
      const uniqueWidths = [...new Set(data.widths)];
      const widthsText = uniqueWidths.join('", ') + '"';
      
      // For PDF, we'll handle text wrapping manually
      const maxCharsPerLine = 40; // Adjust based on column width
      const wrapText = (text:any, maxChars:any) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
          if ((currentLine + word).length <= maxChars) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
      };
      
      // For display purposes, we'll use the wrapped version
      const wrappedWidths = wrapText(widthsText, maxCharsPerLine);
      
      return [
        status.replace('_', ' '),
        data.count.toString(),
        data.total_weight.toFixed(1),
        wrappedWidths // This will be an array of lines
      ];
    });

    // Table rows with borders
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    
    statusTableData.forEach((row, index) => {
      // Calculate row height based on wrapped text
      const widthsLines = Array.isArray(row[3]) ? row[3] : [row[3]];
      const rowHeight = Math.max(10, widthsLines.length * 6 + 4); // Dynamic height
      
      checkPageBreak(rowHeight);
      
      if (index % 2 === 1) {
        doc.setFillColor(252, 252, 252);
        doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), rowHeight, 'F');
      }
      
      // Row border
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);
      doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), rowHeight, 'S');

      // Column separators
      let colX = margin;
      for (let i = 0; i < colWidths.length - 1; i++) {
        colX += colWidths[i];
        doc.line(colX, yPosition - 2, colX, yPosition + rowHeight - 2);
      }
      
      // Render cell content
      let xPos = margin + 3;
      row.forEach((cell, cellIndex) => {
        if (cellIndex === 3 && Array.isArray(cell)) {
          // Handle wrapped widths text
          cell.forEach((line, lineIndex) => {
            doc.text(line, xPos, yPosition + 5 + (lineIndex * 6));
          });
        } else {
          doc.text(typeof cell === 'string' ? cell : cell.toString(), xPos, yPosition + 5);
        }
        xPos += colWidths[cellIndex];
      });
      
      yPosition += rowHeight;
    });

    yPosition += 15;

    // Cut Rolls Table Section
    checkPageBreak(50);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`Cut Rolls Details (${filteredCutRolls.length} items)`, margin, yPosition);
    yPosition += 12;

    if (filteredCutRolls.length > 0) {
      // Group by jumbo rolls
      const jumboGroups = groupCutRollsByJumboWithSequential(filteredCutRolls);
      
      Object.entries(jumboGroups).forEach(([originalJumboId, jumboGroup]) => {
        const { displayId: jumboDisplayName, rolls: jumboRolls } = jumboGroup;
        
        // Jumbo group header with paper specs
        checkPageBreak(30);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        
        // Get paper specs from first roll (since all rolls in jumbo have same specs)
        const paperSpecs = jumboRolls[0]?.paper_specs 
          ? `(${jumboRolls[0].paper_specs.gsm}gsm, BF:${jumboRolls[0].paper_specs.bf}, ${jumboRolls[0].paper_specs.shade})`
          : '';
        
        doc.text(`${jumboDisplayName} ${paperSpecs} - ${jumboRolls.length} rolls`, margin, yPosition);
        yPosition += 10;

        // Table headers for cut rolls
        const rollTableHeaders = ['Barcode', 'Width', 'Status', 'Client', 'Weight'];
        const rollColWidths = [45, 20, 30, 35, 30];

        doc.setFillColor(248, 249, 250);
        doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), 10, 'F');
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.5);
        doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), 10, 'S');
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        
        // Add column separators
        let colX = margin;
        for (let i = 0; i < rollColWidths.length - 1; i++) {
          colX += rollColWidths[i];
          doc.line(colX, yPosition - 2, colX, yPosition + 8);
        }
        
        let xPos = margin + 2;
        rollTableHeaders.forEach((header, index) => {
          doc.text(header, xPos, yPosition + 5);
          xPos += rollColWidths[index];
        });
        yPosition += 10;

        // Roll data rows
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        
        jumboRolls.forEach((roll, rollIndex) => {
          checkPageBreak(8);
          
          if (rollIndex % 2 === 1) {
            doc.setFillColor(252, 252, 252);
            doc.rect(margin, yPosition - 1, pageWidth - (margin * 2), 8, 'F');
          }

          // Row border
          doc.setDrawColor(100, 100, 100);
          doc.setLineWidth(0.3);
          doc.rect(margin, yPosition - 1, pageWidth - (margin * 2), 8, 'S');
          
          // Column separators
          let colX = margin;
          for (let i = 0; i < rollColWidths.length - 1; i++) {
            colX += rollColWidths[i];
            doc.line(colX, yPosition - 1, colX, yPosition + 7);
          }

          const rollData = [
            roll.barcode_id || roll.qr_code,
            `${roll.width_inches}"`,
            roll.status.replace('_', ' '),
            roll.client_name || 'Unknown',
            roll.weight_kg === 0 ? '' : `${roll.weight_kg}kg`
          ];

          let xPos = margin + 2;
          rollData.forEach((cell, cellIndex) => {
            // Truncate long text to fit column width
            let displayText = cell;
            if (cellIndex === 0 && cell.length > 15) { // Barcode column
              displayText = cell.substring(0, 12) + '...';
            } else if (cellIndex === 3 && cell.length > 25) { // Client column
              displayText = cell.substring(0, 9) + '...';
            }
            
            doc.setFontSize(7);
            doc.text(displayText, xPos, yPosition + 4);
            xPos += rollColWidths[cellIndex];
          });
          yPosition += 8;
        });
        
        yPosition += 8; // Space between jumbo groups
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("No cut rolls found", margin, yPosition);
    }

    // Add page numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    // Print the PDF directly
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    const printWindow = window.open(pdfUrl);
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
      toast.success('Printing production summary...');
    } else {
      toast.error('Unable to open print window. Please check your browser settings.');
    }
  } catch (error) {
    console.error('Error exporting production summary PDF:', error);
    toast.error('Failed to export production summary PDF');
  }
};

  const exportPlanDetailsToPDF = () => {
    try {
      if (!plan || !productionSummary) {
        toast.error('Plan data not available for export');
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Helper function to check if we need a new page
      const checkPageBreak = (height: number) => {
        if (yPosition + height > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
      };

      // Title
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text("Production Planning Report", 20, yPosition);
      yPosition += 15;

      // Plan Information
      doc.setFontSize(14);
      doc.text(`Plan: ${plan.name || 'Unnamed Plan'}`, 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, yPosition);
      yPosition += 5;
      doc.text(`Status: ${plan.status}`, 20, yPosition);
      yPosition += 5;
      doc.text(`Expected Waste: ${plan.expected_waste_percentage}%`, 20, yPosition);
      yPosition += 5;
      if (plan.actual_waste_percentage) {
        doc.text(`Actual Waste: ${plan.actual_waste_percentage}%`, 20, yPosition);
        yPosition += 5;
      }
      doc.text(`Created: ${new Date(plan.created_at).toLocaleString()}`, 20, yPosition);
      yPosition += 5;
      const user = getUserById(plan.created_by_id);
      doc.text(`Created By: ${user?.name || plan.created_by?.name || 'Unknown'} (@${user?.username || plan.created_by?.username || 'unknown'})`, 20, yPosition);
      yPosition += 15;

      // Legend
      checkPageBreak(30);
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text("Color Legend:", 20, yPosition);
      yPosition += 8;

      const legendItems = [
        { color: [251, 191, 36], text: "From Inventory" },
        { color: [59, 130, 246], text: "From Cutting" },
        { color: [99, 102, 241], text: "Other Source" },
        { color: [239, 68, 68], text: "Waste Material" }
      ];

      legendItems.forEach((item, index) => {
        const legendX = 20 + (index * 65);
        
        // Draw color box
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.rect(legendX, yPosition - 3, 8, 6, 'F');
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.rect(legendX, yPosition - 3, 8, 6, 'S');
        
        // Add text
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(item.text, legendX + 10, yPosition);
      });

      yPosition += 15;

      // Production Summary
      checkPageBreak(30);
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text("Production Summary", 20, yPosition);
      yPosition += 15;

      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total Cut Rolls: ${productionSummary.production_summary.total_cut_rolls}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Total Weight: ${productionSummary.production_summary.total_weight_kg} kg`, 20, yPosition);
      yPosition += 8;
      doc.text(`Average Weight per Roll: ${productionSummary.production_summary.average_weight_per_roll.toFixed(1)} kg`, 20, yPosition);
      yPosition += 15;

      // Combined Cutting Pattern with Jumbo Roll Numbers
      checkPageBreak(30);
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text("Cutting Pattern with Jumbo Roll Mapping", 20, yPosition);
      yPosition += 15;

      // Parse cut_pattern data from plan
      let cutPatternData: any[] = [];
      try {
        if (plan.cut_pattern) {
          if (typeof plan.cut_pattern === 'string') {
            cutPatternData = JSON.parse(plan.cut_pattern);
          } else {
            cutPatternData = plan.cut_pattern;
          }
        }
      } catch (error) {
        console.error('Error parsing cut_pattern:', error);
        cutPatternData = [];
      }

      // Get jumbo roll mapping from production data
      const jumboRollMapping = groupCutRollsByJumboWithSequential(productionSummary.detailed_items);

      if (cutPatternData.length === 0) {
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text("No cutting pattern data available", 20, yPosition);
        yPosition += 15;
      } else {
        // Group cut pattern data by specification
        const groupedCutPatterns = cutPatternData.reduce((groups, cutRoll) => {
          const specKey = cutRoll.gsm && cutRoll.bf && cutRoll.shade 
            ? `${cutRoll.gsm}gsm, ${cutRoll.bf}bf, ${cutRoll.shade}`
            : 'Unknown Specification';
          
          if (!groups[specKey]) {
            groups[specKey] = [];
          }
          groups[specKey].push(cutRoll);
          return groups;
        }, {} as Record<string, Array<any>>);

        Object.entries(groupedCutPatterns).forEach(([specKey, rolls]:[any,any]) => {
          checkPageBreak(25);

          // Specification header
          doc.setFontSize(14);
          doc.setTextColor(40, 40, 40);
          doc.text(specKey, 20, yPosition);
          yPosition += 10;

          // Find corresponding jumbo roll ID from production data for this specification
          let jumboDisplayId = "Unknown Jumbo";
          let productionInfo = null;
          
          const matchingJumboEntry = Object.entries(jumboRollMapping).find(([originalId, jumboGroup]) => {
            const { rolls: jumboRolls } = jumboGroup;
            // Check if any roll in this jumbo has the same paper specs
            return jumboRolls.some(roll => 
              roll.paper_specs &&
              roll.paper_specs.gsm === rolls[0]?.gsm &&
              roll.paper_specs.bf === rolls[0]?.bf &&
              roll.paper_specs.shade === rolls[0]?.shade
            );
          });

          if (matchingJumboEntry) {
            const [originalId, jumboGroup] = matchingJumboEntry;
            jumboDisplayId = jumboGroup.displayId; // This will be "JR-001", "JR-002", etc.
            const totalWeight = jumboGroup.rolls.reduce((sum, roll) => sum + roll.weight_kg, 0);
            const cutCount = jumboGroup.rolls.length;
            productionInfo = { totalWeight, cutCount };
          }

          // LEVEL 1: JUMBO ROLL HEADER (Main header with border)
          checkPageBreak(35);
          doc.setFillColor(240, 240, 240); // Light gray background
          doc.rect(20, yPosition - 5, pageWidth - 40, 20, 'F'); // Background rectangle
          doc.setDrawColor(100, 100, 100);
          doc.setLineWidth(1);
          doc.rect(20, yPosition - 5, pageWidth - 40, 20, 'S'); // Border
          
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(40, 40, 40);
          doc.text(jumboDisplayId, 25, yPosition + 6); // Jumbo roll header
          
          // Add production info next to jumbo header
          if (productionInfo) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text(`Production: ${productionInfo.cutCount} cuts, ${productionInfo.totalWeight.toFixed(1)}kg`, pageWidth - 25, yPosition + 6, { align: 'right' });
          }
          yPosition += 25;

          // Group by individual_roll_number (118" jumbo roll) within this jumbo
          const rollsByNumber = rolls.reduce((rollGroups:any, roll:any) => {
            const rollNum = roll.individual_roll_number || "No Roll #";
            if (!rollGroups[rollNum]) {
              rollGroups[rollNum] = [];
            }
            rollGroups[rollNum].push(roll);
            return rollGroups;
          }, {} as Record<string, Array<any>>);

          // LEVEL 2: INDIVIDUAL 118" ROLL SUB-HEADERS + LEVEL 3: VISUAL PATTERNS
          Object.entries(rollsByNumber).forEach(([rollNumber, rollsInNumber]:[any,any]) => {
            checkPageBreak(80);

            // LEVEL 2: Roll Sub-header (Roll #1, Roll #2, etc.)
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(60, 60, 60);
            const rollTitle = rollNumber === "No Roll #" ? "Unassigned Roll" : `Roll #${rollNumber}`;
            doc.text(rollTitle, 35, yPosition);
            yPosition += 12;

            // LEVEL 3: Visual cutting pattern representation
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text("Cutting Pattern:", 40, yPosition);
            yPosition += 8;

            // Draw visual cutting representation using actual cut pattern data
            const rectStartX = 40;
            const rectWidth = pageWidth - 80;
            const rectHeight = 15; // Slightly taller for better visibility
            let currentX = rectStartX;

            // Calculate total used width from cut pattern data
            const totalUsedWidth = rollsInNumber.reduce((sum:any, roll:any) => sum + (roll.width || 0), 0);
            const waste = rollsInNumber[0]?.trim_left || (118 - totalUsedWidth);

            // Draw each cut section from the cut pattern data
            rollsInNumber.forEach((roll:any, rollIndex:any) => {
              const widthRatio = (roll.width || 0) / 118;
              const sectionWidth = rectWidth * widthRatio;

              // Set color based on source
              if (roll.source === 'inventory') {
                doc.setFillColor(251, 191, 36); // Golden for inventory
              } else if (roll.source === 'cutting') {
                doc.setFillColor(59, 130, 246); // Blue for cutting
              } else {
                doc.setFillColor(99, 102, 241); // Default purple
              }

              // Draw rectangle for this cut
              doc.rect(currentX, yPosition, sectionWidth, rectHeight, 'F');
              
              // Add border
              doc.setDrawColor(255, 255, 255);
              doc.setLineWidth(0.5);
              doc.rect(currentX, yPosition, sectionWidth, rectHeight, 'S');

              // Add width text inside the rectangle
              if (sectionWidth > 15) { // Only add text if section is wide enough
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(7);
                const textX = currentX + sectionWidth/2;
                const textY = yPosition + rectHeight/2 + 1;
                doc.text(`${roll.width}"`, textX, textY, { align: 'center' });
              }

              currentX += sectionWidth;
            });

            // Draw waste section using trim_left data
            if (waste > 0) {
              const wasteRatio = waste / 118;
              const wasteWidth = rectWidth * wasteRatio;
              
              doc.setFillColor(239, 68, 68); // Red for waste
              doc.rect(currentX, yPosition, wasteWidth, rectHeight, 'F');
              doc.setDrawColor(255, 255, 255);
              doc.rect(currentX, yPosition, wasteWidth, rectHeight, 'S');
              
              if (wasteWidth > 20) { // Only add text if waste section is wide enough
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(6);
                doc.text(`Waste: ${waste.toFixed(1)}"`, currentX + wasteWidth/2, yPosition + rectHeight/2 + 1, { align: 'center' });
              }
            }

            yPosition += rectHeight + 3;

            // Add 118" total indicator
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(7);
            doc.text("118\" Total Width", rectStartX + rectWidth/2, yPosition, { align: 'center' });
            yPosition += 8;

            // Statistics for this roll with both cutting pattern and production data
            const efficiency = ((totalUsedWidth / 118) * 100);
            checkPageBreak(25);
            doc.setFontSize(8);
            doc.setTextColor(60, 60, 60);
            
            let statsLine = `Used: ${totalUsedWidth.toFixed(1)}"  |  Waste: ${waste.toFixed(1)}"  |  Efficiency: ${efficiency.toFixed(1)}%  |  Cuts: ${rollsInNumber.length}`;
            
            doc.text(statsLine, 30, yPosition);
            yPosition += 15;
          });

          yPosition += 10; // Space between specifications
        });
      }

      // Cut Rolls Status Summary
      checkPageBreak(30);
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text('Cut Rolls Status Summary', 20, yPosition);
      yPosition += 15;

      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      Object.entries(productionSummary.production_summary.status_breakdown).forEach(([status, data]) => {
        doc.text(`${status}: ${data.count} rolls (${data.total_weight.toFixed(1)} kg)`, 20, yPosition);
        yPosition += 6;
      });

      doc.save(`plan-details-${plan.name || 'plan'}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Plan details exported to PDF successfully!');
    } catch (error) {
      console.error('Error exporting plan details PDF:', error);
      toast.error('Failed to export plan details PDF');
    }
  };

  // Filter cut rolls
  const filteredCutRolls = productionSummary?.detailed_items.filter(item => {
    const matchesSearch = !cutRollSearchTerm || 
      item.qr_code.toLowerCase().includes(cutRollSearchTerm.toLowerCase()) ||
      item.barcode_id?.toLowerCase().includes(cutRollSearchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(cutRollSearchTerm.toLowerCase()) ||
      item.paper_specs?.shade.toLowerCase().includes(cutRollSearchTerm.toLowerCase()) ||
      item.client_name?.toLowerCase().includes(cutRollSearchTerm.toLowerCase());
    
    const matchesStatus = cutRollStatusFilter === "all" || item.status === cutRollStatusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading plan details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !plan) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Plans
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || 'Plan not found'}</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Plans
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Factory className="w-8 h-8 text-primary" />
                {plan.name || 'Plan Details'}
              </h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive view of cutting plan and production details
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {productionSummary && filteredCutRolls.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportProductionSummaryToPDF}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportBarcodesToPDF}
                >
                  <ScanLine className="mr-2 h-4 w-4" />
                  Export Labels
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportPlanDetailsToPDF}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Export Plan Report
                </Button>
              </>
            )}
            {plan.status === 'planned' && (
              <Button
                onClick={() => updatePlanStatus('in_progress')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="mr-2 h-4 w-4" />
                Start Plan
              </Button>
            )}
            {plan.status === 'in_progress' && (
              <Button
                onClick={() => updatePlanStatus('completed')}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Plan
              </Button>
            )}
          </div>
        </div>

        {/* Plan Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Plan Overview
                  <Badge variant={getStatusBadgeVariant(plan.status)}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(plan.status)}
                      {plan.status.replace('_', ' ')}
                    </div>
                  </Badge>
                </CardTitle>
                <CardDescription>Basic plan information and timeline</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Expected Waste</label>
                <p className="text-2xl font-bold">{plan.expected_waste_percentage}%</p>
              </div>
              {plan.actual_waste_percentage && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Actual Waste</label>
                  <p className="text-2xl font-bold">{plan.actual_waste_percentage}%</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Created
                </label>
                <p className="text-lg font-medium">
                  {new Date(plan.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(plan.created_at).toLocaleTimeString()}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Created By
                </label>
                <p className="text-lg font-medium">
                  {(() => {
                    const user = getUserById(plan.created_by_id);
                    return user?.name || plan.created_by?.name || 'Unknown';
                  })()}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{(() => {
                    const user = getUserById(plan.created_by_id);
                    return user?.username || plan.created_by?.username || 'unknown';
                  })()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Production Summary */}
        {loadingSummary ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Loading production details...</p>
              </div>
            </CardContent>
          </Card>
        ) : productionSummary ? (
          <div className="space-y-6">
            {/* Production Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium">Total Rolls</span>
                  </div>
                  <p className="text-3xl font-bold">{productionSummary.production_summary.total_cut_rolls}</p>
                  <p className="text-xs text-muted-foreground mt-1">Cut rolls produced</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Weight className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium">Total Weight</span>
                  </div>
                  <p className="text-3xl font-bold">{productionSummary.production_summary.total_weight_kg}</p>
                  <p className="text-xs text-muted-foreground mt-1">kg total weight</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Ruler className="h-5 w-5 text-purple-500" />
                    <span className="text-sm font-medium">Avg Weight</span>
                  </div>
                  <p className="text-3xl font-bold">{productionSummary.production_summary.average_weight_per_roll.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground mt-1">kg per roll</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Factory className="h-5 w-5 text-orange-500" />
                    <span className="text-sm font-medium">Paper Types</span>
                  </div>
                  <p className="text-3xl font-bold">{productionSummary.production_summary.paper_specifications.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">different specs</p>
                </CardContent>
              </Card>
            </div>

            {/* Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Production Status Breakdown</CardTitle>
                <CardDescription>Overview of cut roll statuses and their distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.entries(productionSummary.production_summary.status_breakdown).map(([status, data]) => (
                    <div key={status} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
                          {status.replace('_', ' ')}
                        </Badge>
                        <span className="font-bold text-xl">{data.count}</span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Weight: {data.total_weight.toFixed(1)} kg</div>
                        <div>Widths: {[...new Set(data.widths)].join('", ')}"</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cut Rolls Table with Jumbo Roll Grouping */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Cut Rolls Details ({filteredCutRolls.length})</CardTitle>
                    <CardDescription>Cut rolls grouped by jumbo rolls in this plan</CardDescription>
                  </div>
                  <div className="flex gap-3">
                    {filteredCutRolls.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={exportBarcodesToPDF}
                        className="text-purple-600 border-purple-600 hover:bg-purple-50"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Export Labels
                      </Button>
                    )}
                    {productionSummary.detailed_items.length === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={createSampleData}
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                      >
                        <Factory className="h-3 w-3 mr-1" />
                        Create Sample Data
                      </Button>
                    )}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search cut rolls..."
                        value={cutRollSearchTerm}
                        onChange={(e) => setCutRollSearchTerm(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={cutRollStatusFilter} onValueChange={setCutRollStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {Object.keys(productionSummary.production_summary.status_breakdown).map(status => (
                          <SelectItem key={status} value={status}>
                            {status.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredCutRolls.length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(groupCutRollsByJumboWithSequential(filteredCutRolls)).map(([originalJumboId, jumboGroup]) => {
                      const { displayId: jumboDisplayName, rolls: jumboRolls } = jumboGroup;
                      
                      return (
                        <div key={originalJumboId} className="border rounded-lg p-4 bg-card">
                          <div className="flex items-center justify-between mb-4 pb-3 border-b">
                            <div className="flex items-center gap-2">
                              <Package className="h-5 w-5 text-blue-500" />
                              <h3 className="text-lg font-semibold">{jumboDisplayName}</h3>
                              <Badge variant="outline" className="ml-2">
                                {jumboRolls.length} cut {jumboRolls.length === 1 ? 'roll' : 'rolls'}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Total Weight: {jumboRolls.reduce((sum, roll) => sum + roll.weight_kg, 0).toFixed(1)} kg
                            </div>
                          </div>
                          
                          <div className="border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Barcode</TableHead>
                                  <TableHead>Dimensions</TableHead>
                                  <TableHead>Paper Specs</TableHead>
                                  <TableHead>Weight</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Client</TableHead>
                                  <TableHead>Created</TableHead>
                                  <TableHead>Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {jumboRolls.map((item) => (
                                  <TableRow key={item.inventory_id}>
                                    <TableCell>
                                      <div className="font-mono text-xs">{item.barcode_id || item.qr_code}</div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium">{item.width_inches}"</div>
                                    </TableCell>
                                    <TableCell>
                                      {item.paper_specs && (
                                        <div className="text-sm">
                                          <div>{item.paper_specs.gsm}gsm</div>
                                          <div className="text-xs text-muted-foreground">
                                            BF: {item.paper_specs.bf}, {item.paper_specs.shade}
                                          </div>
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium">{item.weight_kg} kg</div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={getStatusBadgeVariant(item.status)} className="text-xs">
                                        {item.status.replace('_', ' ')}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-sm">
                                        {item.client_name || "Unknown Client"}
                                      </div>
                                      {item.order_date && (
                                        <div className="text-xs text-muted-foreground">
                                          Order: {new Date(item.order_date).toLocaleDateString()}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-xs text-muted-foreground">
                                        {new Date(item.created_at).toLocaleDateString()}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleShowQRCode(item.barcode_id || item.qr_code)}
                                      >
                                        {item.barcode_id ? <ScanLine className="h-3 w-3" /> : <QrCode className="h-3 w-3" />}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border rounded-lg p-12 text-center">
                    {productionSummary.detailed_items.length === 0
                      ? "No cut rolls found for this plan."
                      : "No cut rolls match the current filters."
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  No production data available for this plan.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QR Code Display Modal */}
        {selectedQRCode && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-4 rounded-lg max-w-sm w-full mx-4">
              {selectedQRCode?.startsWith('CR_') ? (
                <BarcodeDisplay
                  value={selectedQRCode}
                  title="Cut Roll Barcode"
                  description={`Scan this barcode to access cut roll details`}
                  width={2}
                  height={100}
                  showActions={true}
                />
              ) : (
                <QRCodeDisplay
                  value={selectedQRCode}
                  title="Cut Roll QR Code"
                  description={`Scan this code to access cut roll details`}
                  size={200}
                  showActions={true}
                />
              )}
              <Button
                className="w-full mt-4"
                variant="outline"
                onClick={() => setSelectedQRCode(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}