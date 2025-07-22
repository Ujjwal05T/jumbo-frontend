/**
 * Admin users management page
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, authFetch } from "@/lib/auth";

interface User {
  id: string;
  username: string;
  role: string;
  created_at: string;
  last_login: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const currentUser = getCurrentUser();

  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/users/`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.status}`);
        }
        
        const data = await response.json();
        setUsers(data);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch users");
      } finally {
        setLoading(false);
      }
    };

    // Check if user is admin
    if (currentUser?.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    fetchUsers();
  }, [router, currentUser]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">User Management</h1>
        <div className="text-center py-8">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">User Management</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      
      <div className="mb-6">
        <button
          onClick={() => router.push("/auth/register")}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Create New User
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 border text-left">Username</th>
              <th className="py-2 px-4 border text-left">Role</th>
              <th className="py-2 px-4 border text-left">Created At</th>
              <th className="py-2 px-4 border text-left">Last Login</th>
              <th className="py-2 px-4 border text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border">{user.username}</td>
                <td className="py-2 px-4 border">
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.role === "admin" ? "bg-red-100 text-red-800" :
                    user.role === "manager" ? "bg-blue-100 text-blue-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="py-2 px-4 border">{formatDate(user.created_at)}</td>
                <td className="py-2 px-4 border">{formatDate(user.last_login)}</td>
                <td className="py-2 px-4 border">
                  <button
                    className="text-blue-600 hover:text-blue-800 mr-2"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}