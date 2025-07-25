/**
 * Pending Order Master page - Manage pending orders
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
  Clock, 
  Search, 
  MoreHorizontal, 
  CheckCircle, 
  XCircle, 
  Eye,
  AlertTriangle,
  Calendar,
  DollarSign,
  Package,
  Play
} from "lucide-react";

interface PendingOrder {
  id: string;
  clientName: string;
  clientCompany: string;
  orderDate: string;
  requestedDelivery: string;
  daysWaiting: number;
  totalAmount: number;
  paperType: string;
  quantity: number;
  priority: "low" | "medium" | "high" | "urgent";
  reason: string;
  estimatedProcessingTime: string;
}

export default function PendingOrderMasterPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Dummy pending order data
  const pendingOrders: PendingOrder[] = [
    {
      id: "ORD-003",
      clientName: "Michael Brown",
      clientCompany: "Tech Solutions Corp",
      orderDate: "2024-01-18",
      requestedDelivery: "2024-01-23",
      daysWaiting: 5,
      totalAmount: 3200.00,
      paperType: "Custom Size",
      quantity: 2500,
      priority: "high",
      reason: "Awaiting material availability",
      estimatedProcessingTime: "2-3 days"
    },
    {
      id: "ORD-007",
      clientName: "Robert Johnson",
      clientCompany: "Print Masters Inc",
      orderDate: "2024-01-19",
      requestedDelivery: "2024-01-26",
      daysWaiting: 4,
      totalAmount: 1750.00,
      paperType: "A4 Premium",
      quantity: 3500,
      priority: "medium",
      reason: "Quality check in progress",
      estimatedProcessingTime: "1-2 days"
    },
    {
      id: "ORD-008",
      clientName: "Jennifer Davis",
      clientCompany: "Creative Agency",
      orderDate: "2024-01-20",
      requestedDelivery: "2024-01-27",
      daysWaiting: 3,
      totalAmount: 2900.00,
      paperType: "A3 Glossy",
      quantity: 1800,
      priority: "urgent",
      reason: "Awaiting client approval",
      estimatedProcessingTime: "1 day"
    },
    {
      id: "ORD-009",
      clientName: "Mark Wilson",
      clientCompany: "Business Solutions",
      orderDate: "2024-01-21",
      requestedDelivery: "2024-01-28",
      daysWaiting: 2,
      totalAmount: 1450.00,
      paperType: "A5 Standard",
      quantity: 4200,
      priority: "low",
      reason: "Production queue",
      estimatedProcessingTime: "3-4 days"
    },
    {
      id: "ORD-010",
      clientName: "Amanda Taylor",
      clientCompany: "Design Studio Pro",
      orderDate: "2024-01-22",
      requestedDelivery: "2024-01-29",
      daysWaiting: 1,
      totalAmount: 3800.00,
      paperType: "Custom Premium",
      quantity: 1200,
      priority: "high",
      reason: "Special coating required",
      estimatedProcessingTime: "2-3 days"
    }
  ];

  const filteredOrders = pendingOrders.filter(order =>
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.clientCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.paperType.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const getWaitingBadge = (days: number) => {
    if (days >= 5) {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{days} days</Badge>;
    } else if (days >= 3) {
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{days} days</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{days} days</Badge>;
    }
  };

  const totalPendingValue = pendingOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const urgentOrders = pendingOrders.filter(order => order.priority === "urgent").length;
  const averageWaitTime = Math.round(
    pendingOrders.reduce((sum, order) => sum + order.daysWaiting, 0) / pendingOrders.length
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Clock className="w-8 h-8 text-primary" />
              Pending Orders
            </h1>
            <p className="text-muted-foreground">
              Manage and prioritize orders awaiting processing
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Play className="w-4 h-4" />
              Process All
            </Button>
            <Button className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Approve Selected
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting processing
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Urgent Orders</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{urgentOrders}</div>
              <p className="text-xs text-muted-foreground">
                Require immediate attention
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averageWaitTime} days</div>
              <p className="text-xs text-muted-foreground">
                Average processing delay
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalPendingValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Total order value
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Order Queue</CardTitle>
            <CardDescription>
              Review and process orders waiting for approval or production
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pending orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline">Priority Filter</Button>
              <Button variant="outline">Sort by Wait Time</Button>
            </div>

            {/* Pending Orders Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Details</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Wait Time</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Est. Processing</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{order.id}</div>
                          <div className="text-sm text-muted-foreground">
                            Ordered: {order.orderDate}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Due: {order.requestedDelivery}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{order.clientName}</div>
                          <div className="text-sm text-muted-foreground">{order.clientCompany}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{order.paperType}</div>
                          <div className="text-sm text-muted-foreground">
                            Qty: {order.quantity.toLocaleString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(order.priority)}
                      </TableCell>
                      <TableCell>
                        {getWaitingBadge(order.daysWaiting)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-[150px] truncate" title={order.reason}>
                          {order.reason}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{order.estimatedProcessingTime}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">${order.totalAmount.toLocaleString()}</div>
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
                            <DropdownMenuItem className="text-green-600">
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve & Process
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Package className="mr-2 h-4 w-4" />
                              Update Status
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject Order
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredOrders.length === 0 && (
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No pending orders found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  All orders are currently being processed or completed.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}