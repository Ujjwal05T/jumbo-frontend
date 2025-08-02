/**
 * Barcode Display Component
 */
"use client";

import React from "react";
import Barcode from "react-barcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Printer } from "lucide-react";

interface BarcodeDisplayProps {
  value: string;
  title?: string;
  description?: string;
  width?: number;
  height?: number;
  showActions?: boolean;
  className?: string;
}

export default function BarcodeDisplay({ 
  value, 
  title, 
  description, 
  width = 2,
  height = 100, 
  showActions = true,
  className = ""
}: BarcodeDisplayProps) {
  
  const downloadBarcode = () => {
    const svg = document.getElementById(`barcode-${value}`)?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    canvas.width = 400; // Higher resolution
    canvas.height = 150;
    
    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const link = document.createElement('a');
        link.download = `barcode-${value}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const printBarcode = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode - ${value}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 20px; 
            }
            .barcode-container { 
              margin: 20px auto;
              display: inline-block;
            }
            .barcode-info {
              margin-top: 15px;
              font-size: 14px;
              color: #666;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="barcode-container">
            <h2>${title || 'Barcode'}</h2>
            <div id="barcode-print"></div>
            <div class="barcode-info">
              <p><strong>Code:</strong> ${value}</p>
              ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
            </div>
          </div>
        </body>
      </html>
    `);
    
    // Add barcode to print window
    const barcodeContainer = printWindow.document.getElementById('barcode-print');
    if (barcodeContainer) {
      // Create a larger barcode for printing
      const barcodeSvg = `
        <svg width="300" height="120" viewBox="0 0 300 120">
          ${document.getElementById(`barcode-${value}`)?.querySelector('svg')?.innerHTML || ''}
        </svg>
      `;
      barcodeContainer.innerHTML = barcodeSvg;
    }
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title || "Barcode"}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div 
          id={`barcode-${value}`}
          className="flex justify-center p-4 bg-white rounded-lg border inline-block"
        >
          <Barcode
            value={value}
            width={width}
            height={height}
            format="CODE128"
            displayValue={true}
            fontSize={14}
            textAlign="center"
            textPosition="bottom"
          />
        </div>
        
        <div className="text-sm text-muted-foreground font-mono break-all">
          {value}
        </div>
        
        {showActions && (
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadBarcode}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={printBarcode}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}