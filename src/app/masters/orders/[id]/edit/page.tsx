"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  fetchOrder,
  fetchClients,
  fetchPapers,
  updateOrder,
  CreateOrderItemData,
  calculateQuantityKg,
  calculateQuantityRolls,
  calculateAmount,
  Order,
} from "@/lib/orders";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Plus,
  X,
  Edit,
} from "lucide-react";
import OTPVerificationModal from "@/components/OTPVerificationModal";

// Extend Window interface to include our temporary storage
declare global {
  interface Window {
    validatedOrderData?: any;
  }
}

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  // State for form data
  const [clients, setClients] = useState<
    { id: string; company_name: string }[]
  >([]);
  const [papers, setPapers] = useState<
    { id: string; name: string; gsm: number; bf: number; shade: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showOTPModal, setShowOTPModal] = useState(false);

  // Search state for selects
  const [clientSearch, setClientSearch] = useState("");
  const [paperSearches, setPaperSearches] = useState<Record<number, string>>({});

  // Form state
  const [formData, setFormData] = useState({
    client_id: "",
    priority: "normal" as any,
    payment_type: "bill" as any,
    delivery_date: "",
  });

  const [orderItems, setOrderItems] = useState<CreateOrderItemData[]>([
    {
      paper_id: "",
      width_inches: 0,
      quantity_rolls: 0,
      quantity_kg: 0,
      rate: 0.0,
      amount: 0.0,
    },
  ]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load clients and papers
        const [clientsData, papersData, orderData] = await Promise.all([
          fetchClients(),
          fetchPapers(),
          fetchOrder(orderId),
        ]);

        setClients(clientsData);
        setPapers(papersData);

        // Check if order can be edited
        if (orderData.status !== "created") {
          setError(`Cannot edit order with status "${orderData.status}". Only orders with status "created" can be edited.`);
          return;
        }

        // Populate form with existing order data
        setFormData({
          client_id: orderData.client_id,
          priority: orderData.priority as any,
          payment_type: orderData.payment_type as any,
          delivery_date: orderData.delivery_date ? orderData.delivery_date.split('T')[0] : "",
        });

        // Populate order items
        setOrderItems(
          orderData.order_items.map((item:any) => ({
            paper_id: item.paper_id,
            width_inches: item.width_inches,
            quantity_rolls: item.quantity_rolls || 0,
            quantity_kg: item.quantity_kg || 0,
            rate: item.rate,
            amount: item.amount || 0,
          }))
        );

      } catch (error) {
        console.error("Error loading order data:", error);
        setError("Failed to load order data");
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      loadData();
    }
  }, [orderId]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleOrderItemChange = (
  index: number,
  field: keyof CreateOrderItemData,
  value: any
) => {
  setOrderItems((prev) => {
    const updated: any = [...prev];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate related fields when certain values change
    if (field === "paper_id") {
      const paper = papers.find((p) => p.id === value);
      if (paper) {
        // Recalculate weight when paper changes (GSM changes) if we have rolls and width
        const existingRolls = updated[index].quantity_rolls;
        const existingWidth = updated[index].width_inches;
        const existingRate = updated[index].rate;
        
        if (existingRolls > 0 && existingWidth > 0) {
          updated[index].quantity_kg = calculateQuantityKg(
            existingWidth,
            existingRolls,
            paper.gsm
          );
          if (existingRate > 0) {
            updated[index].amount = calculateAmount(
              updated[index].quantity_kg,
              existingRate
            );
          }
        } else {
          // Reset calculations when paper changes and no existing data
          updated[index].quantity_kg = 0;
          updated[index].quantity_rolls = 0;
          updated[index].amount = 0;
        }
      }
    } else if (field === "quantity_rolls") {
      const paper = papers.find((p) => p.id === updated[index].paper_id);
      if (paper && updated[index].quantity_rolls > 0 && updated[index].width_inches > 0) {
        updated[index].quantity_kg = calculateQuantityKg(
          updated[index].width_inches,
          updated[index].quantity_rolls,
          paper.gsm
        );
        updated[index].amount = calculateAmount(
          updated[index].quantity_kg,
          updated[index].rate
        );
      }
    } else if (field === "quantity_kg") {
      const paper = papers.find((p) => p.id === updated[index].paper_id);
      if (paper && updated[index].quantity_kg > 0 && updated[index].width_inches > 0) {
        updated[index].quantity_rolls = calculateQuantityRolls(
          updated[index].width_inches,
          updated[index].quantity_kg,
          paper.gsm
        );
        updated[index].amount = calculateAmount(
          updated[index].quantity_kg,
          updated[index].rate
        );
      }
    } else if (field === "width_inches") {
      const paper = papers.find((p) => p.id === updated[index].paper_id);
      if (paper && updated[index].quantity_kg > 0 && updated[index].width_inches > 0) {
        updated[index].quantity_rolls = calculateQuantityRolls(
          updated[index].width_inches,
          updated[index].quantity_kg,
          paper.gsm
        );
        updated[index].amount = calculateAmount(
          updated[index].quantity_kg,
          updated[index].rate
        );
      }
    } else if (field === "rate") {
      updated[index].amount = calculateAmount(
        updated[index].quantity_kg,
        Number(value)
      );
    }

    return updated;
  });
};

  const addOrderItem = () => {
    setOrderItems((prev) => [
      ...prev,
      {
        paper_id: "",
        width_inches: 0,
        quantity_rolls: 0,
        quantity_kg: 0,
        rate: 0.0,
        amount: 0.0,
      },
    ]);
  };

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      // Validate form
      if (!formData.client_id) {
        throw new Error("Please select a client");
      }

      // Validate order items
      for (let i = 0; i < orderItems.length; i++) {
        const item = orderItems[i];
        if (!item.paper_id) {
          throw new Error(`Please select paper for item ${i + 1}`);
        }
        if (item.width_inches <= 0) {
          throw new Error(`Please enter width for item ${i + 1}`);
        }
        if (item.quantity_rolls! <= 0 && item.quantity_kg! <= 0) {
          throw new Error(`Please enter quantity for item ${i + 1}`);
        }
        if (item.rate <= 0) {
          throw new Error(`Please enter rate for item ${i + 1}`);
        }
      }

      // Store order data for later use after OTP verification
      const orderData: any = {
        priority: formData.priority,
        payment_type: formData.payment_type,
        delivery_date: formData.delivery_date
          ? new Date(formData.delivery_date).toISOString()
          : null, // Backend expects ISO datetime string
        order_items: orderItems.map((item: any) => ({
          paper_id: item.paper_id,
          width_inches: parseFloat(String(item.width_inches)), // Backend expects float
          quantity_rolls: item.quantity_rolls ? parseInt(String(item.quantity_rolls)) : undefined, // Backend expects int or null
          quantity_kg: item.quantity_kg ? parseFloat(String(item.quantity_kg)) : undefined, // Backend expects float or null
          rate: parseFloat(String(item.rate)), // Backend expects float
          amount: item.amount ? parseFloat(String(item.amount)) : undefined, // Backend expects float or null
        })),
        edited_by_id: localStorage.getItem("user_id"), // Replace with actual current user ID from auth context/session
      };

      console.log("Validated order update data:", JSON.stringify(orderData, null, 2));

      // Store order data temporarily and show OTP verification
      window.validatedOrderData = orderData;
      setShowOTPModal(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update order";
      setError(errorMessage);
      toast.error(errorMessage);
      setSubmitting(false);
    }
  };

  const handleOTPVerified = async () => {
    try {
      const orderData = (window as any).validatedOrderData;

      if (!orderData) {
        throw new Error("Order data not found. Please try again.");
      }

      console.log("Sending order update data after OTP verification:", JSON.stringify(orderData, null, 2));

      // Call the update API using the updateOrder function
      await updateOrder(orderId, orderData);

      setSuccess("Order updated successfully!");
      toast.success("Order updated successfully!");
      setShowOTPModal(false);

      // Clear temporary data
      delete (window as any).validatedOrderData;

      // Redirect back to orders list after a delay
      setTimeout(() => {
        router.push("/masters/orders");
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update order";
      setError(errorMessage);
      toast.error(errorMessage);
      setShowOTPModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOTPCancel = () => {
    setShowOTPModal(false);
    setSubmitting(false);
    // Clear temporary data
    delete (window as any).validatedOrderData;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2 text-sm text-muted-foreground">Loading order data...</p>
        </div>
      </div>
    );
  }

  if (error && !formData.client_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Cannot Edit Order
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push("/masters/orders")} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 m-8">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Edit Order</h1>
      </div>

      {/* Alert Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="default">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
          <CardDescription>Update the details for this order</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Order Header - Single Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Client Selection */}
              <div className="space-y-2">
                <Label htmlFor="client_id">Client *</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => handleInputChange("client_id", value)}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectSearch
                      placeholder="Search clients..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    {clients
                      .filter((client) =>
                        client.company_name
                          .toLowerCase()
                          .includes(clientSearch.toLowerCase())
                      )
                      .sort((a, b) => a.company_name.localeCompare(b.company_name))
                      .map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.company_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Type */}
              <div className="space-y-2">
                <Label htmlFor="payment_type">Bill/Cash *</Label>
                <Select
                  value={formData.payment_type}
                  onValueChange={(value: any) => handleInputChange("payment_type", value)}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bill">Bill</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Delivery Date */}
              <div className="space-y-2">
                <Label htmlFor="delivery_date">Delivery Date</Label>
                <Input
                  id="delivery_date"
                  name="delivery_date"
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => handleInputChange("delivery_date", e.target.value)}
                  disabled={submitting}
                />
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: any) => handleInputChange("priority", value)}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Order Items Section */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Order Items *</Label>

              <div className="space-y-4">
              {orderItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-end gap-3">
                    {/* Item Number */}
                    <div className="flex-shrink-0 w-12">
                      <Label className="text-sm font-medium">Item</Label>
                      <div className="flex items-center justify-center mt-2">
                        <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded">#{index + 1}</span>
                      </div>
                    </div>

                    {/* Paper - Wider field */}
                    <div className="flex-1 min-w-0 max-w-96">
                      <Label htmlFor={`paper_${index}`}>Paper Type *</Label>
                      <Select
                        value={item.paper_id}
                        onValueChange={(value) =>
                          handleOrderItemChange(index, "paper_id", value)
                        }
                        disabled={submitting}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectSearch
                            placeholder="Search papers..."
                            value={paperSearches[index] || ""}
                            onChange={(e) =>
                              setPaperSearches((prev) => ({
                                ...prev,
                                [index]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                          {papers
                            .filter((paper) => {
                              const search = (paperSearches[index] || "").toLowerCase();
                              return (
                                paper.gsm.toString().includes(search) ||
                                paper.bf.toString().toLowerCase().includes(search) ||
                                paper.shade.toLowerCase().includes(search)
                              );
                            })
                            .sort((a, b) => a.gsm - b.gsm)
                            .map((paper) => (
                              <SelectItem key={paper.id} value={paper.id}>
                                {paper.name} ({paper.gsm}gsm, {paper.bf}bf, {paper.shade})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Width */}
                    <div className="flex-shrink-0 ">
                      <Label htmlFor={`width_${index}`}>Width *</Label>
                      <Input
                        id={`width_${index}`}
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                        value={item.width_inches || ""}
                        onChange={(e) =>
                          handleOrderItemChange(index, "width_inches", e.target.value === "" ? 0 : Number(e.target.value))
                        }
                        placeholder="Inches"
                        disabled={submitting}
                        className="mt-2"
                      />
                    </div>

                    

                    {/* Quantity Rolls */}
                    <div className="flex-shrink-0 ">
                      <Label htmlFor={`quantity_rolls_${index}`}>Rolls</Label>
                      <Input
                        id={`quantity_rolls_${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={item.quantity_rolls || ""}
                        onChange={(e) =>
                          handleOrderItemChange(index, "quantity_rolls", e.target.value === "" ? 0 : Number(e.target.value))
                        }
                        placeholder="Number"
                        disabled={submitting}
                        className="mt-2"
                      />
                    </div>

                    {/* Quantity Kg */}
                    <div className="flex-shrink-0 ">
                      <Label htmlFor={`quantity_kg_${index}`}>Weight (Kg)</Label>
                      <Input
                        id={`quantity_kg_${index}`}
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                        value={item.quantity_kg || ""}
                        onChange={(e) =>
                          handleOrderItemChange(index, "quantity_kg", e.target.value === "" ? 0 : Number(e.target.value))
                        }
                        placeholder="Weight"
                        disabled={submitting}
                        className="mt-2"
                      />
                    </div>

                    {/* Rate */}
                    <div className="flex-shrink-0">
                      <Label htmlFor={`rate_${index}`}>Rate *</Label>
                      <Input
                        id={`rate_${index}`}
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                        value={item.rate || ""}
                        onChange={(e) =>
                          handleOrderItemChange(index, "rate", e.target.value === "" ? 0 : Number(e.target.value))
                        }
                        placeholder="Per kg"
                        disabled={submitting}
                        className="mt-2"
                      />
                    </div>

                    {/* Amount */}
                    <div className="flex-shrink-0">
                      <Label htmlFor={`amount_${index}`}>Amount</Label>
                      <Input
                        id={`amount_${index}`}
                        type="text"
                        value={item.amount?.toFixed(2) || "0.00"}
                        disabled
                        className="bg-gray-50 mt-2"
                      />
                    </div>

                    {/* Remove Button at the very end */}
                    <div className="flex-shrink-0">
                      <Label className="text-sm font-medium opacity-0">Remove</Label>
                      <div className="mt-2">
                        {orderItems.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOrderItem(index)}
                            disabled={submitting}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        ) : (
                          <div className="h-8 w-8"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>

            
              

<div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={addOrderItem}
                disabled={submitting}
                className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/masters/orders")}
                  disabled={submitting}
                  className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Order
                </Button>
              </div>
          
          </form>
        </CardContent>
      </Card>

    {/* OTP Verification Modal */}
    <OTPVerificationModal
      open={showOTPModal}
      onOpenChange={setShowOTPModal}
      title="Admin Verification Required for Order Update"
      description="This order update operation requires admin verification. Please ask an administrator to provide their OTP code."
      onVerified={handleOTPVerified}
      onCancel={handleOTPCancel}
    />
    </div>
  );
}