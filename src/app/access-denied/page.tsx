"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";

// Role-based route permissions (from middleware)
const roleBasedRoutes = {
  admin: ['/dashboard'],
  order_puncher: ['/masters/orders'],
  security: ['/in-out'],
  co_admin: ['/dashboard'],
  planner: ['/weight-update'],
  poduction: ['/dashboard'],
  accountant: ['/dashboard'],
};

export default function AccessDeniedPage() {
  const router = useRouter();
  const [defaultRoute, setDefaultRoute] = useState<string | null>(null);

  useEffect(() => {
    // Get user role from localStorage
    const userRole = localStorage.getItem('user_role');
    if (userRole && userRole in roleBasedRoutes) {
      const routes = roleBasedRoutes[userRole as keyof typeof roleBasedRoutes];
      // Set the first available route for this role
      setDefaultRoute(routes[0]);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-red-600">Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Your current role doesn't have access to this resource. Please contact your administrator if you believe this is an error.
          </p>
          <div className="flex flex-col gap-2">
            {defaultRoute && (
              <Button
                onClick={() => router.push(defaultRoute)}
                className="w-full"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to {defaultRoute === '/dashboard' ? 'Dashboard' : 'Home'}
              </Button>
            )}
            <Button
              onClick={() => {
                localStorage.removeItem('username');
                localStorage.removeItem('user_role');
                document.cookie = 'username=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
                document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
                router.push('/auth/login');
              }}
              variant="outline"
              className="w-full"
            >
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}