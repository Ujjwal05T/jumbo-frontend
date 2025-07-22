/**
 * New Order Page
 * Allows users to create a new order through a form
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, authFetch } from "@/lib/auth";
import Link from "next/link";

// Define the Order interface
interface OrderFormData {
  customer_name: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  quantity_rolls: number;
  quantity_tons?: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState<OrderFormData>({
    customer_name: "",
    width_inches: 0,
    gsm: 0,
    bf: 0,
    shade: "",
    quantity_rolls: 0,
    quantity_tons: undefined,
  });

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const user = getCurrentUser();
      if (!user) {
        router.push("/auth/login?redirect=/orders/new");
      }
    };

    checkAuth();
  }, [router]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    // Convert numeric inputs to numbers
    if (type === "number") {
      setFormData({
        ...formData,
        [name]: value === "" ? "" : Number(value),
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  // Calculate tonnage from rolls (1 inch roll = 13 kg)
  const calculateTonnage = () => {
    if (formData.width_inches && formData.quantity_rolls) {
      // Formula: width_inches * quantity_rolls * 13 kg / 1000 (to convert to tons)
      const tons = (formData.width_inches * formData.quantity_rolls * 13) / 1000;
      setFormData({
        ...formData,
        quantity_tons: parseFloat(tons.toFixed(2)),
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Validate form data
      if (!formData.customer_name) {
        throw new Error("Customer name is required");
      }
      if (!formData.width_inches || formData.width_inches <= 0) {
        throw new Error("Width must be greater than 0");
      }
      if (!formData.gsm || formData.gsm <= 0) {
        throw new Error("GSM must be greater than 0");
      }
      if (!formData.bf || formData.bf <= 0) {
        throw new Error("BF must be greater than 0");
      }
      if (!formData.shade) {
        throw new Error("Shade is required");
      }
      if (!formData.quantity_rolls || formData.quantity_rolls <= 0) {
        throw new Error("Quantity of rolls must be greater than 0");
      }

      // Submit the order
      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/orders/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create order");
      }

      const data = await response.json();
      setSuccess("Order created successfully!");
      
      // Reset form
      setFormData({
        customer_name: "",
        width_inches: 0,
        gsm: 0,
        bf: 0,
        shade: "",
        quantity_rolls: 0,
        quantity_tons: undefined,
      });

      // Redirect to order details after a short delay
      setTimeout(() => {
        router.push(`/orders/${data.id}`);
      }, 1500);
    } catch (err) {
      console.error("Error creating order:", err);
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Create New Order</h1>
        <Link
          href="/orders"
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Back to Orders
        </Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Customer Information</h2>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="customer_name">
                Customer Name *
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="customer_name"
                name="customer_name"
                type="text"
                placeholder="Enter customer name"
                value={formData.customer_name}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Roll Specifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="width_inches">
                  Width (inches) *
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="width_inches"
                  name="width_inches"
                  type="number"
                  min="1"
                  max="200"
                  placeholder="Enter width in inches"
                  value={formData.width_inches || ""}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="gsm">
                  GSM (Grams per Square Meter) *
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="gsm"
                  name="gsm"
                  type="number"
                  min="1"
                  max="1000"
                  placeholder="Enter GSM"
                  value={formData.gsm || ""}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="bf">
                  BF (Brightness Factor) *
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="bf"
                  name="bf"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="Enter BF"
                  value={formData.bf || ""}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="shade">
                  Shade *
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="shade"
                  name="shade"
                  type="text"
                  placeholder="Enter shade"
                  value={formData.shade}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Quantity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="quantity_rolls">
                  Number of Rolls *
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="quantity_rolls"
                  name="quantity_rolls"
                  type="number"
                  min="1"
                  placeholder="Enter number of rolls"
                  value={formData.quantity_rolls || ""}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="quantity_tons">
                  Weight in Tons (Optional)
                </label>
                <div className="flex">
                  <input
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    id="quantity_tons"
                    name="quantity_tons"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter weight in tons"
                    value={formData.quantity_tons || ""}
                    onChange={handleInputChange}
                  />
                  <button
                    type="button"
                    className="ml-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    onClick={calculateTonnage}
                  >
                    Calculate
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Click Calculate to estimate tonnage based on roll dimensions (1 inch roll = 13 kg)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Order"}
            </button>
            <button
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="button"
              onClick={() => router.push("/orders")}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}