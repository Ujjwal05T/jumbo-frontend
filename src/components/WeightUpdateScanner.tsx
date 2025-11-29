"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Weight,
  Scan,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Search,
  LogOut,
  User,
  Printer,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

import {
  scanQRCode,
  updateWeightViaQR,
  formatWeight,
  formatDimensions,
  getStatusColor,
  parseQRCodeData,
  validateWeight,
  getPaperSpecSummary,
  QRScanResult,
  QRWeightUpdate
} from '@/lib/qr-management';
import { transformJumboBarcode, transformSetBarcode } from '@/lib/barcode-utils';

interface RollDetailsCardProps {
  result: QRScanResult;
}

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

// Function to open PDF for print
const openPDFForPrint = (doc: any) => {
  try {
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);

    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error opening PDF for print:', error);
    throw error;
  }
};

// Function to print single barcode label
const printSingleBarcodeLabel = async (result: QRScanResult) => {
  try {

    const img = new Image();
    img.src = '/GPH_LOGO.png'; // Path to your base64 logo file
    await new Promise((resolve, reject) => {
      img.onload = () => resolve(true);
      img.onerror = (err) => reject(err);
    });
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'cm',
      format: [15.00, 10.13]
    });

    const barcodeValue = result.barcode_id || result.qr_code;

    // Draw border
    doc.setDrawColor(51, 51, 51);
    doc.setLineWidth(0.03);
    doc.rect(0, 0, 15.00, 10.13);

    // Header section (1.2cm height)
    doc.setFillColor(233, 233, 233);
    doc.rect(0, 0, 15.00, 1.2, 'F');
    doc.setDrawColor(191, 191, 191);
    doc.line(0, 1.2, 15.00, 1.2);

    // Add GPH Logo - using the loaded PNG image
    doc.addImage(img, 'PNG', 0.3, 0.2, 1.5, 0.8);
    console.log('Using GPH PNG logo');

    // Company name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SatGuru Papers Pvt. Ltd.', 7.5, 0.65, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Kraft paper Mill', 11.5, 0.65, { align: 'left' });

    // Plant address
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Plant Address - Sector 3 Pithampur Dhar (M.P.)', 14.6, 1.0, { align: 'right' });

    // Content area - Left column (labels)
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 34, 34);

    let yPos = 2.1;
    doc.text('SHADE :', 0.8, yPos);
    yPos += 1.1;
    doc.text('SIZE (Inch) :', 0.8, yPos);
    yPos += 1.1;
    doc.text('GSM :', 0.8, yPos);
    yPos += 1.1;
    doc.text('BF :', 0.8, yPos);
    yPos += 1.1;
    doc.text('Batch No. :', 0.8, yPos);

    // Content area - Right column (values)
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');

    yPos = 2.1;
    const rightX = 14.4;

    // DATE
    const formattedDate = new Date().toLocaleDateString('en-GB');
    doc.text(`DATE : ${formattedDate}`, rightX, yPos, { align: 'right' });
    yPos += 1.1;

    // REEL NO
    doc.text(`REEL NO. : ${barcodeValue}`, rightX, yPos, { align: 'right' });
    yPos += 1.1;

    // WEIGHT
    doc.text(`WEIGHT : ${result.roll_details.weight_kg}kg`, rightX, yPos, { align: 'right' });

    // Left column values (shade, size, gsm, bf)
    doc.setFontSize(15);
    yPos = 2.1;
    const leftValueX = 4.5;

    doc.text(result.paper_specifications?.shade || '', leftValueX, yPos);
    yPos += 1.1;
    doc.text(`${result.roll_details.width_inches}"`, leftValueX, yPos);
    yPos += 1.1;
    doc.text(`${result.paper_specifications?.gsm || ''}`, leftValueX, yPos);
    yPos += 1.1;
    doc.text(`${result.paper_specifications?.bf || ''}`, leftValueX, yPos);
    yPos += 1.1;
    doc.text(" ", leftValueX, yPos);

    // Barcode area (10cm x 2cm) at bottom-right
    try {
      const canvas = generateBarcodeCanvas(barcodeValue);
      const barcodeDataUrl = canvas.toDataURL('image/png');

      // Position barcode at bottom-right
      const barcodeX = 4.4; // right margin 0.6cm
      const barcodeY = 7.63; // bottom margin 0.5cm
      const barcodeWidth = 10.0;
      const barcodeHeight = 2.0;

      // Draw border around barcode
      doc.setDrawColor(153, 153, 153);
      doc.setLineWidth(0.03);
      doc.rect(barcodeX, barcodeY, barcodeWidth, barcodeHeight);

      // Add barcode image
      doc.addImage(barcodeDataUrl, 'PNG', barcodeX + 0.2, barcodeY + 0.2, barcodeWidth - 0.4, barcodeHeight - 0.4);

    } catch (error) {
      console.error('Error adding barcode:', error);
      // Fallback: draw box with text
      const barcodeX = 4.4;
      const barcodeY = 7.63;
      const barcodeWidth = 10.0;
      const barcodeHeight = 2.0;

      doc.setDrawColor(153, 153, 153);
      doc.rect(barcodeX, barcodeY, barcodeWidth, barcodeHeight);

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(barcodeValue, barcodeX + barcodeWidth / 2, barcodeY + barcodeHeight / 2, { align: 'center' });
    }

    openPDFForPrint(doc);
    toast.success('Barcode label opened for printing!');
  } catch (error) {
    console.error('Error printing barcode label:', error);
    toast.error('Failed to print barcode label');
  }
};

