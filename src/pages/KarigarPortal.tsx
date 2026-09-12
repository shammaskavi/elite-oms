import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    CheckCircle2,
    Circle,
    Clock,
    Package,
    Search,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    Sparkles,
    X
} from "lucide-react";

type WorkItem = {
    vendor_name: string;
    order_id: string;
    invoice_number: string;
    customer_name: string;
    item_name: string;
    delivery_date: string;
    stage_name: string;
};

type SortField = "order_date" | "delivery_date";
type SortDirection = "asc" | "desc";

// Extract numerical part of invoice number for natural sorting
function parseInvoiceNum(inv: string): number {
    if (!inv) return 0;
    const match = inv.match(/\d+/g);
    if (!match) return 0;
    return parseInt(match.join(""), 10) || 0;
}

function getDeliveryStatus(deliveryDateStr: string, isDone: boolean) {
    if (!deliveryDateStr) {
        return { label: "No Date", color: "text-slate-400 bg-slate-100 border-slate-200", isOverdue: false };
    }
    if (isDone) {
        return { label: "Completed", color: "text-emerald-700 bg-emerald-50 border-emerald-200", isOverdue: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(deliveryDateStr);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return {
            label: `Overdue (${Math.abs(diffDays)}d)`,
            color: "text-rose-700 bg-rose-50 border-rose-300 font-semibold",
            isOverdue: true,
        };
    }
    if (diffDays === 0) {
        return {
            label: "Due Today",
            color: "text-amber-800 bg-amber-100 border-amber-300 font-semibold",
            isOverdue: false,
        };
    }
    if (diffDays === 1) {
        return {
            label: "Due Tomorrow",
            color: "text-amber-700 bg-amber-50 border-amber-200 font-medium",
            isOverdue: false,
        };
    }
    if (diffDays <= 3) {
        return {
            label: `Due in ${diffDays}d`,
            color: "text-orange-700 bg-orange-50 border-orange-200 font-medium",
            isOverdue: false,
        };
    }
    return {
        label: new Date(deliveryDateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        color: "text-slate-600 bg-slate-50 border-slate-200",
        isOverdue: false,
    };
}

export default function KarigarPortal() {
    const params = useParams();
    const rawToken = params["*"] || params.token || "";
    const token = rawToken ? decodeURIComponent(rawToken) : "";
    const navigate = useNavigate();
    const [work, setWork] = useState<WorkItem[]>([]);
    const [vendorInfo, setVendorInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Sort state: default by order_date descending (newest order first)
    const [sortField, setSortField] = useState<SortField>("order_date");
    const [sortDir, setSortDir] = useState<SortDirection>("desc");

    const vendorName = vendorInfo?.name || work[0]?.vendor_name || "Karigar";

    useEffect(() => {
        if (vendorName && vendorName !== "Karigar") {
            document.title = `${vendorName} · Karigar Work Portal`;
        }
    }, [vendorName]);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                // 1. Fetch vendor profile by token (guarantees artisan name even if 0 tasks assigned)
                if (token) {
                    const { data: vData } = await (supabase as any)
                        .from("vendors")
                        .select("name, portal_enabled, active")
                        .eq("access_token", token)
                        .maybeSingle();
                    if (vData) setVendorInfo(vData);
                }

                // 2. Fetch live assigned work
                const { data, error } = await supabase.rpc("get_vendor_work", {
                    p_token: token,
                });

                if (error) {
                    console.error("Error loading vendor work:", error);
                    setWork([]);
                } else {
                    setWork(data || []);
                }
            } catch (err) {
                console.error("Failed to load portal work:", err);
                setWork([]);
            } finally {
                setLoading(false);
            }
        }
        if (token) loadData();
    }, [token]);

    const getStageStyles = (stage: string) => {
        const s = stage?.toLowerCase() || "";
        if (s.includes("packed") || s.includes("deliver")) return "border-emerald-500 bg-emerald-50 text-emerald-700";
        if (s.includes("embroidery") || s.includes("dyeing")) return "border-blue-500 bg-blue-50 text-blue-700";
        if (s.includes("cut")) return "border-purple-500 bg-purple-50 text-purple-700";
        if (s.includes("dispatch")) return "border-orange-500 bg-orange-50 text-orange-700";
        return "border-amber-500 bg-amber-50 text-amber-700";
    };

    // Toggle Sort by Field
    const handleSortToggle = (field: SortField) => {
        if (sortField === field) {
            // Toggle direction on every click
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            // Switch field with sensible default direction
            setSortField(field);
            setSortDir(field === "order_date" ? "desc" : "asc");
        }
    };

    // Multi-token intelligent search & robust deterministic sorting
    const filteredAndSortedWork = useMemo(() => {
        const searchWords = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);

        return work
            .filter((item) => {
                if (searchWords.length === 0) return true;

                // Build a combined searchable text index for this task
                const searchableText = [
                    item.customer_name || "",
                    item.item_name || "",
                    item.invoice_number || "",
                    `#${item.invoice_number || ""}`,
                    `inv-${item.invoice_number || ""}`,
                    item.stage_name || "",
                ].join(" ").toLowerCase();

                // Every typed word must match somewhere in this item
                return searchWords.every((word) => searchableText.includes(word));
            })
            .sort((a, b) => {
                if (sortField === "order_date") {
                    const numA = parseInvoiceNum(a.invoice_number);
                    const numB = parseInvoiceNum(b.invoice_number);
                    if (numA !== numB) {
                        return sortDir === "desc" ? numB - numA : numA - numB;
                    }
                    // Secondary tie-breaker: customer name
                    const custCmp = (a.customer_name || "").localeCompare(b.customer_name || "");
                    if (custCmp !== 0) return sortDir === "desc" ? -custCmp : custCmp;
                    // Tertiary tie-breaker: item name
                    return (a.item_name || "").localeCompare(b.item_name || "");
                }

                if (sortField === "delivery_date") {
                    const dateA = a.delivery_date ? new Date(a.delivery_date).getTime() : (sortDir === "asc" ? Infinity : -Infinity);
                    const dateB = b.delivery_date ? new Date(b.delivery_date).getTime() : (sortDir === "asc" ? Infinity : -Infinity);

                    if (dateA !== dateB) {
                        return sortDir === "asc" ? dateA - dateB : dateB - dateA;
                    }

                    // Tie-breaker when delivery dates are identical: sort by invoice number
                    const numA = parseInvoiceNum(a.invoice_number);
                    const numB = parseInvoiceNum(b.invoice_number);
                    if (numA !== numB) {
                        return sortDir === "asc" ? numB - numA : numA - numB;
                    }
                    return (a.item_name || "").localeCompare(b.item_name || "");
                }

                return 0;
            });
    }, [work, searchQuery, sortField, sortDir]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 text-sm gap-2">
                <Package className="h-8 w-8 animate-bounce text-slate-300" />
                <span>Loading assigned tasks...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50 pb-16">
            {/* Header */}
            <div className="px-4 py-3.5 border-b sticky top-0 bg-white/95 backdrop-blur-md z-20 shadow-xs">
                <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto">
                    <div>
                        <h1 className="text-base font-bold text-slate-900 leading-tight">
                            {vendorName}
                        </h1>
                        <p className="text-xs text-slate-500 font-medium">
                            {filteredAndSortedWork.length} of {work.length} {work.length === 1 ? "task" : "tasks"}
                            {searchQuery ? " matching" : " assigned"}
                        </p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                        <Package className="h-4 w-4" />
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-3">
                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search customer, item, #INV..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-8 h-9.5 text-sm rounded-xl bg-white border-slate-200/80 shadow-xs focus:bg-white"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Column Sort Header (Toggles ASC / DESC on every click) */}
                <div className="bg-white rounded-xl px-3 py-2 border border-slate-200/80 shadow-xs flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Sort:</span>

                    <div className="flex items-center gap-2">
                        {/* Order Date / # Toggle */}
                        <button
                            type="button"
                            onClick={() => handleSortToggle("order_date")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer ${sortField === "order_date"
                                ? "bg-slate-900 text-white shadow-xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                        >
                            <span>
                                {sortField === "order_date"
                                    ? sortDir === "desc"
                                        ? "Order: Newest"
                                        : "Order: Oldest"
                                    : "Order Date"}
                            </span>
                            {sortField === "order_date" ? (
                                sortDir === "desc" ? (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                ) : (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                )
                            ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                        </button>

                        {/* Delivery Date Toggle */}
                        <button
                            type="button"
                            onClick={() => handleSortToggle("delivery_date")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer ${sortField === "delivery_date"
                                ? "bg-slate-900 text-white shadow-xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                        >
                            <span>
                                {sortField === "delivery_date"
                                    ? sortDir === "asc"
                                        ? "Delivery: Earliest"
                                        : "Delivery: Latest"
                                    : "Delivery Date"}
                            </span>
                            {sortField === "delivery_date" ? (
                                sortDir === "asc" ? (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                ) : (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                )
                            ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Work Item Cards */}
                <div className="space-y-2">
                    {filteredAndSortedWork.length === 0 ? (
                        <div className="bg-white rounded-xl p-8 text-center border border-slate-200/80 shadow-xs space-y-2">
                            <Sparkles className="h-8 w-8 text-slate-300 mx-auto" />
                            <p className="text-sm font-semibold text-slate-700">No matching tasks found</p>
                            <p className="text-xs text-slate-400">
                                {searchQuery ? `No tasks match "${searchQuery}"` : "You're all caught up ✨"}
                            </p>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="text-xs text-blue-600 font-semibold hover:underline mt-2 inline-block cursor-pointer"
                                >
                                    Clear search
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredAndSortedWork.map((item) => {
                            const isDone = item.stage_name?.toLowerCase().includes("packed") || item.stage_name?.toLowerCase().includes("deliver");
                            const deliveryStatus = getDeliveryStatus(item.delivery_date, isDone);

                            return (
                                <div
                                    key={`${item.order_id}-${item.item_name}-${item.stage_name}`}
                                    onClick={() => navigate(`/karigar/order/${item.order_id}?token=${token}`)}
                                    className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs hover:border-slate-300 active:scale-[0.99] transition-all cursor-pointer flex items-start gap-3"
                                >
                                    {/* Status Circle */}
                                    <div className="mt-0.5 shrink-0">
                                        {isDone ? (
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                        ) : deliveryStatus.isOverdue ? (
                                            <Circle className="h-5 w-5 text-rose-500 stroke-[2.5]" />
                                        ) : (
                                            <Circle className="h-5 w-5 text-slate-300" />
                                        )}
                                    </div>

                                    {/* Item Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h2 className={`text-[15px] font-semibold leading-snug break-words ${isDone ? "text-slate-400 line-through" : "text-slate-900"}`}>
                                                {item.item_name}
                                            </h2>
                                            <Badge className={`text-[10px] px-2 py-0.5 h-5 uppercase tracking-wide font-bold border rounded-md shrink-0 ${getStageStyles(item.stage_name)}`}>
                                                {item.stage_name}
                                            </Badge>
                                        </div>

                                        <p className={`text-xs mt-1 font-medium ${isDone ? "text-slate-400" : "text-slate-600"}`}>
                                            {item.customer_name}
                                        </p>

                                        {/* Metadata Footer */}
                                        <div className="flex items-center flex-wrap gap-2 mt-2.5 text-[11px]">
                                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-semibold">
                                                #{item.invoice_number}
                                            </span>

                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] ${deliveryStatus.color}`}>
                                                <Clock className="h-3 w-3 shrink-0" />
                                                {deliveryStatus.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}