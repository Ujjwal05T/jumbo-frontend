/**
 * Partial Jumbo Completion Component
 * Allows users to manually complete partial jumbos by creating Gupta Publishing orders
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Minus, Package, AlertCircle } from "lucide-react";
import {
  createGuptaCompletionOrder,
  convertGuptaOrderToCutRolls,
  type RequiredRoll
} from "@/lib/gupta-orders";

interface PartialJumbo {
  paperSpecs: {
    gsm: number;
    bf: number;
    shade: string;
  };
  paper_id: string;
  currentRolls: number;
  neededRolls: number;
  maxRollNumber: number;
  existingRolls: any[];
}

interface PartialJumboCompleterProps {
  planData: any;
  onPlanUpdate: (newPlanData: any) => void;
  currentUserId: string;
}

export default function PartialJumboCompleter({
  planData,
  onPlanUpdate,
  currentUserId
}: PartialJumboCompleterProps) {
  const [partialJumbos, setPartialJumbos] = useState<PartialJumbo[]>([]);
  const [selectedJumbo, setSelectedJumbo] = useState<PartialJumbo | null>(null);
  const [requiredRolls, setRequiredRolls] = useState<RequiredRoll[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Analyze plan data to find partial jumbos
  const analyzePartialJumbos = () => {
    console.log('🔍 Analyzing planData:', planData);
    
    if (!planData?.selected_cut_rolls) {
      console.log('❌ No selected_cut_rolls found');
      return [];
    }

    console.log('📊 Found cut rolls:', planData.selected_cut_rolls.length);

    // Group by paper specifications
    const grouped = planData.selected_cut_rolls.reduce((acc: any, roll: any) => {
      const key = `${roll.gsm}-${roll.bf}-${roll.shade}`;
      if (!acc[key]) {
        acc[key] = {
          paperSpecs: { gsm: roll.gsm, bf: roll.bf, shade: roll.shade },
          paper_id: roll.paper_id,
          rolls: []
        };
      }
      acc[key].rolls.push(roll);
      return acc;
    }, {});

    console.log('📋 Grouped by specs:', Object.keys(grouped));

    // Find partial jumbos (not divisible by 3)
    const partials: PartialJumbo[] = [];
    Object.entries(grouped).forEach(([key, group]: [string, any]) => {
      const rollCount = group.rolls.length;
      const remainder = rollCount % 3;
      
      console.log(`📦 ${key}: ${rollCount} rolls, remainder: ${remainder}`);
      
      if (remainder !== 0) {
        const maxRollNumber = Math.max(...group.rolls.map((r: any) => r.individual_roll_number || 0));
        partials.push({
          paperSpecs: group.paperSpecs,
          paper_id: group.paper_id,
          currentRolls: remainder,
          neededRolls: 3 - remainder,
          maxRollNumber,
          existingRolls: group.rolls
        });
        console.log(`🔥 Found partial jumbo: ${key} needs ${3 - remainder} more rolls`);
      }
    });

    console.log('🎯 Total partial jumbos found:', partials.length);
    return partials;
  };

  useEffect(() => {
    const partials = analyzePartialJumbos();
    setPartialJumbos(partials);
  }, [planData]);

  const openCompletionDialog = (jumbo: PartialJumbo) => {
    setSelectedJumbo(jumbo);
    // Initialize with suggested widths (can be modified by user)
    const defaultRolls: RequiredRoll[] = Array(jumbo.neededRolls).fill(0).map(() => ({
      width_inches: 36, // Default width
      paper_id: jumbo.paper_id,
      rate: 50.0 // Default rate
    }));
    setRequiredRolls(defaultRolls);
    setDialogOpen(true);
  };

  const updateRollWidth = (index: number, width: number) => {
    const updated = [...requiredRolls];
    updated[index].width_inches = width;
    setRequiredRolls(updated);
  };

  const updateRollRate = (index: number, rate: number) => {
    const updated = [...requiredRolls];
    updated[index].rate = rate;
    setRequiredRolls(updated);
  };

  const addRoll = () => {
    if (!selectedJumbo) return;
    setRequiredRolls([...requiredRolls, {
      width_inches: 36,
      paper_id: selectedJumbo.paper_id,
      rate: 50.0
    }]);
  };

  const removeRoll = (index: number) => {
    const updated = requiredRolls.filter((_, i) => i !== index);
    setRequiredRolls(updated);
  };

  const completePartialJumbo = async () => {
    if (!selectedJumbo || !requiredRolls.length) return;

    try {
      setLoading(true);

      // Validate input
      const validRolls = requiredRolls.filter(roll => roll.width_inches > 0);
      if (validRolls.length === 0) {
        toast.error("Please specify at least one valid roll width");
        return;
      }

      // Create Gupta Publishing order
      const guptaOrderResponse = await createGuptaCompletionOrder({
        required_rolls: validRolls,
        created_by_id: currentUserId,
        notes: `Completing partial jumbo: ${selectedJumbo.paperSpecs.gsm}GSM ${selectedJumbo.paperSpecs.bf}BF ${selectedJumbo.paperSpecs.shade}`
      });

      // Convert to cut_rolls format
      const additionalCutRolls = convertGuptaOrderToCutRolls(guptaOrderResponse, {
        gsm: selectedJumbo.paperSpecs.gsm,
        bf: selectedJumbo.paperSpecs.bf,
        shade: selectedJumbo.paperSpecs.shade,
        maxRollNumber: selectedJumbo.maxRollNumber
      });

      // Update plan data
      const updatedPlanData = {
        ...planData,
        selected_cut_rolls: [...planData.selected_cut_rolls, ...additionalCutRolls]
      };

      onPlanUpdate(updatedPlanData);

      toast.success(
        `Created Gupta order ${guptaOrderResponse.order.frontend_id} with ${validRolls.length} rolls`
      );

      // Close dialog and refresh partial jumbos
      setDialogOpen(false);
      setSelectedJumbo(null);
      setRequiredRolls([]);

    } catch (error) {
      console.error('Error completing partial jumbo:', error);
      toast.error(
        error instanceof Error 
          ? error.message 
          : 'Failed to complete partial jumbo'
      );
    } finally {
      setLoading(false);
    }
  };

  const getTotalWeight = (rolls: RequiredRoll[]) => {
    return rolls.reduce((sum, roll) => sum + (roll.width_inches * 13), 0);
  };

  const getTotalAmount = (rolls: RequiredRoll[]) => {
    return rolls.reduce((sum, roll) => sum + (roll.width_inches * 13 * roll.rate), 0);
  };

  if (partialJumbos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            Jumbo Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="text-green-600 text-sm font-medium">
              ✓ All jumbos are complete! No partial jumbos detected.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          Partial Jumbos Detected
        </CardTitle>
        <CardDescription>
          Complete partial jumbos by adding rolls through Gupta Publishing House orders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {partialJumbos.map((jumbo, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm">
                      {jumbo.paperSpecs.gsm} GSM
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      {jumbo.paperSpecs.bf} BF
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      {jumbo.paperSpecs.shade}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Current: <span className="font-medium">{jumbo.currentRolls}/3 rolls</span>
                  </div>
                  <div className="text-sm text-amber-600">
                    Need: <span className="font-medium">{jumbo.neededRolls} more rolls</span> to complete jumbo
                  </div>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm"
                      onClick={() => openCompletionDialog(jumbo)}
                    >
                      Add Rolls
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Complete Partial Jumbo</DialogTitle>
                      <DialogDescription>
                        Add rolls to complete partial jumbo for{" "}
                        <strong>
                          {selectedJumbo?.paperSpecs.gsm}GSM {selectedJumbo?.paperSpecs.bf}BF {selectedJumbo?.paperSpecs.shade}
                        </strong>
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label className="text-base font-medium">Roll Specifications</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addRoll}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Roll
                        </Button>
                      </div>
                      
                      <div className="border rounded">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Width (inches)</TableHead>
                              <TableHead>Weight (kg)</TableHead>
                              <TableHead>Rate (₹/kg)</TableHead>
                              <TableHead>Amount (₹)</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {requiredRolls.map((roll, idx) => {
                              const weight = roll.width_inches * 13;
                              const amount = weight * roll.rate;
                              return (
                                <TableRow key={idx}>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      value={roll.width_inches}
                                      onChange={(e) => updateRollWidth(idx, parseFloat(e.target.value) || 0)}
                                      min={1}
                                      max={117}
                                      step={0.5}
                                      className="w-20"
                                    />
                                  </TableCell>
                                  <TableCell>{weight.toFixed(1)}</TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      value={roll.rate}
                                      onChange={(e) => updateRollRate(idx, parseFloat(e.target.value) || 0)}
                                      min={0}
                                      step={0.1}
                                      className="w-20"
                                    />
                                  </TableCell>
                                  <TableCell>₹{amount.toFixed(2)}</TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeRoll(idx)}
                                      disabled={requiredRolls.length <= 1}
                                    >
                                      <Minus className="w-4 h-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      
                      {requiredRolls.length > 0 && (
                        <div className="bg-muted p-4 rounded space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Total Rolls:</span>
                            <span className="font-medium">{requiredRolls.length}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Total Weight:</span>
                            <span className="font-medium">{getTotalWeight(requiredRolls).toFixed(1)} kg</span>
                          </div>
                          <div className="flex justify-between text-sm border-t pt-2">
                            <span>Total Amount:</span>
                            <span className="font-medium">₹{getTotalAmount(requiredRolls).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={completePartialJumbo}
                        disabled={loading || requiredRolls.length === 0}
                      >
                        {loading ? "Creating..." : "Create Gupta Order"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}