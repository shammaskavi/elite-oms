import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
    ShieldCheck,
    Briefcase,
    Activity,
    TrendingUp,
    AlertTriangle,
    Wallet,
    ArrowUpRight,
    FileText,
    Download
} from "lucide-react";

export default function Reports() {
    const [chartView, setChartView] = useState("revenue"); // Toggle for Analytics section

    /* =========================
       DATA FETCHING (AS PER ORIGINAL)
    ========================== */
    const { data: overview } = useQuery({
        queryKey: ["monthly-owner-summary"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_monthly_owner_summary");
            if (error) throw error;
            return Array.isArray(data) ? data?.[0]?.get_monthly_owner_summary ?? data?.[0] : data?.get_monthly_owner_summary ?? data;
        },
    });

    const { data: ownerInsights } = useQuery({
        queryKey: ["owner-insights"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_owner_insights");
            if (error) throw error;
            return Array.isArray(data) ? data?.[0]?.get_owner_insights ?? data?.[0] : data?.get_owner_insights ?? data;
        },
    });

    const { data: cashTrend = [] } = useQuery({
        queryKey: ["cash-inflow-trend"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_cash_inflow_daily");
            if (error) throw error;
            return data;
        },
    });

    const { data: revenueTrend = [] } = useQuery({
        queryKey: ["revenue-trend"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_revenue_trend");
            if (error) throw error;
            return data;
        },
    });

    const { data: processData = [] } = useQuery({
        queryKey: ["process-breakdown"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_process_breakdown");
            if (error) throw error;
            return data;
        },
    });

    const { data: vendorLoad = [] } = useQuery({
        queryKey: ["vendor-load"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_vendor_load");
            if (error) throw error;
            return data;
        },
    });

    const { data: deliveryRisk = [] } = useQuery({
        queryKey: ["delivery-risk"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_delivery_risk");
            if (error) throw error;
            return data;
        },
    });

    /* =========================
       DERIVED VALUES
    ========================== */
    const money = overview?.money || null;
    const invoices = overview?.invoices || null;

    const revenueChartData = (revenueTrend || []).map((row: any) => ({
        date: row.date,
        booked: Number(row.booked_revenue || 0),
        confirmed: Number(row.confirmed_revenue || 0),
    }));

    const cashInflowData = (cashTrend || []).map((row: any) => ({
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
        .sort((a, b) => b.total - a.total);

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
        <div className="p-6 space-y-12 max-w-7xl mx-auto bg-slate-50/30 min-h-screen pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Reports & Analytics</h1>
                    <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-500" />
                        Monitoring Financial Health, Performance, and Operations
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="shadow-sm">This Month</Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center gap-2">
                        <Download className="w-4 h-4" /> Export Summary
                    </Button>
                </div>
            </div>

            {/* 1️⃣ LAYER ONE: OWNER INSIGHTS (Financial Health) */}
            <section className="space-y-6">
                <div className="flex items-center gap-2 border-l-4 border-indigo-600 pl-4">
                    <ShieldCheck className="w-6 h-6 text-indigo-600" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Owner Insights</h2>
                        <p className="text-sm text-slate-500 font-medium italic">"Is my business financially safe?"</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-white shadow-sm border-none ring-1 ring-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Collection Efficiency</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-slate-900">{ownerInsights?.collection_efficiency ?? "—"}%</div>
                            <p className="text-xs text-slate-400 mt-2 font-medium">Cash Collected vs. Amount Billed</p>
                            <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${ownerInsights?.collection_efficiency || 0}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white shadow-sm border-none ring-1 ring-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold text-red-500 uppercase tracking-wider flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> At-Risk Receivables
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-slate-900">₹ {(ownerInsights?.outstanding_due || 0).toLocaleString("en-IN")}</div>
                            <p className="text-xs text-slate-400 mt-2 font-medium">Money stuck outside the business</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-white shadow-sm border-none ring-1 ring-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                                <Wallet className="w-4 h-4" /> Cash Received (Liquidity)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-slate-900">₹ {(ownerInsights?.total_collected || 0).toLocaleString("en-IN")}</div>
                            <p className="text-xs text-slate-400 mt-2 font-medium">Actual bank/cash reality</p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* 2️⃣ LAYER TWO: BUSINESS OVERVIEW (Operational Performance) */}
            <section className="space-y-6">
                <div className="flex items-center gap-2 border-l-4 border-slate-400 pl-4">
                    <Briefcase className="w-6 h-6 text-slate-600" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Business Overview</h2>
                        <p className="text-sm text-slate-500 font-medium italic">"How much business did we actually do?"</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="p-4 pb-0"><CardDescription>Cash Generated</CardDescription></CardHeader>
                        <CardContent className="p-4 pt-2">
                            <div className="text-2xl font-bold text-slate-900">₹{(money?.total_collected || 0).toLocaleString("en-IN")}</div>
                            <div className="text-[10px] text-indigo-500 font-bold mt-1 uppercase tracking-tighter">Operational Output</div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="p-4 pb-0"><CardDescription>Expected Pipeline</CardDescription></CardHeader>
                        <CardContent className="p-4 pt-2">
                            <div className="text-2xl font-bold text-slate-900">₹{(money?.outstanding_due || 0).toLocaleString("en-IN")}</div>
                            <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Total Outstanding Due</div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="p-4 pb-0"><CardDescription>Orders Completed</CardDescription></CardHeader>
                        <CardContent className="p-4 pt-2">
                            <div className="text-2xl font-bold text-slate-900">{invoices?.paid || 0}</div>
                            <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Invoices Fully Paid</div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="p-4 pb-0"><CardDescription>Avg. Ticket Size</CardDescription></CardHeader>
                        <CardContent className="p-4 pt-2">
                            <div className="text-2xl font-bold text-slate-900">₹{Math.round((money?.total_invoiced || 0) / (invoices?.total || 1)).toLocaleString("en-IN")}</div>
                            <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Average Order Value</div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* 3️⃣ LAYER THREE: ANALYTICS (Operational Reality) */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-4">
                        <Activity className="w-6 h-6 text-amber-500" />
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Analytics</h2>
                            <p className="text-sm text-slate-500 font-medium italic">"The Factory Floor Reality"</p>
                        </div>
                    </div>

                    {/* TOGGLE FOR TREND VIEW */}
                    <Tabs value={chartView} onValueChange={setChartView} className="w-[400px]">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
                            <TabsTrigger value="cash">Cash Inflow</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* TOGGLEABLE TREND CHART */}
                    <Card className="xl:col-span-2 shadow-md overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b">
                            <CardTitle className="text-lg">
                                {chartView === "revenue" ? "Revenue Visibility (Booked vs Confirmed)" : "Cash Flow Timing (Actual Inflow)"}
                            </CardTitle>
                            <CardDescription>
                                {chartView === "revenue"
                                    ? "Gap between lines shows sales conversion speed"
                                    : "Reveals payment cycles and seasonal spikes"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                {chartView === "revenue" ? (
                                    <LineChart data={revenueChartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} />
                                        <YAxis tickFormatter={(v) => `₹${v / 1000}k`} />
                                        <Tooltip formatter={(v: any) => `₹ ${v.toLocaleString()}`} />
                                        <Legend verticalAlign="top" height={36} />
                                        <Line name="Booked (Draft + Final)" type="monotone" dataKey="booked" stroke="#6366f1" strokeWidth={3} dot={false} />
                                        <Line name="Confirmed (Final Only)" type="monotone" dataKey="confirmed" stroke="#6366f1" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                                    </LineChart>
                                ) : (
                                    <LineChart data={cashInflowData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} />
                                        <YAxis tickFormatter={(v) => `₹${v / 1000}k`} />
                                        <Tooltip formatter={(v: any) => `₹ ${v.toLocaleString()}`} />
                                        <Line name="Cash Received" type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                    </LineChart>
                                )}
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* OPERATIONS HEALTH */}
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Activity className="w-4 h-4 text-slate-400" /> Factory Control Panel
                            </CardTitle>
                            <CardDescription>Order distribution by production stage</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={processChartData} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="stage" type="category" width={100} axisLine={false} tickLine={false} />
                                    <Tooltip />
                                    <Bar dataKey="total" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* DELIVERY RISK */}
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Delivery Risk (Future Problem Detector)</CardTitle>
                            <CardDescription>Spot delays before they become customer complaints</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px] flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={deliveryRiskData} dataKey="total" nameKey="risk" innerRadius={60} outerRadius={90} paddingAngle={5}>
                                        {deliveryRiskData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.risk] || "#cbd5e1"} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* VENDOR LOAD */}
                    <Card className="xl:col-span-2 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Vendor Load Distribution</CardTitle>
                            <CardDescription>Who is overloaded? Who can take more work?</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vendorChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="vendor" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip />
                                    <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* 4️⃣ REPORTS LIBRARY */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900">Reports Library (Export Center)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { title: "Cash Flow Report", desc: "Payments received analysis", icon: Wallet },
                        { title: "Sales Report", desc: "Invoiced revenue performance", icon: TrendingUp },
                        { title: "Outstanding Report", desc: "Dues and collection risks", icon: AlertTriangle },
                        { title: "Operations Report", desc: "Vendor efficiency & workflow", icon: FileText },
                    ].map((item) => (
                        <Card key={item.title} className="hover:ring-2 hover:ring-indigo-500 transition-all cursor-pointer group">
                            <CardContent className="p-6 flex items-start gap-4">
                                <div className="p-2 bg-slate-100 rounded group-hover:bg-indigo-50">
                                    <item.icon className="w-5 h-5 text-slate-500 group-hover:text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{item.title}</h3>
                                    <p className="text-xs text-slate-500">{item.desc}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>
        </div>
    );
}