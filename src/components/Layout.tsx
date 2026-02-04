import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import Logo from "../assets/logo.svg";
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  ShoppingBag,
  LogOut,
  Menu,
  X,
  BadgeIndianRupee
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Orders", href: "/orders", icon: Package },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Products", href: "/products", icon: ShoppingBag },
  { name: "Payments", href: "/payments", icon: BadgeIndianRupee },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);   // mobile sidebar
  const [collapsed, setCollapsed] = useState(false);       // desktop collapse

  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">

      {/* ====================== MOBILE SIDEBAR (UNCHANGED) ====================== */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden",
          sidebarOpen ? "block" : "hidden"
        )}
        onClick={() => setSidebarOpen(false)}
      >
        <div
          className="fixed inset-y-0 left-0 w-64 bg-card shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-16 items-center justify-between border-b px-6">
            <div className="flex items-center gap-2">
              <img src={Logo} alt="Elite CRM logo" className="h-6 w-6" />
              <span className="text-lg font-semibold">Elite CRM</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-4">
            <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* ====================== DESKTOP SIDEBAR (COLLAPSIBLE) ====================== */}
      <div
        className={cn(
          "hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col border-r bg-card px-6 transition-all duration-300",
          collapsed ? "lg:w-20" : "lg:w-64"
        )}
      >
        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-50 h-7 w-7 rounded-full bg-card shadow-md border flex items-center justify-center hover:bg-muted transition"
        >
          {collapsed ? "›" : "‹"}
        </button>

        {/* ====================== FIXED LOGO SECTION ====================== */}
        <div className="flex h-16 shrink-0 items-center gap-2">
          <img src={Logo} alt="Elite CRM logo" className="h-6 w-6" />

          {/* ONLY CHANGE: hide text when collapsed */}
          {!collapsed && (
            <span className="text-lg font-semibold whitespace-nowrap">
              Elite CRM
            </span>
          )}
        </div>
        {/* =============================================================== */}

        <nav className="flex flex-1 flex-col">
          <ul className="flex flex-1 flex-col gap-y-4 items-center">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;

              return (
                <li key={item.name} className="w-full">
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",

                      // EXPANDED ACTIVE STATE (full width pill)
                      !collapsed && isActive && "bg-primary text-primary-foreground",

                      // COLLAPSED ACTIVE STATE (centered rounded icon pill)
                      collapsed &&
                      isActive &&
                      "px-0 py-0 w-10 h-10 justify-center bg-primary/10 text-primary rounded-xl",

                      // DEFAULT INACTIVE STATE
                      !isActive &&
                      "text-muted-foreground hover:bg-muted hover:text-foreground",

                      // COLLAPSED INACTIVE STATE — tighten spacing
                      collapsed && !isActive && "px-0 justify-center"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-6 w-6 shrink-0 transition",
                        collapsed && isActive && "text-primary"
                      )}
                    />

                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto pb-4">
            <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && "Sign Out"}
            </Button>
          </div>
        </nav>
      </div>

      {/* ====================== MAIN CONTENT ====================== */}
      <div
        className={cn(
          "transition-all duration-300",
          collapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-card px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          {/* Mobile hamburger button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}