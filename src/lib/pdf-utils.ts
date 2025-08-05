import jsPDF from 'jspdf';

export interface CutRollForPDF {
  width: number;
  gsm?: number;
  bf?: number;
  shade?: string;
  qr_code?: string;
  barcode_id?: string;
  individual_roll_number?: number;
  trim_left?: number;
  isSelected?: boolean;
}

export interface RollGroupForPDF {
  rolls: CutRollForPDF[];
  specKey: string;
  rollNumber?: string | number;
}

/**
 * Add visual cutting pattern representation to PDF
 */
export function addVisualCuttingPattern(
  pdf: jsPDF,
  rolls: CutRollForPDF[],
  yPosition: number,
  options: {
    rectStartX?: number;
    rectWidth?: number;
    rectHeight?: number;
    showSelectionColors?: boolean;
    showWaste?: boolean;
    totalWidth?: number;
  } = {}
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  
  const {
    rectStartX = 30,
    rectWidth = pageWidth - 60,
    rectHeight = 15,
    showSelectionColors = true,
    showWaste = true,
    totalWidth = 118
  } = options;

  // Calculate total used width
  const totalUsedWidth = rolls.reduce((sum, roll) => sum + roll.width, 0);
  const waste = totalWidth - totalUsedWidth;

  let currentX = rectStartX;

  // Draw each cut section
  rolls.forEach((roll) => {
    const widthRatio = roll.width / totalWidth;
    const sectionWidth = rectWidth * widthRatio;

    // Set color based on selection or default colors
    if (showSelectionColors && roll.isSelected !== undefined) {
      if (roll.isSelected) {
        pdf.setFillColor(34, 197, 94); // Green for selected
      } else {
        pdf.setFillColor(59, 130, 246); // Blue for not selected
      }
    } else {
      // Default colors based on roll characteristics
      if (roll.shade?.toLowerCase().includes('white')) {
        pdf.setFillColor(148, 163, 184); // Light gray for white paper
      } else if (roll.shade?.toLowerCase().includes('golden')) {
        pdf.setFillColor(251, 191, 36); // Golden color
      } else {
        pdf.setFillColor(99, 102, 241); // Default blue
      }
    }

    // Draw rectangle for this cut
    pdf.rect(currentX, yPosition, sectionWidth, rectHeight, 'F');
    
    // Add border
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.5);
    pdf.rect(currentX, yPosition, sectionWidth, rectHeight, 'S');

    // Add width text inside the rectangle
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(7);
    const textX = currentX + sectionWidth/2;
    const textY = yPosition + rectHeight/2 + 1;
    pdf.text(`${roll.width}"`, textX, textY, { align: 'center' });

    currentX += sectionWidth;
  });

  // Draw waste section if any
  if (showWaste && waste > 0) {
    const wasteRatio = waste / totalWidth;
    const wasteWidth = rectWidth * wasteRatio;
    
    pdf.setFillColor(239, 68, 68); // Red for waste
    pdf.rect(currentX, yPosition, wasteWidth, rectHeight, 'F');
    pdf.setDrawColor(255, 255, 255);
    pdf.rect(currentX, yPosition, wasteWidth, rectHeight, 'S');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(6);
    pdf.text(`Waste: ${waste.toFixed(1)}"`, currentX + wasteWidth/2, yPosition + rectHeight/2 + 1, { align: 'center' });
  }

  return yPosition + rectHeight;
}

/**
 * Add legend for roll colors to PDF
 */
export function addRollColorLegend(
  pdf: jsPDF,
  yPosition: number,
  options: {
    showSelectionLegend?: boolean;
    showPaperTypeLegend?: boolean;
  } = {}
): number {
  const { showSelectionLegend = true, showPaperTypeLegend = false } = options;

  pdf.setFontSize(12);
  pdf.setTextColor(40, 40, 40);
  pdf.text("Color Legend:", 20, yPosition);
  yPosition += 8;

  const legendItems = [];

  if (showSelectionLegend) {
    legendItems.push(
      { color: [34, 197, 94], text: "✓ Selected for Production" },
      { color: [59, 130, 246], text: "Available but Not Selected" }
    );
  }

  if (showPaperTypeLegend) {
    legendItems.push(
      { color: [148, 163, 184], text: "White Paper" },
      { color: [251, 191, 36], text: "Golden Paper" },
      { color: [99, 102, 241], text: "Other Paper Types" }
    );
  }

  if (!showSelectionLegend && !showPaperTypeLegend) {
    legendItems.push(
      { color: [239, 68, 68], text: "Waste Material" },
      { color: [99, 102, 241], text: "Cut Rolls" }
    );
  }

  // Always add waste legend
  legendItems.push({ color: [239, 68, 68], text: "Waste Material" });

  legendItems.forEach((item, index) => {
    const legendX = 20 + (index * 65);
    
    // Draw color box
    pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
    pdf.rect(legendX, yPosition - 3, 8, 6, 'F');
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    pdf.rect(legendX, yPosition - 3, 8, 6, 'S');
    
    // Add text
    pdf.setFontSize(8);
    pdf.setTextColor(60, 60, 60);
    pdf.text(item.text, legendX + 10, yPosition);
  });

  return yPosition + 15;
}

