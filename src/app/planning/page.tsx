/**
 * Planning page - Cutting plans and production planning
 */
"use client";

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Scissors, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Play,
  Pause,
  CheckCircle,
  Calendar,
  BarChart3,
  Target,
  TrendingUp,
  Clock
} from "lucide-react";

interface CuttingPlan {
  id: string;
  planName: string;
  orderIds: string[];
  paperType: string;
  totalSheets: number;
  wastePercentage: number;
  efficiency: number;
  status: "draft" | "approved" | "in_progress" | "completed" | "paused";
  createdDate: string;
  scheduledDate: string;
  estimatedDuration: string;
  assignedOperator: string;
  priority: "low" | "medium" | "high" | "urgent";
  cuttingPattern: string;
}

export default function PlanningPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Dummy cutting plan data
  const cuttingPlans: CuttingPlan[] = [
    {
      id: "PLN-001",
      planName: "A4 Premium Batch #1",
      orderIds: ["ORD-001", "ORD-003"],
      paperType: "A4 Premium White",
      totalSheets: 7500,
      wastePercentage: 5.2,
      efficiency: 94.8,
      status: "in_progress",
      createdDate: "2024-01-20",
      scheduledDate: "2024-01-23",
      estimatedDuration: "4 hours",
      assignedOperator: "John Smith",
      priority: "high",
      cuttingPattern: "Standard A4 Layout"
    },
    {
      id: "PLN-002",
      planName: "Custom Size Mixed",
      orderIds: ["ORD-005"],
      paperType: "Custom Premium",
      totalSheets: 1200,
      wastePercentage: 8.5,
      efficiency: 91.5,
      status: "approved",
      createdDate: "2024-01-21",
      scheduledDate: "2024-01-24",
      estimatedDuration: "2.5 hours",
      assignedOperator: "Sarah Johnson",
      priority: "medium",
      cuttingPattern: "Custom Layout #3"
    },
    {
      id: "PLN-003",
      planName: "A3 Standard Production",
      orderIds: ["ORD-002", "ORD-006"],
      paperType: "A3 Standard White",
      totalSheets: 4800,
      wastePercentage: 3.8,
      efficiency: 96.2,
      status: "completed",
      createdDate: "2024-01-18",
      scheduledDate: "2024-01-22",
      estimatedDuration: "3 hours",
      assignedOperator: "Michael Brown",
      priority: "medium",
      cuttingPattern: "Optimized A3 Layout"
    },
    {
      id: "PLN-004",
      planName: "Photo Paper Glossy",
      orderIds: ["ORD-007"],
      paperType: "A4 Glossy Photo",
      totalSheets: 3500,
      wastePercentage: 12.0,
      efficiency: 88.0,
      status: "draft",
      createdDate: "2024-01-22",
      scheduledDate: "2024-01-25",
      estimatedDuration: "1.5 hours",
      assignedOperator: "Emily Davis",
      priority: "low",
      cuttingPattern: "Photo Paper Layout"
    },
    {
      id: "PLN-005",
      planName: "Urgent A5 Batch",
      orderIds: ["ORD-008", "ORD-009"],
      paperType: "A5 Standard",
      totalSheets: 6200,
      wastePercentage: 6.3,
      efficiency: 93.7,
      status: "paused",
      createdDate: "2024-01-19",
      scheduledDate: "2024-01-23",
      estimatedDuration: "3.5 hours",
      assignedOperator: "David Wilson",
      priority: "urgent",
      cuttingPattern: "A5 Efficient Layout"
    }
  ];

  const filteredPlans = cuttingPlans.filter(plan =>
    plan.planName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.paperType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.assignedOperator.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.orderIds.some(id => id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Completed
        </Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          <Play className="w-3 h-3 mr-1" />
          In Progress
        </Badge>;
      case "approved":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Approved
        </Badge>;
      case "paused":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
          <Pause className="w-3 h-3 mr-1" />
          Paused
        </Badge>;
      case "draft":
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          <Edit className="w-3 h-3 mr-1" />
          Draft
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Urgent</Badge>;
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 95) return "text-green-600";
    if (efficiency >= 90) return "text-blue-600";
    if (efficiency >= 85) return "text-yellow-600";
    return "text-red-600";
  };

  const totalPlans = cuttingPlans.length;
  const activePlans = cuttingPlans.filter(plan => plan.status === "in_progress").length;
  const completedPlans = cuttingPlans.filter(plan => plan.status === "completed").length;
  const averageEfficiency = Math.round(
    cuttingPlans.reduce((sum, plan) => sum + plan.efficiency, 0) / cuttingPlans.length
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Scissors className="w-8 h-8 text-primary" />
              Production Planning
            </h1>
            <p className="text-muted-foreground">
              Manage cutting plans, optimize production, and track efficiency
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </Button>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Plan
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
              <Scissors className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPlans}</div>
              <p className="text-xs text-muted-foreground">
                All cutting plans
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{activePlans}</div>
              <p className="text-xs text-muted-foreground">
                Currently running
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completedPlans}</div>
              <p className="text-xs text-muted-foreground">
                This week
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Efficiency</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getEfficiencyColor(averageEfficiency)}`}>
                {averageEfficiency}%
              </div>
              <p className="text-xs text-muted-foreground">
                Material efficiency
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Cutting Plans</CardTitle>
            <CardDescription>
              Manage production schedules and optimize cutting operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search plans by name, paper type, or operator..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline">Status Filter</Button>
              <Button variant="outline">Priority</Button>
              <Button variant="outline">Schedule</Button>
            </div>

            {/* Plans Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan Details</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Efficiency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Operator</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map((plan) => (
                    <TableRow key={plan.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{plan.planName}</div>
                          <div className="text-sm text-muted-foreground">{plan.id}</div>
                          <div className="text-xs text-muted-foreground">
                            Pattern: {plan.cuttingPattern}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {plan.orderIds.map((orderId, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {orderId}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{plan.paperType}</div>
                          <div className="text-sm text-muted-foreground">
                            {plan.totalSheets.toLocaleString()} sheets
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className={`font-medium ${getEfficiencyColor(plan.efficiency)}`}>
                            {plan.efficiency}%
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Waste: {plan.wastePercentage}%
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(plan.status)}
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(plan.priority)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {plan.scheduledDate}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {plan.estimatedDuration}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{plan.assignedOperator}</div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Plan
                            </DropdownMenuItem>
                            {plan.status === "approved" && (
                              <DropdownMenuItem className="text-green-600">
                                <Play className="mr-2 h-4 w-4" />
                                Start Production
                              </DropdownMenuItem>
                            )}
                            {plan.status === "in_progress" && (
                              <DropdownMenuItem className="text-orange-600">
                                <Pause className="mr-2 h-4 w-4" />
                                Pause Plan
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <BarChart3 className="mr-2 h-4 w-4" />
                              View Analytics
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Plan
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredPlans.length === 0 && (
              <div className="text-center py-8">
                <Scissors className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No plans found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your search criteria or create a new cutting plan.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}