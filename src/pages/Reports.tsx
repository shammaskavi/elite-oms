import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    BarChart,
    Bar,
    Legend,
    PieChart,
    Pie,
    Cell,
} from "recharts";

export default function Reports() {
    /* =========================
       BUSINESS OVERVIEW DATA
    ========================== */

    const { data: overview } = useQuery({
        queryKey: ["monthly-owner-summary"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .rpc("get_monthly_owner_summary");

            if (error) throw error;

            // Supabase RPC can return:
            // 1) [{ get_monthly_owner_summary: {...} }]
            // 2) { get_monthly_owner_summary: {...} }
            // 3) {...} (direct object depending on client/runtime)

            let result: any = null;

            if (Array.isArray(data)) {
                result = data?.[0]?.get_monthly_owner_summary ?? data?.[0];
            } else if (data?.get_monthly_owner_summary) {
                result = data.get_monthly_owner_summary;
            } else {
                result = data;
            }

            return result ?? null;
        },
    });

    /* =========================
       OWNER INSIGHTS DATA
    ========================== */

    const { data: ownerInsights } = useQuery({
        queryKey: ["owner-insights"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .rpc("get_owner_insights");

            if (error) throw error;

            let result: any = null;

            if (Array.isArray(data)) {
                result = data?.[0]?.get_owner_insights ?? data?.[0];
            } else if (data?.get_owner_insights) {
                result = data.get_owner_insights;
            } else {
                result = data;
            }

            console.log("📊 OWNER INSIGHTS RAW:", data);
            console.log("📊 OWNER INSIGHTS PARSED:", result);

            return result ?? null;
        },
    });

    /* =========================
       DERIVED OVERVIEW VALUES
    ========================== */

    const money = overview?.money || null;
    const invoices = overview?.invoices || null;

    const cashCollected =
        money && typeof money.total_collected === "number"
            ? money.total_collected
            : null;

    const outstandingDue =
        money && typeof money.outstanding_due === "number"
            ? money.outstanding_due
            : null;

    const ordersCompleted =
        invoices && typeof invoices.paid === "number"
            ? invoices.paid
            : null;

    const avgOrderValue =
        money && invoices && invoices.total > 0
            ? Math.round(money.total_invoiced / invoices.total)
            : null;

    /* =========================
       DERIVED OWNER INSIGHTS
    ========================== */

    const collectionEfficiency =
        ownerInsights?.collection_efficiency ?? null;

    const ownerOutstanding =
        ownerInsights?.outstanding_due ?? null;

    const ownerCollected =
        ownerInsights?.total_collected ?? null;

    /* =========================
       CASH INFLOW DATA (STEP 1)
    ========================== */

    const { data: cashTrend = [] } = useQuery({
        queryKey: ["cash-inflow-trend"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .rpc("get_cash_inflow_daily");

            if (error) throw error;

            return data;
        },
    });

    /* =========================
       REVENUE TREND DATA (STEP 2)
    ========================== */

    const { data: revenueTrend = [] } = useQuery({
        queryKey: ["revenue-trend"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .rpc("get_revenue_trend");

            if (error) throw error;

            return data;
        },
    });

    /* =========================
       PROCESS BREAKDOWN DATA (STEP 3)
    ========================== */

    const { data: processData = [] } = useQuery({
        queryKey: ["process-breakdown"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .rpc("get_process_breakdown");

            if (error) throw error;
            return data;
        },
    });

    /* =========================
       VENDOR LOAD DATA (STEP 4)
    ========================== */

    const { data: vendorLoad = [] } = useQuery({
        queryKey: ["vendor-load"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .rpc("get_vendor_load");

            if (error) throw error;
            return data;
        },
    });

    /* =========================
       DELIVERY RISK DATA (STEP 5)
    ========================== */

    const { data: deliveryRisk = [] } = useQuery({
        queryKey: ["delivery-risk"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .rpc("get_delivery_risk");

            if (error) throw error;
            return data;
        },
    });

    const revenueChartData = (revenueTrend || []).map((row: any) => ({
        date: row.date,
        booked: Number(row.booked_revenue || 0),
        confirmed: Number(row.confirmed_revenue || 0),
    }));

    const chartData = (cashTrend || []).map((row: any) => ({
        date: row.date,
        total: Number(row.total || 0),
    }));

    const processChartData = (processData || []).map((row: any) => ({
        stage: row.stage_name,
        total: Number(row.total_orders || 0),
    }));

    const vendorChartData = (vendorLoad || [])
        .filter((row: any) => row.vendor_name !== "Unassigned")
        .map((row: any) => ({
            vendor: row.vendor_name,
            total: Number(row.active_orders || 0),
        }))
        .sort((a: any, b: any) => b.total - a.total);

    const deliveryRiskData = (deliveryRisk || []).map((row: any) => ({
        risk: row.risk,
        total: Number(row.total_orders || 0),
    }));

    const RISK_COLORS: Record<string, string> = {
        Delayed: "#ef4444",
        "Due Soon": "#f59e0b",
        "On Track": "#22c55e",
    };

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
                    <p className="text-muted-foreground text-sm">
                        Business performance, financial insights, and operational health.
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline">This Month</Button>
                    <Button variant="outline">Export Summary</Button>
                </div>
            </div>

            {/* ========================= */}
            {/* OWNER INSIGHTS SECTION */}
            {/* ========================= */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Owner Insights</h2>
                <p className="text-sm text-muted-foreground">
                    Executive financial health — liquidity, collection strength, and receivable risk.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">
                                Collection Efficiency
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {collectionEfficiency !== null
                                    ? `${collectionEfficiency}%`
                                    : "—"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                % of invoiced revenue converted into real cash
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">
                                At‑Risk Receivables
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {ownerOutstanding !== null
                                    ? `₹ ${ownerOutstanding.toLocaleString("en-IN")}`
                                    : "—"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Older unpaid invoices that may delay or fail collection
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">
                                Cash Received (Liquidity)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {ownerCollected !== null
                                    ? `₹ ${ownerCollected.toLocaleString("en-IN")}`
                                    : "—"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Actual cash inflow received during this period
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* ========================= */}
            {/* BUSINESS OVERVIEW SECTION */}
            {/* ========================= */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Business Overview</h2>
                <p className="text-sm text-muted-foreground">
                    Operational performance view — shows business generated, money expected, and completed collections.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Cash Received (Operations)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {cashCollected !== null
                                    ? `₹ ${cashCollected.toLocaleString("en-IN")}`
                                    : "—"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Payments received against invoices created in this period
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Total Outstanding (Expected Cash)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {outstandingDue !== null
                                    ? `₹ ${outstandingDue.toLocaleString("en-IN")}`
                                    : "—"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Total amount customers still owe across all invoices
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Invoices Fully Paid</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {ordersCompleted !== null ? ordersCompleted : "—"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Invoices completely settled by customers
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Average Invoice Value</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {avgOrderValue !== null
                                    ? `₹ ${avgOrderValue.toLocaleString("en-IN")}`
                                    : "—"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Average revenue generated per invoice
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* ========================= */}
            {/* ANALYTICS CHARTS SECTION */}
            {/* ========================= */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Analytics</h2>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card className="h-[340px]">
                        <CardHeader>
                            <CardTitle>Revenue Trend</CardTitle>
                        </CardHeader>
                        <CardContent className="h-full min-h-0">
                            {revenueChartData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    No revenue data available
                                </div>
                            ) : (
                                <div className="w-full h-full min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={revenueChartData}
                                            margin={{ top: 10, right: 20, left: 0, bottom: 80 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />

                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(date) =>
                                                    new Date(date).toLocaleDateString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                    })
                                                }
                                                tick={{ fontSize: 12 }}
                                                height={30}
                                            />

                                            <YAxis
                                                tickFormatter={(value) => `₹${value / 1000}k`}
                                                tick={{ fontSize: 12 }}
                                                width={60}
                                            />

                                            <Tooltip
                                                formatter={(value: number) =>
                                                    `₹ ${value.toLocaleString("en-IN")}`
                                                }
                                                labelFormatter={(date) =>
                                                    new Date(date).toLocaleDateString("en-IN", {
                                                        weekday: "short",
                                                        day: "numeric",
                                                        month: "long",
                                                    })
                                                }
                                            />

                                            {/* Booked Revenue (Draft + Finalized) */}
                                            <Line
                                                type="monotone"
                                                dataKey="booked"
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{ r: 6 }}
                                            />

                                            {/* Confirmed Revenue (Finalized Only) */}
                                            <Line
                                                type="monotone"
                                                dataKey="confirmed"
                                                strokeDasharray="5 5"
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="h-[340px]">
                        <CardHeader>
                            <CardTitle>Cash Inflow Trend</CardTitle>
                        </CardHeader>
                        <CardContent className="h-full min-h-0">
                            {chartData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    No payment data available
                                </div>
                            ) : (
                                <div className="w-full h-full min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={chartData}
                                            margin={{ top: 10, right: 20, left: 0, bottom: 80 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />

                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(date) =>
                                                    new Date(date).toLocaleDateString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                    })
                                                }
                                                tick={{ fontSize: 12 }}
                                                height={30}
                                            />

                                            <YAxis
                                                tickFormatter={(value) => `₹${value / 1000}k`}
                                                tick={{ fontSize: 12 }}
                                                width={60}
                                            />

                                            <Tooltip
                                                formatter={(value: number) =>
                                                    `₹ ${value.toLocaleString("en-IN")}`
                                                }
                                                labelFormatter={(date) =>
                                                    new Date(date).toLocaleDateString("en-IN", {
                                                        weekday: "short",
                                                        day: "numeric",
                                                        month: "long",
                                                    })
                                                }
                                            />

                                            <Line
                                                type="monotone"
                                                dataKey="total"
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{ r: 6 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="h-[340px] xl:col-span-2">
                        <CardHeader>
                            <CardTitle>Operations Health</CardTitle>
                        </CardHeader>
                        <CardContent className="h-full min-h-0">
                            {processChartData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    No active orders
                                </div>
                            ) : (
                                <div className="w-full h-full min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={processChartData}
                                            layout="vertical"
                                            margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />

                                            <XAxis type="number" />

                                            <YAxis
                                                type="category"
                                                dataKey="stage"
                                                width={120}
                                                tick={{ fontSize: 12 }}
                                            />

                                            <Tooltip formatter={(value: number) => `${value} orders`} />

                                            <Bar
                                                dataKey="total"
                                                radius={[6, 6, 6, 6]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="h-[340px] xl:col-span-2">
                        <CardHeader>
                            <CardTitle>Vendor Load</CardTitle>
                        </CardHeader>
                        <CardContent className="h-full min-h-0">
                            {vendorChartData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    No vendor activity
                                </div>
                            ) : (
                                <div className="w-full h-full min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={vendorChartData}
                                            margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                                            barCategoryGap="30%"
                                            barGap={4}
                                        >
                                            <CartesianGrid vertical={false} strokeDasharray="3 3" />

                                            <XAxis
                                                dataKey="vendor"
                                                tick={{ fontSize: 12 }}
                                                interval={0}
                                                angle={0}
                                                textAnchor="middle"
                                                height={30}
                                                tickMargin={8}
                                            />

                                            <YAxis
                                                tickFormatter={(value) => `₹${value}`}
                                                tick={{ fontSize: 12 }}
                                            />

                                            <Tooltip formatter={(value: number) => `${value} active orders`} />

                                            <Legend />

                                            <Bar
                                                dataKey="total"
                                                name="Active Orders"
                                                radius={[6, 6, 0, 0]}
                                                barSize={30}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="h-[340px] xl:col-span-2">
                        <CardHeader>
                            <CardTitle>Delivery Risk</CardTitle>
                        </CardHeader>

                        <CardContent className="h-full min-h-0">
                            {deliveryRiskData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    No delivery data
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={deliveryRiskData}
                                                dataKey="total"
                                                nameKey="risk"
                                                innerRadius={70}
                                                outerRadius={110}
                                                paddingAngle={3}
                                            >
                                                {deliveryRiskData.map((entry: any, index: number) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={RISK_COLORS[entry.risk] || "#8884d8"}
                                                    />
                                                ))}
                                            </Pie>

                                            <Tooltip
                                                formatter={(value: number) =>
                                                    `${value} orders`
                                                }
                                            />

                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* ========================= */}
            {/* REPORTS LIBRARY SECTION */}
            {/* ========================= */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Reports Library</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card className="cursor-pointer hover:shadow-md transition">
                        <CardContent className="p-6">
                            <h3 className="font-semibold">Cash Flow Report</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Payments received and inflow analysis
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="cursor-pointer hover:shadow-md transition">
                        <CardContent className="p-6">
                            <h3 className="font-semibold">Sales Report</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Invoice revenue performance
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="cursor-pointer hover:shadow-md transition">
                        <CardContent className="p-6">
                            <h3 className="font-semibold">Outstanding Report</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Pending dues and collections risk
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="cursor-pointer hover:shadow-md transition">
                        <CardContent className="p-6">
                            <h3 className="font-semibold">Operations Report</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Vendor and workflow performance
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    );
}
