/**
 * Create Wastage Modal - Modal for manually creating wastage inventory items (Stock)
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSearch,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Package } from "lucide-react";
import {
  createManualWastage,
  fetchPapersForWastage,
  PaperMaster,
  CreateWastageRequest,
} from "@/lib/wastage";

interface CreateWastageModalProps {
  onWastageCreated: () => void;
}

export default function CreateWastageModal({ onWastageCreated }: CreateWastageModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [papers, setPapers] = useState<PaperMaster[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [paperSearch, setPaperSearch] = useState("");

  // Form state
  const [formData, setFormData] = useState<CreateWastageRequest>({
    width_inches: 0,
    paper_id: "",
    reel_no: "",
    weight_kg: 0,
    status: "available",
    location: "WASTE_STORAGE",
    notes: "",
  });

  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load papers when modal opens
  useEffect(() => {
    if (open && papers.length === 0) {
      loadPapers();
    }
  }, [open]);

  const loadPapers = async () => {
    try {
      setLoadingPapers(true);
      const papersData = await fetchPapersForWastage();
      setPapers(papersData);
    } catch (error) {
      console.error("Error loading papers:", error);
      toast.error("Failed to load paper options");
    } finally {
      setLoadingPapers(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};


    if (!formData.paper_id) {
      newErrors.paper_id = "Please select a paper type";
    }

    if (formData.weight_kg !== undefined && formData.weight_kg < 0) {
      newErrors.weight_kg = "Weight cannot be negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    try {
      setLoading(true);

      const wastageData: CreateWastageRequest = {
        ...formData,
        weight_kg: formData.weight_kg || 0,
      };

      await createManualWastage(wastageData);

      toast.success("Stock item created successfully!");

      // Reset form
      setFormData({
        width_inches: 0,
        paper_id: "",
        weight_kg: 0,
        status: "available",
        location: "WASTE_STORAGE",
        notes: "",
        reel_no: "",
      });
      setErrors({});
      setOpen(false);

      // Refresh parent data
      onWastageCreated();
    } catch (error) {
      console.error("Error creating wastage:", error);
      toast.error("Failed to create stock item");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreateWastageRequest, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const selectedPaper = papers.find(p => p.id === formData.paper_id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Manual Stock</DialogTitle>
          <DialogDescription>
            Create a new stock entry for physical wastage rolls found in warehouse
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Width */}
          <div className="space-y-2">
            <Label htmlFor="width">Width (inches) *</Label>
            <Input
              id="width"
              type="number"
              placeholder="e.g., 15.5"
              value={formData.width_inches || ""}
              onChange={(e) => handleInputChange("width_inches", parseFloat(e.target.value) || 0)}
              className={errors.width_inches ? "border-red-500" : ""}
            />
            {errors.width_inches && (
              <p className="text-sm text-red-500">{errors.width_inches}</p>
            )}
          </div>

          {/* Paper Type */}
          <div className="space-y-2">
            <Label htmlFor="paper">Paper Type *</Label>
            {loadingPapers ? (
              <div className="flex items-center space-x-2 p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading papers...</span>
              </div>
            ) : (
              <Select
                value={formData.paper_id}
                onValueChange={(value) => handleInputChange("paper_id", value)}
              >
                <SelectTrigger className={errors.paper_id ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select paper type" />
                </SelectTrigger>
                <SelectContent>
                    {papers.sort((a, b) => a.gsm - b.gsm).map((paper) => (
                    <SelectItem key={paper.id} value={paper.id}>
                      <div className="flex flex-col">
                      
                      <span className="text-sm font-medium">
                        {paper.gsm}GSM • {paper.bf}BF • {paper.shade}
                      </span>
                      </div>
                    </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            {errors.paper_id && (
              <p className="text-sm text-red-500">{errors.paper_id}</p>
            )}
            {selectedPaper && (
              <div className="p-2 bg-muted rounded text-sm">
                <strong>{selectedPaper.name}</strong> - {selectedPaper.gsm}GSM, {selectedPaper.bf}BF, {selectedPaper.shade}
              </div>
            )}
          </div>

          {/* Reel Number */}
          <div className="space-y-2">
            <Label htmlFor="reel_no">Reel Number</Label>
            <Input
              id="reel_no"
              placeholder="001"
              value={formData.reel_no || ""}
              onChange={(e) => handleInputChange("reel_no", e.target.value)}
            />
          </div>

          {/* Weight */}
          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              min="0"
              placeholder="0.0"
              value={formData.weight_kg || ""}
              onChange={(e) => handleInputChange("weight_kg", parseFloat(e.target.value) || 0)}
              className={errors.weight_kg ? "border-red-500" : ""}
            />
            {errors.weight_kg && (
              <p className="text-sm text-red-500">{errors.weight_kg}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Weight can be set now or later via QR code scanning
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes for identification..."
              value={formData.notes || ""}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Create Stock
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}