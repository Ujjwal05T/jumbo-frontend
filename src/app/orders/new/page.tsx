"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface OrderFormData {
  customer_name: string;
  width_inches: number | string;
  gsm: number | string;
  bf: number | string;
  shade: string;
  quantity_rolls: number | string;
  quantity_tons?: number | string;
  notes?: string;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<OrderFormData>({
    customer_name: "",
    width_inches: "",
    gsm: "",
    bf: "",
    shade: "",
    quantity_rolls: "",
    quantity_tons: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check authentication on component mount
  useEffect(() => {
    const username = localStorage.getItem('username');
    if (!username) {
      router.push("/auth/login?redirect=/orders/new");
    }
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'customer_name' || name === 'shade' || name === 'notes' 
        ? value 
        : value === '' 
          ? '' 
          : Number(value)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Basic validation
      if (!formData.customer_name || !formData.width_inches || !formData.gsm || !formData.bf || !formData.shade || !formData.quantity_rolls) {
        throw new Error("Please fill in all required fields");
      }

      const response = await fetch('http://localhost:8000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_name: formData.customer_name,
          width_inches: Number(formData.width_inches),
          gsm: Number(formData.gsm),
          bf: Number(formData.bf),
          shade: formData.shade,
          quantity_rolls: Number(formData.quantity_rolls),
          quantity_tons: formData.quantity_tons ? Number(formData.quantity_tons) : undefined,
          notes: formData.notes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create order');
      }

      const newOrder = await response.json();
      router.push(`/orders/${newOrder.id}`);
    } catch (err) {
      console.error('Error creating order:', err);
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Link 
          href="/orders" 
          className="text-blue-600 hover:underline flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Orders
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create New Order</h1>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Order Information</h2>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="customer_name">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="customer_name"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="shade">
                  Shade <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="shade"
                  name="shade"
                  value={formData.shade}
                  onChange={handleInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="quantity_rolls">
                  Number of Rolls <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="quantity_rolls"
                  name="quantity_rolls"
                  value={formData.quantity_rolls}
                  onChange={handleInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  min="1"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="quantity_tons">
                  Weight (Tons)
                </label>
                <input
                  type="number"
                  id="quantity_tons"
                  name="quantity_tons"
                  value={formData.quantity_tons}
                  onChange={handleInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Specifications</h2>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="width_inches">
                  Width (inches) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="width_inches"
                  name="width_inches"
                  value={formData.width_inches}
                  onChange={handleInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="gsm">
                  GSM (Grams per Square Meter) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="gsm"
                  name="gsm"
                  value={formData.gsm}
                  onChange={handleInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  step="0.1"
                  min="0"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="bf">
                  BF (Bursting Factor) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="bf"
                  name="bf"
                  value={formData.bf}
                  onChange={handleInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  step="0.1"
                  min="0"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Any additional notes about this order..."
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => router.push('/orders')}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mr-2"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}