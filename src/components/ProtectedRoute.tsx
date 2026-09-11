import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LoadingState } from "@/components/states";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState fullScreen message="Checking your session…" />;
  }

  if (!user) {
    // Preserve the attempted location so we can return after sign-in.
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (adminOnly && !isAdmin) {
    toast.error("Admin access required.");
    return <Navigate to="/orders" replace />;
  }

  return <>{children}</>;
}
