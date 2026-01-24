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
  Scan,
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  LogOut,
  User,
  ArrowLeft,
  ClipboardCheck
} from 'lucide-react';
import { toast } from 'sonner';

import {
  scanQRCode,
  formatDimensions,
  getStatusColor,
  parseQRCodeData,
  getPaperSpecSummary,
  QRScanResult
} from '@/lib/qr-management';
import { transformJumboBarcode, transformSetBarcode } from '@/lib/barcode-utils';
import { QUALITY_CHECK_ENDPOINTS, createRequestOptions } from '@/lib/api-config';

interface RollDetailsCardProps {
  result: QRScanResult;
}

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
          <Badge
            style={{ backgroundColor: statusColor, color: 'white' }}
            className="text-xs sm:text-sm px-2 sm:px-3 py-1"
          >
            {result.roll_details.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
            <Label className="text-xs sm:text-sm font-medium text-muted-foreground">WIDTH</Label>
            <p className="text-xl sm:text-2xl font-bold mt-1">{formatDimensions(result.roll_details.width_inches)}</p>
          </div>
          {/* <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
            <Label className="text-xs sm:text-sm font-medium text-muted-foreground">WEIGHT</Label>
            <p className="text-xl sm:text-2xl font-bold mt-1 text-blue-600">{result.roll_details.weight_kg} kg</p>
          </div> */}
        </div>

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

interface QualityCheckFormProps {
  scanResult: QRScanResult;
  onUpdate: (qcData: QualityCheckData) => Promise<void>;
  loading: boolean;
  onReset: () => void;
}

interface QualityCheckData {
  barcode_id: string;
  gsm: string;
  bf: string;
  cobb_value: string;
}

function QualityCheckForm({ scanResult, onUpdate, loading, onReset }: QualityCheckFormProps) {
  const [gsm, setGsm] = useState<string>('');
  const [bf, setBf] = useState<string>('');
  const [cobbValue, setCobbValue] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const gsmInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus on GSM input when component mounts
    if (gsmInputRef.current) {
      gsmInputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that at least one field is filled
    if (!gsm.trim() && !bf.trim() && !cobbValue.trim()) {
      setErrors({ general: 'Please enter at least one quality parameter' });
      toast.error('Please enter at least one quality parameter');
      return;
    }

    setErrors({});

    try {
      await onUpdate({
        barcode_id: scanResult.barcode_id || scanResult.qr_code,
        gsm: gsm.trim(),
        bf: bf.trim(),
        cobb_value: cobbValue.trim()
      });

      // Clear the inputs
      setGsm('');
      setBf('');
      setCobbValue('');
      
      toast.success('Quality check recorded successfully!', {
        description: 'QC data has been saved',
        duration: 2000,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record quality check';
      toast.error(errorMessage);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl md:text-2xl flex items-center">
          <ClipboardCheck className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />
          Quality Check
        </CardTitle>
        <CardDescription className="text-sm sm:text-base">
          Enter quality parameters for this roll
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="gsm" className="text-base sm:text-lg font-medium mb-2 block">
                GSM
              </Label>
              <Input
                ref={gsmInputRef}
                id="gsm"
                type="text"
                value={gsm}
                onChange={(e) => setGsm(e.target.value)}
                placeholder="GSM"
                className="text-lg sm:text-xl p-3 sm:p-4 h-12 sm:h-14"
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor="bf" className="text-base sm:text-lg font-medium mb-2 block">
                BF
              </Label>
              <Input
                id="bf"
                type="text"
                value={bf}
                onChange={(e) => setBf(e.target.value)}
                placeholder="BF"
                className="text-lg sm:text-xl p-3 sm:p-4 h-12 sm:h-14"
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor="cobb" className="text-base sm:text-lg font-medium mb-2 block">
                Cobb Value
              </Label>
              <Input
                id="cobb"
                type="text"
                value={cobbValue}
                onChange={(e) => setCobbValue(e.target.value)}
                placeholder="Cobb"
                className="text-lg sm:text-xl p-3 sm:p-4 h-12 sm:h-14"
                autoComplete="off"
              />
            </div>
          </div>

          {errors.general && (
            <p className="text-red-500 text-sm font-medium">{errors.general}</p>
          )}

          <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-medium text-blue-800 mb-1">Quality Data</p>
                <p className="text-xs sm:text-sm text-blue-700">
                  Enter quality parameters for this roll. At least one field is required.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-2 sm:pt-4">
            <Button
              type="submit"
              disabled={loading || (!gsm.trim() && !bf.trim() && !cobbValue.trim())}
              className="flex-1 min-h-[48px] sm:min-h-[56px] text-base sm:text-lg w-full sm:w-auto"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  <span className="text-sm sm:text-base">Recording...</span>
                </>
              ) : (
                <>
                  <ClipboardCheck className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm sm:text-base">Record Quality Check</span>
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

export default function QualityCheckScanner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('CR_');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString().slice(-2));
  const [scanResult, setScanResult] = useState<QRScanResult | null>(null);
  const [userName, setUserName] = useState<string>('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Generate dynamic year options (current year ± 2 years)
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = -2; i <= 2; i++) {
      const year = currentYear + i;
      years.push({
        value: year.toString().slice(-2),
        label: year.toString()
      });
    }
    return years;
  };

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

    // Append year suffix if not already present
    const barcodeWithYear = qrCode.includes('-') ? qrCode : `${qrCode}-${selectedYear}`;

    try {
      setLoading(true);
      setError(null);

      const result = await scanQRCode(barcodeWithYear);
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

  const handleQualityCheckUpdate = async (qcData: QualityCheckData) => {
    try {
      setLoading(true);
      
      const response = await fetch(
        QUALITY_CHECK_ENDPOINTS.QUALITY_CHECK,
        createRequestOptions('POST', qcData)
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to record quality check');
      }

      await response.json();
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
              QC Scanner
            </h1>
            <p className="text-base sm:text-lg text-gray-600">
              Scan barcode to record quality parameters
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
                    Barcode & Year
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex items-center flex-1">
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
                        className="text-lg sm:text-xl p-3 sm:p-4 h-12 sm:h-14 rounded-l-none rounded-r-md"
                        autoComplete="off"
                      />
                    </div>
                    <div className="relative">
                      <select
                        id="year-select"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="appearance-none text-lg sm:text-xl p-3 sm:p-4 h-12 sm:h-14 pr-10 border border-gray-300 rounded-md bg-white font-semibold text-blue-600 cursor-pointer hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[90px] sm:min-w-[110px]"
                      >
                        {getYearOptions().map(year => (
                          <option key={year.value} value={year.value}>{year.label}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
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
          /* Roll Details and Quality Check Form */
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
              <QualityCheckForm
                scanResult={scanResult}
                onUpdate={handleQualityCheckUpdate}
                loading={loading}
                onReset={handleReset}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
