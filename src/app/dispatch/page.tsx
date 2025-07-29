/**
 * Dispatch page - Manage order items in production and mark them as completed
 */
"use client";

import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Truck,
  Search,
  MoreHorizontal,
  CheckCircle,
  Clock,
  Package,
  AlertCircle,
  Eye,
  MapPin,
  Calendar,
  User,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// Dummy data for order items in production
const dummyDispatchItems = [
  {
    id: "1",
    orderId: "ORD-001",
    clientName: "ABC Printing Co.",
    contactPerson: "John Smith",
    paperType: "Glossy A4 - 90gsm",
    width: 29,
    quantity: 500,
    quantityProduced: 500,
    status: "ready_for_dispatch",
    priority: "high",
    productionDate: "2024-01-15",
    expectedDelivery: "2024-01-18",
    address: "123 Business St, Industrial Area, City",
    phone: "+1-234-567-8900",
    notes: "Handle with care - glossy finish",
  },
  {
    id: "2",
    orderId: "ORD-002",
    clientName: "XYZ Publications",
    contactPerson: "Sarah Johnson",
    paperType: "Matte A3 - 120gsm",
    width: 42,
    quantity: 300,
    quantityProduced: 300,
    status: "ready_for_dispatch",
    priority: "normal",
    productionDate: "2024-01-16",
    expectedDelivery: "2024-01-19",
    address: "456 Print Ave, Downtown, City",
    phone: "+1-234-567-8901",
    notes: "Urgent delivery required",
  },
  {
    id: "3",
    orderId: "ORD-003",
    clientName: "Quick Print Services",
    contactPerson: "Mike Wilson",
    paperType: "Standard A4 - 80gsm",
    width: 21,
    quantity: 1000,
    quantityProduced: 1000,
    status: "in_transit",
    priority: "normal",
    productionDate: "2024-01-14",
    expectedDelivery: "2024-01-17",
    address: "789 Commerce Blvd, Business Park, City",
    phone: "+1-234-567-8902",
    notes: "Regular customer - standard packaging",
  },
  {
    id: "4",
    orderId: "ORD-004",
    clientName: "Premium Graphics Ltd",
    contactPerson: "Lisa Chen",
    paperType: "Premium Glossy A2 - 150gsm",
    width: 59,
    quantity: 200,
    quantityProduced: 200,
    status: "ready_for_dispatch",
    priority: "urgent",
    productionDate: "2024-01-16",
    expectedDelivery: "2024-01-18",
    address: "321 Design Street, Creative District, City",
    phone: "+1-234-567-8903",
    notes: "Premium quality - extra protective packaging",
  },
  {
    id: "5",
    orderId: "ORD-005",
    clientName: "Local News Daily",
    contactPerson: "Robert Brown",
    paperType: "Newsprint A1 - 45gsm",
    width: 84,
    quantity: 2000,
    quantityProduced: 2000,
    status: "dispatched",
    priority: "high",
    productionDate: "2024-01-13",
    expectedDelivery: "2024-01-16",
    address: "654 Media Lane, Press Quarter, City",
    phone: "+1-234-567-8904",
    notes: "Daily newspaper - time sensitive",
  },
];

type DispatchStatus = "ready_for_dispatch" | "in_transit" | "dispatched";

