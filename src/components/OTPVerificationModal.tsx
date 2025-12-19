/**
 * OTP Verification Modal - For verifying admin OTP during sensitive operations
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSearch,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle,
  Key
} from "lucide-react";
import {
  getAdminList,
  verifyAdminOTP,
  type AdminUser,
  type TOTPVerifyRequest
} from "@/lib/totp";

interface OTPVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onVerified: () => void;
  onCancel?: () => void;
}

export default function OTPVerificationModal({
  open,
  onOpenChange,
  title = "Admin Verification Required",
  description = "This action requires admin verification. Please ask an administrator to provide their OTP code.",
  onVerified,
  onCancel
}: OTPVerificationModalProps) {
  const [adminList, setAdminList] = useState<AdminUser[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");

  useEffect(() => {
    if (open) {
      loadAdminList();
      setOtpCode("");
      setSelectedAdminId("");
      setError(null);
      setVerified(false);
    }
  }, [open]);

  const loadAdminList = async () => {
    setLoadingAdmins(true);
    try {
      const admins = await getAdminList();
      setAdminList(admins);
      if (admins.length === 0) {
        setError("No administrators with TOTP enabled found. Please contact system administrator.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin list");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedAdminId || !otpCode.trim()) {
      setError("Please select an administrator and enter the OTP code");
      return;
    }

    if (otpCode.length !== 6) {
      setError("OTP code must be 6 digits");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: TOTPVerifyRequest = {
        user_id: selectedAdminId,
        otp_code: otpCode.trim()
      };

      const result = await verifyAdminOTP(request);

      if (result.valid) {
        setVerified(true);
        toast.success("Admin verification successful!");
        setTimeout(() => {
          onVerified();
          onOpenChange(false);
        }, 1500);
      } else {
        setError(result.message || "Invalid OTP code");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !verified) {
      onOpenChange(false);
      if (onCancel) onCancel();
    }
  };

  const handleOtpChange = (value: string) => {
    // Only allow numbers and limit to 6 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setOtpCode(numericValue);
    if (error && numericValue.length > 0) {
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        {verified ? (
          <div className="py-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-green-800">Verification Successful</h3>
                <p className="text-sm text-green-600 mt-1">
                  Admin verification completed. Processing your request...
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {loadingAdmins ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Loading administrators...</span>
              </div>
            ) : (
              <>
                {adminList.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="admin-select">Select Administrator</Label>
                      <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                        <SelectTrigger id="admin-select">
                          <SelectValue placeholder="Choose an administrator" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectSearch
                            placeholder="Search administrators..."
                            value={adminSearch}
                            onChange={(e) => setAdminSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                          {adminList
                            .filter((admin) => {
                              const searchLower = adminSearch.toLowerCase();
                              return (
                                admin.name.toLowerCase().includes(searchLower) ||
                                admin.username.toLowerCase().includes(searchLower)
                              );
                            })
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((admin) => (
                              <SelectItem key={admin.id} value={admin.id}>
                                <div className="flex items-center gap-2">
                                  <Shield className="w-4 h-4" />
                                  {admin.name} (@{admin.username})
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otp-code">OTP Code</Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="otp-code"
                          type="text"
                          value={otpCode}
                          onChange={(e) => handleOtpChange(e.target.value)}
                          placeholder="Enter 6-digit code"
                          className="pl-10 text-center text-lg tracking-widest font-mono"
                          maxLength={6}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Ask the selected administrator to provide their current OTP code
                      </p>
                    </div>
                  </>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
        )}

        {!verified && !loadingAdmins && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={loading || !selectedAdminId || otpCode.length !== 6}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}