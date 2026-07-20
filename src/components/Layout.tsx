import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  BadgeIndianRupee,
  FileChartPie,
  PencilRuler,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Orders", href: "/orders", icon: Package },
  { name: "Measurements", href: "/measurements", icon: PencilRuler },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Products", href: "/products", icon: ShoppingBag },
  { name: "Payments", href: "/payments", icon: BadgeIndianRupee },
  { name: "Reports", href: "/reports", icon: FileChartPie },
];

const COLLAPSED_KEY = "spe.sidebar.collapsed";

const isActiveRoute = (current: string, href: string) => {
  if (href === "/") return current === "/";
  return current === href || current.startsWith(href + "/");
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile sidebar
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const { signOut } = useAuth();
  const location = useLocation();

  // Persist collapsed preference.
  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Close mobile sidebar whenever route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Allow Esc to close mobile drawer.
  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sidebarOpen]);

  const SidebarNavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
    <ul className="flex flex-1 flex-col gap-y-1">
      {navigation.map((item) => {
        const isActive = isActiveRoute(location.pathname, item.href);
        const link = (
          <Link
            to={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              !collapsed && isActive && "bg-primary text-primary-foreground hover:bg-primary/90",
              collapsed && isActive && "bg-primary/10 text-primary",
              !isActive && "text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            <item.icon className={cn("h-5 w-5 shrink-0")} aria-hidden="true" />
            {!collapsed && <span>{item.name}</span>}
            {collapsed && <span className="sr-only">{item.name}</span>}
          </Link>
        );

        return (
          <li key={item.name}>
            {collapsed ? (
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            ) : (
              link
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* ====================== MOBILE SIDEBAR ====================== */}
        <div
          className={cn(
            "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden transition-opacity duration-300",
            sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setSidebarOpen(false)}
          aria-hidden={!sidebarOpen}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            className={cn(
              "fixed inset-y-0 left-0 flex w-64 flex-col bg-card shadow-lg transform transition-transform duration-300",
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-16 items-center justify-between border-b px-6">
              <div className="flex items-center gap-2">
                <img src={Logo} alt="" aria-hidden="true" className="h-6 w-6" />
                <span className="text-lg font-semibold">Saree Palace Elite</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close menu"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav aria-label="Primary" className="flex-1 overflow-y-auto p-4">
              <SidebarNavItems onNavigate={() => setSidebarOpen(false)} />
            </nav>

            <div className="border-t p-4">
              <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </aside>
        </div>

        {/* ====================== DESKTOP SIDEBAR ====================== */}
        <aside
          aria-label="Primary navigation"
          className={cn(
            "hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col border-r bg-card transition-[width] duration-300",
            collapsed ? "lg:w-20" : "lg:w-64"
          )}
        >
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn(
              "absolute -right-3 top-20 z-50 flex h-7 w-7 items-center justify-center rounded-full border bg-card shadow-md transition hover:bg-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <div className={cn("flex h-16 shrink-0 items-center gap-2", collapsed ? "justify-center px-2" : "px-6")}>
            <img src={Logo} alt="" aria-hidden="true" className="h-6 w-6" />
            {!collapsed && (
              <span className="whitespace-nowrap text-lg font-semibold">Saree Palace Elite</span>
            )}
          </div>

          <nav aria-label="Primary" className={cn("flex flex-1 flex-col", collapsed ? "px-2" : "px-4")}>
            <SidebarNavItems />

            <div className="mt-auto pb-4 pt-2">
              {collapsed ? (
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-full" onClick={signOut} aria-label="Sign out">
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign out</TooltipContent>
                </Tooltip>
              ) : (
                <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              )}
            </div>
          </nav>
        </aside>

        {/* ====================== MAIN CONTENT ====================== */}
        <div
          className={cn(
            "transition-[padding] duration-300",
            collapsed ? "lg:pl-20" : "lg:pl-64"
          )}
        >
          <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-card px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-2 lg:hidden">
              <img src={Logo} alt="" aria-hidden="true" className="h-5 w-5" />
              <span className="text-sm font-semibold">Saree Palace Elite</span>
            </div>
          </header>

          <main id="main" tabIndex={-1} className="py-8 focus:outline-none">
            <div className="px-4 sm:px-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
