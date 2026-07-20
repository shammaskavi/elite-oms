import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LoadingState } from "@/components/states";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
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

  return <>{children}</>;
}
