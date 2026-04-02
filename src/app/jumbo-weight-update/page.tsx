"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Weight,
  Scan,
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  LogOut,
  User,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL, createRequestOptions } from "@/lib/api-config";

interface JumboRoll {
  id: string;
  barcode_id: string;
  width_inches: number;
  weight_kg: number;
  status: string;
  location: string | null;
  paper_specs: { gsm: number; bf: number; shade: string } | null;
  updated_at: string | null;
}

export default function JumboWeightUpdatePage() {
  const router = useRouter();
  const [barcodeInput, setBarcodeInput] = useState("JR_");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString().slice(-2));
  const [roll, setRoll] = useState<JumboRoll | null>(null);
  const [weight, setWeight] = useState("");
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUserName(localStorage.getItem("user_name") || localStorage.getItem("username") || "User");
  }, []);

  useEffect(() => {
    if (!roll && barcodeInputRef.current) barcodeInputRef.current.focus();
    if (roll && weightInputRef.current) weightInputRef.current.focus();
  }, [roll]);

  const handleLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_role");
    toast.success("Logged out successfully");
    router.push("/auth/login");
  };

  const getYearOptions = () => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => current - 2 + i).map(y => ({
      value: y.toString().slice(-2),
      label: y.toString(),
    }));
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = barcodeInput.trim();
    if (!barcode || barcode === "JR_") {
      toast.error("Please enter a barcode number");
      return;
    }
    const barcodeWithYear = barcode.includes("-") ? barcode : `${barcode}-${selectedYear}`;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/jumbo-rolls/${barcodeWithYear}`, createRequestOptions("GET"));
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Jumbo roll not found");
      }
      const data: JumboRoll = await res.json();
      setRoll(data);
      setWeight("");
      toast.success("Jumbo roll found!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch roll";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleWeightUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weight);
    if (!w || w <= 0 || w > 9999) {
      toast.error("Enter a valid weight between 0 and 9999 kg");
      return;
    }
    if (!roll) return;
    setUpdating(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/jumbo-rolls/${roll.barcode_id}/weight`,
        createRequestOptions("PUT", { weight_kg: w })
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update weight");
      }
      const result = await res.json();
      setRoll(prev => prev ? { ...prev, weight_kg: w } : prev);
      setWeight("");
      toast.success(`Weight updated to ${w} kg`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update weight");
    } finally {
      setUpdating(false);
    }
  };

  const handleReset = () => {
    setRoll(null);
    setBarcodeInput("JR_");
    setError(null);
    setWeight("");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Jumbo Roll Weight Update</h1>
            <p className="text-sm sm:text-base text-gray-600">Scan JR barcode to update jumbo roll weight</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-2 text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200">
              <User className="h-4 w-4" />
              <span className="text-xs sm:text-sm font-medium truncate max-w-[100px]">{userName}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-red-600 border-red-200 hover:bg-red-50 px-2 sm:px-3"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline ml-1">Logout</span>
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!roll ? (
          /* Scan Form */
          <Card>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <Scan className="h-7 w-7 text-blue-600" />
              </div>
              <CardTitle className="text-xl sm:text-2xl">Scan Jumbo Barcode</CardTitle>
              <CardDescription>Enter the JR barcode to look up the jumbo roll</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScan} className="space-y-4">
                <div>
                  <Label htmlFor="barcode" className="text-base font-medium mb-2 block">Barcode</Label>
                  <div className="flex gap-2">
                    <div className="flex items-center flex-1">
                      <div className="text-lg p-3 h-12 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md flex items-center font-mono">
                        JR_
                      </div>
                      <Input
                        ref={barcodeInputRef}
                        id="barcode"
                        type="text"
                        value={barcodeInput.replace("JR_", "")}
                        onChange={(e) => setBarcodeInput("JR_" + e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                        placeholder="Enter barcode"
                        className="text-lg p-3 h-12 rounded-l-none"
                        autoComplete="off"
                      />
                    </div>
                    <div className="relative">
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="appearance-none text-lg p-3 h-12 pr-10 border border-gray-300 rounded-md bg-white font-semibold text-blue-600 cursor-pointer hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[90px] sm:min-w-[110px]"
                      >
                        {getYearOptions().map(y => (
                          <option key={y.value} value={y.value}>{y.label}</option>
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
                  disabled={loading || !barcodeInput.trim() || barcodeInput.trim() === "JR_"}
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Scanning...</>
                  ) : (
                    <><Search className="mr-2 h-5 w-5" />Scan Barcode</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* Roll Details + Weight Update */
          <div className="space-y-4">
            <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Scanner
            </Button>

            {/* Roll Details */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">Jumbo Roll Details</CardTitle>
                    <CardDescription className="font-mono font-semibold text-sm mt-1">
                      {roll.barcode_id}
                    </CardDescription>
                  </div>
                  <Badge
                    className="capitalize"
                    variant={roll.status === "available" ? "default" : "secondary"}
                  >
                    {roll.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Width</p>
                    <p className="text-2xl font-bold mt-1">{roll.width_inches}"</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Current Weight</p>
                    <p className="text-2xl font-bold mt-1 text-blue-600">{roll.weight_kg} kg</p>
                  </div>
                </div>
                {roll.paper_specs && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Paper Spec</p>
                    <p className="text-base font-semibold text-green-600">
                      {roll.paper_specs.gsm}gsm / {roll.paper_specs.bf}bf / {roll.paper_specs.shade}
                    </p>
                  </div>
                )}
                {roll.location && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Location</p>
                    <p className="text-base font-semibold">{roll.location}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weight Update Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Weight className="h-5 w-5" />
                  Update Weight
                </CardTitle>
                <CardDescription>Enter the new weight for this jumbo roll</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleWeightUpdate} className="space-y-4">
                  <div>
                    <Label htmlFor="weight" className="text-base font-medium mb-2 block">
                      New Weight (kg) *
                    </Label>
                    <Input
                      ref={weightInputRef}
                      id="weight"
                      type="text"
                      inputMode="decimal"
                      value={weight}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                        setWeight(v);
                      }}
                      placeholder="Enter weight in kg"
                      className="text-xl p-4 h-14"
                      autoComplete="off"
                    />
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700">Weight will be updated directly on the jumbo roll record.</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      type="submit"
                      disabled={updating || !weight.trim()}
                      className="flex-1 h-12 text-base"
                      size="lg"
                    >
                      {updating ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Updating...</>
                      ) : (
                        <><Weight className="mr-2 h-5 w-5" />Update Weight</>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReset}
                      disabled={updating}
                      className="h-12 px-6"
                      size="lg"
                    >
                      New Scan
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
