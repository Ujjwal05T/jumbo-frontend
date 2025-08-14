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
  Receipt
} from "lucide-react";
import { getCurrentUser, logout } from "@/lib/auth";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Masters",
    icon: FileText,
    children: [
      { name: "Client Master", href: "/masters/clients" },
      { name: "Order Master", href: "/masters/orders" },
      { name: "Pending Orders", href: "/masters/pending-orders" },
      { name: "Plan Master", href: "/masters/plans" },
      { name: "User Master", href: "/masters/users" },
      { name: "Paper Master", href: "/masters/papers" },
    ],
  },
  {
    name: "Planning",
    href: "/planning",
    icon: Scissors,
  },
  {
    name: "Dispatch",
    href: "/dispatch",
    icon: Truck,
  },
  {
    name: "Challan",
    href: "/challan",
    icon: Receipt,
  },
  {
    name: "QR Scanner",
    href: "/qr-scanner",
    icon: QrCode,
  },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(["Masters"]);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const user = getCurrentUser();

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
    return pathname === href || pathname.startsWith(href + "/");
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