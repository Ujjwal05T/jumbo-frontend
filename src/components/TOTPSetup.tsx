/**
 * TOTP Setup Component - For admin users to setup 2FA
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  QrCode,
  Key,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Copy,
  Download
} from "lucide-react";
import {
  generateAdminTOTP,
  disableAdminTOTP,
  getAdminTOTPStatus,
  type TOTPSetupResponse,
  type TOTPStatus
} from "@/lib/totp";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface TOTPSetupProps {
  onStatusChange?: () => void;
}

export default function TOTPSetup({ onStatusChange }: TOTPSetupProps) {
  const [totpStatus, setTotpStatus] = useState<TOTPStatus | null>(null);
  const [setupData, setSetupData] = useState<TOTPSetupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);

  useEffect(() => {
    loadTOTPStatus();
  }, []);

  const loadTOTPStatus = async () => {
    try {
      const status = await getAdminTOTPStatus();
      setTotpStatus(status);
    } catch (err) {
      console.error('Failed to load TOTP status:', err);
    }
  };

  const handleGenerateTOTP = async () => {
    setLoading(true);
    try {
      const data = await generateAdminTOTP();
      setSetupData(data);
      setTotpStatus({ totp_enabled: true, has_backup_codes: true });
      toast.success("TOTP setup completed successfully!");
      if (onStatusChange) onStatusChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to setup TOTP");
    } finally {
      setLoading(false);
    }
  };

  const handleDisableTOTP = async () => {
    setLoading(true);
    try {
      await disableAdminTOTP();
      setTotpStatus({ totp_enabled: false, has_backup_codes: false });
      setSetupData(null);
      setShowDisableDialog(false);
      toast.success("TOTP disabled successfully!");
      if (onStatusChange) onStatusChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disable TOTP");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const downloadBackupCodes = () => {
    if (!setupData) return;

    const content = [
      "JumboRoll System - TOTP Backup Codes",
      "================================",
      "",
      "These backup codes can be used instead of your authenticator app.",
      "Each code can only be used once.",
      "Keep these codes secure and accessible.",
      "",
      "Backup Codes:",
      ...setupData.backup_codes.map((code, index) => `${index + 1}. ${code}`)
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jumboroll-totp-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!totpStatus) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2">Loading TOTP status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication (TOTP)
          </CardTitle>
          <CardDescription>
            Secure your admin account with time-based one-time passwords
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className={`w-5 h-5 ${totpStatus.totp_enabled ? 'text-green-600' : 'text-gray-400'}`} />
              <div>
                <p className="font-medium">TOTP Status</p>
                <p className="text-sm text-muted-foreground">
                  Two-factor authentication for admin operations
                </p>
              </div>
            </div>
            <Badge variant={totpStatus.totp_enabled ? "default" : "secondary"}>
              {totpStatus.totp_enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>

          {!totpStatus.totp_enabled ? (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-yellow-800">Setup Required</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Enable TOTP to secure sensitive operations. You'll need an authenticator app like
                      Google Authenticator, Authy, or similar.
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={handleGenerateTOTP} disabled={loading} className="w-full gap-2">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
                {loading ? "Setting up TOTP..." : "Setup TOTP"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-green-800">TOTP Active</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Your account is secured with two-factor authentication. Users will need your approval
                      for sensitive operations.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                variant="destructive"
                onClick={() => setShowDisableDialog(true)}
                disabled={loading}
                className="w-full gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                Disable TOTP
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Results */}
      {setupData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              TOTP Setup Complete
            </CardTitle>
            <CardDescription>
              Scan the QR code with your authenticator app and save your backup codes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QR Code */}
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                Scan QR Code
              </h3>
              <div className="flex justify-center p-4 bg-white border rounded-lg">
                <img
                  src={`data:image/png;base64,${setupData.qr_code}`}
                  alt="TOTP QR Code"
                  className="max-w-[200px] max-h-[200px]"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Use your authenticator app to scan this QR code
              </p>
            </div>

            {/* Secret Key */}
            <div className="space-y-2">
              <h3 className="font-medium">Manual Entry Key</h3>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm">
                <span className="flex-1">{setupData.secret}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(setupData.secret, "Secret key")}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Backup Codes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Backup Codes</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadBackupCodes}
                  className="gap-1"
                >
                  <Download className="w-3 h-3" />
                  Download
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {setupData.backup_codes.map((code, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded text-sm font-mono">
                    <span className="flex-1">{code}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(code, `Backup code ${index + 1}`)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                ⚠️ Save these backup codes securely. Each can only be used once.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disable Confirmation Dialog */}
      <ConfirmDialog
        open={showDisableDialog}
        onOpenChange={setShowDisableDialog}
        title="Disable TOTP"
        description="Are you sure you want to disable two-factor authentication? This will remove the additional security layer from your admin account."
        confirmText="Disable"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDisableTOTP}
      />
    </div>
  );
}