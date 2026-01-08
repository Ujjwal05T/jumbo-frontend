"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchPapers, Paper } from "@/lib/papers";
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
import { useRouter } from "next/navigation";

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
  clientName: string;
  orderSource: string; // e.g., "ORD-00010-26"
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
    clientName: "",
    orderSource: "",
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
      clientName: "",
      orderSource: "",
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
      clientName: cutRoll.clientName,
      orderSource: cutRoll.orderSource,
    });
    setShowAddCutRollDialog(true);
  };

  // Save Cut Roll
  const handleSaveCutRoll = () => {
    if (!cutRollForm.widthInches || !cutRollForm.quantity || !cutRollForm.clientName) {
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
              clientName: cutRollForm.clientName,
              orderSource: cutRollForm.orderSource,
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
        clientName: cutRollForm.clientName,
        orderSource: cutRollForm.orderSource,
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
    <div className="space-y-6 m-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manual Planning</h1>
        <Button variant="outline" onClick={() => router.push("/planning")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Planning
        </Button>
      </div>

      {/* Wastage Configuration */}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
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
                    placeholder="1.0"
                  />
                  <Button
                    onClick={handleApplyWastage}
                    className="bg-green-600 hover:bg-green-700">
                    Apply
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold">
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
              <div className="text-lg font-mono bg-muted p-2 rounded-md">
                124 - {isEditingWastage ? wastageInput : appliedWastage} = {isEditingWastage ? (124 - wastageInput) : planningWidth}"
              </div>
              <div className="text-xs text-muted-foreground">
                Default Roll Width - Wastage
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">Planning Width</label>
              <div className="text-2xl font-bold text-primary">
                {planningWidth} inches
              </div>
              <div className="text-sm text-green-600">
                ✓ {isEditingWastage ? "Current" : "Active"} planning width: {planningWidth} inches
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Production Planning Hierarchy</CardTitle>
              <CardDescription>
                Paper Spec → Jumbo Rolls →  Sets → Cut Rolls
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddPaperDialog(true)}
              className="bg-blue-600 hover:bg-blue-700">
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
              <p className="text-sm">Click "Add Paper Spec" to get started.</p>
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
                    <div className="bg-orange-50 border-orange-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePaperExpand(paper.id)}
                            className="h-8 w-8 p-0">
                            {isPaperExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </Button>
                          <div className="flex items-center gap-3">
                            <FileText className="h-6 w-6 text-orange-600" />
                            <Package className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <div className="font-bold text-lg">
                              {paper.shade.toUpperCase()} {paper.gsm}GSM (BF: {paper.bf})
                            </div>
                            <div className="text-sm text-muted-foreground flex gap-4">
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
                            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300">
                            <Plus className="h-3 w-3 mr-1" />
                            Add Jumbo Roll
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePaperSpec(paper.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50">
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
                                <div className="bg-blue-50 p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                      <div>
                                        <div className="font-semibold text-blue-900">
                                          Jumbo Roll #{jumbo.jumboNumber}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {setsForJumbo.length} sets | {totalWaste.toFixed(1)}" total waste
                                        </div>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteJumboRoll(jumbo.id)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50">
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
                                        <div className="bg-cyan-50 border-b p-3">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-1">
                                              <div className="flex-1">
                                                <div className="font-medium text-sm text-cyan-900">
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
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6">
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Cutting Pattern Visual */}
                                        <div className="p-3 bg-white space-y-3">
                                              <div>
                                                <div className="text-xs font-medium mb-2">
                                                  Cutting Pattern ({planningWidth}" Roll):
                                                </div>
                                                <div className="w-full h-16 rounded flex overflow-hidden">
                                                  {cutsForSet.map((cut) =>
                                                    Array.from({ length: cut.quantity }).map((_, idx) => (
                                                      <div
                                                        key={`${cut.id}-${idx}`}
                                                        style={{ width: `${(cut.widthInches / planningWidth) * 100}%` }}
                                                        className="bg-green-500 border-r-2 border-white flex flex-col items-center justify-center text-white text-xs font-bold">
                                                        <div>{cut.widthInches}"</div>
                                                      </div>
                                                    ))
                                                  )}
                                                  {remainingWidth > 0 && (
                                                    <div
                                                      style={{ width: `${(remainingWidth / planningWidth) * 100}%` }}
                                                      className="bg-pink-300 flex items-center justify-center text-gray-700 text-xs">
                                                      {remainingWidth.toFixed(1)}" waste
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Cut Rolls List */}
                                              <div className="space-y-2">
                                                {cutsForSet.map((cut) => (
                                                  <div key={cut.id} className="flex items-center justify-between bg-green-50 p-2 rounded">
                                                    <div className="flex items-center gap-2">
                                                      <Badge className="bg-green-600">{cut.widthInches}" × {cut.quantity}</Badge>
                                                      <span className="text-sm font-medium">{cut.widthInches * cut.quantity}.0" from {cut.orderSource || "Manual"}</span>
                                                      <span className="text-xs text-muted-foreground">- {cut.clientName}</span>
                                                    </div>
                                                    <div className="flex gap-1">
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
                                                ))}
                                              </div>

                                              {/* Add Manual Cut Button */}
                                              <div className="flex justify-center">
                                                <Button
                                                  variant="outline"
                                                  onClick={() => handleAddCutToRollSet(rollSet.id)}
                                                  className="border-orange-300 text-orange-600 hover:bg-orange-50">
                                                  <Plus className="h-3 w-3 mr-1" />
                                                  Add Manual Cut ({remainingWidth.toFixed(1)}" available)
                                                </Button>
                                              </div>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddPaperDialog(false);
              setSelectedPaperId("");
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPaperSpec}
              className="bg-blue-600 hover:bg-blue-700"
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cutWidth">Width (inches)</Label>
                <Input
                  id="cutWidth"
                  type="number"
                  placeholder="e.g., 72"
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
                  placeholder="e.g., 1"
                  value={cutRollForm.quantity}
                  onChange={(e) => setCutRollForm({ ...cutRollForm, quantity: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                placeholder="e.g., AM TRADE LINK PRIVATE LIMITED"
                value={cutRollForm.clientName}
                onChange={(e) => setCutRollForm({ ...cutRollForm, clientName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orderSource">Order Source (Optional)</Label>
              <Input
                id="orderSource"
                placeholder="e.g., ORD-00010-26"
                value={cutRollForm.orderSource}
                onChange={(e) => setCutRollForm({ ...cutRollForm, orderSource: e.target.value })}
              />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddCutRollDialog(false);
              setEditingCutRoll(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveCutRoll} className="bg-green-600 hover:bg-green-700">
              {editingCutRoll ? "Update Cut Roll" : "Add Cut Roll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
