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
  Plus,
  X,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";

// Types for manual cut roll entry
interface ManualCutRoll {
  id: string;
  paper_id: string;
  paper_name: string;
  reel_number: string;
  width_inches: string;
  weight_kg: string;
}

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

  // Single client selection for all rolls
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedClientName, setSelectedClientName] = useState<string>("");

  const [cutRolls, setCutRolls] = useState<ManualCutRoll[]>([
    {
      id: "1",
      paper_id: "",
      paper_name: "",
      reel_number: "",
      width_inches: "",
      weight_kg: "",
    },
  ]);

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

    if (cutRolls.length === 0) {
      setAlert({
        type: "error",
        message: "Please add at least one cut roll.",
      });
      return;
    }

    for (let i = 0; i < cutRolls.length; i++) {
      const roll = cutRolls[i];

      if (!roll.paper_id) {
        setAlert({
          type: "error",
          message: `Please select a paper type for cut roll ${i + 1}.`,
        });
        return;
      }

      if (!roll.reel_number || roll.reel_number.trim() === "") {
        setAlert({
          type: "error",
          message: `Please enter a reel number for cut roll ${i + 1}.`,
        });
        return;
      }

      if (!roll.width_inches || parseFloat(roll.width_inches) <= 0) {
        setAlert({
          type: "error",
          message: `Please enter a valid width for cut roll ${i + 1}.`,
        });
        return;
      }

      if (!roll.weight_kg || parseFloat(roll.weight_kg) <= 0) {
        setAlert({
          type: "error",
          message: `Please enter a valid weight for cut roll ${i + 1}.`,
        });
        return;
      }
    }

    try {
      setLoading(true);

      // Prepare data with client information
      const rollData = cutRolls.map(roll => ({
        client_id: selectedClientId,
        client_name: selectedClientName,
        paper_id: roll.paper_id,
        paper_name: roll.paper_name,
        reel_number: roll.reel_number,
        width_inches: roll.width_inches,
        weight_kg: roll.weight_kg,
      }));

      // Mockup - just show success message
      // In real implementation, this would send rollData to backend
      console.log("Submitting cut rolls:", rollData);

      setAlert({
        type: "success",
        message: `Successfully registered ${cutRolls.length} cut roll(s) for ${selectedClientName}!`,
      });

      toast.success(`Successfully registered ${cutRolls.length} cut roll(s)!`);

      // Reset form after successful submission
      setTimeout(() => {
        setCutRolls([{
          id: "1",
          paper_id: "",
          paper_name: "",
          reel_number: "",
          width_inches: "",
          weight_kg: "",
        }]);
        setSelectedClientId("");
        setSelectedClientName("");
        setAlert({ type: null, message: "" });
      }, 2000);

    } catch (error) {
      console.error("Error saving cut rolls:", error);
      setAlert({
        type: "error",
        message: "Failed to save cut rolls. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const addCutRoll = () => {
    const newRoll: ManualCutRoll = {
      id: Date.now().toString(), // Use timestamp as temporary ID
      paper_id: cutRolls[0]?.paper_id || "",
      paper_name: cutRolls[0]?.paper_name || "",
      reel_number: "",
      width_inches: "",
      weight_kg: "",
    };

    setCutRolls([...cutRolls, newRoll]);
  };

  const removeCutRoll = (id: string) => {
    if (cutRolls.length > 1) {
      setCutRolls(cutRolls.filter(roll => roll.id !== id));
    }
  };

  const updateCutRoll = (id: string, field: keyof ManualCutRoll, value: string) => {
    setCutRolls(cutRolls.map(roll => {
      if (roll.id === id) {
        const updatedRoll = { ...roll, [field]: value };

        // Auto-populate paper name when paper_id changes
        if (field === "paper_id") {
          const selectedPaper = papers.find(p => p.id === value);
          updatedRoll.paper_name = selectedPaper ?
            `${selectedPaper.gsm}gsm, ${selectedPaper.bf}bf, ${selectedPaper.shade}` : "";
        }

        return updatedRoll;
      }
      return roll;
    }));
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const selectedClient = clients.find(c => c.id === clientId);
    setSelectedClientName(selectedClient?.company_name || "");
  };

  const handleNumberInput = (
    id: string,
    field: keyof ManualCutRoll,
    value: string
  ) => {
    // Allow empty string, numbers, and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      updateCutRoll(id, field, value);
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

            {/* Cut Rolls Section */}
            <div className="space-y-4">
              <Label className="text-lg font-semibold mb-4">Cut Rolls *</Label>

              <div className="space-y-4">
                {cutRolls.map((roll, index) => (
                  <div key={roll.id} className="border rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:justify-around sm:items-end sm:gap-3 gap-4">
                      {/* Item Number */}
                      <div className="flex-shrink-0 w-12">
                        <Label className="text-base font-medium">Item</Label>
                        <div className="flex items-center justify-center mt-2">
                          <span className="text-md font-medium bg-gray-100 px-2 py-1 rounded">
                            #{index + 1}
                          </span>
                        </div>
                      </div>

                      {/* Paper Selection */}
                      <div className="flex-1 min-w-0 sm:max-w-64 lg:max-w-86">
                        <Label className="text-base font-medium">Paper Type *</Label>
                        <Select
                          value={roll.paper_id}
                          onValueChange={(value) =>
                            updateCutRoll(roll.id, "paper_id", value)
                          }
                          disabled={loading}
                          
                        >
                          <SelectTrigger className="mt-2 w-full font-medium">
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
                      </div>

                      {/* Reel Number */}
                      <div className="flex-shrink-0 max-w-86">
                        <Label className="text-base font-medium">Reel Number *</Label>
                        <Input
                          type="text"
                          value={roll.reel_number}
                          onChange={(e) =>
                            updateCutRoll(roll.id, "reel_number", e.target.value)
                          }
                          placeholder="Reel ID"
                          disabled={loading}
                          className="mt-2 w-fullv font-medium"
                        />
                      </div>

                      {/* Width */}
                      <div className="flex-shrink-0 sm:w-32 lg:w-40 xl:w-48">
                        <Label className="text-base font-medium">Width (inches) *</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*\.?[0-9]*"
                          value={roll.width_inches}
                          onChange={(e) =>
                            handleNumberInput(roll.id, "width_inches", e.target.value)
                          }
                          placeholder="Width"
                          disabled={loading}
                          className="mt-2 font-medium"
                        />
                      </div>

                      {/* Weight */}
                      <div className="flex-shrink-0 sm:w-32 lg:w-40 xl:w-48">
                        <Label className="text-base font-medium">Weight (kg) *</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*\.?[0-9]*"
                          value={roll.weight_kg}
                          onChange={(e) =>
                            handleNumberInput(roll.id, "weight_kg", e.target.value)
                          }
                          placeholder="Weight"
                          disabled={loading}
                          className="mt-2 font-medium"
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="flex-shrink-0">
                        <Label className="text-sm font-medium opacity-0">Remove</Label>
                        <div className="mt-2">
                          {cutRolls.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCutRoll(roll.id)}
                              disabled={loading}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            >
                              <X className="h-5 w-5" />
                            </Button>
                          ) : (
                            <div className="h-8 w-8"></div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Display selected paper info */}
                    <div className="mt-3 pt-3 border-t text-sm text-gray-600">
                      {roll.paper_name && (
                        <div>
                          <span className="font-medium">Paper:</span> {roll.paper_name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={addCutRoll}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Cut Roll
              </Button>

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
                Save Cut Rolls
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}