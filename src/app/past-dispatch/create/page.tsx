"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Loader2, 
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  Truck,
  Package,
  User,
  Calendar,
  FileText,
  Settings
} from "lucide-react";
import Link from "next/link";

interface DropdownOptions {
  client_names: string[];
  paper_specs: string[];
  statuses: string[];
  payment_types: string[];
}

interface DispatchItem {
  frontend_id: string;
  width_inches: string;
  weight_kg: string;
  rate: string;
  paper_spec: string;
}

interface DispatchRecord {
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  payment_type: string;
  dispatch_date: string;
  dispatch_number: string;
  client_name: string;
  status: string;
}

export default function CreatePastDispatchPage() {
  const router = useRouter();
  
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions>({
    client_names: [],
    paper_specs: [],
    statuses: [],
    payment_types: []
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDispatchDetailsModal, setShowDispatchDetailsModal] = useState(false);
  
  // Dispatch Record State
  const [dispatchRecord, setDispatchRecord] = useState<DispatchRecord>({
    vehicle_number: "",
    driver_name: "",
    driver_mobile: "",
    payment_type: "bill",
    dispatch_date: new Date().toISOString().split('T')[0],
    dispatch_number: "",
    client_name: "",
    status: "dispatched"
  });
  
  // Dispatch Items State
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>([
    {
      frontend_id: "",
      width_inches: "",
      weight_kg: "",
      rate: "",
      paper_spec: ""
    }
  ]);

  useEffect(() => {
    loadDropdownOptions();
  }, []);

  const loadDropdownOptions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${MASTER_ENDPOINTS.BASE}/past-dispatch/dropdowns`, createRequestOptions('GET'));
      if (response.ok) {
        const data = await response.json();
        setDropdownOptions(data);
      }
    } catch (err) {
      console.error('Error loading dropdown options:', err);
      toast.error('Failed to load dropdown options');
    } finally {
      setLoading(false);
    }
  };

  const addDispatchItem = () => {
    // Get the last item for prefilling
    const lastItem = dispatchItems[dispatchItems.length - 1];
    
    // Function to increment frontend_id
    const getIncrementedFrontendId = (lastFrontendId: string): string => {
      if (!lastFrontendId.trim()) return "";
      
      // Extract number from the end of the string (e.g., "ABC123" -> 123)
      const match = lastFrontendId.match(/^(.*)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const number = parseInt(match[2]);
        return `${prefix}${number + 1}`;
      } else {
        // If no number found, append "1" to the string
        return `${lastFrontendId}1`;
      }
    };
    
    setDispatchItems([
      ...dispatchItems,
      {
        frontend_id: getIncrementedFrontendId(lastItem.frontend_id),
        width_inches: "",
        weight_kg: "",
        rate: lastItem.rate, // Copy rate from last item
        paper_spec: lastItem.paper_spec // Copy paper_spec from last item
      }
    ]);
  };

  const removeDispatchItem = (index: number) => {
    if (dispatchItems.length > 1) {
      const newItems = dispatchItems.filter((_, i) => i !== index);
      setDispatchItems(newItems);
    }
  };

  const updateDispatchItem = (index: number, field: keyof DispatchItem, value: string) => {
    const newItems = [...dispatchItems];
    newItems[index][field] = value;
    setDispatchItems(newItems);
  };

  const updateDispatchRecord = (field: keyof DispatchRecord, value: string) => {
    setDispatchRecord({
      ...dispatchRecord,
      [field]: value
    });
  };

  const isDispatchRecordComplete = () => {
    return dispatchRecord.vehicle_number.trim() &&
           dispatchRecord.driver_name.trim() &&
           dispatchRecord.driver_mobile.trim() &&
           dispatchRecord.dispatch_number.trim() &&
           dispatchRecord.client_name.trim();
  };

  const validateForm = () => {
    // Validate dispatch record
    if (!dispatchRecord.vehicle_number.trim()) {
      toast.error("Vehicle number is required");
      return false;
    }
    if (!dispatchRecord.driver_name.trim()) {
      toast.error("Driver name is required");
      return false;
    }
    if (!dispatchRecord.driver_mobile.trim()) {
      toast.error("Driver mobile is required");
      return false;
    }
    if (!dispatchRecord.dispatch_number.trim()) {
      toast.error("Dispatch number is required");
      return false;
    }
    if (!dispatchRecord.client_name.trim()) {
      toast.error("Client name is required");
      return false;
    }

    // Validate dispatch items
    for (let i = 0; i < dispatchItems.length; i++) {
      const item = dispatchItems[i];
      if (!item.width_inches.trim() || isNaN(parseFloat(item.width_inches))) {
        toast.error(`Valid width is required for item ${i + 1}`);
        return false;
      }
      if (!item.weight_kg.trim() || isNaN(parseFloat(item.weight_kg))) {
        toast.error(`Valid weight is required for item ${i + 1}`);
        return false;
      }
      if (!item.paper_spec.trim()) {
        toast.error(`Paper specification is required for item ${i + 1}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = {
        dispatch_record: dispatchRecord,
        items: dispatchItems
      };

      const response = await fetch(`${MASTER_ENDPOINTS.BASE}/past-dispatch`, createRequestOptions('POST', payload));
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create past dispatch record');
      }

      const result = await response.json();
      
      toast.success('Past dispatch record created successfully!');
      router.push('/past-dispatch');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create past dispatch record';
      toast.error(errorMessage);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/past-dispatch">
              <Button variant="ghost">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Past Dispatches
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Truck className="w-8 h-8 text-primary" />
                Create Past Dispatch Record
              </h1>
              <p className="text-muted-foreground mt-1">
                Add dispatch items first, then fill dispatch details
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={showDispatchDetailsModal} onOpenChange={setShowDispatchDetailsModal}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Dispatch Details
                  {isDispatchRecordComplete() && (
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Dispatch Record Details</DialogTitle>
                  <DialogDescription>
                    Fill in the dispatch record information
                  </DialogDescription>
                </DialogHeader>
                
                {/* Dispatch Record Form in Modal */}
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dispatch-number">Packing Slip Number *</Label>
                      <Input
                        id="dispatch-number"
                        value={dispatchRecord.dispatch_number}
                        onChange={(e) => updateDispatchRecord('dispatch_number', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="dispatch-date">Date of Production *</Label>
                      <Input
                        id="dispatch-date"
                        type="date"
                        value={dispatchRecord.dispatch_date}
                        onChange={(e) => updateDispatchRecord('dispatch_date', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="client-name">Client Name *</Label>
                      <Select value={dispatchRecord.client_name} onValueChange={(value) => updateDispatchRecord('client_name', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          {dropdownOptions.client_names.map(client => (
                            <SelectItem key={client} value={client}>{client}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="payment-type">Payment Type *</Label>
                      <Select value={dispatchRecord.payment_type} onValueChange={(value) => updateDispatchRecord('payment_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment type" />
                        </SelectTrigger>
                        <SelectContent>
                          {dropdownOptions.payment_types.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="status">Status *</Label>
                      <Select value={dispatchRecord.status} onValueChange={(value) => updateDispatchRecord('status', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {dropdownOptions.statuses.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Transport Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vehicle-number">Vehicle Number *</Label>
                        <Input
                          id="vehicle-number"
                          placeholder="Enter vehicle number"
                          value={dispatchRecord.vehicle_number}
                          onChange={(e) => updateDispatchRecord('vehicle_number', e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="driver-name">Driver Name *</Label>
                        <Input
                          id="driver-name"
                          placeholder="Enter driver name"
                          value={dispatchRecord.driver_name}
                          onChange={(e) => updateDispatchRecord('driver_name', e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="driver-mobile">Driver Mobile *</Label>
                        <Input
                          id="driver-mobile"
                          placeholder="Enter driver mobile"
                          value={dispatchRecord.driver_mobile}
                          onChange={(e) => updateDispatchRecord('driver_mobile', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button onClick={() => setShowDispatchDetailsModal(false)}>
                      Done
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button 
              onClick={handleSubmit} 
              disabled={saving || !isDispatchRecordComplete()}
              className="flex items-center gap-2"
              title={!isDispatchRecordComplete() ? "Please fill dispatch details first" : ""}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Dispatch Record'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading form options...</p>
            </div>
          </div>
          ) : (
          <div className="space-y-6">
            {/* Status Indicator */}
            
            
            {/* Dispatch Items */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Dispatch Items ({dispatchItems.length})
                  </CardTitle>
                  <CardDescription>Add the items that were dispatched</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {dispatchItems.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Item {index + 1}</h4>
                        {dispatchItems.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDispatchItem(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="space-y-2">
                          <Label>Paper Specification *</Label>
                          <Select value={item.paper_spec} onValueChange={(value) => updateDispatchItem(index, 'paper_spec', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select paper spec" />
                            </SelectTrigger>
                            <SelectContent>
                              {dropdownOptions.paper_specs.map(spec => (
                                <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Reel No.</Label>
                          <Input
                            value={item.frontend_id}
                            onChange={(e) => updateDispatchItem(index, 'frontend_id', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Width (inches) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.width_inches}
                            onChange={(e) => updateDispatchItem(index, 'width_inches', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Weight (kg) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.weight_kg}
                            onChange={(e) => updateDispatchItem(index, 'weight_kg', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Rate (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => updateDispatchItem(index, 'rate', e.target.value)}
                            placeholder="Enter rate"
                          />
                        </div>
                        
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Fill Details Button - Below Dispatch Items */}
            

            {/* Action Buttons */}
            <div className="flex justify-end gap-4">
              {!isDispatchRecordComplete() && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowDispatchDetailsModal(true)}
                  className="flex items-center gap-2 "
                >
                  <Settings className="h-5 w-5" />
                  Fill Dispatch Details
                </Button>
            )}
              <Button onClick={addDispatchItem} variant="outline" disabled={saving}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
              <Link href="/past-dispatch">
                <Button variant="outline" disabled={saving}>
                  Cancel
                </Button>
              </Link>
              <Button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Create Past Dispatch Record'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}