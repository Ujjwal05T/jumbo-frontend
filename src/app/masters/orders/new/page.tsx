"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createOrder, fetchClients, fetchPapers, CreateOrderItemData, CreateOrderData, calculateQuantityKg, calculateQuantityRolls, calculateAmount } from "@/lib/orders";
import { Loader2, ArrowLeft, AlertCircle, CheckCircle2, Plus, X } from "lucide-react";

export default function NewOrderPage() {
  const router = useRouter();
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
  const [papers, setPapers] = useState<{ id: string; name: string; gsm: number; bf: number; shade: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [formData, setFormData] = useState({
    client_id: "",
    payment_type: "bill",
    min_length: "1500",
    priority: "normal",
    delivery_date: "",
    notes: ""
  });

  const [orderItems, setOrderItems] = useState<CreateOrderItemData[]>([{
    paper_id: "",
    width_inches: "",
    quantity_rolls: "",
    quantity_kg: "",
    rate: "",
    amount: ""
  }]);

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
          type: 'error',
          message: 'Failed to load clients and papers. Please try again.'
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
        type: 'error',
        message: 'Please select a client.'
      });
      return;
    }

    // Validate order items
    if (orderItems.length === 0) {
      setAlert({
        type: 'error',
        message: 'Please add at least one order item.'
      });
      return;
    }

    for (let i = 0; i < orderItems.length; i++) {
      const item = orderItems[i];
      if (!item.paper_id || !item.width_inches || !item.rate) {
        setAlert({
          type: 'error',
          message: `Please fill in paper type, width, and rate for order item ${i + 1}.`
        });
        return;
      }
      if ((!item.quantity_rolls || item.quantity_rolls === '') && (!item.quantity_kg || item.quantity_kg === '')) {
        setAlert({
          type: 'error',
          message: `Please specify either quantity in rolls or weight in kg for order item ${i + 1}.`
        });
        return;
      }
      // Validate numeric values
      if (isNaN(parseFloat(item.width_inches as string)) || parseFloat(item.width_inches as string) <= 0) {
        setAlert({
          type: 'error',
          message: `Please enter a valid width for order item ${i + 1}.`
        });
        return;
      }
      if (isNaN(parseFloat(item.rate as string)) || parseFloat(item.rate as string) <= 0) {
        setAlert({
          type: 'error',
          message: `Please enter a valid rate for order item ${i + 1}.`
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
      const cleanOrderItems = orderItems.map(item => {
        const cleanItem: CreateOrderItemData = {
          paper_id: item.paper_id,
          width_inches: parseFloat(item.width_inches as string),
          rate: parseFloat(item.rate as string)
        };
        
        // Only include quantity fields if they have values
        if (item.quantity_rolls && item.quantity_rolls !== '') {
          cleanItem.quantity_rolls = parseInt(item.quantity_rolls as string, 10);
        }
        if (item.quantity_kg && item.quantity_kg !== '') {
          cleanItem.quantity_kg = parseFloat(item.quantity_kg as string);
        }
        if (item.amount && item.amount !== '') {
          cleanItem.amount = parseFloat(item.amount as string);
        }
        
        return cleanItem;
      });
      
      const orderData: CreateOrderData = {
        client_id: formData.client_id,
        priority: formData.priority as "low" | "normal" | "high" | "urgent",
        payment_type: formData.payment_type as "bill" | "cash",
        delivery_date: formData.delivery_date ? new Date(formData.delivery_date).toISOString() : undefined,
        notes: formData.notes || undefined,
        created_by_id: user_id,
        order_items: cleanOrderItems
      };

      console.log('Sending order data:', JSON.stringify(orderData, null, 2));
      await createOrder(orderData);
      
      setAlert({
        type: 'success',
        message: 'Order created successfully! Redirecting...'
      });
      
      // Redirect after a short delay to show success message
      setTimeout(() => {
        router.push("/masters/orders");
      }, 1500);
      
    } catch (error) {
      console.error("Error creating order:", error);
      setAlert({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create order. Please try again.'
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
    setOrderItems(prev => [...prev, {
      paper_id: "",
      width_inches: "",
      quantity_rolls: "",
      quantity_kg: "",
      rate: "",
      amount: ""
    }]);
  };

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateOrderItem = (index: number, field: keyof CreateOrderItemData, value: string) => {
    setOrderItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        
        // Auto-calculate based on which field was changed
        const widthInches = parseFloat(updatedItem.width_inches as string) || 0;
        const rate = parseFloat(updatedItem.rate as string) || 0;
        
        if (field === 'quantity_rolls' && value && widthInches) {
          const quantityRolls = parseInt(value, 10);
          updatedItem.quantity_kg = calculateQuantityKg(widthInches, quantityRolls).toString();
          if (rate) {
            updatedItem.amount = calculateAmount(parseFloat(updatedItem.quantity_kg as string), rate).toFixed(2);
          }
        } else if (field === 'quantity_kg' && value && widthInches) {
          const quantityKg = parseFloat(value);
          updatedItem.quantity_rolls = calculateQuantityRolls(widthInches, quantityKg).toString();
          if (rate) {
            updatedItem.amount = calculateAmount(quantityKg, rate).toFixed(2);
          }
        } else if (field === 'width_inches' && value) {
          const quantityRolls = parseInt(updatedItem.quantity_rolls as string, 10) || 0;
          if (quantityRolls) {
            updatedItem.quantity_kg = calculateQuantityKg(widthInches, quantityRolls).toString();
            if (rate) {
              updatedItem.amount = calculateAmount(parseFloat(updatedItem.quantity_kg as string), rate).toFixed(2);
            }
          }
        } else if (field === 'rate' && value) {
          const quantityKg = parseFloat(updatedItem.quantity_kg as string) || 0;
          if (quantityKg) {
            updatedItem.amount = calculateAmount(quantityKg, parseFloat(value)).toFixed(2);
          }
        }
        
        return updatedItem;
      }
      return item;
    }));
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
        <Alert variant={alert.type === 'error' ? 'destructive' : 'default'}>
          {alert.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertTitle>{alert.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
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
                  onValueChange={(value) => handleSelectChange("client_id", value)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
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
                <Label htmlFor="payment_type">Payment *</Label>
                <Select
                  value={formData.payment_type}
                  onValueChange={(value) => handleSelectChange("payment_type", value)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Payment type" />
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
                  onValueChange={(value) => handleSelectChange("priority", value)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
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

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Optional notes for this order"
                disabled={loading}
              />
            </div>

            {/* Order Items Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Order Items *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOrderItem}
                  disabled={loading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
              
              <div className="space-y-4">
                {orderItems.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm text-gray-700">Item #{index + 1}</h4>
                      {orderItems.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeOrderItem(index)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                    
                    {/* Paper Selection - Full Width */}
                    <div className="space-y-2">
                      <Label htmlFor={`paper_${index}`}>Paper Type *</Label>
                      <Select
                        value={item.paper_id}
                        onValueChange={(value) => updateOrderItem(index, "paper_id", value)}
                        disabled={loading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select paper type" />
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
                    
                    {/* Quantity and Pricing - Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`width_${index}`}>Width (in) *</Label>
                        <Input
                          id={`width_${index}`}
                          type="number"
                          value={item.width_inches}
                          onChange={(e) => updateOrderItem(index, "width_inches", e.target.value)}
                          placeholder="42"
                          disabled={loading}
                          min="1"
                          step="0.01"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`quantity_rolls_${index}`}>Rolls</Label>
                        <Input
                          id={`quantity_rolls_${index}`}
                          type="number"
                          value={item.quantity_rolls}
                          onChange={(e) => updateOrderItem(index, "quantity_rolls", e.target.value)}
                          placeholder="6"
                          disabled={loading}
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`quantity_kg_${index}`}>Weight (kg)</Label>
                        <Input
                          id={`quantity_kg_${index}`}
                          type="number"
                          value={item.quantity_kg}
                          onChange={(e) => updateOrderItem(index, "quantity_kg", e.target.value)}
                          placeholder="Auto-calc"
                          disabled={loading}
                          min="0.01"
                          step="0.01"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`rate_${index}`}>Rate *</Label>
                        <Input
                          id={`rate_${index}`}
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateOrderItem(index, "rate", e.target.value)}
                          placeholder="100.00"
                          disabled={loading}
                          min="0.01"
                          step="0.01"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`amount_${index}`}>Amount</Label>
                        <Input
                          id={`amount_${index}`}
                          type="text"
                          value={item.amount}
                          placeholder="Auto-calc"
                          disabled
                          className="bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/masters/orders")}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Order
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}