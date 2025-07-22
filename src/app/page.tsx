/**
 * Landing page component
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

export default function LandingPage() {
  const router = useRouter();

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        router.push("/dashboard");
      }
    };

    checkAuth();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-4xl p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Paper Roll Management System</h1>
          <p className="mt-4 text-xl text-gray-600">
            Streamline your paper roll manufacturing workflow
          </p>
        </div>

        <div className="flex justify-center space-x-4 mt-8">
          <Link
            href="/auth/login"
            className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Login
          </Link>
          <Link
            href="/auth/register"
            className="px-6 py-3 bg-white text-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Register
          </Link>
        </div>

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-semibold">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-medium">Order Management</h3>
              <p className="mt-2 text-gray-600">
                Process orders with AI-powered message parsing
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-medium">Cutting Optimization</h3>
              <p className="mt-2 text-gray-600">
                Minimize waste with intelligent cutting plans
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-medium">Inventory Tracking</h3>
              <p className="mt-2 text-gray-600">
                Track rolls with QR codes and real-time updates
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}