/**
 * Add roll statistics boxes to PDF
 */
export function addRollStatistics(
  pdf: jsPDF,
  rolls: CutRollForPDF[],
  yPosition: number,
  options: {
    rectStartX?: number;
    rectWidth?: number;
    totalWidth?: number;
  } = {}
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const {
    rectStartX = 30,
    rectWidth = pageWidth - 60,
    totalWidth = 118
  } = options;

  const totalUsedWidth = rolls.reduce((sum, roll) => sum + roll.width, 0);
  const waste = totalWidth - totalUsedWidth;
  const efficiency = ((totalUsedWidth / totalWidth) * 100);
  const selectedRolls = rolls.filter(roll => roll.isSelected).length;

  const statsBoxWidth = (rectWidth - 15) / 4; // 4 stats boxes with gaps
  const statsBoxHeight = 15;

  const stats = [
    { label: 'Used Width', value: `${totalUsedWidth.toFixed(1)}"`, color: [34, 197, 94] },
    { label: 'Waste', value: `${waste.toFixed(1)}"`, color: [239, 68, 68] },
    { label: 'Efficiency', value: `${efficiency.toFixed(1)}%`, color: [59, 130, 246] },
    { label: 'Rolls', value: `${rolls.length}`, color: [99, 102, 241] }
  ];

  stats.forEach((stat, index) => {
    const boxX = rectStartX + (index * (statsBoxWidth + 5));
    
    // Draw box border
    pdf.setDrawColor(60, 60, 60);
    pdf.setLineWidth(0.5);
    pdf.rect(boxX, yPosition, statsBoxWidth, statsBoxHeight, 'S');
    
    // Add colored header
    pdf.setFillColor(stat.color[0], stat.color[1], stat.color[2]);
    pdf.rect(boxX, yPosition, statsBoxWidth, 5, 'F');
    
    // Add label
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(7);
    pdf.text(stat.label, boxX + statsBoxWidth/2, yPosition + 3.5, { align: 'center' });
    
    // Add value
    pdf.setTextColor(40, 40, 40);
    pdf.setFontSize(10);
    pdf.text(stat.value, boxX + statsBoxWidth/2, yPosition + 11, { align: 'center' });
  });

  return yPosition + statsBoxHeight + 8;
}

/**
 * Add total width indicator to PDF
 */
export function addTotalWidthIndicator(
  pdf: jsPDF,
  yPosition: number,
  options: {
    rectStartX?: number;
    rectWidth?: number;
    totalWidth?: number;
  } = {}
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const {
    rectStartX = 30,
    rectWidth = pageWidth - 60,
    totalWidth = 118
  } = options;

  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(7);
  pdf.text(`${totalWidth}" Total Width`, rectStartX + rectWidth/2, yPosition, { align: 'center' });
  
  return yPosition + 8;
}

/**
 * Group rolls by specification for better organization
 */
export function groupRollsBySpecification(rolls: CutRollForPDF[]): Record<string, CutRollForPDF[]> {
  return rolls.reduce((groups, roll) => {
    const specKey = roll.gsm && roll.bf && roll.shade 
      ? `${roll.gsm}gsm, ${roll.bf}bf, ${roll.shade}`
      : 'Unknown Specification';
    
    if (!groups[specKey]) {
      groups[specKey] = [];
    }
    groups[specKey].push(roll);
    return groups;
  }, {} as Record<string, CutRollForPDF[]>);
}

/**
 * Group rolls by roll number within a specification
 */
