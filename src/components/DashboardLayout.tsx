/**
 * Dashboard Layout Component with Sidebar
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  FileText,
  Scissors,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Star,
  ChevronDown,
  ChevronRight,
  QrCode,
  Truck,
  BarChart3,
  Receipt,
  Recycle,
  Package,
  Database,
  Clock,
  Weight,
  Barcode
} from "lucide-react";
import { getCurrentUser, logout } from "@/lib/auth";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const getNavigationForRole = (role: string | null) => {
  const allNavigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "co_admin", "production"],
    },
    {
      name: "Masters",
      icon: FileText,
      roles: ["admin", "order_puncher", "co_admin", "accountant","accountant2","security", "sales_person"],
      children: [
        { name: "Client Master", href: "/masters/clients", roles: ["admin", "order_puncher", "co_admin", "accountant","accountant2","security", "sales_person"] },
        { name: "Order Master", href: "/masters/orders", roles: ["admin", "order_puncher", "co_admin", "accountant","accountant2", "sales_person"] },
        { name: "Order Edit Logs", href: "/masters/orders/edit-logs", roles: ["admin", "co_admin"] },
        { name: "Pending Orders", href: "/masters/pending-orders", roles: ["admin", "production", "sales_person"] },
        { name: "Plan Master", href: "/masters/plans", roles: ["admin"] },
        { name: "Deletion Logs", href: "/masters/deletion-logs", roles: ["admin"] },
        { name: "User Master", href: "/masters/users", roles: ["admin"] },
        { name: "Paper Master", href: "/masters/papers", roles: ["admin", "order_puncher", "accountant","accountant2"] },
        { name: "Material Master", href: "/masters/materials", roles: ["admin", "accountant","accountant2","security"] },
        { name: "Manual Cut Rolls", href: "/masters/cut-rolls", roles: ["admin", "production", "accountant","accountant2"] },
      ],
    },
    
    {
      name: "Inventory",
      href: "/inventory/past-inventory",
      icon: Package,
      roles: ["admin"],
    },
    
    {
      name: "Planning",
      href: "/planning",
      icon: Scissors,
      roles: ["admin"],
    },
    {
      name: "Manual Plan",
      href: "/planning/manual",
      icon: Database,
      roles: ["admin" ],
    },
    {
      name: "Stock",
      href: "/wastage",
      icon: Recycle,
      roles: ["admin", "accountant","accountant2"],
    },
    {
      name: "Weight Update",
      href: "/weight-update",
      icon: Database,
      roles: ["admin", "weight_update", "accountant","accountant2",'dispatch'],
    },
    {
      name: "In/Out",
      href: "/in-out",
      icon: Database,
      roles: ["admin", "security", "accountant","accountant2"],
    },
    {
      name: "Outward Challan",
      href: "/outward-challan",
      icon: Database,
      roles: ["dispatch" ],
    },
    
    {
      name: "MOU",
      icon: Clock,
      roles: ["admin", "accountant","accountant2", "mou"],
      children: [
        { name: "MOU Entry", href: "/mou", roles: ["admin", "accountant","accountant2", "mou"] },
        { name: "MOU Reports", href: "/mou-reports", roles: ["admin", "accountant","accountant2", "mou"] },
      ],
    },

    {
      name: "Dispatch",
      icon: Truck,
      roles: ["admin", "co_admin", "accountant","accountant2", "dispatch"],
      children: [
        { name: "Current Dispatch", href: "/dispatch/history", roles: ["admin", "co_admin", "accountant","accountant2", "sales_person"] },
        { name: "Past Dispatch", href: "/past-dispatch", roles: ["admin", "co_admin", "accountant","accountant2"] },
      ],
    },
    { name: "Current Dispatch",icon: Truck, href: "/dispatch/history", roles: ["dispatch", "sales_person"] },
    { name: "Plan Weights",icon: Weight, href: "/plan-weights", roles: ["dispatch"] },
    { name: "All cut rolls",icon: BarChart3, href: "/reports/all-cut-rolls", roles: ["dispatch"] },
    { name: "Filter Cut Rolls",icon: BarChart3, href: "/reports/all-cut-rolls-filtered", roles: ["dispatch"] },
    
    {
      name: "Bills",
      icon: Receipt,
      roles: ["admin", "accountant","accountant2"],
      children: [
        { name: "Bill Management", href: "/challan", roles: ["admin", "accountant","accountant2"] },
        { name: "Added Bills", href: "/bills", roles: ["admin", "accountant"] },
      ],
    },
    {
      name: "Set Jumbo Roll",
      href: "/current-jumbo",
      icon: Clock,
      roles: ["admin"],
    },
    {
      name: "QR Scanner",
      href: "/qr-scanner",
      icon: QrCode,
      roles: ["admin", "production"],
    },
    {
      name: "Barcode Lookup",
      href: "/barcode-lookup",
      icon: Barcode,
      roles: ["admin","dispatch"],
    },
    {
      name: "Reports",
      icon: BarChart3,
      roles: ["admin", "production", "accountant","accountant2", "dispatch"],
      children: [
        { name: "Analytics Dashboard", href: "/reports", roles: ["admin", "production", "accountant","accountant2"] },
        { name: "Client-Order Analysis", href: "/reports/client-orders", roles: ["admin", "production", "accountant","accountant2"] },
        { name: "Plan Report", href: "/reports/client-orders-plans", roles: ["admin"] },
        { name: "Order-Plan Execution", href: "/reports/order-plan-execution", roles: ["admin", "production", "accountant","accountant2"] },
        { name: "Client Order Summary", href: "/reports/client-order-summary", roles: ["admin", "production", "accountant","accountant2"] },
        { name: "Cut Rolls Report", href: "/reports/cut-rolls-weight", roles: ["admin", "production"] },
        { name: "All Cut Rolls", href: "/reports/all-cut-rolls", roles: ["admin", "production", "accountant","accountant2"] },
        { name: "Filter Cut Rolls", href: "/reports/all-cut-rolls-filtered", roles: ["admin", "production", "accountant","accountant2"] },
        { name: "Plan Weights", href: "/plan-weights", roles: ["admin"] },
      ],
    },
    {
      name: "Hour Calculator",
      href: "/hour-calculator",
      icon: Clock,
      roles: ["admin"],
    },
  ];

  // Filter navigation based on user role
  return allNavigation.filter(item => {
    if (!role || !item.roles.includes(role)) return false;

    // Filter children if they exist
    if (item.children) {
      item.children = item.children.filter(child =>
        child.roles.includes(role)
      );
      // Only show parent if it has accessible children
      return item.children.length > 0;
    }

    return true;
  });
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(["Masters"]);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const user = getCurrentUser();
  const userRole = typeof window !== "undefined" ? localStorage.getItem("user_role") : null;
  const navigation = getNavigationForRole(userRole);

  const handleLogout = () => {
    console.log('Logout button clicked');
    setShowLogoutDialog(true);
  };

  const confirmLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev => 
      prev.includes(name) 
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  const isActive = (href: string) => {
    return pathname === href;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-card/95 backdrop-blur-sm border-r border-border
        transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-2 px-6 border-b border-border">
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">Paper Roll System</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.children ? (
                  <div>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start gap-3 h-10 ${
                        expandedItems.includes(item.name) ? 'bg-muted' : ''
                      }`}
                      onClick={() => toggleExpanded(item.name)}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="flex-1 text-left">{item.name}</span>
                      {expandedItems.includes(item.name) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                    {expandedItems.includes(item.name) && (
                      <div className="ml-6 mt-2 space-y-1">
                        {item.children.map((child) => (
                          <Button
                            key={child.name}
                            variant="ghost"
                            size="sm"
                            className={`w-full justify-start h-8 ${
                              isActive(child.href) ? 'bg-primary/10 text-primary' : ''
                            }`}
                            asChild
                          >
                            <Link href={child.href}>
                              {child.name}
                            </Link>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 h-10 ${
                      isActive(item.href!) ? 'bg-primary/10 text-primary' : ''
                    }`}
                    asChild
                  >
                    <Link href={item.href!}>
                      <item.icon className="w-4 h-4" />
                      {item.name}
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </nav>

          {/* User menu */}
          <div className="border-t border-border p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-12">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{user}</p>
                    <p className="text-xs text-muted-foreground">User</p>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="flex h-full items-center gap-4 px-6">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-4 h-4" />
            </Button>
            <div className="flex-1" />
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>

      {/* Logout confirmation dialog */}
      <ConfirmDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        onConfirm={confirmLogout}
        title="Confirm Logout"
        description="Are you sure you want to logout? You will need to sign in again to access the system."
        confirmText="Logout"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}