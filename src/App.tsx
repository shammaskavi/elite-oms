import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { toast } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingState } from "@/components/states";

// Code-split routes — keeps the initial bundle small and speeds up first paint.
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const Customers = lazy(() => import("./pages/Customers"));
const Invoices = lazy(() => import("./pages/Invoices"));
const OrdersNew = lazy(() => import("./pages/OrdersNew"));
const OrderDetailNew = lazy(() => import("./pages/OrderDetailNew"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const PublicInvoiceTracking = lazy(() => import("./pages/PublicInvoiceTracking"));
const Payments = lazy(() => import("./pages/Payments"));
const Reports = lazy(() => import("./pages/Reports"));
const AnotherReports = lazy(() => import("./pages/AnotherReports"));
const PublicMeasurementForm = lazy(() => import("./pages/PublicMeasurementForm"));
const KarigarPortal = lazy(() => import("./pages/KarigarPortal"));
const KarigarOrderDetail = lazy(() => import("./pages/KarigarOrderDetail"));
const CreateMeasurement = lazy(() => import("./pages/CreateMeasurement"));
const Measurements = lazy(() => import("./pages/Measurements"));
const ScanLookup = lazy(() => import("./pages/ScanLookup"));
const Reshelve = lazy(() => import("./pages/Reshelve"));
const Receive = lazy(() => import("./pages/Receive"));
const LocationsAdmin = lazy(() => import("./pages/LocationsAdmin"));
const DeadstockReport = lazy(() => import("./pages/DeadstockReport"));
const StockAudit = lazy(() => import("./pages/StockAudit"));

/**
 * Global QueryClient with sensible defaults:
 * - 60s staleTime: avoid refetching everything on every focus
 * - Single retry: don't hammer the network on persistent failures
 * - Mutation errors surface as toasts so silent failures stop happening
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error("[Query error]", query.queryKey, error);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: any) => {
      const message =
        error?.message || "Something went wrong. Please try again.";
      toast.error(message);
    },
  }),
});

const RouteFallback = () => <LoadingState fullScreen message="Loading…" />;

const protectedPage = (Page: React.ComponentType) => (
  <ProtectedRoute>
    <Layout>
      <Page />
    </Layout>
  </ProtectedRoute>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/track/:token" element={<PublicInvoiceTracking />} />
                <Route path="/m/:token" element={<PublicMeasurementForm />} />
                <Route path="/karigar/:token" element={<KarigarPortal />} />
                <Route path="/karigar/order/:id" element={<KarigarOrderDetail />} />
                <Route path="/auth" element={<Auth />} />

                <Route path="/" element={protectedPage(Dashboard)} />
                <Route path="/products" element={protectedPage(Products)} />
                <Route path="/customers" element={protectedPage(Customers)} />
                <Route path="/measurements" element={protectedPage(Measurements)} />
                <Route path="/measurements/new" element={protectedPage(CreateMeasurement)} />
                <Route path="/customers/:id" element={protectedPage(CustomerDetail)} />
                <Route path="/invoices" element={protectedPage(Invoices)} />
                <Route path="/orders" element={protectedPage(OrdersNew)} />
                <Route path="/orders/:id" element={protectedPage(OrderDetailNew)} />
                <Route path="/payments" element={protectedPage(Payments)} />
                <Route path="/reports-dusra" element={protectedPage(AnotherReports)} />
                <Route path="/reports" element={protectedPage(Reports)} />
                <Route path="/scan" element={protectedPage(ScanLookup)} />
                <Route path="/reshelve" element={protectedPage(Reshelve)} />
                <Route path="/receive" element={protectedPage(Receive)} />
                <Route path="/locations" element={protectedPage(LocationsAdmin)} />
                <Route path="/deadstock" element={protectedPage(DeadstockReport)} />
                <Route path="/stock-count" element={protectedPage(StockAudit)} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
