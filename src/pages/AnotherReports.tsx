import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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
    FileText,
    Download,
    Loader2,
    CalendarDays,
    ArrowUpRight,
    CheckCircle2
} from "lucide-react";

export default function Reports() {
    /* =========================
       1. STATE & DATE LOGIC
    ========================== */
    type ReportPeriod = "today" | "last_7_days" | "this_month" | "this_year";
    const [period, setPeriod] = useState<ReportPeriod>("this_month");
    const [chartView, setChartView] = useState("revenue");
    const [isExporting, setIsExporting] = useState(false);

    const { fromDate, toDate } = useMemo(() => {
        const now = new Date();
        const start = new Date(now);
        switch (period) {
            case "today": start.setHours(0, 0, 0, 0); break;
            case "last_7_days": start.setDate(now.getDate() - 6); break;
            case "this_month": start.setDate(1); break;
            case "this_year": start.setMonth(0, 1); break;
        }
        return {
            fromDate: start.toISOString().slice(0, 10),
            toDate: now.toISOString().slice(0, 10),
        };
    }, [period]);

    const isRangeReady = Boolean(fromDate && toDate);

    /* =========================
       2. DATA FETCHING (FILTERED)
    ========================== */
    const { data: ownerInsights, isLoading: loadingInsights } = useQuery({
        enabled: isRangeReady,
        queryKey: ["owner-insights", fromDate, toDate],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_owner_insights", { from_date: fromDate, to_date: toDate });
            if (error) throw error;
            return Array.isArray(data) ? data?.[0]?.get_owner_insights ?? data?.[0] : data?.get_owner_insights ?? data;
        },
    });

    const { data: overview, isLoading: loadingOverview } = useQuery({
        enabled: isRangeReady,
        queryKey: ["owner-summary", fromDate, toDate],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_owner_summary", { from_date: fromDate, to_date: toDate });
            if (error) throw error;
            return Array.isArray(data) ? data?.[0]?.get_owner_summary ?? data?.[0] : data?.get_owner_summary ?? data;
        },
    });

    const { data: revenueTrend = [] } = useQuery({
        enabled: isRangeReady,
        queryKey: ["revenue-trend", fromDate, toDate],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_revenue_trend", { from_date: fromDate, to_date: toDate });
            return error ? [] : data;
        }
    });

    const { data: cashTrend = [] } = useQuery({
        enabled: isRangeReady,
        queryKey: ["cash-trend", fromDate, toDate],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_cash_inflow_daily", { from_date: fromDate, to_date: toDate });
            return error ? [] : data;
        }
    });

    // Operational context (Stage, Vendor, Risk)
    const { data: processData = [] } = useQuery({
        queryKey: ["process-breakdown"], queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_process_breakdown");
            return error ? [] : data;
        }
    });

    const { data: vendorLoad = [] } = useQuery({
        queryKey: ["vendor-load"], queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_vendor_load");
            return error ? [] : data;
        }
    });

    const { data: deliveryRisk = [] } = useQuery({
        queryKey: ["delivery-risk"], queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_delivery_risk");
            return error ? [] : data;
        }
    });

    /* =========================
       3. IN-DEPTH PDF ENGINE
    ========================== */
    const handleExport = async () => {
        setIsExporting(true);
        const doc = new jsPDF();
        const brandPink = [236, 72, 153]; // #ec4899

        // --- PAGE 1: EXECUTIVE SUMMARY ---
        doc.setFillColor(brandPink[0], brandPink[1], brandPink[2]);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("STRATEGIC BUSINESS REPORT", 14, 25);
        doc.setFontSize(10);
        doc.text(`PERIOD: ${fromDate} TO ${toDate} | GENERATED ON: ${new Date().toLocaleDateString()}`, 14, 32);

        // Strategic Health Check Paragraph
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(14);
        doc.text("I. Financial Health Assessment", 14, 55);

        const efficiency = ownerInsights?.collection_efficiency || 0;
        const healthStatus = efficiency > 85 ? "EXCELLENT" : efficiency > 60 ? "STABLE" : "CRITICAL";

        doc.setFontSize(10);
        const introText = `This report provides a multi-layer analysis of business liquidity and operational pipeline. 
Currently, collection efficiency is at ${efficiency}%, which is considered ${healthStatus}. 
There is a total of INR ${ownerInsights?.outstanding_due?.toLocaleString() || 0} currently stuck in receivables.`;
        doc.text(doc.splitTextToSize(introText, 180), 14, 62);

        autoTable(doc, {
            startY: 75,
            head: [['Financial Core Metric', 'Current Value', 'Status']],
            body: [
                ['Collection Efficiency', `${efficiency}%`, healthStatus],
                ['At-Risk Receivables', `INR ${ownerInsights?.outstanding_due?.toLocaleString() || 0}`, 'High Risk'],
                ['Total Liquid Cash Realized', `INR ${ownerInsights?.total_collected?.toLocaleString() || 0}`, 'In-Bank'],
                ['Average Order Value', `INR ${Math.round((overview?.money?.total_invoiced || 0) / (overview?.invoices?.total || 1)).toLocaleString()}`, 'Ticket Size'],
            ],
            theme: 'grid',
            headStyles: { fillStyle: brandPink }
        });

        // --- PAGE 2: OPERATIONAL REALITY ---
        doc.addPage();
        doc.setTextColor(brandPink[0], brandPink[1], brandPink[2]);
        doc.setFontSize(16);
        doc.text("II. Production & Logistics Audit", 14, 20);

        doc.setTextColor(100);
        doc.setFontSize(10);
        doc.text("Factory Floor stage breakdown and vendor leverage analysis.", 14, 26);

        // Production Stages Table
        autoTable(doc, {
            startY: 35,
            head: [['Production Stage', 'Active Orders', 'Bottleneck Risk']],
            body: processData.map((p: any) => [
                p.stage_name,
                p.total_orders,
                p.total_orders > 10 ? 'HIGH' : 'LOW'
            ]),
            theme: 'striped'
        });

        // Vendor Table
        doc.text("Vendor Load Distribution", 14, (doc as any).lastAutoTable.finalY + 15);
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [['Vendor Name', 'Assigned Orders', 'Capacity Usage']],
            body: vendorLoad.filter((v: any) => v.vendor_name !== 'Unassigned').map((v: any) => [
                v.vendor_name,
                v.active_orders,
                `${Math.min(100, (v.active_orders / 15) * 100).toFixed(0)}%`
            ]),
        });

        // --- PAGE 3: RISK ASSESSMENT ---
        doc.addPage();
        doc.text("III. Delivery Risk Analysis", 14, 20);
        autoTable(doc, {
            startY: 30,
            head: [['Risk Level', 'Orders Affected', 'Action Required']],
            body: deliveryRisk.map((r: any) => [
                r.risk,
                r.total_orders,
                r.risk === 'Delayed' ? 'IMMEDIATE EXPEDITE' : 'MONITOR'
            ]),
            styles: { fontSize: 10 },
            columnStyles: { 2: { fontStyle: 'bold', textColor: [239, 68, 68] } }
        });

        doc.save(`Executive_Report_${period}.pdf`);
        setIsExporting(false);
    };

    /* =========================
       4. UI THEME
    ========================== */
    const BRAND = { primary: "#ec4899", secondary: "#6366f1", success: "#22c55e", danger: "#ef4444", warning: "#f59e0b" };
    const RISK_COLORS: Record<string, string> = { Delayed: BRAND.danger, "Due Soon": BRAND.warning, "On Track": BRAND.success };

    return (
        <div className="p-6 space-y-12 max-w-7xl mx-auto bg-slate-50/50 min-h-screen pb-20">

            {/* --- GLOBAL HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Reports Library</h1>
                    <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
                        <CalendarDays className="w-4 h-4 text-pink-500" />
                        Analyzing period: <span className="text-pink-600 font-bold underline decoration-pink-200 uppercase">{period.replace('_', ' ')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex p-1 bg-white border rounded-lg shadow-sm">
                        {["today", "last_7_days", "this_month", "this_year"].map((p) => (
                            <Button
                                key={p}
                                variant={period === p ? "default" : "ghost"}
                                size="sm"
                                className={period === p ? "bg-pink-500 text-white shadow-md hover:bg-pink-600" : "text-slate-500"}
                                onClick={() => setPeriod(p as ReportPeriod)}
                            >
                                {p.replace(/_/g, ' ')}
                            </Button>
                        ))}
                    </div>
                    <Button
                        onClick={handleExport}
                        disabled={isExporting || loadingInsights}
                        className="bg-slate-900 hover:bg-slate-800 text-white gap-2 shadow-lg min-w-[140px]"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {isExporting ? "Building..." : "Get PDF"}
                    </Button>
                </div>
            </div>

            {/* --- LAYER 1: OWNER INSIGHTS (Financial Health) --- */}
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-2 text-slate-900">
                    <ShieldCheck className="w-6 h-6 text-pink-500" />
                    <h2 className="text-2xl font-black uppercase tracking-tight">Owner Insights</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="relative overflow-hidden border-none ring-1 ring-slate-200 shadow-sm">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-pink-500" />
                        <CardHeader className="pb-1"><CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Collection Efficiency</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-slate-900">{ownerInsights?.collection_efficiency ?? 0}%</div>
                            <p className="text-[10px] text-slate-400 mt-1">Cash Realization Rate</p>
                            <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-pink-500 transition-all duration-1000" style={{ width: `${ownerInsights?.collection_efficiency || 0}%` }} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden border-none ring-1 ring-slate-200 shadow-sm">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
                        <CardHeader className="pb-1"><CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">At-Risk Receivables</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-slate-900">₹{(ownerInsights?.outstanding_due || 0).toLocaleString("en-IN")}</div>
                            <p className="text-[10px] text-red-500 mt-1 font-bold flex items-center gap-1 uppercase tracking-tighter">
                                <AlertTriangle className="w-3 h-3" /> Capital Stuck Outside
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden border-none ring-1 ring-slate-200 shadow-sm">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                        <CardHeader className="pb-1"><CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Cash Received (Liquidity)</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-slate-900">₹{(ownerInsights?.total_collected || 0).toLocaleString("en-IN")}</div>
                            <p className="text-[10px] text-emerald-600 mt-1 font-bold flex items-center gap-1 uppercase tracking-tighter">
                                <CheckCircle2 className="w-3 h-3" /> Actual Bank Inflow
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* --- LAYER 2: BUSINESS OVERVIEW (Performance) --- */}
            <section className="space-y-6">
                <div className="flex items-center gap-2 text-slate-900 border-l-4 border-indigo-500 pl-4">
                    <Briefcase className="w-6 h-6 text-indigo-500" />
                    <h2 className="text-2xl font-black uppercase tracking-tight">Business Overview</h2>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: "Ops Cash", val: overview?.money?.total_collected, sub: "Generated", icon: Wallet },
                        { label: "Pipeline", val: overview?.money?.outstanding_due, sub: "Expected", icon: TrendingUp },
                        { label: "Paid", val: overview?.invoices?.paid, sub: "Invoices Closed", isCurr: false, icon: CheckCircle2 },
                        { label: "Avg Ticket", val: Math.round((overview?.money?.total_invoiced || 0) / (overview?.invoices?.total || 1)), sub: "Avg. Order Val", icon: ArrowUpRight }
                    ].map((m, i) => (
                        <Card key={i} className="border-slate-200 shadow-none hover:border-indigo-200 transition-colors">
                            <CardContent className="p-5 flex items-center gap-4">
                                <div className="p-2 bg-slate-50 rounded-lg"><m.icon className="w-4 h-4 text-slate-400" /></div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.label}</p>
                                    <div className="text-xl font-black text-slate-900 mt-0.5">
                                        {m.isCurr === false ? m.val : `₹${(m.val || 0).toLocaleString("en-IN")}`}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* --- LAYER 3: ANALYTICS (Factory Floor) --- */}
            <section className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-900 border-l-4 border-amber-500 pl-4">
                        <Activity className="w-6 h-6 text-amber-500" />
                        <h2 className="text-2xl font-black uppercase tracking-tight">Operational Reality</h2>
                    </div>
                    <Tabs value={chartView} onValueChange={setChartView} className="w-[350px]">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="revenue">Revenue Mix</TabsTrigger>
                            <TabsTrigger value="cash">Inflow Timing</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* CHART AREA */}
                    <Card className="lg:col-span-2 shadow-sm border-none ring-1 ring-slate-200">
                        <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                            <CardTitle className="text-xs uppercase font-bold text-slate-500">
                                {chartView === "revenue" ? "Revenue Visibility (Booked vs Confirmed)" : "Actual Cash Collection Flow"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[400px] pt-8">
                            <ResponsiveContainer width="100%" height="100%">
                                {chartView === "revenue" ? (
                                    <LineChart data={revenueTrend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })} tick={{ fontSize: 10 }} />
                                        <YAxis tickFormatter={(v) => `₹${v / 1000}k`} tick={{ fontSize: 10 }} />
                                        <Tooltip />
                                        <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingBottom: '20px' }} />
                                        <Line name="Booked (Pipeline)" type="monotone" dataKey="booked_revenue" stroke={BRAND.primary} strokeWidth={4} dot={false} />
                                        <Line name="Confirmed (Billed)" type="monotone" dataKey="confirmed_revenue" stroke={BRAND.secondary} strokeDasharray="5 5" strokeWidth={2} dot={false} />
                                    </LineChart>
                                ) : (
                                    <LineChart data={cashTrend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })} tick={{ fontSize: 10 }} />
                                        <YAxis tickFormatter={(v) => `₹${v / 1000}k`} tick={{ fontSize: 10 }} />
                                        <Tooltip />
                                        <Line name="Cash Inflow" type="monotone" dataKey="total" stroke={BRAND.success} strokeWidth={4} dot={{ r: 4, fill: BRAND.success }} />
                                    </LineChart>
                                )}
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* RISK PROFILE */}
                    <Card className="shadow-sm border-none ring-1 ring-slate-200">
                        <CardHeader className="py-3 px-6"><CardTitle className="text-xs uppercase font-bold text-slate-500 tracking-widest">Future Problem Detector</CardTitle></CardHeader>
                        <CardContent className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={deliveryRisk} dataKey="total_orders" nameKey="risk" innerRadius={70} outerRadius={90} paddingAngle={10}>
                                        {deliveryRisk.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.risk] || "#cbd5e1"} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* VENDOR LOAD - FULL WIDTH */}
                    <Card className="lg:col-span-3 shadow-sm border-none ring-1 ring-slate-200">
                        <CardHeader className="py-3 px-6"><CardTitle className="text-xs uppercase font-bold text-slate-500 tracking-widest">Vendor Load Distribution (Factory Leverage)</CardTitle></CardHeader>
                        <CardContent className="h-[300px] pt-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vendorLoad.filter((v: any) => v.vendor_name !== 'Unassigned')}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="vendor_name" tick={{ fontSize: 11, fontWeight: 'bold' }} axisLine={false} />
                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="active_orders" name="Active Orders" fill={BRAND.secondary} radius={[6, 6, 0, 0]} barSize={45} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    );
}