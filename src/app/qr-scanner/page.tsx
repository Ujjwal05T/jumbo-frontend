/**
 * QR Scanner page - For scanning cut roll QR codes and updating weights
 */
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PRODUCTION_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, QrCode, Scale, CheckCircle, AlertCircle } from "lucide-react";
import QRCodeDisplay from "@/components/QRCodeDisplay";

interface QRCodeData {
  qr_code: string;
  cut_roll_id: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  client_name?: string;
  order_details?: string;
  production_date?: string;
}

interface CutRollDetails {
  id: string;
  qr_code: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  status: string;
  actual_weight_kg?: number;
  selected_at: string;
}

interface QRScanResult {
  cut_roll: CutRollDetails;
  qr_data: QRCodeData;
  can_update_weight: boolean;
  current_status: string;
}

export default function QRScannerPage() {
  const [qrCode, setQrCode] = useState("");
  const [weight, setWeight] = useState("");
  const [scanning, setScanning] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [scanResult, setScanResult] = useState<QRScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const scanQRCode = async () => {
    if (!qrCode.trim()) {
      setError("Please enter a QR code to scan.");
      return;
    }

    try {
      setScanning(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`${PRODUCTION_ENDPOINTS.QR_SCAN}/${qrCode}`, createRequestOptions('GET'));

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('QR code not found. Please check the code and try again.');
        }
        throw new Error('Failed to scan QR code');
      }

      const data = await response.json();
      setScanResult(data);
      setWeight(data.cut_roll.actual_weight_kg?.toString() || "");
      toast.success("QR code scanned successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to scan QR code';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const updateWeight = async () => {
    if (!scanResult || !weight.trim()) {
      setError("Please enter a weight value.");
      return;
    }

    const weightValue = parseFloat(weight);
    if (isNaN(weightValue) || weightValue <= 0) {
      setError("Please enter a valid weight value greater than 0.");
      return;
    }

    try {
      setUpdating(true);
      setError(null);
      setSuccess(null);

      const user_id = localStorage.getItem("user_id");
      if (!user_id) {
        throw new Error("User not authenticated");
      }

      const response = await fetch(PRODUCTION_ENDPOINTS.UPDATE_WEIGHT, createRequestOptions('POST', {
        qr_code: qrCode,
        actual_weight_kg: weightValue,
        updated_by_id: user_id
      }));

      if (!response.ok) {
        throw new Error('Failed to update weight');
      }

      const updatedCutRoll = await response.json();
      
      // Update the scan result with new data
      setScanResult(prev => prev ? {
        ...prev,
        cut_roll: {
          ...prev.cut_roll,
          actual_weight_kg: updatedCutRoll.actual_weight_kg,
          status: updatedCutRoll.status
        },
        current_status: updatedCutRoll.status,
        can_update_weight: updatedCutRoll.status === 'in_production'
      } : null);

      const successMessage = `Weight updated successfully! Status: ${updatedCutRoll.status}`;
      setSuccess(successMessage);
      toast.success(successMessage);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update weight';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const resetForm = () => {
    setQrCode("");
    setWeight("");
    setScanResult(null);
    setError(null);
    setSuccess(null);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'selected': return 'outline';
      case 'in_production': return 'secondary';
      case 'completed': return 'default';
      case 'quality_check': return 'destructive';
      case 'delivered': return 'default';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6 m-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">QR Code Scanner</h1>
        <Button variant="outline" onClick={resetForm}>
          Reset
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* QR Code Scanner */}
      <Card>
        <CardHeader>
          <CardTitle>Scan QR Code</CardTitle>
          <CardDescription>Enter or scan the QR code on the cut roll</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="qr-code">QR Code</Label>
              <Input
                id="qr-code"
                placeholder="Enter QR code (e.g., CR_29_90_A1B2C3D4)"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && scanQRCode()}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={scanQRCode}
                disabled={scanning || !qrCode.trim()}
              >
                {scanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" />
                    Scan
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scan Results */}
      {scanResult && (
        <Card>
          <CardHeader>
            <CardTitle>Cut Roll Details</CardTitle>
            <CardDescription>Information from QR code scan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* QR Code Display */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">QR Code</h3>
                <QRCodeDisplay
                  value={scanResult.qr_data.qr_code}
                  title=""
                  size={120}
                  showActions={true}
                  className="border-0 shadow-none"
                />
              </div>

              {/* Cut Roll Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Cut Roll Information</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">QR Code:</span>
                    <code className="text-sm">{scanResult.qr_data.qr_code}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Width:</span>
                    <span className="text-sm">{scanResult.qr_data.width_inches}&quot;</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Paper:</span>
                    <span className="text-sm">
                      {scanResult.qr_data.gsm}gsm, {scanResult.qr_data.bf}bf, {scanResult.qr_data.shade}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={getStatusBadgeVariant(scanResult.current_status)}>
                      {scanResult.current_status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {scanResult.qr_data.client_name && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Client:</span>
                      <span className="text-sm">{scanResult.qr_data.client_name}</span>
                    </div>
                  )}
                  {scanResult.qr_data.order_details && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Order:</span>
                      <span className="text-sm">{scanResult.qr_data.order_details}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Selected At:</span>
                    <span className="text-sm">
                      {new Date(scanResult.cut_roll.selected_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weight Input */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Weight Tracking</h3>
                {scanResult.can_update_weight ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="weight">Actual Weight (kg)</Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.01"
                        placeholder="Enter weight in kg"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && updateWeight()}
                      />
                    </div>
                    <Button 
                      onClick={updateWeight}
                      disabled={updating || !weight.trim()}
                      className="w-full"
                    >
                      {updating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating Weight...
                        </>
                      ) : (
                        <>
                          <Scale className="mr-2 h-4 w-4" />
                          Update Weight
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Weight cannot be updated for this cut roll.
                    </p>
                    <p className="text-sm">
                      Current Status: <Badge variant={getStatusBadgeVariant(scanResult.current_status)}>
                        {scanResult.current_status.replace('_', ' ')}
                      </Badge>
                    </p>
                    {scanResult.cut_roll.actual_weight_kg && (
                      <p className="text-sm">
                        Current Weight: <strong>{scanResult.cut_roll.actual_weight_kg} kg</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Enter or scan the QR code from the cut roll label</li>
            <li>Review the cut roll details and current status</li>
            <li>If weight can be updated, enter the actual weight in kilograms</li>
            <li>Click &ldquo;Update Weight&rdquo; to record the weight and update production status</li>
            <li>The system will automatically update the production status based on the current state</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}