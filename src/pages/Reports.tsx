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
import React from "react";
import { useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Reports() {
    /* =========================
       REPORT PERIOD STATE (LOCAL TO REPORTS PAGE)
    ========================== */

    type ReportPeriod =
        | "today"
        | "last_7_days"
        | "this_month"
        | "this_year"
        | "custom";

    const [period, setPeriod] = React.useState<ReportPeriod>("this_month");

    const [customRange, setCustomRange] = React.useState<{
        startDate: string | null;
        endDate: string | null;
    }>({
        startDate: null,
        endDate: null,
    });

    /* =========================
       DERIVE DATE RANGE (REPORTS ONLY)
    ========================== */

    const { fromDate, toDate } = useMemo(() => {
        const now = new Date();
        const start = new Date(now);

        switch (period) {
            case "today":
                start.setHours(0, 0, 0, 0);
                break;

            case "last_7_days":
                start.setDate(now.getDate() - 6);
                break;

            case "this_month":
                start.setDate(1);
                break;

            case "this_year":
                start.setMonth(0, 1);
                break;

            case "custom":
                return {
                    fromDate: customRange.startDate,
                    toDate: customRange.endDate,
                };
        }

        return {
            fromDate: start.toISOString().slice(0, 10),
            toDate: now.toISOString().slice(0, 10),
        };
    }, [period, customRange]);

    /* =========================
       PERIOD READY CHECK
    ========================== */

    const isRangeReady =
        fromDate !== null &&
        toDate !== null &&
        fromDate !== undefined &&
        toDate !== undefined;
    /* =========================
       BUSINESS OVERVIEW DATA
    ========================== */

    const { data: overview } = useQuery({
        enabled: isRangeReady,
        queryKey: ["monthly-owner-summary", period, fromDate, toDate],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .rpc("get_owner_summary", {
                    from_date: fromDate,
                    to_date: toDate,
                });

            if (error) throw error;

            // Supabase RPC can return:
            // 1) [{ get_owner_summary: {...} }]
            // 2) { get_owner_summary: {...} }
            // 3) {...} (direct object depending on client/runtime)

            let result: any = null;

            if (Array.isArray(data)) {
                result = data?.[0]?.get_owner_summary ?? data?.[0];
            } else if (data?.get_owner_summary) {
                result = data.get_owner_summary;
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
        enabled: isRangeReady,
        queryKey: ["owner-insights", period, fromDate, toDate],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .rpc("get_owner_insights", {
                    from_date: fromDate,
                    to_date: toDate,
                });

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
        enabled: isRangeReady,
        queryKey: ["cash-inflow-trend", period, fromDate, toDate],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .rpc("get_cash_inflow_daily", {
                    from_date: fromDate,
                    to_date: toDate,
                });

            if (error) throw error;

            return data;
        },
    });

    /* =========================
       REVENUE TREND DATA (STEP 2)
    ========================== */

    const { data: revenueTrend = [] } = useQuery({
        enabled: isRangeReady,
        queryKey: ["revenue-trend", period, fromDate, toDate],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .rpc("get_revenue_trend", {
                    from_date: fromDate,
                    to_date: toDate,
                });

            if (error) throw error;

            return data;
        },
    });

    /* =========================
       PROCESS BREAKDOWN DATA (STEP 3)
    ========================== */

    const { data: processData = [] } = useQuery({
        enabled: isRangeReady,
        queryKey: ["process-breakdown", period, fromDate, toDate],
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
        enabled: isRangeReady,
        queryKey: ["vendor-load", period, fromDate, toDate],
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
        enabled: isRangeReady,
        queryKey: ["delivery-risk", period, fromDate, toDate],
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

    /* =========================
       CHART COLOR SYSTEM (CONSISTENT BRANDING)
    ========================== */

    const BRAND_PRIMARY = "#ec4899";      // pink (brand)
    const BRAND_SECONDARY = "#6366f1";    // indigo
    const BRAND_MUTED = "#94a3b8";        // slate
    const BRAND_SUCCESS = "#22c55e";      // green
    const BRAND_WARNING = "#f59e0b";      // amber
    const BRAND_DANGER = "#ef4444";       // red

    const GRID_COLOR = "#e5e7eb";

    const RISK_COLORS: Record<string, string> = {
        Delayed: BRAND_DANGER,
        "Due Soon": BRAND_WARNING,
        "On Track": BRAND_SUCCESS,
    };

    /* =========================
       SALES REPORT GENERATOR
    ========================== */

    const generateSalesReport = async () => {
        if (!fromDate || !toDate) return;

        const { data: invoices, error } = await (supabase as any)
            .from("invoices")
            .select(`
                invoice_number,
                date,
                total,
                payment_status,
                customers(name, phone),
                invoice_items(id)
            `)
            .gte("date", fromDate)
            .lte("date", toDate)
            .order("total", { ascending: false });

        if (error) {
            console.error("Sales report error:", error);
            return;
        }

        const rows = (invoices || []).map((inv: any) => ({
            invoice: inv.invoice_number,
            date: new Date(inv.date).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }),
            customer: inv.customers?.name || "",
            phone: inv.customers?.phone || "",
            items: inv.invoice_items?.length || 0,
            total: Number(inv.total || 0),
            status: inv.payment_status,
        }));

        const totalRevenue = rows.reduce(
            (sum: number, r: any) => sum + r.total,
            0
        );

        const avgInvoice =
            rows.length > 0 ? Math.round(totalRevenue / rows.length) : 0;

        const formatCurrency = (value: number) =>
            `Rs. ${value.toLocaleString("en-IN")}`;

        const doc = new jsPDF();

        /* =========================
           HEADER
        ========================== */

        doc.setFontSize(18);
        doc.text("Saree Palace Elite", 14, 18);

        doc.setFontSize(14);
        doc.text("Sales Report", 14, 26);

        doc.setFontSize(10);
        doc.text(
            `Period: ${new Date(fromDate).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            })} - ${new Date(toDate).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            })}`,
            14,
            34
        );

        doc.text(
            `Generated: ${new Date().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            })}`,
            14,
            40
        );

        /* =========================
           SUMMARY
        ========================== */

        doc.setFontSize(12);
        doc.text("Summary", 14, 52);

        doc.setFontSize(10);
        doc.text(`Total Revenue : ${formatCurrency(totalRevenue)}`, 14, 60);
        doc.text(`Invoices      : ${rows.length}`, 14, 66);
        doc.text(`Avg Invoice   : ${formatCurrency(avgInvoice)}`, 14, 72);

        /* =========================
           TABLE
        ========================== */

        autoTable(doc, {
            startY: 82,
            head: [[
                "Invoice",
                "Date",
                "Customer",
                "Phone",
                "Items",
                "Total",
                "Status"
            ]],
            body: rows.map((r: any) => [
                r.invoice,
                r.date,
                r.customer,
                r.phone,
                r.items,
                formatCurrency(r.total),
                r.status
            ]),
            theme: "grid",
            styles: {
                fontSize: 9,
                cellPadding: 3,
            },
            headStyles: {
                fillColor: [236, 72, 153],
                textColor: 255,
                fontStyle: "bold",
            },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 28 },
                2: { cellWidth: 40 },
                3: { cellWidth: 30 },
                4: { halign: "center", cellWidth: 16 },
                5: { halign: "right", cellWidth: 28 },
                6: { halign: "center", cellWidth: 22 },
            },
            didDrawPage: (data) => {
                const pageSize = doc.internal.pageSize;
                const pageHeight = pageSize.height || pageSize.getHeight();

                doc.setFontSize(9);
                doc.text(
                    "Generated by Elite OMS",
                    data.settings.margin.left,
                    pageHeight - 10
                );
            },
        });

        doc.save(`sales-report-${fromDate}-to-${toDate}.pdf`);
    }

    /* =========================
       OUTSTANDING REPORT GENERATOR
    ========================== */

    const generateOutstandingReport = async () => {
        if (!fromDate || !toDate) return;

        const { data: invoices, error } = await (supabase as any)
            .from("invoices")
            .select(`
                id,
                invoice_number,
                date,
                total,
                customers(name, phone),
                invoice_payments(amount)
            `)
            .gte("date", fromDate)
            .lte("date", toDate)
            .order("date", { ascending: true });

        if (error) {
            console.error("Outstanding report error:", error);
            return;
        }

        const today = new Date();

        const rows = (invoices || [])
            .map((inv: any) => {
                const paid = (inv.invoice_payments || []).reduce(
                    (sum: number, p: any) => sum + Number(p.amount || 0),
                    0
                );

                const total = Number(inv.total || 0);
                const due = Math.max(total - paid, 0);

                if (due <= 0) return null;

                const invDate = new Date(inv.date);

                const ageDays = Math.floor(
                    (today.getTime() - invDate.getTime()) /
                    (1000 * 60 * 60 * 24)
                );

                return {
                    invoice: inv.invoice_number,
                    date: invDate,
                    dateStr: invDate.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                    }),
                    customer: inv.customers?.name || "",
                    phone: inv.customers?.phone || "",
                    total,
                    paid,
                    due,
                    age: ageDays,
                };
            })
            .filter(Boolean);

        const formatCurrency = (value: number) =>
            `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;

        const totalOutstanding = rows.reduce(
            (sum: number, r: any) => sum + r.due,
            0
        );

        const invoiceCount = rows.length;

        const customerSet = new Set(rows.map((r: any) => r.customer));
        const customerCount = customerSet.size;

        const avgDue =
            invoiceCount > 0
                ? Math.round(totalOutstanding / invoiceCount)
                : 0;

        /* =========================
           AGING BUCKETS
        ========================== */

        const aging = {
            "0-7": 0,
            "8-15": 0,
            "16-30": 0,
            "30+": 0,
        };

        rows.forEach((r: any) => {
            if (r.age <= 7) aging["0-7"] += r.due;
            else if (r.age <= 15) aging["8-15"] += r.due;
            else if (r.age <= 30) aging["16-30"] += r.due;
            else aging["30+"] += r.due;
        });

        /* =========================
           CUSTOMER SUMMARY
        ========================== */

        const customerMap: Record<
            string,
            { phone: string; invoices: number; due: number }
        > = {};

        rows.forEach((r: any) => {
            if (!customerMap[r.customer]) {
                customerMap[r.customer] = {
                    phone: r.phone,
                    invoices: 0,
                    due: 0,
                };
            }

            customerMap[r.customer].invoices += 1;
            customerMap[r.customer].due += r.due;
        });

        const customerSummary = Object.entries(customerMap)
            .map(([name, data]) => ({
                customer: name,
                phone: data.phone,
                invoices: data.invoices,
                due: data.due,
            }))
            .sort((a, b) => b.due - a.due)
            .slice(0, 20);

        /* =========================
           PDF GENERATION
        ========================== */

        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Saree Palace Elite", 14, 18);

        doc.setFontSize(14);
        doc.text("Outstanding Report", 14, 26);

        doc.setFontSize(10);

        doc.text(
            `Period: ${new Date(fromDate).toLocaleDateString(
                "en-IN",
                { day: "2-digit", month: "short", year: "numeric" }
            )} - ${new Date(toDate).toLocaleDateString(
                "en-IN",
                { day: "2-digit", month: "short", year: "numeric" }
            )}`,
            14,
            34
        );

        doc.text(
            `Generated: ${new Date().toLocaleDateString(
                "en-IN",
                { day: "2-digit", month: "short", year: "numeric" }
            )}`,
            14,
            40
        );

        /* =========================
           SUMMARY SECTION
        ========================== */

        doc.setFontSize(12);
        doc.text("SUMMARY", 14, 52);

        doc.setFontSize(10);

        doc.text(`Total Outstanding : ${formatCurrency(totalOutstanding)}`, 14, 60);
        doc.text(`Invoices Pending  : ${invoiceCount}`, 14, 66);
        doc.text(`Customers with Dues : ${customerCount}`, 14, 72);
        doc.text(`Average Due per Invoice : ${formatCurrency(avgDue)}`, 14, 78);

        /* =========================
           AGING ANALYSIS
        ========================== */

        doc.setFontSize(12);
        doc.text("AGING ANALYSIS", 14, 94);

        doc.setFontSize(10);

        doc.text(`0–7 days  : ${formatCurrency(aging["0-7"])}`, 14, 102);
        doc.text(`8–15 days : ${formatCurrency(aging["8-15"])}`, 14, 108);
        doc.text(`16–30 days : ${formatCurrency(aging["16-30"])}`, 14, 114);
        doc.text(`30+ days  : ${formatCurrency(aging["30+"])}`, 14, 120);

        /* =========================
           CUSTOMER SUMMARY TABLE
        ========================== */

        doc.setFontSize(12);
        doc.text("CUSTOMER SUMMARY", 14, 128);
        autoTable(doc, {
            startY: 134,
            head: [["Customer", "Phone", "Invoices", "Due"]],
            body: customerSummary.map((c) => [
                c.customer,
                c.phone,
                c.invoices,
                formatCurrency(c.due),
            ]),
            theme: "grid",
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: {
                fillColor: [236, 72, 153],
                textColor: 255,
            },
            columnStyles: {
                0: { cellWidth: 70 }, // Customer
                1: { cellWidth: 40 }, // Phone
                2: { halign: "center", cellWidth: 28 }, // Invoices
                3: { halign: "right", cellWidth: 42 }, // Due
            },
        });

        /* =========================
           OUTSTANDING INVOICE TABLE
        ========================== */

        doc.setFontSize(12);
        doc.text("OUTSTANDING INVOICE DETAILS", 14, doc.lastAutoTable.finalY + 8);
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 14,
            head: [[
                "Invoice",
                "Date",
                "Customer",
                "Phone",
                "Total",
                "Paid",
                "Due",
                "Age",
            ]],
            body: rows.map((r: any) => [
                r.invoice,
                r.dateStr,
                r.customer,
                r.phone,
                formatCurrency(r.total),
                formatCurrency(r.paid),
                formatCurrency(r.due),
                `${r.age}d`,
            ]),
            theme: "grid",
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: {
                fillColor: [236, 72, 153],
                textColor: 255,
                fontStyle: "bold",
            },
            columnStyles: {
                0: { cellWidth: 20 }, // Invoice
                1: { cellWidth: 20 }, // Date
                2: { cellWidth: 38 }, // Customer
                3: { cellWidth: 30 }, // Phone
                4: { halign: "right", cellWidth: 20 }, // Total
                5: { halign: "right", cellWidth: 20 }, // Paid
                6: { halign: "right", cellWidth: 20 }, // Due
                7: { halign: "center", cellWidth: 12 }, // Age
            },
            didDrawPage: (data) => {
                const pageHeight = doc.internal.pageSize.height;

                doc.setFontSize(9);
                doc.text(
                    "Generated by Elite OMS",
                    data.settings.margin.left,
                    pageHeight - 10
                );
            },
        });

        doc.save(`outstanding-report-${fromDate}-to-${toDate}.pdf`);
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

                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant={period === "today" ? "default" : "outline"}
                        onClick={() => setPeriod("today")}
                    >
                        Today
                    </Button>

                    <Button
                        variant={period === "last_7_days" ? "default" : "outline"}
                        onClick={() => setPeriod("last_7_days")}
                    >
                        Last 7 Days
                    </Button>

                    <Button
                        variant={period === "this_month" ? "default" : "outline"}
                        onClick={() => setPeriod("this_month")}
                    >
                        This Month
                    </Button>

                    <Button
                        variant={period === "this_year" ? "default" : "outline"}
                        onClick={() => setPeriod("this_year")}
                    >
                        This Year
                    </Button>

                    <Button variant="outline">
                        Export Summary
                    </Button>
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
                                            margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                                        >
                                            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />

                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(date) =>
                                                    new Date(date).toLocaleDateString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                    })
                                                }
                                                tick={{ fontSize: 12 }}
                                                height={40}
                                            />

                                            <YAxis
                                                tickFormatter={(value) => `₹${value / 1000}k`}
                                                tick={{ fontSize: 12 }}
                                                width={60}
                                            />

                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: "#ffffff",
                                                    borderRadius: "8px",
                                                    border: "1px solid #e5e7eb",
                                                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                                                }}
                                                formatter={(value: number) =>
                                                    typeof value === "number"
                                                        ? `₹ ${value.toLocaleString("en-IN")}`
                                                        : value
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
                                                stroke={BRAND_PRIMARY}
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{ r: 6 }}
                                            />

                                            {/* Confirmed Revenue (Finalized Only) */}
                                            <Line
                                                type="monotone"
                                                dataKey="confirmed"
                                                stroke={BRAND_SECONDARY}
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
                                            margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                                        >
                                            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />

                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(date) =>
                                                    new Date(date).toLocaleDateString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                    })
                                                }
                                                tick={{ fontSize: 12 }}
                                                height={40}
                                            />

                                            <YAxis
                                                tickFormatter={(value) => `₹${value / 1000}k`}
                                                tick={{ fontSize: 12 }}
                                                width={60}
                                            />

                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: "#ffffff",
                                                    borderRadius: "8px",
                                                    border: "1px solid #e5e7eb",
                                                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                                                }}
                                                formatter={(value: number) =>
                                                    typeof value === "number"
                                                        ? `₹ ${value.toLocaleString("en-IN")}`
                                                        : value
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
                                                stroke={BRAND_SUCCESS}
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

                    <Card className="xl:col-span-2">
                        <CardHeader>
                            <CardTitle>Operations Health</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {processChartData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    No active orders
                                </div>
                            ) : (
                                <div className="w-full h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={processChartData}
                                            layout="vertical"
                                            margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                                        >
                                            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />

                                            <XAxis type="number" />

                                            <YAxis
                                                type="category"
                                                dataKey="stage"
                                                width={100}
                                                tick={{ fontSize: 12 }}
                                            />

                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: "#ffffff",
                                                    borderRadius: "8px",
                                                    border: "1px solid #e5e7eb",
                                                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                                                }}
                                                formatter={(value: number) =>
                                                    typeof value === "number"
                                                        ? `${value} orders`
                                                        : value
                                                }
                                            />

                                            <Bar
                                                dataKey="total"
                                                fill={BRAND_SECONDARY}
                                                radius={[8, 8, 8, 8]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="xl:col-span-2">
                        <CardHeader>
                            <CardTitle>Vendor Load</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {vendorChartData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    No vendor activity
                                </div>
                            ) : (
                                <div className="w-full h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={vendorChartData}
                                            margin={{ top: 10, right: 20, left: 20, bottom: 20 }}
                                            barCategoryGap="40%"
                                            barGap={4}
                                        >
                                            <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />

                                            <XAxis
                                                dataKey="vendor"
                                                tick={{ fontSize: 12 }}
                                                interval={0}
                                                angle={0}
                                                textAnchor="middle"
                                                height={50}
                                                tickMargin={8}
                                            />

                                            <YAxis
                                                tickFormatter={(value) => `₹${value}`}
                                                tick={{ fontSize: 12 }}
                                            />

                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: "#ffffff",
                                                    borderRadius: "8px",
                                                    border: "1px solid #e5e7eb",
                                                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                                                }}
                                                formatter={(value: number) =>
                                                    typeof value === "number"
                                                        ? `${value} active orders`
                                                        : value
                                                }
                                            />

                                            <Bar
                                                dataKey="total"
                                                name="Active Orders"
                                                fill={BRAND_PRIMARY}
                                                radius={[6, 6, 0, 0]}
                                                barSize={30}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="xl:col-span-2">
                        <CardHeader>
                            <CardTitle>Delivery Risk</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {deliveryRiskData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    No delivery data
                                </div>
                            ) : (
                                <div className="w-full h-[320px] flex items-center justify-center">
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
                                                contentStyle={{
                                                    backgroundColor: "#ffffff",
                                                    borderRadius: "8px",
                                                    border: "1px solid #e5e7eb",
                                                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                                                }}
                                                formatter={(value: number) =>
                                                    typeof value === "number"
                                                        ? `${value} orders`
                                                        : value
                                                }
                                            />

                                            {(() => {
                                                const total = deliveryRiskData.reduce((sum: number, r: any) => sum + r.total, 0);
                                                return (
                                                    <text
                                                        x="50%"
                                                        y="50%"
                                                        textAnchor="middle"
                                                        dominantBaseline="middle"
                                                        style={{ fontSize: "16px", fontWeight: 600 }}
                                                    >
                                                        {total}
                                                    </text>
                                                );
                                            })()}

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

                    <Card
                        className="cursor-pointer hover:shadow-md transition"
                        onClick={generateSalesReport}
                    >
                        <CardContent className="p-6">
                            <h3 className="font-semibold">Sales Report</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Invoice revenue performance
                            </p>
                        </CardContent>
                    </Card>

                    <Card
                        className="cursor-pointer hover:shadow-md transition"
                        onClick={generateOutstandingReport}
                    >
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
