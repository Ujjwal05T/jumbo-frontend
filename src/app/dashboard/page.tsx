/**
 * Dashboard page component - Modern overview with dynamic statistics
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isAuthenticated } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DASHBOARD_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
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
  ArrowRight,
  Factory,
  Scissors,
  AlertTriangle,
  Activity,
  BarChart3,
  Zap
} from "lucide-react";

interface DashboardSummary {
  orders: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    completion_rate: number;
  };
  pending_items: {
    total_items: number;
    total_quantity: number;
    high_priority: number;
    avg_wait_time: number;
  };
  plans: {
    total: number;
    planned: number;
    in_progress: number;
    completed: number;
    success_rate: number;
  };
  inventory: {
    total_available: number;
    jumbo_rolls: number;
    cut_rolls: number;
    utilization_rate: number;
  };
  production: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    efficiency: number;
  };
  activity: {
    recent_orders: number;
    recent_plans: number;
    recent_production: number;
    total_clients: number;
    active_clients: number;
    paper_types: number;
  };
}

interface RecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  status: string;
  icon: string;
}

interface DashboardAlert {
  id: string;
  type: "info" | "warning" | "error";
  title: string;
  message: string;
  action: string;
  link: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const router = useRouter();

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch summary data
      const summaryResponse = await fetch(DASHBOARD_ENDPOINTS.SUMMARY, createRequestOptions('GET'));
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData.summary);
        setLastUpdated(new Date(summaryData.timestamp).toLocaleString());
      }
      
      // Fetch recent activities
      const activitiesResponse = await fetch(DASHBOARD_ENDPOINTS.RECENT_ACTIVITY, createRequestOptions('GET'));
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setActivities(activitiesData.activities);
      }
      
      // Fetch alerts
      const alertsResponse = await fetch(DASHBOARD_ENDPOINTS.ALERTS, createRequestOptions('GET'));
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.alerts);
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        router.push("/auth/login");
      } else {
        await fetchDashboardData();
      }
    };

    checkAuth();
  }, [router]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchDashboardData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading]);

  if (loading || !summary) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <Activity className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
          <h1 className="text-2xl font-bold">Loading Dashboard...</h1>
          <p className="text-muted-foreground">Fetching real-time data</p>
        </div>
      </div>
    );
  }

  // Dynamic stats from API
  const stats = [
    {
      title: "Total Orders",
      value: summary.orders.total.toLocaleString(),
      subValue: `${summary.orders.completion_rate}% completed`,
      icon: ShoppingCart,
      color: "blue",
      details: [
        { label: "Pending", value: summary.orders.pending },
        { label: "Processing", value: summary.orders.processing },
        { label: "Completed", value: summary.orders.completed }
      ]
    },
    {
      title: "Pending Items",
      value: summary.pending_items.total_items.toLocaleString(),
      subValue: `${summary.pending_items.total_quantity} rolls total`,
      icon: Clock,
      color: summary.pending_items.high_priority > 0 ? "red" : "yellow",
      details: [
        { label: "High Priority", value: summary.pending_items.high_priority },
        { label: "Total Quantity", value: summary.pending_items.total_quantity }
      ]
    },
    {
      title: "Production Plans",
      value: summary.plans.total.toLocaleString(),
      subValue: `${summary.plans.success_rate}% success rate`,
      icon: Scissors,
      color: "green",
      details: [
        { label: "Planned", value: summary.plans.planned },
        { label: "In Progress", value: summary.plans.in_progress },
        { label: "Completed", value: summary.plans.completed }
      ]
    },
    {
      title: "Inventory",
      value: summary.inventory.total_available.toLocaleString(),
      subValue: `${summary.inventory.jumbo_rolls} jumbo rolls`,
      icon: Package,
      color: summary.inventory.jumbo_rolls < 5 ? "red" : "purple",
      details: [
        { label: "Jumbo Rolls", value: summary.inventory.jumbo_rolls },
        { label: "Cut Rolls", value: summary.inventory.cut_rolls }
      ]
    },
    {
      title: "Production Orders",
      value: summary.production.total.toLocaleString(),
      subValue: `${summary.production.efficiency}% efficiency`,
      icon: Factory,
      color: "indigo",
      details: [
        { label: "Pending", value: summary.production.pending },
        { label: "In Progress", value: summary.production.in_progress },
        { label: "Completed", value: summary.production.completed }
      ]
    },
    {
      title: "System Activity",
      value: summary.activity.active_clients.toLocaleString(),
      subValue: `of ${summary.activity.total_clients} clients`,
      icon: Activity,
      color: "teal",
      details: [
        { label: "Recent Orders", value: summary.activity.recent_orders },
        { label: "Recent Plans", value: summary.activity.recent_plans },
        { label: "Paper Types", value: summary.activity.paper_types }
      ]
    }
  ];

  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case "package": return Package;
      case "scissors": return Scissors;
      case "factory": return Factory;
      default: return Activity;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
      case "created":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Created</Badge>;
      case "processing":
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Progress</Badge>;
      case "planned":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Planned</Badge>;
      case "pending":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAlertBadge = (type: string) => {
    switch (type) {
      case "error":
        return <Badge variant="destructive">Critical</Badge>;
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Warning</Badge>;
      case "info":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Info</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue": return "border-blue-200 bg-blue-50";
      case "red": return "border-red-200 bg-red-50";
      case "green": return "border-green-200 bg-green-50";
      case "yellow": return "border-yellow-200 bg-yellow-50";
      case "purple": return "border-purple-200 bg-purple-50";
      case "indigo": return "border-indigo-200 bg-indigo-50";
      case "teal": return "border-teal-200 bg-teal-50";
      default: return "border-gray-200 bg-gray-50";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-primary" />
              Live Dashboard
            </h1>
            <p className="text-muted-foreground">
              Real-time overview of your paper roll management system
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="w-4 h-4" />
              Last updated: {lastUpdated}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchDashboardData}
              className="mt-2"
            >
              <Zap className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              System Alerts
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {alerts.map((alert) => (
                <Card key={alert.id} className={`border-l-4 ${
                  alert.type === 'error' ? 'border-l-red-500' : 
                  alert.type === 'warning' ? 'border-l-yellow-500' : 
                  'border-l-blue-500'
                }`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{alert.title}</CardTitle>
                      {getAlertBadge(alert.type)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{alert.message}</p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => router.push(alert.link)}
                    >
                      {alert.action}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat, index) => (
            <Card key={index} className={`hover-lift transition-all duration-300 ${getColorClasses(stat.color)}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-1">{stat.value}</div>
                <p className="text-xs text-muted-foreground mb-3">{stat.subValue}</p>
                <div className="space-y-1">
                  {stat.details.map((detail, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{detail.label}:</span>
                      <span className="font-medium">{detail.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Latest system activities and events</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchDashboardData()}>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.length > 0 ? activities.map((activity) => {
                  const IconComponent = getActivityIcon(activity.icon);
                  return (
                    <div key={activity.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="p-2 rounded-full bg-primary/10">
                        <IconComponent className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{activity.title}</span>
                          {getStatusBadge(activity.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/masters/orders/new')}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                New Order
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/masters/pending-orders')}
              >
                <Clock className="w-4 h-4 mr-2" />
                Pending Orders
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/masters/plans')}
              >
                <Scissors className="w-4 h-4 mr-2" />
                Production Plans
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/workflow')}
              >
                <Factory className="w-4 h-4 mr-2" />
                Workflow Manager
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/masters/clients')}
              >
                <Users className="w-4 h-4 mr-2" />
                Manage Clients
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}