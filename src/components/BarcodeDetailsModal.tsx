"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { createRequestOptions } from '@/lib/api-config';
import { Barcode, Loader2, AlertCircle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface BarcodeDetailsModalProps {
  barcodeId: string | null;
  isWastage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BarcodeDetailsModal({ barcodeId, isWastage, open, onOpenChange }: BarcodeDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && barcodeId) {
      fetchBarcodeDetails();
    }
  }, [open, barcodeId]);

  const fetchBarcodeDetails = async () => {
    if (!barcodeId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/reports/barcode-details/${barcodeId}`,
        createRequestOptions('GET')
      );

      if (!response.ok) {
        throw new Error('Failed to fetch barcode details');
      }

      const data = await response.json();
      setDetails(data.data);
    } catch (err) {
      console.error('Error fetching barcode details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load barcode details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            Barcode Details
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive py-4">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && details && (
          <div className="space-y-4">
            {/* Wastage Details (for SCR barcodes) */}
            {details.wastage_details && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">Stock Details</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Source</p>
                      <p className="font-semibold">{details.wastage_details.source}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Reel No.</p>
                      <p className="font-mono font-semibold">
                        {details.wastage_details.reel_no || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dispatch Information (for both CR and SCR) */}
            {details.dispatch_info ? (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">Dispatch Information</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Dispatch Number</p>
                      <p className="font-mono font-semibold">{details.dispatch_info.dispatch_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dispatch Date</p>
                      <p className="font-semibold">
                        {details.dispatch_info.dispatch_date
                          ? new Date(details.dispatch_info.dispatch_date).toLocaleDateString('en-GB')
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Client</p>
                      <p className="font-semibold">{details.dispatch_info.client_name || 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">Not yet dispatched</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!loading && !error && !details && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">No details available</p>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
