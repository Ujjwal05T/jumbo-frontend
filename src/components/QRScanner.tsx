/**
 * QR Scanner Component for NEW FLOW
 * Handles QR code scanning, weight updates, and roll management
 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Camera, 
  Scan, 
  Weight, 
  Package, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Download,
  Search,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

import {
  scanQRCode,
  updateWeightViaQR,
  generateQRCode,
  isValidQRCode,
  formatWeight,
  formatDimensions,
  getStatusColor,
  parseQRCodeData,
  calculateWeightDifference,
  getRecommendedLocation,
  formatQRCodeDisplay,
  validateWeight,
  getPaperSpecSummary,
  exportQRDataToCSV,
  QRScanResult,
  QRWeightUpdate,
  QRGenerateRequest
} from '@/lib/qr-management';

interface ScanHistoryItem extends QRScanResult {
  scannedAt: string;
  actionTaken?: string;
}

interface WeightUpdateFormProps {
  scanResult: QRScanResult;
  onUpdate: (updateData: QRWeightUpdate) => Promise<void>;
  loading: boolean;
}

function WeightUpdateForm({ scanResult, onUpdate, loading }: WeightUpdateFormProps) {
  const [weight, setWeight] = useState<string>('');
  const [location, setLocation] = useState<string>(scanResult.roll_details.location);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
        qr_code: scanResult.qr_code,
        weight_kg: weightNum,
        location
      });
      
      setWeight('');
      toast.success('Weight updated successfully! Status automatically set to available.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update weight';
      toast.error(errorMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="weight">Weight (kg) *</Label>
          <Input
            id="weight"
            type="number"
            step="0.01"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Enter weight in kg"
            className={errors.weight ? 'border-red-500' : ''}
          />
          {errors.weight && <p className="text-sm text-red-500 mt-1">{errors.weight}</p>}
        </div>
        
        <div>
          <Label htmlFor="location">Location (Optional)</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Roll location"
          />
        </div>
      </div>
      
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> When weight is added, the roll status will automatically be set to "available" and ready for dispatch.
        </p>
      </div>
      
      <Button type="submit" disabled={loading || !weight}>
        {loading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
        ) : (
          <><Weight className="mr-2 h-4 w-4" />Update Weight</>
        )}
      </Button>
    </form>
  );
}

interface ScanResultDisplayProps {
  result: QRScanResult;
}

function ScanResultDisplay({ result }: ScanResultDisplayProps) {
  const statusColor = getStatusColor(result.roll_details.status);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">Roll Details</CardTitle>
            <CardDescription>QR Code: {formatQRCodeDisplay(result.qr_code)}</CardDescription>
          </div>
          <Badge 
            style={{ backgroundColor: statusColor, color: 'white' }}
          >
            {result.roll_details.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-sm text-muted-foreground">Width</Label>
            <p className="font-semibold">{formatDimensions(result.roll_details.width_inches)}</p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Weight</Label>
            <p className="font-semibold">{formatWeight(result.roll_details.weight_kg)}</p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Type</Label>
            <p className="font-semibold capitalize">{result.roll_details.roll_type}</p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Location</Label>
            <p className="font-semibold">{result.roll_details.location || 'Unknown'}</p>
          </div>
        </div>
        
        {result.paper_specifications && (
          <div>
            <Label className="text-sm text-muted-foreground">Paper Specification</Label>
            <p className="font-semibold">{getPaperSpecSummary(result)}</p>
          </div>
        )}
        
        <Separator />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-muted-foreground">Created</Label>
            <p>{new Date(result.production_info.created_at).toLocaleString()}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Created By</Label>
            <p>{result.production_info.created_by || 'Unknown'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function QRScanner() {
  const [activeTab, setActiveTab] = useState('scan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Scan state
  const [qrInput, setQrInput] = useState('');
  const [scanResult, setScanResult] = useState<QRScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  
  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Generation state
  const [generateRequest, setGenerateRequest] = useState<QRGenerateRequest>({});
  
  useEffect(() => {
    // Load scan history from localStorage
    const savedHistory = localStorage.getItem('qr_scan_history');
    if (savedHistory) {
      try {
        setScanHistory(JSON.parse(savedHistory));
      } catch (err) {
        console.error('Failed to load scan history:', err);
      }
    }
    
    return () => {
      // Cleanup camera stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  const saveScanHistory = (newHistory: ScanHistoryItem[]) => {
    setScanHistory(newHistory);
    localStorage.setItem('qr_scan_history', JSON.stringify(newHistory.slice(-50))); // Keep last 50
  };
  
  const handleManualScan = async () => {
    if (!qrInput.trim()) {
      toast.error('Please enter a QR code');
      return;
    }
    
    const { qrCode, isValid } = parseQRCodeData(qrInput);
    
    if (!isValid) {
      toast.error('Invalid QR code format');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const result = await scanQRCode(qrCode);
      setScanResult(result);
      
      // Add to history
      const historyItem: ScanHistoryItem = {
        ...result,
        scannedAt: new Date().toISOString(),
        actionTaken: 'Manual scan'
      };
      saveScanHistory([historyItem, ...scanHistory]);
      
      toast.success('QR code scanned successfully!');
      setQrInput('');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to scan QR code';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handleWeightUpdate = async (updateData: QRWeightUpdate) => {
    try {
      setLoading(true);
      const result = await updateWeightViaQR(updateData);
      
      // Update scan result with new data
      if (scanResult) {
        setScanResult({
          ...scanResult,
          roll_details: {
            ...scanResult.roll_details,
            weight_kg: result.weight_update.new_weight_kg,
            status: result.current_status,
            location: result.current_location
          }
        });
      }
      
      // Add to history
      const historyItem: ScanHistoryItem = {
        ...scanResult!,
        scannedAt: new Date().toISOString(),
        actionTaken: `Weight updated: ${result.weight_update.old_weight_kg}kg → ${result.weight_update.new_weight_kg}kg`
      };
      saveScanHistory([historyItem, ...scanHistory]);
      
      const weightDiff = calculateWeightDifference(
        result.weight_update.old_weight_kg,
        result.weight_update.new_weight_kg
      );
      
      toast.success(
        `Weight ${weightDiff.isIncrease ? 'increased' : 'decreased'} by ${weightDiff.difference.toFixed(2)}kg`
      );
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update weight';
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  const handleGenerateQR = async () => {
    try {
      setLoading(true);
      const result = await generateQRCode(generateRequest);
      
      toast.success(`QR code generated: ${result.qr_code}`);
      
      // You could display the generated QR code here
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate QR code';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use rear camera on mobile
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      toast.error('Failed to access camera');
      console.error('Camera error:', err);
    }
  };
  
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };
  
  const exportScanHistory = () => {
    if (scanHistory.length === 0) {
      toast.error('No scan history to export');
      return;
    }
    
    try {
      const csvContent = exportQRDataToCSV(scanHistory);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `qr_scan_history_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('Scan history exported successfully!');
      }
    } catch (err) {
      toast.error('Failed to export scan history');
      console.error('Export error:', err);
    }
  };
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">QR Code Management</h1>
          <p className="text-muted-foreground">Scan, track, and manage production roll QR codes</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportScanHistory}
            disabled={scanHistory.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export History
          </Button>
          <Button
            variant="outline"
            onClick={() => setScanHistory([])}
            disabled={scanHistory.length === 0}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Clear History
          </Button>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scan">Scan QR</TabsTrigger>
          <TabsTrigger value="update">Update Weight</TabsTrigger>
          <TabsTrigger value="generate">Generate QR</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="scan" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>QR Code Scanner</CardTitle>
              <CardDescription>
                Scan QR codes manually or using camera
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="qr-input">Enter QR Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="qr-input"
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      placeholder="Enter or paste QR code"
                      onKeyDown={(e) => e.key === 'Enter' && handleManualScan()}
                    />
                    <Button onClick={handleManualScan} disabled={loading || !qrInput.trim()}>
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={isCameraActive ? stopCamera : startCamera}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {isCameraActive ? 'Stop Camera' : 'Start Camera'}
                  </Button>
                </div>
              </div>
              
              {isCameraActive && (
                <div className="space-y-2">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full max-w-md mx-auto border rounded-lg"
                  />
                  <p className="text-sm text-muted-foreground text-center">
                    Point camera at QR code to scan
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {scanResult && <ScanResultDisplay result={scanResult} />}
        </TabsContent>
        
        <TabsContent value="update" className="space-y-6">
          {scanResult ? (
            <Card>
              <CardHeader>
                <CardTitle>Update Roll Weight</CardTitle>
                <CardDescription>
                  Update weight and status for QR: {formatQRCodeDisplay(scanResult.qr_code)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WeightUpdateForm
                  scanResult={scanResult}
                  onUpdate={handleWeightUpdate}
                  loading={loading}
                />
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <Scan className="h-4 w-4" />
              <AlertTitle>No QR Code Scanned</AlertTitle>
              <AlertDescription>
                Please scan a QR code first using the Scan QR tab.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        
        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate QR Code</CardTitle>
              <CardDescription>
                Generate new QR codes for inventory items
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="inventory-id">Inventory ID (Optional)</Label>
                  <Input
                    id="inventory-id"
                    value={generateRequest.inventory_id || ''}
                    onChange={(e) => setGenerateRequest({ inventory_id: e.target.value || undefined })}
                    placeholder="Leave empty to generate standalone QR code"
                  />
                </div>
                
                <Button onClick={handleGenerateQR} disabled={loading}>
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                  ) : (
                    <><Package className="mr-2 h-4 w-4" />Generate QR Code</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Scan History</CardTitle>
                  <CardDescription>
                    Recent QR code scans and actions ({scanHistory.length} total)
                  </CardDescription>
                </div>
                <Badge variant="outline">{scanHistory.length} scans</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {scanHistory.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {scanHistory.map((item, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{formatQRCodeDisplay(item.qr_code)}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDimensions(item.roll_details.width_inches)} - {formatWeight(item.roll_details.weight_kg)}
                          </p>
                        </div>
                        <Badge variant="outline">{item.roll_details.status}</Badge>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        <p>Scanned: {new Date(item.scannedAt).toLocaleString()}</p>
                        {item.actionTaken && <p>Action: {item.actionTaken}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Scan className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No scan history available</p>
                  <p className="text-sm">Start scanning QR codes to see history here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}