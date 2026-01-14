"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchPapers, Paper } from "@/lib/papers";
import { fetchClients, Client } from "@/lib/clients";
import { MASTER_ENDPOINTS } from "@/lib/api-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import {
  Plus,
  Trash2,
  Package,
  FileText,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Pencil,
} from "lucide-react";

// Types
interface PaperSpec {
  id: string;
  gsm: number;
  bf: number;
  shade: string;
  createdAt: Date;
}

interface JumboRoll {
  id: string;
  paperSpecId: string;
  jumboNumber: number; // 1, 2, 3, etc.
  createdAt: Date;
}

interface RollSet {
  id: string;
  jumboRollId: string;
  setNumber: number; // 1, 2, or 3 (118" rolls within a jumbo)
  createdAt: Date;
}

interface CutRoll {
  id: string;
  rollSetId: string;
  widthInches: number;
  quantity: number;
  clientId: string;
  // orderSource: string; // e.g., "ORD-00010-26"
  createdAt: Date;
}

export default function ManualPlanningPage() {
  const router = useRouter();
  const [wastageInput, setWastageInput] = useState(1);
  const [appliedWastage, setAppliedWastage] = useState(1);
  const [isEditingWastage, setIsEditingWastage] = useState(true);
  const [paperSpecs, setPaperSpecs] = useState<PaperSpec[]>([]);
  const [jumboRolls, setJumboRolls] = useState<JumboRoll[]>([]);
  const [rollSets, setRollSets] = useState<RollSet[]>([]);
  const [cutRolls, setCutRolls] = useState<CutRoll[]>([]);

  const [showAddPaperDialog, setShowAddPaperDialog] = useState(false);
  const [showAddCutRollDialog, setShowAddCutRollDialog] = useState(false);
  const [expandedPaperSpecs, setExpandedPaperSpecs] = useState<Set<string>>(new Set());

  const [editingCutRoll, setEditingCutRoll] = useState<CutRoll | null>(null);
  const [selectedRollSetForCut, setSelectedRollSetForCut] = useState<string>("");

  // Paper Master dropdown
  const [availablePapers, setAvailablePapers] = useState<Paper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(false);

  // Client Master dropdown
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");

  // Plan creation
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planCreated, setPlanCreated] = useState(false);
  const [createdPlanSummary, setCreatedPlanSummary] = useState<any>(null);
  const [showCreatePlanConfirmation, setShowCreatePlanConfirmation] = useState(false);

  // Calculate planning width from applied wastage
  const planningWidth = useMemo(() => {
    const calculated = 124 - appliedWastage;
    return Math.max(calculated, 50);
  }, [appliedWastage]);

  // Form states
  const [selectedPaperId, setSelectedPaperId] = useState<string>("");

  const [cutRollForm, setCutRollForm] = useState({
    widthInches: "",
    quantity: "1",
    clientId: "",
    // orderSource: "",
  });

  // Load available papers from Paper Master
  useEffect(() => {
    const loadPapers = async () => {
      try {
        setLoadingPapers(true);
        const papers = await fetchPapers();
        // Only show active papers
        setAvailablePapers(papers.filter(p => p.status === 'active'));
      } catch (error) {
        console.error('Failed to load papers:', error);
        toast.error('Failed to load paper specifications');
      } finally {
        setLoadingPapers(false);
      }
    };
    loadPapers();
  }, []);

  // Load available clients from Client Master
  useEffect(() => {
    const loadClients = async () => {
      try {
        setLoadingClients(true);
        const clients = await fetchClients(0, 'active');
        // Sort clients alphabetically by company name
        const sortedClients = clients.sort((a, b) =>
          a.company_name.localeCompare(b.company_name)
        );
        setAvailableClients(sortedClients);
      } catch (error) {
        console.error('Failed to load clients:', error);
        toast.error('Failed to load clients');
      } finally {
        setLoadingClients(false);
      }
    };
    loadClients();
  }, []);

  // Filter clients based on search term
  const filteredClients = useMemo(() => {
    if (!clientSearchTerm) return availableClients;
    const searchLower = clientSearchTerm.toLowerCase();
    return availableClients.filter(client =>
      client.company_name.toLowerCase().includes(searchLower) ||
      (client.contact_person && client.contact_person.toLowerCase().includes(searchLower))
    );
  }, [availableClients, clientSearchTerm]);

  // Apply wastage changes
  const handleApplyWastage = () => {
    const hasAnyCutRolls = cutRolls.length > 0;

    if (hasAnyCutRolls) {
      const newPlanningWidth = 124 - wastageInput;

      // Check if any cut rolls would exceed the new planning width
      const invalidCuts = cutRolls.filter(cut => {
        const rollSet = rollSets.find(s => s.id === cut.rollSetId);
        if (!rollSet) return false;

        const totalWidthUsed = cutRolls
          .filter(c => c.rollSetId === rollSet.id)
          .reduce((sum, c) => sum + (c.widthInches * c.quantity), 0);

        return totalWidthUsed > newPlanningWidth;
      });

      if (invalidCuts.length > 0) {
        toast.error(`Cannot apply: ${invalidCuts.length} roll set(s) would exceed the new planning width of ${newPlanningWidth}"`);
        return;
      }
    }

    setAppliedWastage(wastageInput);
    setIsEditingWastage(false);
    toast.success(`Wastage applied: Planning width is now ${124 - wastageInput}"`);
  };

  // Enable editing wastage
  const handleEditWastage = () => {
    setIsEditingWastage(true);
  };

  // Toggle expand/collapse
  const togglePaperExpand = (id: string) => {
    const newExpanded = new Set(expandedPaperSpecs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedPaperSpecs(newExpanded);
  };

  // Add Paper Spec
  const handleAddPaperSpec = () => {
    if (isEditingWastage) {
      toast.error("Please apply wastage configuration first");
      return;
    }

    if (!selectedPaperId) {
      toast.error("Please select a paper specification");
      return;
    }

    const selectedPaper = availablePapers.find(p => p.id === selectedPaperId);
    if (!selectedPaper) {
      toast.error("Selected paper not found");
      return;
    }

    // Check if this paper spec already exists
    const exists = paperSpecs.find(
      p => p.gsm === selectedPaper.gsm && p.bf === selectedPaper.bf && p.shade === selectedPaper.shade
    );
    if (exists) {
      toast.error("This paper specification is already added");
      return;
    }

    const newPaperSpec: PaperSpec = {
      id: `paper-${Date.now()}`,
      gsm: selectedPaper.gsm,
      bf: selectedPaper.bf,
      shade: selectedPaper.shade,
      createdAt: new Date(),
    };

    setPaperSpecs([...paperSpecs, newPaperSpec]);
    toast.success(`Added ${selectedPaper.shade} ${selectedPaper.gsm}gsm (BF: ${selectedPaper.bf})`);

    setSelectedPaperId("");
    setShowAddPaperDialog(false);
  };

  // Add Jumbo Roll to a Paper Spec
  const handleAddJumboRoll = (paperSpecId: string) => {
    const existingJumbos = jumboRolls.filter(j => j.paperSpecId === paperSpecId);
    const jumboNumber = existingJumbos.length + 1;

    const newJumboRoll: JumboRoll = {
      id: `jumbo-${Date.now()}`,
      paperSpecId: paperSpecId,
      jumboNumber: jumboNumber,
      createdAt: new Date(),
    };

    setJumboRolls([...jumboRolls, newJumboRoll]);

    // Create 3 roll sets (118" rolls) for this jumbo by default
    const newRollSets: RollSet[] = [1, 2, 3].map(setNum => ({
      id: `rollset-${Date.now()}-${setNum}`,
      jumboRollId: newJumboRoll.id,
      setNumber: setNum,
      createdAt: new Date(),
    }));

    setRollSets([...rollSets, ...newRollSets]);
    toast.success(`Jumbo Roll #${jumboNumber} added with 3 sets`);
  };

  // Delete Jumbo Roll
  const handleDeleteJumboRoll = (jumboId: string) => {
    setJumboRolls(jumboRolls.filter(j => j.id !== jumboId));
    const deletedSets = rollSets.filter(s => s.jumboRollId === jumboId).map(s => s.id);
    setRollSets(rollSets.filter(s => s.jumboRollId !== jumboId));
    setCutRolls(cutRolls.filter(c => !deletedSets.includes(c.rollSetId)));
    toast.success("Jumbo roll deleted");
  };

  // Delete Roll Set (118" roll)
  const handleDeleteRollSet = (setId: string) => {
    setRollSets(rollSets.filter(s => s.id !== setId));
    setCutRolls(cutRolls.filter(c => c.rollSetId !== setId));
    toast.success("Roll set deleted");
  };

  // Delete Paper Spec
  const handleDeletePaperSpec = (paperId: string) => {
    setPaperSpecs(paperSpecs.filter(p => p.id !== paperId));
    const deletedJumbos = jumboRolls.filter(j => j.paperSpecId === paperId).map(j => j.id);
    setJumboRolls(jumboRolls.filter(j => j.paperSpecId !== paperId));
    const deletedSets = rollSets.filter(s => deletedJumbos.includes(s.jumboRollId)).map(s => s.id);
    setRollSets(rollSets.filter(s => !deletedJumbos.includes(s.jumboRollId)));
    setCutRolls(cutRolls.filter(c => !deletedSets.includes(c.rollSetId)));
    toast.success("Paper specification deleted");
  };

  // Open add cut roll dialog
  const handleAddCutToRollSet = (rollSetId: string) => {
    setSelectedRollSetForCut(rollSetId);
    setEditingCutRoll(null);
    setCutRollForm({
      widthInches: "",
      quantity: "1",
      clientId: "",
      // orderSource: "",
    });
    setShowAddCutRollDialog(true);
  };

  // Open edit cut roll dialog
  const handleEditCutRoll = (cutRoll: CutRoll) => {
    setSelectedRollSetForCut(cutRoll.rollSetId);
    setEditingCutRoll(cutRoll);
    setCutRollForm({
      widthInches: cutRoll.widthInches.toString(),
      quantity: cutRoll.quantity.toString(),
      clientId: cutRoll.clientId,
      // orderSource: cutRoll.orderSource,
    });
    setShowAddCutRollDialog(true);
  };

  // Save Cut Roll
  const handleSaveCutRoll = () => {
    if (!cutRollForm.widthInches || !cutRollForm.quantity || !cutRollForm.clientId) {
      toast.error("Please fill in all required fields");
      return;
    }

    const width = parseFloat(cutRollForm.widthInches);
    const quantity = parseInt(cutRollForm.quantity);
    const totalWidthNeeded = width * quantity;

    if (width > planningWidth) {
      toast.error(`Cut roll width (${width}") cannot exceed planning width (${planningWidth}")`);
      return;
    }

    const totalWidthUsed = getTotalWidthForRollSet(selectedRollSetForCut);
    const existingWidthToExclude = editingCutRoll ? editingCutRoll.widthInches * editingCutRoll.quantity : 0;
    const availableWidth = planningWidth - (totalWidthUsed - existingWidthToExclude);

    if (totalWidthNeeded > availableWidth) {
      toast.error(`Cannot add ${width}" × ${quantity} (${totalWidthNeeded}") - only ${availableWidth.toFixed(1)}" available`);
      return;
    }

    if (editingCutRoll) {
      setCutRolls(cutRolls.map(roll =>
        roll.id === editingCutRoll.id
          ? {
              ...roll,
              widthInches: width,
              quantity: quantity,
              clientId: cutRollForm.clientId,
              // orderSource: cutRollForm.orderSource,
            }
          : roll
      ));
      toast.success(`Updated cut roll: ${width}" × ${quantity}`);
    } else {
      const newCutRoll: CutRoll = {
        id: `cut-${Date.now()}`,
        rollSetId: selectedRollSetForCut,
        widthInches: width,
        quantity: quantity,
        clientId: cutRollForm.clientId,
        // orderSource: cutRollForm.orderSource,
        createdAt: new Date(),
      };
      setCutRolls([...cutRolls, newCutRoll]);
      toast.success(`Added ${width}" × ${quantity} = ${totalWidthNeeded}"`);
    }

    setShowAddCutRollDialog(false);
    setEditingCutRoll(null);
    setSelectedRollSetForCut("");
  };

  // Delete Cut Roll
  const handleDeleteCutRoll = (id: string) => {
    setCutRolls(cutRolls.filter(c => c.id !== id));
    toast.success("Cut roll deleted");
  };

  // Create Plan
  const handleCreatePlan = async () => {
    // Validation
    if (isEditingWastage) {
      toast.error("Please apply wastage configuration first");
      return;
    }

    if (paperSpecs.length === 0) {
      toast.error("Please add at least one paper specification");
      return;
    }

    if (cutRolls.length === 0) {
      toast.error("Please add at least one cut roll");
      return;
    }

    try {
      setCreatingPlan(true);

      // Get user ID from localStorage
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        toast.error('User not authenticated');
        return;
      }

      // Build request payload - filter out empty roll sets
      const requestData = {
        wastage: appliedWastage,
        planning_width: planningWidth,
        created_by_id: userId,
        paper_specs: paperSpecs.map(paperSpec => {
          return {
            gsm: paperSpec.gsm,
            bf: paperSpec.bf,
            shade: paperSpec.shade,
            jumbo_rolls: getJumbosForPaper(paperSpec.id).map(jumbo => ({
              jumbo_number: jumbo.jumboNumber,
              roll_sets: getRollSetsForJumbo(jumbo.id)
                .map(rollSet => {
                  const cutRollsForSet = getCutRollsForSet(rollSet.id);
                  // Only include roll sets that have cut rolls
                  if (cutRollsForSet.length === 0) {
                    return null;
                  }
                  return {
                    set_number: rollSet.setNumber,
                    cut_rolls: cutRollsForSet.map((cut: CutRoll) => {
                      const client = availableClients.find(c => c.id === cut.clientId);
                      return {
                        width_inches: cut.widthInches,
                        quantity: cut.quantity,
                        client_name: client?.company_name || "Unknown",
                        // order_source: cut.orderSource || "Manual"
                      };
                    })
                  };
                })
                .filter(rollSet => rollSet !== null) // Remove null roll sets
            }))
            .filter(jumbo => jumbo.roll_sets.length > 0) // Remove jumbos with no valid roll sets
          };
        }).filter(paperSpec => paperSpec.jumbo_rolls.length > 0) // Remove paper specs with no valid jumbos
      };

      console.log('Creating manual plan with data:', requestData);

      // Call API
      const response = await fetch(`${MASTER_ENDPOINTS.PLANS}/manual/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create plan');
      }

      const result = await response.json();
      console.log('Manual plan created:', result);

      setCreatedPlanSummary(result);
      setPlanCreated(true);
      toast.success(`Plan created successfully! ${result.plan_frontend_id}`);

    } catch (error: any) {
      console.error('Error creating manual plan:', error);
      toast.error(error.message || 'Failed to create manual plan');
    } finally {
      setCreatingPlan(false);
    }
  };

  // Helper functions
  const getJumbosForPaper = (paperId: string) => jumboRolls.filter(j => j.paperSpecId === paperId);
  const getRollSetsForJumbo = (jumboId: string) => rollSets.filter(s => s.jumboRollId === jumboId);
  const getCutRollsForSet = (setId: string) => cutRolls.filter(c => c.rollSetId === setId);

  const getTotalWidthForRollSet = (setId: string) => {
    const cuts = getCutRollsForSet(setId);
    return cuts.reduce((sum, cut) => sum + (cut.widthInches * cut.quantity), 0);
  };

  const getRemainingWidthForRollSet = (setId: string) => {
    return planningWidth - getTotalWidthForRollSet(setId);
  };

  const getTotalCutsForPaper = (paperId: string) => {
    const jumbos = getJumbosForPaper(paperId);
    let total = 0;
    jumbos.forEach(jumbo => {
      const sets = getRollSetsForJumbo(jumbo.id);
      sets.forEach(set => {
        total += getCutRollsForSet(set.id).length;
      });
    });
    return total;
  };

  const getTotalSetsForPaper = (paperId: string) => {
    const jumbos = getJumbosForPaper(paperId);
    let total = 0;
    jumbos.forEach(jumbo => {
      total += getRollSetsForJumbo(jumbo.id).length;
    });
    return total;
  };

  const getPaperSpec = (paperId: string) => {
    const paper = paperSpecs.find(p => p.id === paperId);
    return paper ? `${paper.gsm}gsm, ${paper.bf}bf, ${paper.shade}` : "";
  };

  return (
    <div className="space-y-6 m-4 md:m-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Manual Planning</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => router.push("/planning")} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Planning
          </Button>
          {!planCreated && (
            <Button
              onClick={() => setShowCreatePlanConfirmation(true)}
              disabled={creatingPlan || paperSpecs.length === 0 || cutRolls.length === 0}
              className="w-full sm:w-auto"
              >
              {creatingPlan ? "Creating..." : "Create Plan"}
            </Button>
          )}
        </div>
      </div>

      {/* Wastage Configuration - Only show if plan not created */}
      {!planCreated && (
      <Card>
        <CardHeader>
          <CardTitle>Roll Width Configuration</CardTitle>
          <CardDescription>
            {isEditingWastage
              ? "Enter wastage allowance to calculate planning width"
              : "Current wastage configuration"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="flex flex-col space-y-2">
              <label htmlFor="wastage-input" className="text-sm font-medium">
                {isEditingWastage ? "Enter Wastage (inches)" : "Wastage"}
              </label>
              {isEditingWastage ? (
                <div className="flex gap-2">
                  <input
                    id="wastage-input"
                    type="number"
                    min="1"
                    max="69"
                    value={wastageInput}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (value >= 1 && value <= 69) {
                        setWastageInput(value);
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"

                  />
                  <Button
                    onClick={handleApplyWastage}
                    className="bg-green-600 hover:bg-green-700 shrink-0">
                    Apply
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xl md:text-2xl font-bold">
                    {appliedWastage} inches
                  </div>
                  <Button
                    onClick={handleEditWastage}
                    variant="outline"
                    size="sm">
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Range: 1-69 inches
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">Calculation</label>
              <div className="text-base md:text-lg font-mono bg-muted p-2 rounded-md break-all">
                124 - {isEditingWastage ? wastageInput : appliedWastage} = {isEditingWastage ? (124 - wastageInput) : planningWidth}"
              </div>
              <div className="text-xs text-muted-foreground">
                Default Roll Width - Wastage
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">Planning Width</label>
              <div className="text-xl md:text-2xl font-bold text-primary">
                {planningWidth} inches
              </div>
              <div className="text-sm text-green-600">
                ✓ {isEditingWastage ? "Current" : "Active"} planning width: {planningWidth} inches
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Plan Created Summary */}
      {planCreated && createdPlanSummary && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs md:text-sm">Jumbo Rolls</CardDescription>
                <CardTitle className="text-xl md:text-2xl text-blue-600">
                  {createdPlanSummary.summary.jumbo_rolls_created}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs md:text-sm">118" Rolls</CardDescription>
                <CardTitle className="text-xl md:text-2xl text-cyan-600">
                  {createdPlanSummary.summary.intermediate_118_rolls_created}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs md:text-sm">Cut Rolls</CardDescription>
                <CardTitle className="text-xl md:text-2xl text-green-600">
                  {createdPlanSummary.summary.cut_rolls_created}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs md:text-sm">Planning Width</CardDescription>
                <CardTitle className="text-xl md:text-2xl text-purple-600">
                  {createdPlanSummary.summary.planning_width}"
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Production Hierarchy */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                  <CardTitle className="text-green-700 text-lg md:text-xl">Plan Created Successfully!</CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Plan ID: {createdPlanSummary.plan_frontend_id} • Jumbo rolls with their associated cut rolls
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => router.push('/masters/plans')}
                    variant={'outline'}
                    className="w-full sm:w-auto">
                    Go to Plan Master
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setPlanCreated(false);
                      setCreatedPlanSummary(null);
                      setPaperSpecs([]);
                      setJumboRolls([]);
                      setRollSets([]);
                      setCutRolls([]);
                    }}>
                    Create Another Plan
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {createdPlanSummary.production_hierarchy.map((jumboGroup: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4 bg-primary/5">
                    {/* Jumbo Roll Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-lg font-bold shrink-0">
                          J
                        </div>
                        <div>
                          <div className="text-base md:text-lg font-bold text-primary break-all">
                            Jumbo Roll: {jumboGroup.jumbo_roll?.barcode_id || 'Unknown'}
                          </div>
                          <div className="text-xs md:text-sm text-muted-foreground">
                            {jumboGroup.jumbo_roll?.paper_spec || 'Unknown Spec'} •
                            {jumboGroup.jumbo_roll?.width_inches || 0}" •
                            {jumboGroup.intermediate_rolls?.length || 0} × 118" rolls •
                            {jumboGroup.cut_rolls.length} cut rolls
                          </div>
                        </div>
                      </div>
                      {jumboGroup.jumbo_roll?.barcode_id && (
                        <code className="text-xs md:text-sm bg-muted px-3 py-1 rounded break-all">
                          {jumboGroup.jumbo_roll.barcode_id}
                        </code>
                      )}
                    </div>

                    {/* Intermediate 118" Rolls */}
                    {/* {jumboGroup.intermediate_rolls && jumboGroup.intermediate_rolls.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <div className="text-sm font-medium text-gray-700">118" Intermediate Rolls:</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {jumboGroup.intermediate_rolls.map((roll118: any, idx: number) => (
                            <div key={idx} className="border rounded-lg p-3 bg-cyan-50/50 border-cyan-200">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 bg-cyan-600 text-white rounded flex items-center justify-center text-xs font-bold">
                                  118"
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{roll118.barcode_id}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Set #{roll118.roll_sequence}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>Width: {roll118.width_inches}"</div>
                                <div className="truncate">{roll118.paper_spec}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )} */}

                    {/* Cut Rolls */}
                    <div className="space-y-2">
                      <div className="text-xs md:text-sm font-medium text-gray-700">Cut Rolls:</div>
                      <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs md:text-sm">Barcode</TableHead>
                              <TableHead className="text-xs md:text-sm">Width (in)</TableHead>
                              <TableHead className="text-xs md:text-sm">Client</TableHead>
                              <TableHead className="text-xs md:text-sm">Status</TableHead>
                              <TableHead className="text-xs md:text-sm">Parent 118" Roll</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {jumboGroup.cut_rolls.map((cutRoll: any, idx: number) => (
                              <TableRow key={idx} className="border-l-4 border-green-200">
                                <TableCell>
                                  <code className="text-xs md:text-sm">{cutRoll.barcode_id}</code>
                                </TableCell>
                                <TableCell className="text-xs md:text-sm">{cutRoll.width_inches}&quot;</TableCell>
                                <TableCell className="text-xs md:text-sm">
                                  {cutRoll.client_name || 'N/A'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={cutRoll.status === 'cutting' ? 'default' : 'secondary'} className="text-xs">
                                    {cutRoll.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {cutRoll.parent_118_barcode || 'N/A'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Main Content - Only show if plan not created */}
      {!planCreated && (
        <>
      {/* Wastage Configuration */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg md:text-xl">Production Planning Hierarchy</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Paper Spec → Jumbo Rolls →  Sets → Cut Rolls
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                if (isEditingWastage) {
                  toast.error("Please apply wastage configuration first");
                  return;
                }
                setShowAddPaperDialog(true);
              }}
              disabled={isEditingWastage}
              className="w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Paper Spec
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paperSpecs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No paper specifications added yet.</p>
              <p className="text-sm">
                {isEditingWastage
                  ? "Please apply wastage configuration before adding paper specs."
                  : "Click \"Add Paper Spec\" to get started."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paperSpecs.map((paper) => {
                const isPaperExpanded = expandedPaperSpecs.has(paper.id);
                const jumbosForPaper = getJumbosForPaper(paper.id);
                const totalSets = getTotalSetsForPaper(paper.id);
                const totalCuts = getTotalCutsForPaper(paper.id);

                return (
                  <div key={paper.id} className="border-2 border-orange-200 rounded-lg overflow-hidden bg-orange-50/30">
                    {/* Paper Spec Header */}
                    <div className="bg-orange-50 border-orange-200 p-3 md:p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePaperExpand(paper.id)}
                            className="h-8 w-8 p-0 shrink-0">
                            {isPaperExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </Button>
                          <div className="flex items-center gap-2 md:gap-3 shrink-0">
                            <FileText className="h-5 w-5 md:h-6 md:w-6 text-orange-600" />
                            <Package className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-base md:text-lg break-words">
                              {paper.shade.toUpperCase()} {paper.gsm}GSM (BF: {paper.bf})
                            </div>
                            <div className="text-xs md:text-sm text-muted-foreground flex flex-wrap gap-2 md:gap-4">
                              <span className="text-orange-600 font-medium">{jumbosForPaper.length} Jumbo Rolls</span>
                              <span>{totalSets} Sets</span>
                              <span>{totalCuts} Cuts</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddJumboRoll(paper.id)}
                            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300 text-xs md:text-sm">
                            <Plus className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">Add Jumbo Roll</span>
                            <span className="sm:hidden">Add Jumbo</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePaperSpec(paper.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Jumbo Rolls */}
                    {isPaperExpanded && (
                      <div className="p-4 space-y-4 ">
                        {jumbosForPaper.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <p className="text-sm">No jumbo rolls added yet.</p>
                          </div>
                        ) : (
                          jumbosForPaper.map((jumbo) => {
                            const setsForJumbo = getRollSetsForJumbo(jumbo.id);
                            const totalWaste = setsForJumbo.reduce((sum, set) => sum + getRemainingWidthForRollSet(set.id), 0);

                            return (
                              <div key={jumbo.id} className="border rounded-lg overflow-hidden bg-blue-50/30">
                                {/* Jumbo Roll Header */}
                                <div className="bg-blue-50 p-2 md:p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                                      <div className="min-w-0">
                                        <div className="font-semibold text-sm md:text-base text-blue-900">
                                          Jumbo Roll #{jumbo.jumboNumber}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {setsForJumbo.length} sets | {totalWaste.toFixed(1)}" waste
                                        </div>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteJumboRoll(jumbo.id)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Roll Sets (118" rolls) */}
                                <div className="p-3 space-y-3 bg-white">
                                  {setsForJumbo.map((rollSet) => {
                                    const cutsForSet = getCutRollsForSet(rollSet.id);
                                      const totalWidthUsed = getTotalWidthForRollSet(rollSet.id);
                                      const remainingWidth = getRemainingWidthForRollSet(rollSet.id);
                                      const efficiency = totalWidthUsed > 0 ? ((totalWidthUsed / planningWidth) * 100).toFixed(0) : 0;

                                    return (
                                      <div key={rollSet.id} className="border rounded-lg overflow-hidden">
                                        {/* Roll Set Header */}
                                        <div className="bg-cyan-50 border-b p-2 md:p-3">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <div className="flex-1 min-w-0">
                                                <div className="font-medium text-xs md:text-sm text-cyan-900">
                                                   Set #{rollSet.setNumber} ({efficiency}% efficient)
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                  {cutsForSet.length} cuts | {remainingWidth.toFixed(1)}" waste
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex gap-1">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteRollSet(rollSet.id)}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 shrink-0">
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Cutting Pattern Visual */}
                                        <div className="p-2 md:p-3 bg-white space-y-3">
                                              <div>
                                                <div className="text-xs font-medium mb-2">
                                                  Cutting Pattern ({planningWidth}" Roll):
                                                </div>
                                                <div className="w-full h-12 md:h-16 rounded flex overflow-hidden">
                                                  {cutsForSet.map((cut) =>
                                                    Array.from({ length: cut.quantity }).map((_, idx) => (
                                                      <div
                                                        key={`${cut.id}-${idx}`}
                                                        style={{ width: `${(cut.widthInches / planningWidth) * 100}%` }}
                                                        className="bg-green-500 border-r-2 border-white flex flex-col items-center justify-center text-white text-xs font-bold">
                                                        <div className="text-[10px] md:text-xs">{cut.widthInches}"</div>
                                                      </div>
                                                    ))
                                                  )}
                                                  {remainingWidth > 0 && (
                                                    <div
                                                      style={{ width: `${(remainingWidth / planningWidth) * 100}%` }}
                                                      className="bg-pink-300 flex items-center justify-center text-gray-700 text-[10px] md:text-xs px-1">
                                                      {remainingWidth.toFixed(1)}" waste
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Cut Rolls List */}
                                              <div className="space-y-2">
                                                {cutsForSet.map((cut) => {
                                                  const client = availableClients.find(c => c.id === cut.clientId);
                                                  return (
                                                  <div key={cut.id} className="flex items-center justify-between bg-green-50 p-2 rounded gap-2">
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                      <Badge className="bg-green-600 text-xs shrink-0">{cut.widthInches}" × {cut.quantity}</Badge>
                                                      {/* <span className="text-sm font-medium">{cut.widthInches * cut.quantity}.0" from {cut.orderSource || "Manual"}</span> */}
                                                      <span className="text-xs text-muted-foreground truncate">- {client?.company_name || "Unknown Client"}</span>
                                                    </div>
                                                    <div className="flex gap-1 shrink-0">
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEditCutRoll(cut)}
                                                        className="h-6 text-blue-600 hover:bg-blue-50">
                                                        <Pencil className="h-3 w-3" />
                                                      </Button>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteCutRoll(cut.id)}
                                                        className="h-6 text-red-600 hover:bg-red-50">
                                                        <Trash2 className="h-3 w-3" />
                                                      </Button>
                                                    </div>
                                                  </div>
                                                  );
                                                })}
                                              </div>

                                              {/* Add Manual Cut Button */}
                                              {remainingWidth > 0 && (
                                                <div className="flex justify-center">
                                                  <Button
                                                    variant="outline"
                                                    onClick={() => handleAddCutToRollSet(rollSet.id)}
                                                    className="border-orange-300 text-orange-600 hover:bg-orange-50 text-xs md:text-sm w-full md:w-auto">
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    <span className="hidden sm:inline">Add Manual Cut ({remainingWidth.toFixed(1)}" available)</span>
                                                    <span className="sm:hidden">Add Cut ({remainingWidth.toFixed(1)}")</span>
                                                  </Button>
                                                </div>
                                              )}
                                            </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}

      {/* Add Paper Spec Dialog */}
      <Dialog open={showAddPaperDialog} onOpenChange={(open) => {
        setShowAddPaperDialog(open);
        if (!open) setSelectedPaperId("");
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Paper Specification</DialogTitle>
            <DialogDescription>
              Select a paper specification from Paper Master
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="paperSelect">Paper Specification</Label>
              {loadingPapers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : availablePapers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No active papers found in Paper Master.</p>
                  <p className="text-xs mt-2">Please add papers in the Paper Master first.</p>
                </div>
              ) : (
                <>
                  <Select
                    value={selectedPaperId}
                    onValueChange={setSelectedPaperId}>
                    <SelectTrigger id="paperSelect">
                      <SelectValue placeholder="Select a paper specification" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePapers.sort((a,b)=>{
                        if(a.gsm !== b.gsm) return a.gsm - b.gsm;
                        if(a.bf !== b.bf) return a.bf - b.bf;
                        return a.shade.localeCompare(b.shade);
                      }).map((paper) => (
                        <SelectItem key={paper.id} value={paper.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">
                               {paper.gsm}gsm {paper.bf}bf {paper.shade}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedPaperId && (() => {
                    const selected = availablePapers.find(p => p.id === selectedPaperId);
                    return selected ? (
                      <div className="bg-blue-50 p-3 rounded-md mt-2">
                        <div className="text-sm font-medium mb-1">Selected Paper:</div>
                        <div className="text-lg font-bold text-blue-600">
                          {selected.shade.toUpperCase()} {selected.gsm}GSM (BF: {selected.bf})
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {selected.name} • {selected.type}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => {
              setShowAddPaperDialog(false);
              setSelectedPaperId("");
            }} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleAddPaperSpec}
              className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
              disabled={!selectedPaperId || loadingPapers}>
              Add Paper Spec
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Cut Roll Dialog */}
      <Dialog open={showAddCutRollDialog} onOpenChange={(open) => {
        setShowAddCutRollDialog(open);
        if (!open) {
          setEditingCutRoll(null);
          setSelectedRollSetForCut("");
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingCutRoll ? "Edit Cut Roll" : "Add Manual Cut"}</DialogTitle>
            <DialogDescription>
              {editingCutRoll ? "Update" : "Add"} a cut roll. Max width: {planningWidth}"
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cutWidth">Width (inches)</Label>
                <Input
                  id="cutWidth"
                  type="number"
                  max={planningWidth}
                  value={cutRollForm.widthInches}
                  onChange={(e) => setCutRollForm({ ...cutRollForm, widthInches: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cutQuantity">Quantity</Label>
                <Input
                  id="cutQuantity"
                  type="number"
                  min="1"
                  value={cutRollForm.quantity}
                  onChange={(e) => setCutRollForm({ ...cutRollForm, quantity: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSelect">Client</Label>
              {loadingClients ? (
                <div className="text-sm text-muted-foreground">Loading clients...</div>
              ) : availableClients.length === 0 ? (
                <div className="text-sm text-orange-600">No active clients found. Please add clients first.</div>
              ) : (
                <Select
                  value={cutRollForm.clientId}
                  onValueChange={(value) => setCutRollForm({ ...cutRollForm, clientId: value })}
                  onOpenChange={(open) => !open && setClientSearchTerm("")}>
                  <SelectTrigger id="clientSelect">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectSearch
                      placeholder="Search clients..."
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                    />
                    {filteredClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{client.company_name}</span>
                          
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              {/* <Label htmlFor="orderSource">Order Source (Optional)</Label>
              <Input
                id="orderSource"
                placeholder="e.g., ORD-00010-26"
                // value={cutRollForm.orderSource}
                // onChange={(e) => setCutRollForm({ ...cutRollForm, orderSource: e.target.value })}
              /> */}
            </div>
            {cutRollForm.widthInches && cutRollForm.quantity && (
              <div className="bg-muted p-3 rounded-md text-sm">
                <div className="font-medium mb-1">Preview:</div>
                <div className="text-muted-foreground">
                  {cutRollForm.widthInches}" × {cutRollForm.quantity} = {parseFloat(cutRollForm.widthInches) * parseInt(cutRollForm.quantity)}" total
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => {
              setShowAddCutRollDialog(false);
              setEditingCutRoll(null);
            }} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSaveCutRoll} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
              {editingCutRoll ? "Update Cut Roll" : "Add Cut Roll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Plan Confirmation Dialog */}
      <Dialog open={showCreatePlanConfirmation} onOpenChange={setShowCreatePlanConfirmation}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Confirm Plan Creation</DialogTitle>
            <DialogDescription>
              Are you sure you want to create this manual plan? This will create inventory records and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">


              <div className="font-medium text-muted-foreground">Planning Width:</div>
              <div className="font-semibold">{planningWidth} inches</div>

            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCreatePlanConfirmation(false)}
              disabled={creatingPlan}
              className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowCreatePlanConfirmation(false);
                handleCreatePlan();
              }}
              disabled={creatingPlan}
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
              {creatingPlan ? "Creating..." : "Confirm & Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
