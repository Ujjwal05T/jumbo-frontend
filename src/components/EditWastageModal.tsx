/**
 * Edit Wastage Modal - Modal for editing wastage inventory items
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
import { Loader2 } from "lucide-react";
import {
  updateWastageItem,
  fetchPapersForWastage,
  PaperMaster,
  UpdateWastageRequest,
  WastageInventory,
} from "@/lib/wastage";

interface EditWastageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wastageItem: WastageInventory | null;
  onWastageUpdated: () => void;
}

export default function EditWastageModal({
  open,
  onOpenChange,
  wastageItem,
  onWastageUpdated,
}: EditWastageModalProps) {
  const [loading, setLoading] = useState(false);
  const [papers, setPapers] = useState<PaperMaster[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [paperSearch, setPaperSearch] = useState("");

  // Form state
  const [formData, setFormData] = useState<UpdateWastageRequest>({
    width_inches: 0,
    paper_id: "",
    reel_no: "",
    weight_kg: 0,
    status: "available",
    location: "",
    notes: "",
  });

  // Load papers when modal opens
  useEffect(() => {
    if (open) {
      loadPapers();
      // Initialize form with current wastage data
      if (wastageItem) {
        setFormData({
          width_inches: wastageItem.width_inches,
          paper_id: wastageItem.paper_id,
          reel_no: wastageItem.reel_no || "",
          weight_kg: wastageItem.weight_kg,
          status: wastageItem.status,
          location: wastageItem.location || "",
          notes: wastageItem.notes || "",
        });
      }
    }
  }, [open, wastageItem]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!wastageItem) {
      toast.error("No wastage item selected");
      return;
    }

    if (!formData.width_inches || formData.width_inches <= 0) {
      toast.error("Please enter a valid width");
      return;
    }

    if (!formData.paper_id) {
      toast.error("Please select a paper type");
      return;
    }

    try {
      setLoading(true);

      // Filter out unchanged fields to only send updates
      const updateData: UpdateWastageRequest = {};

      if (formData.width_inches !== wastageItem.width_inches) {
        updateData.width_inches = formData.width_inches;
      }
      if (formData.paper_id !== wastageItem.paper_id) {
        updateData.paper_id = formData.paper_id;
      }
      if (formData.reel_no !== (wastageItem.reel_no || "")) {
        updateData.reel_no = formData.reel_no;
      }
      if (formData.weight_kg !== wastageItem.weight_kg) {
        updateData.weight_kg = formData.weight_kg;
      }
      if (formData.status !== wastageItem.status) {
        updateData.status = formData.status;
      }
      if (formData.location !== (wastageItem.location || "")) {
        updateData.location = formData.location;
      }
      if (formData.notes !== (wastageItem.notes || "")) {
        updateData.notes = formData.notes;
      }

      // Only update if there are changes
      if (Object.keys(updateData).length === 0) {
        toast.info("No changes to save");
        onOpenChange(false);
        return;
      }

      await updateWastageItem(wastageItem.id, updateData);

      toast.success("Wastage item updated successfully!");
      onWastageUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating wastage:", error);
      toast.error("Failed to update wastage item");
    } finally {
      setLoading(false);
    }
  };

  const getStatusOptions = () => [
    { value: "available", label: "Available" },
    { value: "used", label: "Used" },
    { value: "damaged", label: "Damaged" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Stock Item</DialogTitle>
          <DialogDescription>
            Update the details for this stock inventory item.
            {wastageItem && (
              <span className="font-medium text-foreground">
                {" "}Stock ID: {wastageItem.frontend_id}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="width_inches">Width (inches) *</Label>
              <Input
                id="width_inches"
                type="number"
                step="0.1"
                min="0"
                value={formData.width_inches}
                onChange={(e) =>
                  setFormData({ ...formData, width_inches: parseFloat(e.target.value) || 0 })
                }
                placeholder="e.g., 12.5"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight_kg">Weight (kg)</Label>
              <Input
                id="weight_kg"
                type="number"
                step="0.1"
                min="0"
                value={formData.weight_kg}
                onChange={(e) =>
                  setFormData({ ...formData, weight_kg: parseFloat(e.target.value) || 0 })
                }
                placeholder="e.g., 50.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paper_id">Paper Type *</Label>
            {loadingPapers ? (
              <div className="flex items-center justify-center p-4 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading papers...
              </div>
            ) : (
              <Select
                value={formData.paper_id}
                onValueChange={(value) => setFormData({ ...formData, paper_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select paper type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectSearch
                    placeholder="Search papers..."
                    value={paperSearch}
                    onChange={(e) => setPaperSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  {papers
                    .filter((paper) => {
                      const searchLower = paperSearch.toLowerCase();
                      return (
                        paper.gsm.toString().includes(searchLower) ||
                        paper.bf.toString().toLowerCase().includes(searchLower) ||
                        paper.shade.toLowerCase().includes(searchLower)
                      );
                    })
                    .sort((a, b) => a.gsm - b.gsm)
                    .map((paper) => (
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reel_no">Reel Number</Label>
              <Input
                id="reel_no"
                value={formData.reel_no}
                onChange={(e) => setFormData({ ...formData, reel_no: e.target.value })}
                placeholder="e.g., R001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getStatusOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., WASTE_STORAGE, WAREHOUSE_A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this stock item..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Stock Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}