'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Package, CheckCircle2, AlertCircle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface CurrentJumboData {
  id: string;
  jumbo_barcode_id: string;
  created_at: string;
  updated_at: string | null;
  jumbo_details?: {
    id: string;
    width_inches: number;
    weight_kg: number;
    status: string;
    location: string;
  } | null;
}

export default function CurrentJumboRoll() {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [currentJumbo, setCurrentJumbo] = useState<CurrentJumboData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch current jumbo roll on component mount
  useEffect(() => {
    fetchCurrentJumbo();
  }, []);

  const fetchCurrentJumbo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/current-jumbo`);
      const data = await response.json();

      if (data.current_jumbo) {
        setCurrentJumbo(data.current_jumbo);
      } else {
        setCurrentJumbo(null);
      }
    } catch (err: any) {
      console.error('Error fetching current jumbo roll:', err);
    }
  };

  const handleSetJumbo = async () => {
    if (!barcodeInput.trim()) {
      setError('Please enter a jumbo roll barcode');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/current-jumbo?jumbo_barcode_id=${encodeURIComponent(barcodeInput.trim())}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to set current jumbo roll');
      }

      const data = await response.json();
      setSuccess(data.message);
      setBarcodeInput('');

      // Refresh current jumbo data
      await fetchCurrentJumbo();
    } catch (err: any) {
      setError(err.message || 'Failed to set current jumbo roll');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSetJumbo();
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Jumbo Roll Display */}
      {currentJumbo && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-xl">Current Jumbo Roll</CardTitle>
                <CardDescription className="font-mono text-lg font-semibold mt-1">
                  {currentJumbo.jumbo_barcode_id}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {currentJumbo.jumbo_details && (
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Width</p>
                  <p className="font-semibold">{currentJumbo.jumbo_details.width_inches}"</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Weight</p>
                  <p className="font-semibold">{currentJumbo.jumbo_details.weight_kg} kg</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline">{currentJumbo.jumbo_details.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-semibold">{currentJumbo.jumbo_details.location || 'N/A'}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                <p>Set on: {new Date(currentJumbo.created_at).toLocaleString()}</p>
                {currentJumbo.updated_at && (
                  <p>Last updated: {new Date(currentJumbo.updated_at).toLocaleString()}</p>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Set New Jumbo Roll */}
      <Card>
        <CardHeader>
          <CardTitle>Set Current Jumbo Roll</CardTitle>
          <CardDescription>Enter the barcode ID of the jumbo roll to set as current</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jumbo-barcode">Jumbo Roll Barcode</Label>
            <div className="flex gap-3">
              <Input
                id="jumbo-barcode"
                placeholder="Enter barcode (e.g., JR_00001)..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="flex-1"
              />
              <Button onClick={handleSetJumbo} disabled={isLoading || !barcodeInput.trim()}>
                {isLoading ? 'Setting...' : 'Set Current'}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
