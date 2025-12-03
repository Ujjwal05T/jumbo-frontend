"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";

// Types for manual cut roll entry
interface Client {
  id: string;
  company_name: string;
  gst_number: string;
  contact_person: string;
}

interface Paper {
  id: string;
  name: string;
  gsm: number;
  bf: number;
  shade: string;
  type: string;
}

export default function ManualCutRollEntryPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  // Form fields for single roll entry
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [selectedPaperId, setSelectedPaperId] = useState<string>("");
  const [selectedPaperName, setSelectedPaperName] = useState<string>("");
  const [reelNumber, setReelNumber] = useState<string>("");
  const [widthInches, setWidthInches] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Fetch clients and papers
        const [clientsResponse, papersResponse] = await Promise.all([
          fetch(MASTER_ENDPOINTS.CLIENTS, createRequestOptions('GET')),
          fetch(MASTER_ENDPOINTS.PAPERS, createRequestOptions('GET')),
        ]);

        if (clientsResponse.ok && papersResponse.ok) {
          const clientsData = await clientsResponse.json();
          const papersData = await papersResponse.json();

          // Sort clients by company name
          const sortedClients = clientsData.sort((a: Client, b: Client) =>
            a.company_name.localeCompare(b.company_name)
          );

          // Sort papers by GSM
          const sortedPapers = papersData.sort((a: Paper, b: Paper) => a.gsm - b.gsm);

          setClients(sortedClients);
          setPapers(sortedPapers);
        } else {
          throw new Error("Failed to load data");
        }
      } catch (error) {
        console.error("Error loading data:", error);
        setAlert({
          type: "error",
          message: "Failed to load clients and papers. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!selectedClientId) {
      setAlert({
        type: "error",
        message: "Please select a client.",
      });
      return;
    }

    if (!selectedPaperId) {
      setAlert({
        type: "error",
        message: "Please select a paper type.",
      });
      return;
    }

    if (!reelNumber || reelNumber.trim() === "") {
      setAlert({
        type: "error",
        message: "Please enter a reel number.",
      });
      return;
    }

    if (!widthInches || parseFloat(widthInches) <= 0) {
      setAlert({
        type: "error",
        message: "Please enter a valid width.",
      });
      return;
    }

    if (!weightKg || parseFloat(weightKg) <= 0) {
      setAlert({
        type: "error",
        message: "Please enter a valid weight.",
      });
      return;
    }

    try {
      setLoading(true);

      // Get user ID from localStorage
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        setAlert({
          type: "error",
          message: "User not authenticated. Please log in again.",
        });
        return;
      }

      // Prepare data for backend
      const rollData = {
        client_id: selectedClientId,
        paper_id: selectedPaperId,
        reel_number: reelNumber,
        width_inches: parseFloat(widthInches),
        weight_kg: parseFloat(weightKg),
        created_by_id: userId,
      };

      // Send to backend
      const response = await fetch(
        MASTER_ENDPOINTS.MANUAL_CUT_ROLLS,
        createRequestOptions('POST', rollData)
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create manual cut roll');
      }

      const result = await response.json();

      setAlert({
        type: "success",
        message: `Successfully registered cut roll ${result.frontend_id} for ${selectedClientName}!`,
      });

      toast.success(`Cut roll ${result.barcode_id} created successfully!`);

      // Reset form after successful submission
      setTimeout(() => {
        setSelectedClientId("");
        setSelectedClientName("");
        setSelectedPaperId("");
        setSelectedPaperName("");
        setReelNumber("");
        setWidthInches("");
        setWeightKg("");
        setAlert({ type: null, message: "" });
      }, 2000);

    } catch (error) {
      console.error("Error saving cut roll:", error);
      setAlert({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save cut roll. Please try again.",
      });
      toast.error("Failed to create cut roll");
    } finally {
      setLoading(false);
    }
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const selectedClient = clients.find(c => c.id === clientId);
    setSelectedClientName(selectedClient?.company_name || "");
  };

  const handlePaperChange = (paperId: string) => {
    setSelectedPaperId(paperId);
    const selectedPaper = papers.find(p => p.id === paperId);
    setSelectedPaperName(selectedPaper ?
      `${selectedPaper.gsm}gsm, ${selectedPaper.bf}bf, ${selectedPaper.shade}` : "");
  };

  const handleNumberInput = (
    setter: (value: string) => void,
    value: string
  ) => {
    // Allow empty string, numbers, and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setter(value);
    }
  };

  return (
    <div className="space-y-6 m-8">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-4xl font-bold">Manual Roll Entry</h1>
      </div>

      {/* Alert Message */}
      {alert.type && (
        <Alert variant={alert.type === "error" ? "destructive" : "default"}>
          {alert.type === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertTitle>
            {alert.type === "error" ? "Error" : "Success"}
          </AlertTitle>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Roll Details
          </CardTitle>
          <CardDescription>
            Enter roll information for manual registration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Selection - Single for all rolls */}
            <div className="mb-6 ">
              <Label htmlFor="client_id" className="mb-2 text-base font-medium">Client *</Label>
              <Select
                value={selectedClientId}
                onValueChange={handleClientChange}
                disabled={loading}
              >
                <SelectTrigger className="text-lg font-semibold">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent className="text-3xl font-semibold">
                  {clients
                    .sort((a, b) => a.company_name.localeCompare(b.company_name))
                    .map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              
            </div>

            {/* Cut Roll Entry Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Paper Selection */}
                <div>
                  <Label htmlFor="paper_id" className="text-base font-medium">Paper Type *</Label>
                  <Select
                    value={selectedPaperId}
                    onValueChange={handlePaperChange}
                    disabled={loading}
                  >
                    <SelectTrigger className="mt-2 font-medium">
                      <SelectValue placeholder="Select paper" />
                    </SelectTrigger>
                    <SelectContent>
                      {papers
                        .sort((a, b) => a.gsm - b.gsm)
                        .map((paper) => (
                          <SelectItem key={paper.id} value={paper.id} className="font-medium">
                            {paper.gsm}gsm, {paper.bf}bf, {paper.shade}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedPaperName && (
                    <p className="mt-1 text-sm text-gray-600">
                      Selected: {selectedPaperName}
                    </p>
                  )}
                </div>

                {/* Reel Number */}
                <div>
                  <Label htmlFor="reel_number" className="text-base font-medium">Reel Number *</Label>
                  <Input
                    id="reel_number"
                    type="text"
                    value={reelNumber}
                    onChange={(e) => setReelNumber(e.target.value)}
                    placeholder="Enter reel number"
                    disabled={loading}
                    className="mt-2 font-medium"
                  />
                </div>

                {/* Width */}
                <div>
                  <Label htmlFor="width_inches" className="text-base font-medium">Width (inches) *</Label>
                  <Input
                    id="width_inches"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={widthInches}
                    onChange={(e) => handleNumberInput(setWidthInches, e.target.value)}
                    placeholder="Enter width"
                    disabled={loading}
                    className="mt-2 font-medium"
                  />
                </div>

                {/* Weight */}
                <div>
                  <Label htmlFor="weight_kg" className="text-base font-medium">Weight (kg) *</Label>
                  <Input
                    id="weight_kg"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={weightKg}
                    onChange={(e) => handleNumberInput(setWeightKg, e.target.value)}
                    placeholder="Enter weight"
                    disabled={loading}
                    className="mt-2 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/masters/cut-rolls")}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>

              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Cut Roll
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}