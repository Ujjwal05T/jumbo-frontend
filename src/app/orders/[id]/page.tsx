/**
 * Order Details Page
 * Displays details of a specific order
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrentUser, authFetch } from "@/lib/auth";
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
  const [updateLoading, setUpdateLoading] = useState(false);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState(false);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const user = getCurrentUser();
      if (!user) {
        router.push(`/auth/login?redirect=/orders/${orderId}`);
      } else {
        fetchOrderDetails();
      }
    };

    checkAuth();
  }, [router, orderId]);

  // Fetch order details
  const fetchOrderDetails = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/orders/${orderId}/details`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch order details: ${response.status}`);
      }

      const data = await response.json();
      setOrder(data);
    } catch (err) {
      console.error("Error fetching order details:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch order details");
    } finally {
      setLoading(false);
    }
  };

  // Update order status
  const updateOrderStatus = async (newStatus: string) => {
    setUpdateLoading(true);
    setStatusUpdateSuccess(false);
    setError("");

    try {
      const response = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/orders/${orderId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update order status: ${response.status}`);
      }

      const updatedOrder = await response.json();
      setOrder(updatedOrder);
      setStatusUpdateSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setStatusUpdateSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Error updating order status:", err);
      setError(err instanceof Error ? err.message : "Failed to update order status");
    } finally {
      setUpdateLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading order details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <div className="text-center">
          <Link href="/orders" className="text-blue-500 hover:underline">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Order not found</div>
        <div className="text-center mt-4">
          <Link href="/orders" className="text-blue-500 hover:underline">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Order Details</h1>
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

      {statusUpdateSuccess && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          Order status updated successfully
        </div>
      )}

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-semibold">Order #{order.id.substring(0, 8)}</h2>
            <p className="text-gray-600">Created: {formatDate(order.created_at)}</p>
            <p className="text-gray-600">Last Updated: {formatDate(order.updated_at)}</p>
          </div>
          <div className="flex flex-col items-end">
            <span className={`px-3 py-1 rounded text-sm mb-2 ${getStatusBadgeColor(order.status)}`}>
              {order.status}
            </span>
            <div className="flex space-x-2">
              {order.status === "pending" && (
                <>
                  <button
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    onClick={() => updateOrderStatus("processing")}
                    disabled={updateLoading}
                  >
                    Start Processing
                  </button>
                  <button
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    onClick={() => updateOrderStatus("cancelled")}
                    disabled={updateLoading}
                  >
                    Cancel
                  </button>
                </>
              )}
              {order.status === "processing" && (
                <button
                  className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                  onClick={() => updateOrderStatus("completed")}
                  disabled={updateLoading}
                >
                  Mark Completed
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Customer Information</h3>
            <div className="bg-gray-50 p-4 rounded">
              <p className="font-semibold">{order.customer_name}</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Order Specifications</h3>
            <div className="bg-gray-50 p-4 rounded">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-sm text-gray-600">Width:</p>
                  <p className="font-semibold">{order.width_inches} inches</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">GSM:</p>
                  <p className="font-semibold">{order.gsm}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">BF:</p>
                  <p className="font-semibold">{order.bf}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Shade:</p>
                  <p className="font-semibold">{order.shade}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Quantity</h3>
            <div className="bg-gray-50 p-4 rounded">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-sm text-gray-600">Number of Rolls:</p>
                  <p className="font-semibold">{order.quantity_rolls}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Weight in Tons:</p>
                  <p className="font-semibold">{order.quantity_tons || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {order.source_message && (
            <div>
              <h3 className="text-lg font-medium mb-2">Source Message</h3>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600 mb-1">Original Message:</p>
                <div className="bg-white p-2 border rounded text-sm font-mono whitespace-pre-wrap">
                  {order.source_message.raw_message}
                </div>
              </div>
            </div>
          )}
        </div>

        {order.cut_rolls && order.cut_rolls.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-2">Cut Rolls</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 border text-left">ID</th>
                    <th className="py-2 px-4 border text-left">Width</th>
                    <th className="py-2 px-4 border text-left">Weight</th>
                    <th className="py-2 px-4 border text-left">QR Code</th>
                    <th className="py-2 px-4 border text-left">Status</th>
                    <th className="py-2 px-4 border text-left">Cut Date</th>
                  </tr>
                </thead>
                <tbody>
                  {order.cut_rolls.map((roll) => (
                    <tr key={roll.id} className="hover:bg-gray-50">
                      <td className="py-2 px-4 border">{roll.id.substring(0, 8)}</td>
                      <td className="py-2 px-4 border">{roll.width_inches}"</td>
                      <td className="py-2 px-4 border">{roll.weight_kg || "N/A"} kg</td>
                      <td className="py-2 px-4 border">{roll.qr_code}</td>
                      <td className="py-2 px-4 border">{roll.status}</td>
                      <td className="py-2 px-4 border">{formatDate(roll.cut_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end space-x-2">
          <Link
            href={`/orders/${order.id}/edit`}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Edit Order
          </Link>
          {order.status !== "completed" && order.status !== "cancelled" && (
            <Link
              href={`/cutting-plans/new?order=${order.id}`}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Create Cutting Plan
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}