export function groupRollsByNumber(rolls: CutRollForPDF[]): Record<string, CutRollForPDF[]> {
  return rolls.reduce((rollGroups, roll) => {
    const rollNum = roll.individual_roll_number?.toString() || "No Roll #";
    if (!rollGroups[rollNum]) {
      rollGroups[rollNum] = [];
    }
    rollGroups[rollNum].push(roll);
    return rollGroups;
  }, {} as Record<string, CutRollForPDF[]>);
}

/**
 * Check if a new page is needed and add one if necessary
 */
export function checkPageBreak(pdf: jsPDF, currentY: number, requiredHeight: number): number {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (currentY + requiredHeight > pageHeight - 20) {
    pdf.addPage();
    return 20; // Reset to top margin
  }
  return currentY;
}

/**
 * Add complete visual cutting pattern section to PDF
 */
export function addCompleteCuttingSection(
  pdf: jsPDF,
  rolls: CutRollForPDF[],
  yPosition: number,
  options: {
    title?: string;
    showLegend?: boolean;
    showStatistics?: boolean;
    showTotalIndicator?: boolean;
    groupBySpecification?: boolean;
    groupByRollNumber?: boolean;
    showSelectionColors?: boolean;
  } = {}
): number {
  const {
    title = "Cutting Pattern Visualization",
    showLegend = true,
    showStatistics = true,
    showTotalIndicator = true,
    groupBySpecification = true,
    groupByRollNumber = true,
    showSelectionColors = true
  } = options;

  let currentY = yPosition;

  // Add title
  if (title) {
    currentY = checkPageBreak(pdf, currentY, 20);
    pdf.setFontSize(16);
    pdf.setTextColor(40, 40, 40);
    pdf.text(title, 20, currentY);
    currentY += 15;
  }

  // Add legend
  if (showLegend) {
    currentY = checkPageBreak(pdf, currentY, 25);
    currentY = addRollColorLegend(pdf, currentY, { 
      showSelectionLegend: showSelectionColors,
      showPaperTypeLegend: !showSelectionColors 
    });
  }

  if (groupBySpecification) {
    const groupedRolls = groupRollsBySpecification(rolls);
    
    Object.entries(groupedRolls).forEach(([specKey, specRolls]) => {
      currentY = checkPageBreak(pdf, currentY, 25);

      // Specification header
      pdf.setFontSize(14);
      pdf.setTextColor(40, 40, 40);
      pdf.text(specKey, 20, currentY);
      currentY += 10;

      if (groupByRollNumber) {
        const rollsByNumber = groupRollsByNumber(specRolls);
        
        Object.entries(rollsByNumber).forEach(([rollNumber, rollsInNumber]) => {
          currentY = checkPageBreak(pdf, currentY, 50);

          pdf.setFontSize(12);
          pdf.setTextColor(60, 60, 60);
          const rollTitle = rollNumber === "No Roll #" ? "Unassigned Roll" : `Roll #${rollNumber}`;
          pdf.text(rollTitle, 25, currentY);
          currentY += 8;

          // Add cutting pattern title
          pdf.setFontSize(9);
          pdf.text("Cutting Pattern:", 30, currentY);
          currentY += 8;

          // Add visual representation
          currentY = addVisualCuttingPattern(pdf, rollsInNumber, currentY, { showSelectionColors });
          currentY += 3;

          // Add total width indicator
          if (showTotalIndicator) {
            currentY = addTotalWidthIndicator(pdf, currentY);
          }

          // Add statistics
          if (showStatistics) {
            currentY = checkPageBreak(pdf, currentY, 25);
            currentY = addRollStatistics(pdf, rollsInNumber, currentY);
          }

          currentY += 10; // Space between roll numbers
        });
      } else {
        // Show all rolls in specification without grouping by number
        currentY = checkPageBreak(pdf, currentY, 40);
        currentY = addVisualCuttingPattern(pdf, specRolls, currentY, { showSelectionColors });
        
        if (showTotalIndicator) {
          currentY = addTotalWidthIndicator(pdf, currentY);
        }
        
        if (showStatistics) {
          currentY = addRollStatistics(pdf, specRolls, currentY);
        }
      }

      currentY += 15; // Space between specifications
    });
  } else {
    // Show all rolls together without grouping
    currentY = checkPageBreak(pdf, currentY, 40);
    currentY = addVisualCuttingPattern(pdf, rolls, currentY, { showSelectionColors });
    
    if (showTotalIndicator) {
      currentY = addTotalWidthIndicator(pdf, currentY);
    }
    
    if (showStatistics) {
      currentY = addRollStatistics(pdf, rolls, currentY);
    }
  }

  return currentY;
}