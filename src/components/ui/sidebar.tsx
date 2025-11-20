import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { VariantProps, cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PanelLeft, ChevronLeft, ChevronRight } from "lucide-react";

const SidebarContext = React.createContext<any>(null);

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}

export const SidebarProvider = ({
  children,
  defaultCollapsed = false,
}: {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) => {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
};

/* ---------------- SIDEBAR ROOT ---------------- */

export const Sidebar = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        "hidden lg:flex lg:flex-col h-screen border-r bg-card transition-all duration-300",
        collapsed ? "w-20" : "w-64",
        className
      )}
    >
      {children}
    </div>
  );
};

/* ---------------- COLLAPSE BUTTON ---------------- */

export const SidebarCollapseButton = () => {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <button
      onClick={() => setCollapsed(!collapsed)}
      className="absolute -right-3 top-24 z-50 h-7 w-7 rounded-full bg-card border shadow flex items-center justify-center hover:bg-muted transition"
    >
      {collapsed ? <ChevronRight /> : <ChevronLeft />}
    </button>
  );
};

/* ---------------- HEADER ---------------- */

export const SidebarHeader = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        "flex items-center gap-2 h-16 px-4 transition-all",
        collapsed && "justify-center",
        className
      )}
    >
      {children}
    </div>
  );
};

/* ---------------- CONTENT WRAPPER ---------------- */

export const SidebarContent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn("flex flex-col flex-1 overflow-y-auto py-4", className)}
    >
      {children}
    </div>
  );
};

/* ---------------- MENU ---------------- */

export const SidebarMenu = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { collapsed } = useSidebar();

  return (
    <ul
      className={cn(
        "flex flex-col gap-4 w-full px-4",
        collapsed && "items-center px-2",
        className
      )}
    >
      {children}
    </ul>
  );
};

export const SidebarMenuItem = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <li className={cn("w-full", className)}>{children}</li>;

const sidebarMenuButtonVariants = cva(
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full",
  {
    variants: {
      active: {
        true: "bg-primary text-primary-foreground",
        false: "text-muted-foreground hover:bg-muted hover:text-foreground",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    collapsed?: boolean;
    onClick?: () => void;
  }
>(({ icon, label, active, onClick }, ref) => {
  const { collapsed } = useSidebar();

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={cn(
        sidebarMenuButtonVariants({ active }),
        collapsed && "justify-center px-2"
      )}
    >
      <span className="h-6 w-6 flex items-center justify-center">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

/* ---------------- FOOTER ---------------- */

export const SidebarFooter = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        "mt-auto pb-4 px-4",
        collapsed && "flex justify-center px-2",
        className
      )}
    >
      {children}
    </div>
  );
};