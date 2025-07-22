/**
 * Orders List Page
 * Displays a list of all orders with filtering options
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    customer_name: "",
    status: "",
    width_inches: "",
    gsm: "",
  });

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const user = getCurrentUser();
      if (!user) {
        router.push("/auth/login?redirect=/orders");
      } else {
        fetchOrders();
      }
    };

    checkAuth();
  }, [router]);

  // Fetch orders from API
  const fetchOrders = async () => {
    setLoading(true);
    setError("");

    try {
      // Build query string from filters
      const queryParams = new URLSearchParams();
      if (filters.customer_name) queryParams.append("customer_name", filters.customer_name);
      if (filters.status) queryParams.append("status", filters.status);
      if (filters.width_inches) queryParams.append("width_inches", filters.width_inches);
      if (filters.gsm) queryParams.append("gsm", filters.gsm);

      const response = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/orders/?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }

      const data = await response.json();
      setOrders(data);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value,
    });
  };

  // Apply filters
  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      customer_name: "",
      status: "",
      width_inches: "",
      gsm: "",
    });
    // Fetch orders without filters
    fetchOrders();
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="space-x-2">
          <Link
            href="/orders/new"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            New Order
          </Link>
          <Link
            href="/orders/parse"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Parse Message
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <h2 className="text-xl font-semibold mb-4">Filters</h2>
        <form onSubmit={applyFilters} className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="customer_name">
                Customer Name
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="customer_name"
                name="customer_name"
                type="text"
                placeholder="Filter by customer"
                value={filters.customer_name}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="status">
                Status
              </label>
              <select
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="status"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="width_inches">
                Width (inches)
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="width_inches"
                name="width_inches"
                type="number"
                placeholder="Filter by width"
                value={filters.width_inches}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="gsm">
                GSM
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="gsm"
                name="gsm"
                type="number"
                placeholder="Filter by GSM"
                value={filters.gsm}
                onChange={handleFilterChange}
              />
            </div>
          </div>
          <div className="flex justify-end mt-4 space-x-2">
            <button
              type="button"
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              onClick={resetFilters}
            >
              Reset
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow-md rounded overflow-hidden">
        {loading ? (
          <div className="p-4 text-center">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-4 text-center">
            No orders found. 
            <Link href="/orders/new" className="text-blue-500 hover:underline ml-1">
              Create a new order
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-3 px-4 text-left">Customer</th>
                  <th className="py-3 px-4 text-left">Specifications</th>
                  <th className="py-3 px-4 text-left">Quantity</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-left">Created</th>
                  <th className="py-3 px-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">{order.customer_name}</td>
                    <td className="py-3 px-4">
                      <div>{order.width_inches}" × {order.gsm} GSM</div>
                      <div className="text-xs text-gray-500">BF: {order.bf} | Shade: {order.shade}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{order.quantity_rolls} rolls</div>
                      {order.quantity_tons && (
                        <div className="text-xs text-gray-500">{order.quantity_tons} tons</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">{formatDate(order.created_at)}</td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-blue-500 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}