/**
 * Dashboard page component - Modern overview with statistics
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusMonitor } from "@/components/StatusMonitor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  ShoppingCart, 
  Clock, 
  FileText, 
  TrendingUp, 
  TrendingDown,
  Package,
  AlertCircle,
  CheckCircle,
  ArrowRight
} from "lucide-react";

export default function DashboardPage() {
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

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  // Dummy data for dashboard
  const stats = [
    {
      title: "Total Orders",
      value: "1,234",
      change: "+12%",
      trend: "up",
      icon: ShoppingCart,
      description: "From last month"
    },
    {
      title: "Created Orders",
      value: "23",
      change: "-8%",
      trend: "down",
      icon: Clock,
      description: "Awaiting processing"
    },
    {
      title: "Active Clients",
      value: "89",
      change: "+5%",
      trend: "up",
      icon: Users,
      description: "This month"
    },
    {
      title: "Paper Rolls",
      value: "456",
      change: "+18%",
      trend: "up",
      icon: Package,
      description: "In inventory"
    }
  ];

  const recentOrders = [
    {
      id: "ORD-001",
      client: "ABC Manufacturing",
      status: "completed",
      amount: "$2,450",
      date: "2024-01-20"
    },
    {
      id: "ORD-002",
      client: "XYZ Industries",
      status: "created",
      amount: "$1,890",
      date: "2024-01-19"
    },
    {
      id: "ORD-003",
      client: "Tech Solutions Ltd",
      status: "in_process",
      amount: "$3,200",
      date: "2024-01-18"
    },
    {
      id: "ORD-004",
      client: "Global Corp",
      status: "completed",
      amount: "$1,650",
      date: "2024-01-17"
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
      case "created":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Created</Badge>;
      case "in_process":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Process</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of your paper roll management system.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card key={index} className="hover-lift transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <span className={`flex items-center ${
                    stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.trend === 'up' ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {stat.change}
                  </span>
                  <span>{stat.description}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Orders */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Orders</CardTitle>
                  <CardDescription>Latest customer orders and their status</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push('/masters/orders')}>
                  View All
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{order.id}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{order.client}</p>
                      <p className="text-xs text-muted-foreground">{order.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{order.amount}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/masters/orders')}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                New Order
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/masters/clients')}
              >
                <Users className="w-4 h-4 mr-2" />
                Add Client
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/planning')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Create Plan
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/masters/papers')}
              >
                <Package className="w-4 h-4 mr-2" />
                Manage Inventory
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced System Status Monitor */}
        <StatusMonitor 
          refreshInterval={30000}
          showValidation={true}
          showAutoUpdate={true}
        />
      </div>
    </DashboardLayout>
  );
}