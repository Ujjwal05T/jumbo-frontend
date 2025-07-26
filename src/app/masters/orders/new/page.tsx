"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createOrder } from "@/lib/orders";
import { fetchClients } from "@/lib/orders";
import { fetchPapers } from "@/lib/papers";
import { Loader2, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";

export default function NewOrderPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [formData, setFormData] = useState({
    client_id: "",
    paper_id: "",
    width_inches: "",
    quantity_rolls: "",
    min_length: "1500",
    priority: "normal",
  });

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
    if (!formData.client_id || !formData.paper_id || !formData.width_inches || 
        !formData.quantity_rolls || !formData.min_length) {
      setAlert({
        type: 'error',
        message: 'Please fill in all required fields.'
      });
      return;
    }

    try {
      setLoading(true);
      const user_id = localStorage.getItem("user_id");
      if (!user_id) {
        throw new Error("User not authenticated");
      }

      const orderData = {
        ...formData,
        width_inches: parseFloat(formData.width_inches),
        quantity_rolls: parseInt(formData.quantity_rolls, 10),
        min_length: parseInt(formData.min_length, 10),
        created_by_id: user_id,
      };

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Client Selection */}
              <div className="space-y-2">
                <Label htmlFor="client_id">Client *</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => handleSelectChange("client_id", value)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name} ({client.contact_person})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Paper Selection */}
              <div className="space-y-2">
                <Label htmlFor="paper_id">Paper Type *</Label>
                <Select
                  value={formData.paper_id}
                  onValueChange={(value) => handleSelectChange("paper_id", value)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a paper type" />
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
              <div className="space-y-2">
                <Label htmlFor="width_inches">Width (inches) *</Label>
                <Input
                  id="width_inches"
                  name="width_inches"
                  type="number"
                  value={formData.width_inches}
                  onChange={handleChange}
                  placeholder="e.g., 42"
                  disabled={loading}
                  min="1"
                  step="0.01"
                />
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity_rolls">Number of Rolls *</Label>
                <Input
                  id="quantity_rolls"
                  name="quantity_rolls"
                  type="number"
                  value={formData.quantity_rolls}
                  onChange={handleChange}
                  placeholder="e.g., 6"
                  disabled={loading}
                  min="1"
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
                    <SelectValue placeholder="Select priority" />
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