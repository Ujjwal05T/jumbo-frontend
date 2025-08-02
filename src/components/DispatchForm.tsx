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
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Truck,
  User,
  Phone,
  FileText,
  Calendar,
  Package,
  Weight,
  Building2,
  Loader2,
} from "lucide-react";
import { DISPATCH_ENDPOINTS } from "@/lib/api-config";

interface DispatchFormData {
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  payment_type: string;
  dispatch_number: string;
  reference_number: string;
  client_id: string;
  primary_order_id?: string;
}

interface SelectedItem {
  inventory_id: string;
  qr_code: string;
  barcode_id?: string;
  paper_spec: string;
  width_inches: number;
  weight_kg: number;
  location: string;
}

interface Client {
  id: string;
  company_name: string;
  contact_person: string;
  phone: string;
  address: string;
}

interface DispatchFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: SelectedItem[];
  onConfirmDispatch: (formData: DispatchFormData) => Promise<void>;
  loading?: boolean;
  preSelectedClient?: any;
  preSelectedOrder?: any;
}

export function DispatchForm({
  open,
  onOpenChange,
  selectedItems,
  onConfirmDispatch,
  loading = false,
  preSelectedClient,
  preSelectedOrder,
}: DispatchFormProps) {
  const [formData, setFormData] = useState<DispatchFormData>({
    vehicle_number: "",
    driver_name: "",
    driver_mobile: "",
    payment_type: "bill",
    dispatch_number: "",
    reference_number: "",
    client_id: "",
    primary_order_id: "",
  });
  
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Calculate totals
  const totalItems = selectedItems.length;
  const totalWeight = selectedItems.reduce((sum, item) => sum + item.weight_kg, 0);

  // Load clients on modal open and pre-fill if client is pre-selected
  useEffect(() => {
    if (open) {
      loadClients();
      generateDispatchNumber();
      resetForm();
      
      // Pre-fill client if provided
      if (preSelectedClient) {
        setFormData(prev => ({ 
          ...prev, 
          client_id: preSelectedClient.id,
          primary_order_id: preSelectedOrder?.id || ""
        }));
      }
    }
  }, [open, preSelectedClient, preSelectedOrder]);

  const loadClients = async () => {
    try {
      setLoadingClients(true);
      const response = await fetch(DISPATCH_ENDPOINTS.CLIENTS);
      if (!response.ok) throw new Error('Failed to load clients');
      const data = await response.json();
      setClients(data.clients || []);
    } catch (error) {
      toast.error('Failed to load clients');
      console.error('Error loading clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const generateDispatchNumber = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    const dispatchNumber = `DISP-${dateStr}-${timeStr}`;
    setFormData(prev => ({ ...prev, dispatch_number: dispatchNumber }));
  };

  const resetForm = () => {
    setFormData({
      vehicle_number: "",
      driver_name: "",
      driver_mobile: "",
      payment_type: "bill",
      dispatch_number: "",
      reference_number: "",
      client_id: "",
      primary_order_id: "",
    });
    setFormErrors({});
    generateDispatchNumber();
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.vehicle_number.trim()) {
      errors.vehicle_number = "Vehicle number is required";
    }
    
    if (!formData.driver_name.trim()) {
      errors.driver_name = "Driver name is required";
    }
    
    if (!formData.driver_mobile.trim()) {
      errors.driver_mobile = "Driver mobile is required";
    } else if (!/^\d{10}$/.test(formData.driver_mobile.replace(/\D/g, ''))) {
      errors.driver_mobile = "Please enter a valid 10-digit mobile number";
    }
    
    if (!formData.dispatch_number.trim()) {
      errors.dispatch_number = "Dispatch number is required";
    }
    
    if (!formData.client_id) {
      errors.client_id = "Please select a client";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    try {
      await onConfirmDispatch(formData);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in parent component
    }
  };

  const selectedClient = clients.find(c => c.id === formData.client_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-3 text-2xl font-semibold">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            Create Dispatch Record
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter vehicle and driver details to dispatch <span className="font-medium text-primary">{totalItems}</span> selected items
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <form id="dispatch-form" onSubmit={handleSubmit} className="space-y-6 py-4 max-w-4xl mx-auto">
            <div className="space-y-6">
              {/* Vehicle & Driver Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Vehicle & Driver Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vehicle_number">Vehicle Number *</Label>
                      <Input
                        id="vehicle_number"
                        placeholder="e.g., MH12AB1234"
                        value={formData.vehicle_number}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, vehicle_number: e.target.value }))
                        }
                        className={formErrors.vehicle_number ? "border-destructive" : ""}
                      />
                      {formErrors.vehicle_number && (
                        <p className="text-sm text-destructive">{formErrors.vehicle_number}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="driver_name">Driver Name *</Label>
                      <Input
                        id="driver_name"
                        placeholder="Full name"
                        value={formData.driver_name}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, driver_name: e.target.value }))
                        }
                        className={formErrors.driver_name ? "border-destructive" : ""}
                      />
                      {formErrors.driver_name && (
                        <p className="text-sm text-destructive">{formErrors.driver_name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="driver_mobile">Driver Mobile *</Label>
                      <Input
                        id="driver_mobile"
                        placeholder="10-digit mobile number"
                        value={formData.driver_mobile}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, driver_mobile: e.target.value }))
                        }
                        className={formErrors.driver_mobile ? "border-destructive" : ""}
                      />
                      {formErrors.driver_mobile && (
                        <p className="text-sm text-destructive">{formErrors.driver_mobile}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment & Reference */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Payment & Reference
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payment_type">Payment Type</Label>
                      <Select 
                        value={formData.payment_type} 
                        onValueChange={(value) =>
                          setFormData(prev => ({ ...prev, payment_type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bill">Bill Payment</SelectItem>
                          <SelectItem value="cash">Cash Payment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dispatch_number">Dispatch Number *</Label>
                      <Input
                        id="dispatch_number"
                        value={formData.dispatch_number}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, dispatch_number: e.target.value }))
                        }
                        className={`font-mono ${formErrors.dispatch_number ? "border-destructive" : ""}`}
                      />
                      {formErrors.dispatch_number && (
                        <p className="text-sm text-destructive">{formErrors.dispatch_number}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reference_number">Reference Number</Label>
                      <Input
                        id="reference_number"
                        placeholder="Optional external reference"
                        value={formData.reference_number}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, reference_number: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Client Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Client Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_id">Select Client *</Label>
                    <Select 
                      value={formData.client_id} 
                      onValueChange={(value) =>
                        setFormData(prev => ({ ...prev, client_id: value }))
                      }
                      disabled={loadingClients}
                    >
                      <SelectTrigger className={formErrors.client_id ? "border-destructive" : ""}>
                        <SelectValue placeholder={loadingClients ? "Loading clients..." : "Choose client"} />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3 w-3" />
                              {client.company_name} - {client.contact_person}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.client_id && (
                      <p className="text-sm text-destructive">{formErrors.client_id}</p>
                    )}
                  </div>

                  {selectedClient && (
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{selectedClient.company_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          {selectedClient.contact_person}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {selectedClient.phone}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {selectedClient.address}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              {/* Dispatch Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Dispatch Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="rounded-lg bg-primary/10 p-4">
                      <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <div className="text-2xl font-bold">{totalItems}</div>
                      <div className="text-sm text-muted-foreground">Total Items</div>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-4">
                      <Weight className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <div className="text-2xl font-bold">{totalWeight.toFixed(1)}</div>
                      <div className="text-sm text-muted-foreground">Weight (kg)</div>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-4">
                      <Calendar className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <div className="text-sm font-bold">{new Date().toLocaleDateString()}</div>
                      <div className="text-sm text-muted-foreground">Dispatch Date</div>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-4">
                      <div className="h-8 w-8 mx-auto mb-2 flex items-center justify-center">
                        <Badge variant="secondary" className="text-xs">Ready</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">Status</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </form>
        </div>

        <DialogFooter className="border-t pt-6">
          <div className="flex gap-3 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="dispatch-form"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Dispatch...
                </>
              ) : (
                <>
                  <Truck className="mr-2 h-4 w-4" />
                  Create Dispatch Record
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}