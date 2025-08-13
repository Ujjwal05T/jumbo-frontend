"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Weight, 
  Scan, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  RefreshCw,
  Package,
  Search
} from 'lucide-react';
import { toast } from 'sonner';

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

interface RollDetailsCardProps {
  result: QRScanResult;
}

function RollDetailsCard({ result }: RollDetailsCardProps) {
  const statusColor = getStatusColor(result.roll_details.status);
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl md:text-2xl">Roll Details</CardTitle>
            <CardDescription className="text-base">
              Code: {result.barcode_id || result.qr_code}
            </CardDescription>
          </div>
          <Badge 
            style={{ backgroundColor: statusColor, color: 'white' }}
            className="text-sm px-3 py-1"
          >
            {result.roll_details.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Label className="text-sm font-medium text-muted-foreground">WIDTH</Label>
            <p className="text-2xl font-bold mt-1">{formatDimensions(result.roll_details.width_inches)}</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Label className="text-sm font-medium text-muted-foreground">CURRENT WEIGHT</Label>
            <p className="text-2xl font-bold mt-1 text-blue-600">{formatWeight(result.roll_details.weight_kg)}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Type</Label>
            <p className="text-lg font-semibold capitalize">{result.roll_details.roll_type}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Location</Label>
            <p className="text-lg font-semibold">{result.roll_details.location || 'Not Set'}</p>
          </div>
        </div>
        
        {result.paper_specifications && (
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Paper Specification</Label>
            <p className="text-lg font-semibold text-green-600">{getPaperSpecSummary(result)}</p>
          </div>
        )}
        
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Client</Label>
          <p className="text-lg font-semibold text-purple-600">
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
}

function WeightUpdateForm({ scanResult, onUpdate, loading, onReset }: WeightUpdateFormProps) {
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
      
      // Reset form and go back to scanner
      setWeight('');
      toast.success('Weight updated successfully!', {
        description: 'Roll status set to available. Page will refresh automatically.',
        duration: 2000,
      });
      
      // Auto refresh after successful update
      setTimeout(() => {
        onReset();
      }, 2000);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update weight';
      toast.error(errorMessage);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl flex items-center">
          <Weight className="mr-3 h-6 w-6" />
          Update Weight
        </CardTitle>
        <CardDescription className="text-base">
          Enter the new weight for this roll
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="weight" className="text-lg font-medium mb-3 block">
              New Weight (kg) *
            </Label>
            <Input
              ref={weightInputRef}
              id="weight"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Enter weight in kg"
              className={`text-xl p-4 h-14 ${errors.weight ? 'border-red-500' : 'border-gray-300'}`}
              autoComplete="off"
            />
            {errors.weight && (
              <p className="text-red-500 mt-2 text-sm font-medium">{errors.weight}</p>
            )}
          </div>
          
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 mb-1">Auto Status Update</p>
                <p className="text-sm text-blue-700">
                  When weight is added, the roll status will automatically be set to "available" and ready for dispatch.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 pt-4">
            <Button 
              type="submit" 
              disabled={loading || !weight.trim()}
              className="flex-1 h-14 text-lg"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Updating Weight...
                </>
              ) : (
                <>
                  <Weight className="mr-2 h-5 w-5" />
                  Update Weight
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              disabled={loading}
              className="h-14 px-6"
              size="lg"
            >
              <RefreshCw className="h-5 w-5" />
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
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanResult, setScanResult] = useState<QRScanResult | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus on barcode input when component mounts or resets
    if (barcodeInputRef.current && !scanResult) {
      barcodeInputRef.current.focus();
    }
  }, [scanResult]);

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!barcodeInput.trim()) {
      toast.error('Please enter a barcode');
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
    setBarcodeInput('');
    setError(null);
    // Focus will be set by useEffect
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Weight Update Scanner
          </h1>
          <p className="text-lg text-gray-600">
            Scan barcode to update roll weight
          </p>
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
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Scan className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Scan Barcode</CardTitle>
              <CardDescription className="text-base">
                Enter or scan the barcode to get roll details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBarcodeSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="barcode-input" className="text-lg font-medium mb-3 block">
                    Barcode
                  </Label>
                  <Input
                    ref={barcodeInputRef}
                    id="barcode-input"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Enter barcode (e.g., CR_00001)"
                    className="text-xl p-4 h-14"
                    autoComplete="off"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  disabled={loading || !barcodeInput.trim()}
                  className="w-full h-14 text-lg"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Scan Barcode
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* Roll Details and Weight Update */
          <div className="grid lg:grid-cols-2 gap-8">
            <RollDetailsCard result={scanResult} />
            <WeightUpdateForm
              scanResult={scanResult}
              onUpdate={handleWeightUpdate}
              loading={loading}
              onReset={handleReset}
            />
          </div>
        )}
      </div>
    </div>
  );
}