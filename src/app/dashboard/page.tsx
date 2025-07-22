/**
 * Dashboard page component
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, logout, isAuthenticated } from "@/lib/auth";

export default function DashboardPage() {
  const [user, setUser] = useState(getCurrentUser());
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        router.push("/auth/login");
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-4xl p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        <div className="mt-6">
          <h2 className="text-xl font-semibold">Welcome, {user?.username}!</h2>
          <p className="mt-2 text-gray-600">Role: {user?.role}</p>
        </div>

        <div className="mt-8 border-t pt-6">
          <h3 className="text-lg font-medium">Paper Roll Management System</h3>
          <p className="mt-2 text-gray-600">
            You are now logged in to the system. Use the navigation to access different features.
          </p>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
              onClick={() => router.push("/orders")}
            >
              <h4 className="font-medium">Orders</h4>
              <p className="text-sm text-gray-600">Manage customer orders</p>
              <div className="mt-2 flex space-x-2">
                <button 
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/orders/new");
                  }}
                >
                  New Order
                </button>
                <button 
                  className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/orders/parse");
                  }}
                >
                  Parse Message
                </button>
              </div>
            </div>
            
            <div 
              className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
              onClick={() => router.push("/inventory")}
            >
              <h4 className="font-medium">Inventory</h4>
              <p className="text-sm text-gray-600">Track paper roll inventory</p>
            </div>
            
            <div 
              className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
              onClick={() => router.push("/cutting-plans")}
            >
              <h4 className="font-medium">Cutting Plans</h4>
              <p className="text-sm text-gray-600">Optimize cutting operations</p>
            </div>
            
            {user?.role === "admin" && (
              <div 
                className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 bg-blue-50"
                onClick={() => router.push("/admin/users")}
              >
                <h4 className="font-medium">User Management</h4>
                <p className="text-sm text-gray-600">Manage system users</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}