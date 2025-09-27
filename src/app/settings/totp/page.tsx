/**
 * TOTP Settings Page - Admin users can setup/manage TOTP
 */
"use client";

import DashboardLayout from "@/components/DashboardLayout";
import TOTPSetup from "@/components/TOTPSetup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Info, Users, Lock } from "lucide-react";

export default function TOTPSettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            TOTP Settings
          </h1>
          <p className="text-muted-foreground">
            Manage two-factor authentication for your admin account
          </p>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              How TOTP Works
            </CardTitle>
            <CardDescription>
              Understanding the two-factor authentication flow in JumboRoll System
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Admin Setup</h4>
                    <p className="text-sm text-muted-foreground">
                      Only administrators can enable TOTP on their accounts using authenticator apps
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">User Actions</h4>
                    <p className="text-sm text-muted-foreground">
                      When users perform sensitive operations, they need to ask an admin for OTP codes
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Lock className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Secure Operations</h4>
                    <p className="text-sm text-muted-foreground">
                      Edit, delete, and other sensitive actions require admin TOTP verification
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Info className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Backup Codes</h4>
                    <p className="text-sm text-muted-foreground">
                      Backup codes are provided for emergency access when authenticator is unavailable
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TOTP Setup Component */}
        <TOTPSetup />
      </div>
    </DashboardLayout>
  );
}