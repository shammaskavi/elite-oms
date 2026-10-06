/**
 * Centralized Query Key Factory
 * Provides type-safe hierarchical query keys for TanStack Query across the entire application.
 */

export const queryKeys = {
  // Orders
  orders: {
    all: ["orders"] as const,
    lists: () => [...queryKeys.orders.all, "list"] as const,
    list: (filters?: Record<string, any>) =>
      [...queryKeys.orders.lists(), filters] as const,
    details: () => [...queryKeys.orders.all, "detail"] as const,
    detail: (id: string) => ["order", id] as const,
    stages: (orderId: string) => ["order-stages", orderId] as const,
    stageLog: (orderId: string, productNumber: number) =>
      ["order-stages-log", orderId, productNumber] as const,
    stats: () => ["order-stats"] as const,
  },

  // Invoices
  invoices: {
    all: ["invoices"] as const,
    lists: () => [...queryKeys.invoices.all, "list"] as const,
    list: (filters?: Record<string, any>) =>
      [...queryKeys.invoices.lists(), filters] as const,
    details: () => [...queryKeys.invoices.all, "detail"] as const,
    detail: (id: string) => ["invoice", id] as const,
    payments: (invoiceId: string) => ["invoice-payments", invoiceId] as const,
    paymentsForInvoice: (invoiceId: string) =>
      ["invoice-payments-for-invoice", invoiceId] as const,
    ordersWithStages: (invoiceId: string) =>
      ["invoice-orders-with-stages", invoiceId] as const,
    paymentStatus: (invoiceId: string) =>
      ["invoice-payment-status", invoiceId] as const,
    paymentsRegister: () => ["payments-register"] as const,
    receipt: (receiptId: string) => ["receipt", receiptId] as const,
    receiptAllocations: (receiptId: string) =>
      ["receipt-allocations", receiptId] as const,
  },

  // Customers
  customers: {
    all: ["customers"] as const,
    withInvoices: () => ["customers-with-invoices"] as const,
    detail: (id: string) => ["customer", id] as const,
    invoices: (id: string) => ["customer-invoices", id] as const,
    payments: (id: string) => ["customer-payments", id] as const,
    orders: (id: string) => ["customer-orders", id] as const,
    measurements: (id: string) => ["customer-measurements", id] as const,
    measurementsForOrder: (id: string) =>
      ["customer-measurements-for-order", id] as const,
  },

  // Products & Stock
  products: {
    all: ["products"] as const,
    list: (filters?: Record<string, any>) =>
      ["products", "list", filters] as const,
    detail: (id: string) => ["product", id] as const,
    stockUnits: (productId?: string) =>
      ["stock-units", productId || "all"] as const,
  },

  // Stages & Workflow
  stages: {
    all: ["stages"] as const,
    list: () => ["stages-list"] as const,
  },

  // Vendors & Karigars
  vendors: {
    all: ["vendors"] as const,
    byStage: (stageId: string | null) =>
      ["vendors-by-stage", stageId] as const,
    detail: (id: string) => ["vendor", id] as const,
    orders: (id: string) => ["vendor-orders", id] as const,
  },

  // Locations & Physical Warehouse
  locations: {
    all: ["locations"] as const,
  },

  // Measurements
  measurements: {
    all: ["measurements"] as const,
    templates: () => ["measurement-templates-list"] as const,
    fields: (templateId?: string | null) =>
      ["measurement-fields-for-template", templateId] as const,
  },

  // Dashboard & Reports
  dashboard: {
    data: (timePeriod: string, isAdmin?: boolean) =>
      ["dashboard-data", timePeriod, isAdmin] as const,
  },

  reports: {
    ownerSummary: (dateRange?: any) => ["owner-summary", dateRange] as const,
    ownerInsights: (dateRange?: any) => ["owner-insights", dateRange] as const,
    cashInflowDaily: (dateRange?: any) =>
      ["cash-inflow-daily", dateRange] as const,
    revenueTrend: (dateRange?: any) => ["revenue-trend", dateRange] as const,
    processBreakdown: () => ["process-breakdown"] as const,
    vendorLoad: () => ["vendor-load"] as const,
    deliveryRisk: () => ["delivery-risk"] as const,
  },

  // SPE Clienteling CRM
  crm: {
    dashboard: () => ["crm-dashboard-stats"] as const,
    tasks: (filter?: string) => ["crm-tasks", filter] as const,
    leads: (status?: string) => ["crm-leads", status] as const,
    segments: () => ["crm-segments"] as const,
    inbox: () => ["crm-inbox"] as const,
  },
} as const;

export default queryKeys;
