"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface ParsedOrder {
  customer_name: string;
  width_inches: number | string;
  gsm: number | string;
  bf: number | string;
  shade: string;
  quantity_rolls: number | string;
  quantity_tons?: number | string;
  notes?: string;
}

export default function ParseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams?.get('orderId');
  
  const [message, setMessage] = useState("");
  const [parsedOrder, setParsedOrder] = useState<ParsedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Check authentication on component mount
  useEffect(() => {
    const username = localStorage.getItem('username');
    if (!username) {
      router.push(`/auth/login?redirect=/orders/parse${orderId ? `?orderId=${orderId}` : ''}`);
    }
  }, [router, orderId]);

  // Load existing order data if orderId is provided
  useEffect(() => {
    if (orderId) {
      const fetchOrder = async () => {
        try {
          setLoading(true);
          const response = await fetch(`http://localhost:8000/api/orders/${orderId}`);
          
          if (!response.ok) {
            throw new Error('Failed to fetch order');
          }
          
          const order = await response.json();
          setParsedOrder({
            customer_name: order.customer_name || "",
            width_inches: order.width_inches || "",
            gsm: order.gsm || "",
            bf: order.bf || "",
            shade: order.shade || "",
            quantity_rolls: order.quantity_rolls || "",
            quantity_tons: order.quantity_tons || "",
            notes: order.notes || ""
          });
          
          if (order.source_message?.raw_message) {
            setMessage(order.source_message.raw_message);
          }
        } catch (err) {
          console.error('Error fetching order:', err);
          setError('Failed to load order details');
        } finally {
          setLoading(false);
        }
      };
      
      fetchOrder();
    }
  }, [orderId]);

  const parseMessage = async () => {
    if (!message.trim()) {
      setError('Please enter a message to parse');
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch('http://localhost:8000/api/parse-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to parse message');
      }

      const data = await response.json();
      setParsedOrder({
        customer_name: data.customer_name || "",
        width_inches: data.width_inches || "",
        gsm: data.gsm || "",
        bf: data.bf || "",
        shade: data.shade || "",
        quantity_rolls: data.quantity_rolls || "",
        quantity_tons: data.quantity_tons || "",
        notes: data.notes || ""
      });
      
      setSuccess('Order details parsed successfully!');
    } catch (err) {
      console.error('Error parsing message:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse message');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (!parsedOrder) return;
    
    setParsedOrder({
      ...parsedOrder,
      [name]: name === 'customer_name' || name === 'shade' || name === 'notes' 
        ? value 
        : value === '' 
          ? '' 
          : Number(value)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedOrder) return;
    
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Basic validation
      if (!parsedOrder.customer_name || !parsedOrder.width_inches || !parsedOrder.gsm || 
          !parsedOrder.bf || !parsedOrder.shade || !parsedOrder.quantity_rolls) {
        throw new Error("Please fill in all required fields");
      }

      const url = orderId 
        ? `http://localhost:8000/api/orders/${orderId}`
        : 'http://localhost:8000/api/orders';

      const method = orderId ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_name: parsedOrder.customer_name,
          width_inches: Number(parsedOrder.width_inches),
          gsm: Number(parsedOrder.gsm),
          bf: Number(parsedOrder.bf),
          shade: parsedOrder.shade,
          quantity_rolls: Number(parsedOrder.quantity_rolls),
          quantity_tons: parsedOrder.quantity_tons ? Number(parsedOrder.quantity_tons) : undefined,
          notes: parsedOrder.notes || undefined,
          source_message: message
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to ${orderId ? 'update' : 'create'} order`);
      }

      const order = await response.json();
      setSuccess(`Order ${orderId ? 'updated' : 'created'} successfully!`);
      
      // Redirect to order details after a short delay
      setTimeout(() => {
        router.push(`/orders/${order.id}`);
      }, 1500);
    } catch (err) {
      console.error(`Error ${orderId ? 'updating' : 'creating'} order:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${orderId ? 'update' : 'create'} order`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Link 
          href={orderId ? `/orders/${orderId}` : "/orders"} 
          className="text-blue-600 hover:underline flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to {orderId ? 'Order' : 'Orders'}
        </Link>
        <h1 className="text-2xl font-bold mt-2">
          {orderId ? 'Update Order from Message' : 'Parse New Order'}
        </h1>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="bg-white shadow-md rounded px-6 py-4 mb-6">
            <h2 className="text-xl font-semibold mb-4">Paste Message</h2>
            <textarea
              className="w-full h-64 p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Paste the order message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
            />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={parseMessage}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                disabled={loading || !message.trim()}
              >
                {loading ? 'Parsing...' : 'Parse Message'}
              </button>
            </div>
          </div>

          {message && (
            <div className="bg-white shadow-md rounded px-6 py-4">
              <h2 className="text-xl font-semibold mb-4">Raw Message</h2>
              <div className="bg-gray-100 p-4 rounded whitespace-pre-wrap font-mono text-sm">
                {message}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="bg-white shadow-md rounded px-6 py-4">
            <h2 className="text-xl font-semibold mb-4">Parsed Order Details</h2>
            
            {parsedOrder ? (
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="customer_name">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="customer_name"
                      name="customer_name"
                      value={parsedOrder.customer_name}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="width_inches">
                        Width (in) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        id="width_inches"
                        name="width_inches"
                        value={parsedOrder.width_inches}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="gsm">
                        GSM <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        id="gsm"
                        name="gsm"
                        value={parsedOrder.gsm}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="0.1"
                        min="0"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="bf">
                        BF <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        id="bf"
                        name="bf"
                        value={parsedOrder.bf}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="0.1"
                        min="0"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="shade">
                        Shade <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="shade"
                        name="shade"
                        value={parsedOrder.shade}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="quantity_rolls">
                        Rolls <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        id="quantity_rolls"
                        name="quantity_rolls"
                        value={parsedOrder.quantity_rolls}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="quantity_tons">
                        Weight (Tons)
                      </label>
                      <input
                        type="number"
                        id="quantity_tons"
                        name="quantity_tons"
                        value={parsedOrder.quantity_tons || ''}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="notes">
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={parsedOrder.notes || ''}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Additional notes about this order..."
                    />
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setParsedOrder(null)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      disabled={loading}
                    >
                      Clear
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : orderId ? 'Update Order' : 'Create Order'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Paste a message and click "Parse Message" to extract order details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}