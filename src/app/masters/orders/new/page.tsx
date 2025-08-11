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
  createOrder,
  fetchClients,
  fetchPapers,
  CreateOrderItemData,
  CreateOrderData,
  calculateQuantityKg,
  calculateQuantityRolls,
  calculateAmount,
  Order,
} from "@/lib/orders";
import { generateOrderPDF } from "@/lib/order-pdf-utils";
import { toast } from "sonner";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import {
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";

export default function NewOrderPage() {
  const router = useRouter();
  const [clients, setClients] = useState<
    { id: string; company_name: string }[]
  >([]);
  const [papers, setPapers] = useState<
    { id: string; name: string; gsm: number; bf: number; shade: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const [formData, setFormData] = useState({
    client_id: "",
    payment_type: "",
    min_length: "1500",
    priority: "normal",
    delivery_date: "",
  });

  const [orderItems, setOrderItems] = useState<CreateOrderItemData[]>([
    {
      paper_id: "",
      width_inches: "",
      quantity_rolls: "",
      quantity_kg: "",
      rate: "",
      amount: "",
    },
  ]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [clientsData, papersData] = await Promise.all([
          fetchClients(),
          fetchPapers(),
        ]);
        setClients(clientsData);
        setPapers(papersData);
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
    if (!formData.client_id) {
      setAlert({
        type: "error",
        message: "Please select a client.",
      });
      return;
    }

    // Validate order items
    if (orderItems.length === 0) {
      setAlert({
        type: "error",
        message: "Please add at least one order item.",
      });
      return;
    }

    for (let i = 0; i < orderItems.length; i++) {
      const item = orderItems[i];
      if (!item.paper_id || !item.width_inches || !item.rate) {
        setAlert({
          type: "error",
          message: `Please fill in paper type, width, and rate for order item ${
            i + 1
          }.`,
        });
        return;
      }
      if (
        (!item.quantity_rolls || item.quantity_rolls === "") &&
        (!item.quantity_kg || item.quantity_kg === "")
      ) {
        setAlert({
          type: "error",
          message: `Please specify either quantity in rolls or weight in kg for order item ${
            i + 1
          }.`,
        });
        return;
      }
      // Validate numeric values
      if (
        isNaN(parseFloat(item.width_inches as string)) ||
        parseFloat(item.width_inches as string) <= 0
      ) {
        setAlert({
          type: "error",
          message: `Please enter a valid width for order item ${i + 1}.`,
        });
        return;
      }
      if (
        isNaN(parseFloat(item.rate as string)) ||
        parseFloat(item.rate as string) <= 0
      ) {
        setAlert({
          type: "error",
          message: `Please enter a valid rate for order item ${i + 1}.`,
        });
        return;
      }
    }

    try {
      setLoading(true);
      const user_id = localStorage.getItem("user_id");
      if (!user_id) {
        throw new Error("User not authenticated");
      }

      // Clean up order items - remove empty strings and ensure proper types
      const cleanOrderItems = orderItems.map((item) => {
        const cleanItem: CreateOrderItemData = {
          paper_id: item.paper_id,
          width_inches: parseFloat(String(item.width_inches)), // Backend expects float
          rate: parseFloat(String(item.rate)),
        };

        // Only include quantity fields if they have values
        if (item.quantity_rolls && item.quantity_rolls !== "") {
          cleanItem.quantity_rolls = parseInt(String(item.quantity_rolls));
        }
        if (item.quantity_kg && item.quantity_kg !== "") {
          cleanItem.quantity_kg = parseFloat(String(item.quantity_kg));
        }
        if (item.amount && item.amount !== "") {
          cleanItem.amount = parseFloat(String(item.amount));
        }

        return cleanItem;
      });

      const orderData: CreateOrderData = {
        client_id: formData.client_id,
        priority: formData.priority as "low" | "normal" | "high" | "urgent",
        payment_type: formData.payment_type as "bill" | "cash",
        delivery_date: formData.delivery_date
          ? new Date(formData.delivery_date).toISOString()
          : undefined,
        created_by_id: user_id,
        order_items: cleanOrderItems,
      };

      console.log("Sending order data:", JSON.stringify(orderData, null, 2));
      const createdOrder: Order = await createOrder(orderData);

      setAlert({
        type: "success",
        message: "Order created successfully! Downloading PDF...",
      });

      // Auto-download PDF after successful creation
      try {
        // Need to fetch the complete order details including client info for PDF
        const response = await fetch(`${MASTER_ENDPOINTS.ORDERS}/${createdOrder.id}`, createRequestOptions('GET'));
        if (response.ok) {
          const orderWithDetails = await response.json();
          
          // Generate and download PDF automatically
          generateOrderPDF(orderWithDetails, true);
          toast.success('Order created and PDF downloaded successfully!');
        } else {
          // Fallback - create PDF with available data
          const pdfData:any = {
            ...createdOrder,
            client: clients.find(c => c.id === formData.client_id),
            order_items: cleanOrderItems.map((item, index) => ({
              ...item,
              paper: papers.find(p => p.id === item.paper_id)
            }))
          };
          generateOrderPDF(pdfData, true);
          toast.success('Order created and PDF downloaded successfully!');
        }
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError);
        toast.error('Order created but PDF generation failed');
      }

      // Redirect after a short delay to show success message and allow PDF download
      setTimeout(() => {
        router.push("/masters/orders");
      }, 2000);
    } catch (error) {
      console.error("Error creating order:", error);
      setAlert({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create order. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addOrderItem = () => {
    setOrderItems((prev) => {
      // Get the last item to copy paper_id and rate
      const lastItem = prev[prev.length - 1];
      return [
        ...prev,
        {
          paper_id: lastItem?.paper_id || "",
          width_inches: "",
          quantity_rolls: "",
          quantity_kg: "",
          rate: lastItem?.rate || "",
          amount: "",
        },
      ];
    });
  };

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleNumberInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
    field: keyof CreateOrderItemData
  ) => {
    const value = e.target.value;

    // Allow empty string, numbers, and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      updateOrderItem(index, field, value);
    }
  };

  const handleIntegerInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
    field: keyof CreateOrderItemData
  ) => {
    const value = e.target.value;

    // Allow empty string or positive integers only
    if (value === "" || /^\d+$/.test(value)) {
      updateOrderItem(index, field, value);
    }
  };

  const updateOrderItem = (
    index: number,
    field: keyof CreateOrderItemData,
    value: string
  ) => {
    setOrderItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };

          // Auto-calculate based on which field was changed
          const widthInches =
            parseFloat(updatedItem.width_inches as string) || 0;
          const rate = parseFloat(updatedItem.rate as string) || 0;

          if (field === "quantity_rolls" && value && widthInches) {
            const quantityRolls = parseInt(value, 10);
            updatedItem.quantity_kg = calculateQuantityKg(
              widthInches,
              quantityRolls
            ).toString();
            if (rate) {
              updatedItem.amount = calculateAmount(
                parseFloat(updatedItem.quantity_kg as string),
                rate
              ).toFixed(2);
            }
          } else if (field === "quantity_kg" && value && widthInches) {
            const quantityKg = parseFloat(value);
            updatedItem.quantity_rolls = calculateQuantityRolls(
              widthInches,
              quantityKg
            ).toString();
            if (rate) {
              updatedItem.amount = calculateAmount(quantityKg, rate).toFixed(2);
            }
          } else if (field === "width_inches" && value) {
            const quantityRolls =
              parseInt(updatedItem.quantity_rolls as string, 10) || 0;
            if (quantityRolls) {
              updatedItem.quantity_kg = calculateQuantityKg(
                widthInches,
                quantityRolls
              ).toString();
              if (rate) {
                updatedItem.amount = calculateAmount(
                  parseFloat(updatedItem.quantity_kg as string),
                  rate
                ).toFixed(2);
              }
            }
          } else if (field === "rate" && value) {
            const quantityKg =
              parseFloat(updatedItem.quantity_kg as string) || 0;
            if (quantityKg) {
              updatedItem.amount = calculateAmount(
                quantityKg,
                parseFloat(value)
              ).toFixed(2);
            }
          }

          return updatedItem;
        }
        return item;
      })
    );
  };

  return (
    <div className="space-y-6 m-8">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">New Order</h1>
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
          <CardTitle>Order Details</CardTitle>
          <CardDescription>Enter the details for the new order</CardDescription>
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
                  onValueChange={(value) =>
                    handleSelectChange("client_id", value)
                  }
                  disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
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
                  onValueChange={(value) =>
                    handleSelectChange("payment_type", value)
                  }
                  disabled={loading}>
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
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    handleSelectChange("priority", value)
                  }
                  disabled={loading}>
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
                            updateOrderItem(index, "paper_id", value)
                          }
                          disabled={loading}>
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {papers.map((paper) => (
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
                          value={item.width_inches}
                          onChange={(e) =>
                            handleNumberInput(e, index, "width_inches")
                          }
                          placeholder="Inches"
                          disabled={loading}
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
                          value={item.quantity_rolls}
                          onChange={(e) =>
                            handleIntegerInput(e, index, "quantity_rolls")
                          }
                          placeholder="Number"
                          disabled={loading}
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
                          value={item.quantity_kg}
                          onChange={(e) =>
                            handleNumberInput(e, index, "quantity_kg")
                          }
                          placeholder="Weight"
                          disabled={loading}
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
                          value={item.rate}
                          onChange={(e) => handleNumberInput(e, index, "rate")}
                          placeholder="Per kg"
                          disabled={loading}
                          className="mt-2"
                        />
                      </div>

                      {/* Amount */}
                      <div className="flex-shrink-0">
                        <Label htmlFor={`amount_${index}`}>Amount</Label>
                        <Input
                          id={`amount_${index}`}
                          type="text"
                          value={item.amount}
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
                              disabled={loading}
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
                disabled={loading}
                className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/masters/orders")}
                  disabled={loading}
                  className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Place Order
                </Button>
              </div>
          
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