export default function DispatchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dispatchItems, setDispatchItems] = useState(dummyDispatchItems);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    itemId: string;
    itemName: string;
    action: "dispatch" | "complete";
  }>({ open: false, itemId: "", itemName: "", action: "dispatch" });

  const filteredItems = dispatchItems.filter(
    (item) =>
      item.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.paperType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStatusChange = (item: any, newStatus: DispatchStatus) => {
    const action = newStatus === "dispatched" ? "complete" : "dispatch";
    setConfirmDialog({
      open: true,
      itemId: item.id,
      itemName: `${item.orderId} - ${item.clientName}`,
      action,
    });
  };

  const confirmStatusChange = () => {
    const { itemId, action } = confirmDialog;
    const newStatus = action === "complete" ? "dispatched" : "in_transit";

    setDispatchItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, status: newStatus as DispatchStatus }
          : item
      )
    );

    const actionText = action === "complete" ? "completed" : "dispatched";
    toast.success(`Order item marked as ${actionText} successfully!`);
  };

  const getStatusBadge = (status: DispatchStatus) => {
    switch (status) {
      case "ready_for_dispatch":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <Package className="w-3 h-3 mr-1" />
            Ready for Dispatch
          </Badge>
        );
      case "in_transit":
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
            <Truck className="w-3 h-3 mr-1" />
            In Transit
          </Badge>
        );
      case "dispatched":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Dispatched
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            High
          </Badge>
        );
      case "normal":
        return <Badge variant="outline">Normal</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const readyForDispatch = dispatchItems.filter(
    (item) => item.status === "ready_for_dispatch"
  ).length;
  const inTransit = dispatchItems.filter(
    (item) => item.status === "in_transit"
  ).length;
  const dispatched = dispatchItems.filter(
    (item) => item.status === "dispatched"
  ).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Truck className="w-8 h-8 text-primary" />
              Dispatch Management
            </h1>
            <p className="text-muted-foreground">
              Manage order items ready for dispatch and track delivery status
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dispatchItems.length}</div>
              <p className="text-xs text-muted-foreground">
                Production completed
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ready for Dispatch
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {readyForDispatch}
              </div>
              <p className="text-xs text-muted-foreground">Awaiting dispatch</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Transit</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {inTransit}
              </div>
              <p className="text-xs text-muted-foreground">
                Currently shipping
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dispatched</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {dispatched}
              </div>
              <p className="text-xs text-muted-foreground">
                Successfully delivered
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Dispatch Items Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Dispatch Queue</CardTitle>
                <CardDescription>
                  Manage order items ready for dispatch and delivery
                </CardDescription>
              </div>
              <div className="w-64">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search orders..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>Order & Client</TableHead>
                    <TableHead>Product Details</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Delivery Info</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{item.orderId}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.clientName}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {item.contactPerson}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{item.paperType}</div>
                            <div className="text-sm text-muted-foreground">
                              Width: {item.width}"
                            </div>
                            {item.notes && (
                              <div className="text-xs text-muted-foreground italic">
                                {item.notes}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div className="font-medium">{item.quantity}</div>
                            <div className="text-xs text-muted-foreground">
                              rolls
                            </div>
                            <div className="text-xs text-green-600">
                              {item.quantityProduced} produced
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(
                                item.expectedDelivery
                              ).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {item.address.split(",")[0]}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status as DispatchStatus)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              {item.status === "ready_for_dispatch" && (
                                <DropdownMenuItem
                                  className="text-blue-600"
                                  onClick={() =>
                                    handleStatusChange(item, "in_transit")
                                  }>
                                  <Truck className="mr-2 h-4 w-4" />
                                  Mark as Dispatched
                                </DropdownMenuItem>
                              )}
                              {item.status === "in_transit" && (
                                <DropdownMenuItem
                                  className="text-green-600"
                                  onClick={() =>
                                    handleStatusChange(item, "dispatched")
                                  }>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Mark as Delivered
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        No dispatch items found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={
          confirmDialog.action === "complete"
            ? "Mark as Delivered"
            : "Mark as Dispatched"
        }
        description={`Are you sure you want to mark "${
          confirmDialog.itemName
        }" as ${
          confirmDialog.action === "complete" ? "delivered" : "dispatched"
        }?`}
        confirmText={
          confirmDialog.action === "complete"
            ? "Mark Delivered"
            : "Mark Dispatched"
        }
        cancelText="Cancel"
        variant="default"
        onConfirm={confirmStatusChange}
      />
    </DashboardLayout>
  );
}
