/**
 * Order Details Page
 * Displays details of a specific order
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Order {
  id: string;
  customer_name: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  quantity_rolls: number;
  quantity_tons?: number;
  status: string;
  created_at: string;
  updated_at: string;
  source_message?: {
    id: string;
    raw_message: string;
    parsed_json?: string;
  };
  cut_rolls?: any[];
}

export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    status: "",
    notes: ""
  });

  // Check authentication and fetch order details
  useEffect(() => {
    const checkAuthAndFetch = () => {
      const username = localStorage.getItem('username');
      if (!username) {
        router.push(`/auth/login?redirect=/orders/${orderId}`);
        return;
      }
      fetchOrderDetails();
    };

    checkAuthAndFetch();
  }, [orderId, router]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${orderId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch order details');
      }
      
      const data = await response.json();
      setOrder(data);
      setFormData({
        status: data.status,
        notes: data.notes || ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order details');
      console.error('Error fetching order details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update order');
      }

      const updatedOrder = await response.json();
      setOrder(updatedOrder);
      setIsEditing(false);
      
      // Show success message
      alert('Order updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
      console.error('Error updating order:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[status as keyof typeof statusClasses] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
          <button 
            onClick={() => window.location.reload()}
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
          >
            <span className="sr-only">Reload</span>
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Not Found: </strong>
          <span className="block sm:inline">Order not found.</span>
          <Link 
            href="/orders" 
            className="ml-2 text-blue-600 hover:underline"
          >
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

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
        
        <div className="flex justify-between items-center mt-2">
          <h1 className="text-2xl font-bold">Order #{order.id.substring(0, 8)}</h1>
          <div className="flex space-x-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Edit Order
              </button>
            )}
            <Link
              href={`/orders/parse?orderId=${order.id}`}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Parse Message
            </Link>
          </div>
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
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
              rows={4}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="Add any notes about this order..."
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Order Information</h2>
              <div className="space-y-2">
                <p><span className="font-semibold">Order ID:</span> {order.id}</p>
                <p><span className="font-semibold">Customer:</span> {order.customer_name}</p>
                <p><span className="font-semibold">Status:</span> {getStatusBadge(order.status)}</p>
                <p><span className="font-semibold">Created:</span> {new Date(order.created_at).toLocaleString()}</p>
                <p><span className="font-semibold">Last Updated:</span> {new Date(order.updated_at).toLocaleString()}</p>
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-4">Specifications</h2>
              <div className="space-y-2">
                <p><span className="font-semibold">Width:</span> {order.width_inches} inches</p>
                <p><span className="font-semibold">GSM:</span> {order.gsm}</p>
                <p><span className="font-semibold">BF:</span> {order.bf}</p>
                <p><span className="font-semibold">Shade:</span> {order.shade}</p>
                <p><span className="font-semibold">Quantity:</span> {order.quantity_rolls} rolls</p>
                {order.quantity_tons && (
                  <p><span className="font-semibold">Weight:</span> {order.quantity_tons} tons</p>
                )}
              </div>
            </div>
          </div>

          {order.source_message && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-2">Source Message</h2>
              <div className="bg-gray-100 p-4 rounded whitespace-pre-wrap font-mono text-sm">
                {order.source_message.raw_message}
              </div>
            </div>
          )}

          {order.cut_rolls && order.cut_rolls.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-4">Cut Rolls</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 text-left">Roll ID</th>
                      <th className="py-2 px-4 text-left">Length</th>
                      <th className="py-2 px-4 text-left">Status</th>
                      <th className="py-2 px-4 text-left">Cut At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.cut_rolls.map((roll) => (
                      <tr key={roll.id} className="border-t">
                        <td className="py-2 px-4">{roll.id.substring(0, 8)}...</td>
                        <td className="py-2 px-4">{roll.length_meters}m</td>
                        <td className="py-2 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            roll.status === 'in_stock' ? 'bg-green-100 text-green-800' :
                            roll.status === 'used' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {roll.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2 px-4">{new Date(roll.cut_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}