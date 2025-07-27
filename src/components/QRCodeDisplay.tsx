/**
 * QR Code Display Component
 */
"use client";

import React from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Printer } from "lucide-react";

interface QRCodeDisplayProps {
  value: string;
  title?: string;
  description?: string;
  size?: number;
  showActions?: boolean;
  className?: string;
}

export default function QRCodeDisplay({ 
  value, 
  title, 
  description, 
  size = 128, 
  showActions = true,
  className = ""
}: QRCodeDisplayProps) {
  
  const downloadQRCode = () => {
    const svg = document.getElementById(`qr-${value}`)?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    canvas.width = size * 2; // Higher resolution
    canvas.height = size * 2;
    
    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const link = document.createElement('a');
        link.download = `qr-code-${value}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const printQRCode = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${value}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 20px; 
            }
            .qr-container { 
              margin: 20px auto;
              display: inline-block;
            }
            .qr-info {
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
          <div class="qr-container">
            <h2>${title || 'QR Code'}</h2>
            <div id="qr-print"></div>
            <div class="qr-info">
              <p><strong>Code:</strong> ${value}</p>
              ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
            </div>
          </div>
        </body>
      </html>
    `);
    
    // Add QR code to print window
    const qrContainer = printWindow.document.getElementById('qr-print');
    if (qrContainer) {
      // Create a larger QR code for printing
      const qrSvg = `
        <svg width="200" height="200" viewBox="0 0 200 200">
          ${document.getElementById(`qr-${value}`)?.querySelector('svg')?.innerHTML || ''}
        </svg>
      `;
      qrContainer.innerHTML = qrSvg;
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
        <CardTitle className="text-lg">{title || "QR Code"}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div 
          id={`qr-${value}`}
          className="flex justify-center p-4 bg-white rounded-lg border inline-block"
        >
          <QRCode
            value={value}
            size={size}
            level="M"
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
              onClick={downloadQRCode}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={printQRCode}
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