function RollDetailsCard({ result }: RollDetailsCardProps) {
  const statusColor = getStatusColor(result.roll_details.status);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div className="text-center sm:text-left">
            <CardTitle className="text-lg sm:text-xl md:text-2xl">Roll Details</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-3 sm:gap-4 p-3 text-sm sm:text-base">
              <div className="font-bold text-gray-500">
                Code: <span className="font-mono">{result.barcode_id || result.qr_code}</span>
              </div>

              {result.parent_rolls.parent_118_barcode && (
                <div className="flex items-center gap-1">
                  <span className="text-xs sm:text-sm text-gray-600">SET:</span>
                  <span className="text-sm sm:text-base font-mono font-semibold ">
                    {transformSetBarcode(result.parent_rolls.parent_118_barcode)}
                  </span>
                </div>
              )}
              {result.parent_rolls.parent_jumbo_barcode && (
                <div className="flex items-center gap-1">
                  <span className="text-xs sm:text-sm text-gray-600">Jumbo:</span>
                  <span className="text-sm sm:text-base font-mono font-semibold ">
                    {transformJumboBarcode(result.parent_rolls.parent_jumbo_barcode)}
                  </span>
                </div>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => await printSingleBarcodeLabel(result)}
              className="text-purple-600 border-purple-600 hover:bg-purple-50 w-full sm:w-auto"
            >
              <Printer className="h-3 w-3 mr-1" />
              <span className="text-xs sm:text-sm">Print Label</span>
            </Button>
            <Badge
              style={{ backgroundColor: statusColor, color: 'white' }}
              className="text-xs sm:text-sm px-2 sm:px-3 py-1"
            >
              {result.roll_details.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
            <Label className="text-xs sm:text-sm font-medium text-muted-foreground">WIDTH</Label>
            <p className="text-xl sm:text-2xl font-bold mt-1">{formatDimensions(result.roll_details.width_inches)}</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
            <Label className="text-xs sm:text-sm font-medium text-muted-foreground">CURRENT WEIGHT</Label>
            <p className="text-xl sm:text-2xl font-bold mt-1 text-blue-600">{formatWeight(result.roll_details.weight_kg)}</p>
          </div>
        </div>

        {/* <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          <div>
            <Label className="text-xs sm:text-sm font-medium text-muted-foreground">Type</Label>
            <p className="text-base sm:text-lg font-semibold capitalize">{result.roll_details.roll_type}</p>
          </div>
          <div>
            <Label className="text-xs sm:text-sm font-medium text-muted-foreground">Location</Label>
            <p className="text-base sm:text-lg font-semibold">{result.roll_details.location || 'Not Set'}</p>
          </div>
        </div> */}

        {result.paper_specifications && (
          <div>
            <Label className="text-xs sm:text-sm font-medium text-muted-foreground">Paper Specification</Label>
            <p className="text-base sm:text-lg font-semibold text-green-600 break-words">{getPaperSpecSummary(result)}</p>
          </div>
        )}

        <div>
          <Label className="text-xs sm:text-sm font-medium text-muted-foreground">Client</Label>
          <p className="text-base sm:text-lg font-semibold text-purple-600 break-words">
            {result.client_info?.client_name || 'No Client Assigned'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface WeightUpdateFormProps {
  scanResult: QRScanResult;
  onUpdate: (updateData: QRWeightUpdate) => Promise<void>;
  loading: boolean;
  onReset: () => void;
  onScanResultUpdate: (updatedResult: QRScanResult) => void;
}

function WeightUpdateForm({ scanResult, onUpdate, loading, onReset, onScanResultUpdate }: WeightUpdateFormProps) {
  const [weight, setWeight] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const weightInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus on weight input when component mounts
    if (weightInputRef.current) {
      weightInputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const weightNum = parseFloat(weight);
    const weightValidation = validateWeight(weightNum);

    if (!weightValidation.isValid) {
      setErrors({ weight: weightValidation.message || 'Invalid weight' });
      return;
    }

    setErrors({});

    try {
      await onUpdate({
        qr_code: scanResult.barcode_id || scanResult.qr_code,
        weight_kg: weightNum,
        location: scanResult.roll_details.location
      });

      // Update the scan result to reflect the new weight
      const updatedScanResult = {
        ...scanResult,
        roll_details: {
          ...scanResult.roll_details,
          weight_kg: weightNum,
          status: 'available' // Update status to available
        }
      };
      onScanResultUpdate(updatedScanResult);

      // Clear the input and show toast
      setWeight('');
      toast.success('Weight updated successfully!', {
        description: `Roll weight updated to ${weightNum}kg`,
        duration: 2000,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update weight';
      toast.error(errorMessage);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl md:text-2xl flex items-center">
          <Weight className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />
          Update Weight
        </CardTitle>
        <CardDescription className="text-sm sm:text-base">
          Enter the new weight for this roll
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <Label htmlFor="weight" className="text-base sm:text-lg font-medium mb-2 sm:mb-3 block">
              New Weight (kg) *
            </Label>
            <Input
              ref={weightInputRef}
              id="weight"
              type="text"
              inputMode="decimal"
              pattern="[0-9.]*"
              value={weight}
              onChange={(e) => {
                const value = e.target.value;
                // Allow only numbers and single decimal point
                const cleanValue = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                setWeight(cleanValue);
              }}
              placeholder="Enter weight in kg"
              className={`text-lg sm:text-xl p-3 sm:p-4 h-12 sm:h-14 ${errors.weight ? 'border-red-500' : 'border-gray-300'}`}
              autoComplete="off"
            />
            {errors.weight && (
              <p className="text-red-500 mt-2 text-sm font-medium">{errors.weight}</p>
            )}
          </div>

          <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-medium text-blue-800 mb-1">Auto Status Update</p>
                <p className="text-xs sm:text-sm text-blue-700">
                  When weight is added, the roll status will automatically be set to "available" and ready for dispatch.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-2 sm:pt-4">
            <Button
              type="submit"
              disabled={loading || !weight.trim()}
              className="flex-1 min-h-[48px] sm:min-h-[56px] text-base sm:text-lg w-full sm:w-auto"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  <span className="text-sm sm:text-base">Updating Weight...</span>
                </>
              ) : (
                <>
                  <Weight className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm sm:text-base">Update Weight</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              disabled={loading}
              className="min-h-[48px] sm:min-h-[56px] px-4 sm:px-6 w-full sm:w-auto"
              size="lg"
            >
              New Barcode Scan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function WeightUpdateScanner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('CR_');
  const [scanResult, setScanResult] = useState<QRScanResult | null>(null);
  const [userName, setUserName] = useState<string>('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    // Get user name from localStorage
    const storedUserName = localStorage.getItem('user_name') || localStorage.getItem('username') || 'User';
    setUserName(storedUserName);

    // Focus on barcode input when component mounts or resets
    if (barcodeInputRef.current && !scanResult) {
      barcodeInputRef.current.focus();
    }
  }, [scanResult]);

  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem('username');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_role');
    
    // Show logout toast
    toast.success('Logged out successfully');
    
    // Redirect to login page
    router.push('/auth/login');
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!barcodeInput.trim() || barcodeInput.trim() === 'CR_') {
      toast.error('Please enter a barcode number');
      return;
    }

    const { qrCode, isValid } = parseQRCodeData(barcodeInput);

    if (!isValid) {
      toast.error('Invalid barcode format');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const result = await scanQRCode(qrCode);
      setScanResult(result);
      
      toast.success('Barcode scanned successfully!');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to scan barcode';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleWeightUpdate = async (updateData: QRWeightUpdate) => {
    try {
      setLoading(true);
      await updateWeightViaQR(updateData);
    } catch (err) {
      throw err; // Re-throw to be handled by the form component
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setScanResult(null);
    setBarcodeInput('CR_');
    setError(null);
    // Focus will be set by useEffect
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
        {/* Header with User Info and Logout */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="text-center sm:text-left flex-1 w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">
              Weight Update Scanner
            </h1>
            <p className="text-base sm:text-lg text-gray-600">
              Scan barcode to update roll weight
            </p>
          </div>

          {/* User Info and Logout */}
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-2 text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200">
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-none">{userName}</span>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 px-2 sm:px-3"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg">Error</AlertTitle>
            <AlertDescription className="text-base">{error}</AlertDescription>
          </Alert>
        )}

        {!scanResult ? (
          /* Barcode Input */
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center pb-4 sm:pb-6">
              <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                <Scan className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
              </div>
              <CardTitle className="text-xl sm:text-2xl">Scan Barcode</CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Enter or scan the barcode to get roll details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBarcodeSubmit} className="space-y-4 sm:space-y-6">
                <div>
                  <Label htmlFor="barcode-input" className="text-base sm:text-lg font-medium mb-2 sm:mb-3 block">
                    Barcode
                  </Label>
                  <div className="flex items-center">
                    <div className="text-lg sm:text-xl p-3 sm:p-4 h-12 sm:h-14 bg-gray-100 border border-gray-300 rounded-l-md flex items-center font-mono">
                      CR_
                    </div>
                    <Input
                      ref={barcodeInputRef}
                      id="barcode-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={barcodeInput.replace('CR_', '')}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setBarcodeInput('CR_' + value);
                      }}
                      placeholder="Enter barcode number"
                      className="text-lg sm:text-xl p-3 sm:p-4 h-12 sm:h-14 rounded-l-none"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !barcodeInput.trim() || barcodeInput.trim() === 'CR_'}
                  className="w-full h-12 sm:h-14 text-base sm:text-lg"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      Scan Barcode
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* Roll Details and Weight Update */
          <div className="space-y-4 sm:space-y-6">
            {/* Back Button */}
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Scanner
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 lg:gap-6">
              <RollDetailsCard result={scanResult} />
              <WeightUpdateForm
                scanResult={scanResult}
                onUpdate={handleWeightUpdate}
                loading={loading}
                onReset={handleReset}
                onScanResultUpdate={setScanResult}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}