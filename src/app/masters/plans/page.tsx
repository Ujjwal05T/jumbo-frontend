/**
 * Plan Master page - Display and manage cutting plans with detailed cut roll information
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, PRODUCTION_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, AlertCircle, Eye, Play, CheckCircle, Factory, Search, Filter, Download, FileText, MoreVertical, Printer, ScanLine } from "lucide-react";

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
  frontend_id?: string; // Human-readable plan ID
  cut_pattern?: any; // Original cutting pattern data
}

interface Client {
  id: string;
  company_name: string;
}

interface User {
  id: string;
  name: string;
  username: string;
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
  jumbo_roll_frontend_id?: string;
  jumbo_roll_id?: string;
  individual_roll_number?: number;
  parent_jumbo_id?: string;
  parent_118_roll_id?: string;
  roll_sequence?: number;
  // Added fields for pending orders
  source_type?: string;
  source_pending_id?: string;
  source_order_id?: string;
  gsm?: number;
  bf?: number;
  shade?: string;
  client?: string;
  client_frontend_id?: string;
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

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  useEffect(() => {
    loadClients();
    loadUsers();
  }, []);

  useEffect(() => {
    loadPlans();
  }, [statusFilter, clientFilter, dateFilter]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query parameters for backend filtering
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (clientFilter !== "all") params.append("client_id", clientFilter);
      
      // Add date filtering
      if (dateFilter !== "all") {
        const today = new Date();
        let dateFrom = "";
        switch (dateFilter) {
          case "today":
            dateFrom = today.toISOString().split('T')[0];
            break;
          case "week":
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            dateFrom = weekAgo.toISOString().split('T')[0];
            break;
          case "month":
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            dateFrom = monthAgo.toISOString().split('T')[0];
            break;
        }
        if (dateFrom) params.append("date_from", dateFrom);
      }
      
      const url = `${MASTER_ENDPOINTS.PLANS}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, createRequestOptions('GET'));

      if (!response.ok) {
        throw new Error('Failed to load plans');
      }

      const data = await response.json();
      setPlans(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load plans';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await fetch(MASTER_ENDPOINTS.CLIENTS, createRequestOptions('GET'));
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (err) {
      console.error('Error loading clients:', err);
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'planned': return 'outline';
      case 'in_progress': return 'secondary';
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned': return <Eye className="h-4 w-4" />;
      case 'in_progress': return <Play className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  const handleViewPlan = (plan: Plan) => {
    // Navigate to the dedicated plan details page
    router.push(`/masters/plans/${plan.id}`);
  };

  const loadProductionData = async (planId: string): Promise<ProductionSummary | null> => {
    try {
      const response = await fetch(PRODUCTION_ENDPOINTS.CUT_ROLLS_PLAN(planId), createRequestOptions('GET'));
      if (!response.ok) {
        throw new Error(`Failed to load production data: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error loading production data:', err);
      return null;
    }
  };

  // Helper function to generate barcode canvas
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

  // Helper function to get weight multiplier based on GSM (copied from plan details)
  const getWeightMultiplier = (gsm: number): number => {
    if (gsm <= 70) return 10;
    if (gsm <= 80) return 11;
    if (gsm <= 100) return 12.7;
    if (gsm <= 120) return 13;
    return 13.3; // 140 gsm and above
  };

  // Sequential transformation function (copied from plan details)
  const transformJumboId = (jumboFrontendId: string | undefined, allJumboIds: string[]): string => {
    if (!jumboFrontendId) return "Unknown";
    
    const uniqueJumboIds = [...new Set(allJumboIds.filter(id => id && id !== 'ungrouped'))].sort();
    const index = uniqueJumboIds.indexOf(jumboFrontendId);
    
    if (index >= 0) {
      return `JR-${(index + 1).toString().padStart(5, '0')}`;
    }
    
    return jumboFrontendId;
  };

  // Group cut rolls by jumbo roll (copied from plan details)
  const groupCutRollsByJumboWithSequential = (cutRolls: CutRollItem[]): Record<string, { displayId: string; rolls: CutRollItem[] }> => {
    const allJumboIds = cutRolls.map(item => item.jumbo_roll_frontend_id || 'ungrouped');
    const grouped: Record<string, { displayId: string; rolls: CutRollItem[] }> = {};

    cutRolls.forEach(item => {
      const originalJumboId = item.jumbo_roll_frontend_id || 'ungrouped';
      let transformedId;

      if (originalJumboId === 'ungrouped') {
        // Check if this ungrouped item is a wastage cut roll (SCR barcode)
        const isWastageRoll = item.barcode_id?.startsWith('SCR-');
        transformedId = isWastageRoll ? 'Cut Rolls from Stock' : 'Ungrouped Items';
      } else {
        transformedId = transformJumboId(originalJumboId, allJumboIds);
      }

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

 const handleDownloadReport = async (plan: Plan) => {
  try {
    toast.loading('Preparing report download...', { id: `report-${plan.id}` });
    // console.log('Generating report for plan:', plan);
    const productionSummary = await loadProductionData(plan.id);
    // console.log('Production Summary:', productionSummary);
    if (!productionSummary) {
      toast.error('No production data available for this plan', { id: `report-${plan.id}` });
      return;
    }

    // EXACT copy of exportPlanDetailsToPDF from plan details page
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

    // Plan Information
    doc.setFontSize(14);
    doc.text(`Plan: ${plan.frontend_id || 'Unnamed Plan'}`, 20, yPosition);
    yPosition += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Status: ${plan.status}`, 20, yPosition);
    yPosition += 5;
    doc.text(`Expected Waste: ${plan.expected_waste_percentage}%`, 20, yPosition);
    yPosition += 5;
    doc.text(`Created: ${new Date(plan.created_at).toLocaleString()}`, 20, yPosition);
    yPosition += 5;
    const user = getUserById(plan.created_by_id);
    doc.text(`Created By: ${user?.name || 'Unknown'}`, 20, yPosition);
    yPosition += 15;

    // Extract unique clients and paper specs from production data
    const uniqueClients = [...new Set(productionSummary.detailed_items
      .map(item => item.client_name)
      .filter(client => client && client !== 'Unknown Client'))];
    
    const uniquePaperSpecs = [...new Set(productionSummary.detailed_items
      .filter(item => item.paper_specs)
      .map(item => `${item.paper_specs!.gsm}gsm, BF:${item.paper_specs!.bf}, ${item.paper_specs!.shade}`))];

    // Clients Section
    if (uniqueClients.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text('Clients:', 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      uniqueClients.forEach((client, index) => {
        doc.text(`• ${client}`, 25, yPosition);
        yPosition += 6;
        if ((index + 1) % 15 === 0) checkPageBreak(20);
      });
      yPosition += 8;
    }

    // Paper Specifications Section with Roll Counts and Weights
    if (productionSummary.production_summary.paper_specifications.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text('Paper Specifications:', 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      
      // Group specifications by paper type
      const specGroups = productionSummary.production_summary.paper_specifications.reduce((groups: any, spec: any) => {
        const key = `${spec.gsm}gsm, BF:${spec.bf}, ${spec.shade}`;
        if (!groups[key]) {
          groups[key] = {
            gsm: spec.gsm,
            bf: spec.bf,
            shade: spec.shade,
            details: []
          };
        }
        groups[key].details.push(spec);
        return groups;
      }, {});

      // Helper function to wrap text for PDF
      const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
        doc.setFontSize(fontSize);
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const textWidth = doc.getTextWidth(testLine);
          
          if (textWidth > maxWidth && currentLine !== '') {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        
        if (currentLine) {
          lines.push(currentLine);
        }
        
        return lines;
      };

      Object.entries(specGroups).forEach(([specKey, specGroup]: [string, any], index) => {
        const weightMultiplier = getWeightMultiplier(specGroup.gsm);
        
        let totalWeight = 0;
        let totalRolls = 0;
        
        const specItems = productionSummary.detailed_items.filter((item: any) => 
          item.paper_specs && 
          item.paper_specs.gsm === specGroup.gsm &&
          item.paper_specs.bf === specGroup.bf &&
          item.paper_specs.shade === specGroup.shade
        );
        
        // Track widths in order of appearance instead of using an object
        const widthOrderTracker: { width: number; count: number }[] = [];

        specItems.forEach((item: any) => {
          const width = item.width_inches;
          const existingEntry = widthOrderTracker.find(entry => entry.width === width);
          
          if (existingEntry) {
            existingEntry.count += 1;
          } else {
            widthOrderTracker.push({ width, count: 1 });
          }
        });

        // Calculate totals
        widthOrderTracker.forEach(({ width, count }) => {
          totalWeight += weightMultiplier * width * count;
          totalRolls += count;
        });

        // Generate width details in original order
        const widthDetails = widthOrderTracker
          .map(({ width, count }) => `${width}"×${count}`)
          .join(', ');
        
        const specText = `• ${specKey} - ${totalRolls} rolls (${widthDetails}) - Weight: ${totalWeight.toFixed(1)}kg`;
        
        const maxLineWidth = pageWidth - 50;
        const wrappedLines = wrapText(specText, maxLineWidth, 10);
        
        checkPageBreak(wrappedLines.length * 6 + 2);
        
        wrappedLines.forEach((line, lineIndex) => {
          const xPos = lineIndex === 0 ? 25 : 30;
          doc.text(line, xPos, yPosition);
          yPosition += 6;
        });
        
        yPosition += 2;
      });
      yPosition += 8;
    }

    // Cut Rolls Status Summary
    checkPageBreak(30);
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text('Cut Rolls Summary:', 20, yPosition);
    yPosition += 15;

    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Cut Rolls: ${productionSummary.production_summary.total_cut_rolls}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Total Weight: ${productionSummary.production_summary.total_weight_kg} kg`, 20, yPosition);
    yPosition += 8;
    doc.text(`Expected Waste: ${plan.expected_waste_percentage}%`, 20, yPosition);
    yPosition += 8;

    Object.entries(productionSummary.production_summary.status_breakdown).forEach(([status, data]) => {
      doc.text(`${status}: ${data.count} rolls (${data.total_weight.toFixed(1)} kg)`, 20, yPosition);
      yPosition += 6;
    });
    yPosition += 10;

    // Separate SCR cut rolls from regular cut rolls for plan details PDF
    const regularCutRolls = productionSummary.detailed_items.filter(roll => !roll.barcode_id?.startsWith('SCR-'));
    const scrCutRolls = productionSummary.detailed_items.filter(roll => roll.barcode_id?.startsWith('SCR-'));

    // Add SCR Cut Rolls Summary if any exist
    if (scrCutRolls.length > 0) {
      checkPageBreak(80);

      // Summary header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('Cut Rolls from Stock Summary', 20, yPosition);
      yPosition += 12;

      // Summary description
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`${scrCutRolls.length} cut rolls sourced from existing stock:`, 20, yPosition);
      yPosition += 12;

      // List each SCR cut roll
      scrCutRolls.forEach((roll, index) => {
        checkPageBreak(8);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const rollText = `• ${roll.barcode_id} - ${roll.width_inches}" × ${roll.weight_kg}kg - ${roll.client_name || 'Unknown Client'}`;
        doc.text(rollText, 25, yPosition);
        yPosition += 6;
      });

      yPosition += 10;
    }

    // Use production data directly - group by jumbo rolls first (regular rolls only)
    const jumboRollMapping = groupCutRollsByJumboWithSequential(regularCutRolls);
    const sortedJumboMappingEntries = Object.entries(jumboRollMapping).sort(([aId, aGroup], [bId, bGroup]) => {
      const aDisplayId = aGroup.displayId;
      const bDisplayId = bGroup.displayId;

      if (aDisplayId === 'Ungrouped Items' || aDisplayId === 'Cut Rolls from Stock') return 1;
      if (bDisplayId === 'Ungrouped Items' || bDisplayId === 'Cut Rolls from Stock') return -1;

      const aNum = parseInt(aDisplayId.replace('JR-', '')) || 0;
      const bNum = parseInt(bDisplayId.replace('JR-', '')) || 0;

      return aNum - bNum;
    });

    if (sortedJumboMappingEntries.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("No production data available for cutting pattern", 20, yPosition);
      yPosition += 15;
    } else {
      // Process each jumbo roll
      sortedJumboMappingEntries.forEach(([originalJumboId, jumboGroup], index) => {
        const { displayId: jumboDisplayId, rolls: jumboRolls } = jumboGroup;
        
        // Sort jumbo rolls by individual_roll_number to preserve cutting pattern order
        const sortedJumboRolls = [...jumboRolls].sort((a, b) => {
          const aRollNum = a.individual_roll_number || 999;
          const bRollNum = b.individual_roll_number || 999;
          return aRollNum - bRollNum;
        });
        
        if (index > -1) {
          doc.addPage();
          yPosition = 20;
        }
        
        const paperSpecs = sortedJumboRolls[0]?.paper_specs;
        const specKey = paperSpecs 
          ? `${paperSpecs.gsm}gsm, ${paperSpecs.bf}bf, ${paperSpecs.shade}`
          : 'Unknown Specification';
        
        checkPageBreak(25);

        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text(specKey, 20, yPosition);
        yPosition += 10;

        const totalWeight = sortedJumboRolls.reduce((sum, roll) => sum + roll.weight_kg, 0);
        const cutCount = sortedJumboRolls.length;
        const productionInfo = { totalWeight, cutCount };

        checkPageBreak(35);
        doc.setFillColor(240, 240, 240);
        doc.rect(20, yPosition - 5, pageWidth - 40, 20, 'F');
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(1);
        doc.rect(20, yPosition - 5, pageWidth - 40, 20, 'S');
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(jumboDisplayId, 25, yPosition + 6);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(`Production: ${productionInfo.cutCount} cuts, ${productionInfo.totalWeight.toFixed(1)}kg`, pageWidth - 25, yPosition + 6, { align: 'right' });
        yPosition += 25;

        const rollsByNumber = sortedJumboRolls.reduce((rollGroups: any, roll: CutRollItem) => {
          const rollNum = roll.individual_roll_number || "No Roll #";
          if (!rollGroups[rollNum]) {
            rollGroups[rollNum] = [];
          }
          rollGroups[rollNum].push(roll);
          return rollGroups;
        }, {} as Record<string, CutRollItem[]>);

        // Helper function to visualize a group of rolls
        const visualizeRollGroup = (doc: any, rolls: any[], pageWidth: number, startY: number) => {
          let yPosition = startY;
          let localY = startY;
          
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          doc.text("Cutting Pattern:", 40, localY);
          localY += 8;

          const rectStartX = 40;
          const rectWidth = pageWidth - 65;
          const rectHeight = 20;
          let currentX = rectStartX;

          const totalUsedWidth = rolls.reduce((sum:number, roll:any) => sum + (roll.width_inches || 0), 0);
          const waste = Math.max(0, 119 - totalUsedWidth); // Ensure waste isn't negative
          
          // Draw the roll segments
          rolls.forEach((roll:any) => {

            // Calculate section width based on roll width ratio with min/max constraints
            const rollRatio = roll.width_inches / 118; // Ratio of this roll to total width
            const availableWidth = rectWidth * 0.85; // Use 85% of available space for rolls
            const calculatedWidth = availableWidth * rollRatio;
            const sectionWidth = Math.max(35, Math.min(55, calculatedWidth))

            if (roll.status === 'cutting') {
              doc.setFillColor(189, 189, 189);
            } else {
              doc.setFillColor(115, 114, 114);
            }

            doc.rect(currentX, localY, sectionWidth, rectHeight, 'F');
            
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.5);
            doc.rect(currentX, localY, sectionWidth, rectHeight, 'S');

            if (sectionWidth > 15) {
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(6);
              const textX = currentX + sectionWidth/2;
              
              // Get client name from plan's cut_pattern by matching production data
              let clientName = '';
              if (plan?.cut_pattern && Array.isArray(plan.cut_pattern)) {
                const matchingCutPattern = plan.cut_pattern.find((cutItem: any) => 
                  cutItem.width === roll.width_inches &&
                  cutItem.individual_roll_number === roll.individual_roll_number &&
                  cutItem.gsm === (roll.paper_specs?.gsm || roll.gsm) &&
                  cutItem.bf === (roll.paper_specs?.bf || roll.bf) &&
                  cutItem.shade === (roll.paper_specs?.shade || roll.shade)
                );
                
                clientName = matchingCutPattern?.company_name ? matchingCutPattern.company_name.substring(0, 8) : '';
              } else if (typeof plan?.cut_pattern === 'string') {
                try {
                  const cutPatternArray = JSON.parse(plan.cut_pattern);
                  const matchingCutPattern = cutPatternArray.find((cutItem: any) => 
                    cutItem.width === roll.width_inches &&
                    cutItem.individual_roll_number === roll.individual_roll_number &&
                    cutItem.gsm === (roll.paper_specs?.gsm || roll.gsm) &&
                    cutItem.bf === (roll.paper_specs?.bf || roll.bf) &&
                    cutItem.shade === (roll.paper_specs?.shade || roll.shade)
                  );
                  
                  clientName = matchingCutPattern?.company_name ? matchingCutPattern.company_name.substring(0, 8) : '';
                } catch (e) {
                  console.error('Error parsing cut_pattern:', e);
                }
              }
              
              // Display client name and width
              if (clientName && sectionWidth > 25) {
                const topTextY = localY + rectHeight/2 - 2;
                const bottomTextY = localY + rectHeight/2 + 4;
                doc.text(clientName, textX, topTextY, { align: 'center' });
                doc.text(`${roll.width_inches}"`, textX, bottomTextY, { align: 'center' });
                doc.text(`${roll.barcode_id}`, textX, localY + rectHeight - 2, { align: 'center' });
              } else {
                const textY = localY + rectHeight/2 + 1;
                if (clientName) {
                  doc.text(clientName, textX, textY, { align: 'center' });
                } else {
                  doc.text(`${roll.width_inches}"`, textX, textY, { align: 'center' });
                }
              }
            }

            currentX += sectionWidth;
          });

          // Draw waste section
          if (waste > 0) {
            const wasteRatio = waste / 118;
            const wasteWidth = rectWidth * wasteRatio;
            
            doc.setFillColor(239, 68, 68);
            doc.rect(currentX, localY, wasteWidth, rectHeight, 'F');
            doc.setDrawColor(255, 255, 255);
            doc.rect(currentX, localY, wasteWidth, rectHeight, 'S');
            
            if (wasteWidth > 20) {
              doc.setTextColor(255, 255, 255);
              doc.setFontSize(6);
              doc.text(`Waste: ${waste.toFixed(1)}"`, currentX + wasteWidth/2, localY + rectHeight/2 + 1, { align: 'center' });
            }
          }

          localY += rectHeight + 3;

          doc.setTextColor(100, 100, 100);
          doc.setFontSize(7);
          doc.text("118\" Total Width", rectStartX + rectWidth/2, localY, { align: 'center' });
          localY += 8;

          const efficiency = ((totalUsedWidth / 119) * 100);
          doc.setFontSize(8);
          doc.setTextColor(60, 60, 60);
          
          let statsLine = `Used: ${totalUsedWidth.toFixed(1)}"  |  Waste: ${waste.toFixed(1)}"  |  Efficiency: ${efficiency.toFixed(1)}%  |  Cuts: ${rolls.length}`;
          
          doc.text(statsLine, 30, localY);
          localY += 15;
          
          return localY; // Return the new Y position
        };

        // Process roll groups in order of individual_roll_number
        const sortedRollEntries = Object.entries(rollsByNumber).sort(([aKey], [bKey]) => {
          if (aKey === "No Roll #") return 1;
          if (bKey === "No Roll #") return -1;
          return parseInt(aKey) - parseInt(bKey);
        });

        sortedRollEntries.forEach(([rollNumber, rollsInNumber]:[any, any]) => {
          checkPageBreak(80);

          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(60, 60, 60);
          const rollTitle = rollNumber === "No Roll #" ? "Unassigned Roll" : `Roll #${rollNumber}`;
          doc.text(rollTitle, 35, yPosition);
          yPosition += 12;
          
          // Always check if width exceeds 118" and apply automatic segmentation regardless of order type
          const maxAllowedWidth = 120; // Maximum width constraint in inches
          
          // Create segments automatically based on width constraint
          const segments: CutRollItem[][] = [];
          let currentSegment: CutRollItem[] = [];
          let currentWidth = 0;
          
          // Process each roll and create new segments when width exceeds 118"
          rollsInNumber.forEach((roll: CutRollItem) => {
            const rollWidth = roll.width_inches || 0;
            
            // If this single roll exceeds max width, place it in its own segment
            if (rollWidth > maxAllowedWidth) {
              // If we have rolls in current segment, add them first
              if (currentSegment.length > 0) {
                segments.push([...currentSegment]);
                currentSegment = [];
                currentWidth = 0;
              }
              
              // Add this oversized roll in its own segment
              segments.push([roll]);
            }
            // If adding this roll would exceed max width, start a new segment
            else if (currentWidth + rollWidth > maxAllowedWidth) {
              // Add current segment to segments list
              if (currentSegment.length > 0) {
                segments.push([...currentSegment]);
                currentSegment = [roll]; // Start new segment with current roll
                currentWidth = rollWidth;
              } else {
                // If current segment is empty, add this roll to a new segment
                currentSegment = [roll];
                currentWidth = rollWidth;
              }
            } 
            // Otherwise add to current segment
            else {
              currentSegment.push(roll);
              currentWidth += rollWidth;
            }
          });
          
          // Add any remaining rolls in the last segment
          if (currentSegment.length > 0) {
            segments.push(currentSegment);
          }
          
          // Display segments with appropriate labels
          segments.forEach((segment, segmentIndex) => {
            // Add segment labels for multi-segment rolls
            if (segments.length > 1) {
              if (segmentIndex === 0) {
                yPosition += 2;
              }
            }
            
            // Visualize this segment
            yPosition = visualizeRollGroup(doc, segment, pageWidth, yPosition);
            
            // Add spacing between segments
            if (segmentIndex < segments.length - 1) {
              yPosition += 10;
              checkPageBreak(80);
            }
          });
        });

        yPosition += 10;
      });
    }
    
    doc.save(`${plan.frontend_id || 'plan'}.pdf`);
    toast.success('Plan details exported to PDF successfully!', { id: `report-${plan.id}` });
  } catch (error) {
    console.error('Error downloading report:', error);
    toast.error('Failed to download report', { id: `report-${plan.id}` });
  }
};

  const handlePrintLabels = async (plan: Plan) => {
    try {
      toast.loading('Preparing labels...', { id: `labels-${plan.id}` });
      
      const productionSummary = await loadProductionData(plan.id);
      if (!productionSummary || !productionSummary.detailed_items.length) {
        toast.error('No cut rolls available for label printing', { id: `labels-${plan.id}` });
        return;
      }

      // EXACT copy of exportBarcodesToPDF from plan details page
      const filteredCutRolls = productionSummary.detailed_items; // Use all items for consistency
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Group cut rolls by jumbo for organized PDF output
      const jumboGroups = groupCutRollsByJumboWithSequential(filteredCutRolls);
      
      // Sort jumbo groups for consistent PDF ordering
      const sortedJumboEntries = Object.entries(jumboGroups).sort(([aId, aGroup], [bId, bGroup]) => {
        const aDisplayId = aGroup.displayId;
        const bDisplayId = bGroup.displayId;
        
        if (aDisplayId === 'Ungrouped Items') return 1;
        if (bDisplayId === 'Ungrouped Items') return -1;
        
        const aNum = parseInt(aDisplayId.replace('JR-', '')) || 0;
        const bNum = parseInt(bDisplayId.replace('JR-', '')) || 0;
        
        return aNum - bNum;
      });
      
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
      doc.text(`Generated on: ${new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      doc.text(`Total Items: ${filteredCutRolls.length}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
      
      // Process each jumbo group in sorted order
      sortedJumboEntries.forEach(([originalJumboId, jumboGroup]) => {
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
        
        // Sort cut rolls within this jumbo group and process them
        jumboRolls
          .sort((a, b) => {
            const aRollNum = a.individual_roll_number || 999;
            const bRollNum = b.individual_roll_number || 999;
            if (aRollNum !== bRollNum) return aRollNum - bRollNum;
            
            if (a.width_inches !== b.width_inches) {
              return a.width_inches - b.width_inches;
            }
            
            const aCode = a.barcode_id || a.qr_code;
            const bCode = b.barcode_id || b.qr_code;
            return aCode.localeCompare(bCode);
          })
          .forEach((item, index) => {
          // Check if we need a new page for this item
          if (itemCount >= itemsPerPage || yPosition > pageHeight - 80) {
            doc.addPage();
            pageCount++;
            yPosition = marginY;
            itemCount = 0;
          }

          const barcodeValue = item.barcode_id || item.qr_code;

          doc.setFontSize(15);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text("Satguru Paper Mill Pvt. Ltd.", pageWidth / 2, yPosition, { align: 'center' });
          yPosition += 6;
          
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
      toast.success('Barcode labels exported to PDF successfully!', { id: `labels-${plan.id}` });
    } catch (error) {
      console.error('Error printing labels:', error);
      toast.error('Failed to export labels', { id: `labels-${plan.id}` });
    }
  };

  // Filter functions
  const filteredPlans = plans.filter(plan => {
    const user = getUserById(plan.created_by_id);
    
    const matchesSearch = !searchTerm || 
      plan.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
    
    const matchesDate = dateFilter === "all" || (() => {
      const planDate = new Date(plan.created_at);
      const today = new Date();
      switch (dateFilter) {
        case "today":
          return planDate.toDateString() === today.toDateString();
        case "week":
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return planDate >= weekAgo;
        case "month":
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          return planDate >= monthAgo;
        default:
          return true;
      }
    })();
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  // PDF Print Functions
  const printPlanSummaryToPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      let yPosition = 20;

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Production Plans Summary', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Date and filters
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on: ${new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`, 20, yPosition);
      yPosition += 5;
      doc.text(`Total Plans: ${filteredPlans.length}`, 20, yPosition);
      yPosition += 5;
      if (statusFilter !== "all") doc.text(`Status Filter: ${statusFilter}`, 20, yPosition), yPosition += 5;
      if (dateFilter !== "all") doc.text(`Date Filter: ${dateFilter}`, 20, yPosition), yPosition += 5;
      yPosition += 10;

      // Table headers
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const headers = ['Plan ID', 'Plan Name', 'Status', 'Waste %', 'Created By', 'Created Date'];
      const colWidths = [25, 45, 20, 15, 35, 30];
      let xPosition = 20;
      
      headers.forEach((header, index) => {
        doc.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });
      yPosition += 5;

      // Draw header line
      doc.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 5;

      // Table data
      doc.setFont('helvetica', 'normal');
      filteredPlans.forEach((plan, index) => {
        if (yPosition > 270) { // New page if needed
          doc.addPage();
          yPosition = 20;
        }

        xPosition = 20;
        const user = getUserById(plan.created_by_id);
        const rowData = [
          plan.frontend_id || `P${index + 1}`,
          (plan.name || `Plan #${index + 1}`).substring(0, 25),
          plan.status,
          `${plan.expected_waste_percentage}%`,
          (user?.name || 'Unknown').substring(0, 20),
          new Date(plan.created_at).toLocaleDateString('en-GB')
        ];

        rowData.forEach((data, colIndex) => {
          doc.text(data.toString(), xPosition, yPosition);
          xPosition += colWidths[colIndex];
        });
        yPosition += 5;
      });

      // Status summary
      yPosition += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Status Summary:', 20, yPosition);
      yPosition += 5;
      
      const statusCounts = filteredPlans.reduce((acc, plan) => {
        acc[plan.status] = (acc[plan.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      doc.setFont('helvetica', 'normal');
      Object.entries(statusCounts).forEach(([status, count]) => {
        doc.text(`${status}: ${count}`, 20, yPosition);
        yPosition += 4;
      });

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      
      URL.revokeObjectURL(url);
      toast.success('Plans summary opened for printing!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Plan Master - Production Plans</h1>
            <p className="text-muted-foreground mt-1">
              Manage cutting plans and track cut roll production with detailed analytics
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={printPlanSummaryToPDF}
              disabled={filteredPlans.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Print PDF
            </Button>
            <Button 
              variant="default" 
              onClick={() => router.push('/planning')}
            >
              <Factory className="mr-2 h-4 w-4" />
              Create New Plan
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Plans</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or creator..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All dates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setClientFilter("all");
                    setDateFilter("all");
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Plans List */}
        <Card>
          <CardHeader>
            <CardTitle>Plans ({filteredPlans.length})</CardTitle>
            <CardDescription>Manage and monitor cutting plans - click View Details to see comprehensive plan information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan ID</TableHead>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expected Waste</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <div className="flex items-center justify-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading plans...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredPlans.length > 0 ? (
                    filteredPlans.map((plan, index) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-mono text-sm font-medium">
                          {plan.frontend_id || 'Generating...'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {plan.name || `Plan #${index + 1}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(plan.status)}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(plan.status)}
                              {plan.status.replace('_', ' ')}
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{plan.expected_waste_percentage}%</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            {(() => {
                              const user = getUserById(plan.created_by_id);
                              return (
                                <>
                                  <div className="font-medium">{user?.name || 'Unknown User'}</div>
                                  <div className="text-xs text-muted-foreground">@{user?.username || 'unknown'}</div>
                                </>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(plan.created_at).toLocaleDateString('en-GB')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewPlan(plan)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadReport(plan)}>
                                <Download className="mr-2 h-4 w-4" />
                                Download Report
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePrintLabels(plan)}>
                                <Printer className="mr-2 h-4 w-4" />
                                Print Labels
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        {plans.length === 0 
                          ? "No plans found. Create your first plan to get started."
                          : "No plans match the current filters."
                        }
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}