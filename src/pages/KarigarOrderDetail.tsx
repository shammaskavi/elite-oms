import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Notebook, Ruler, Copy, Check, Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import {
    KarigarLang,
    getSavedKarigarLang,
    saveKarigarLang,
    TRANSLATIONS,
    translateFieldKey,
    translateGarmentName,
    translateTemplateName,
    translateCustomerName,
    formatMeasurementValue,
} from "@/lib/karigarTranslations";

export default function KarigarOrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // Language state (defaults to Gujarati for karigars, toggleable)
    const [lang, setLang] = useState<KarigarLang>(() => getSavedKarigarLang());
    const t = TRANSLATIONS[lang];

    const handleSetLang = (newLang: KarigarLang) => {
        setLang(newLang);
        saveKarigarLang(newLang);
    };

    // 🔹 Data Fetching (Keep existing logic as it works perfectly)
    const { data: vendor } = useQuery({
        queryKey: ["vendor-by-token", token],
        queryFn: async () => {
            if (!token) return null;
            const { data, error } = await supabase.from("vendors").select("*").eq("access_token", token).single();
            if (error) throw error;
            return data;
        },
        enabled: !!token,
    });

    const { data: currentOrder } = useQuery({
        queryKey: ["order", id],
        queryFn: async () => {
            const { data, error } = await supabase.from("orders").select("*").eq("id", id).single();
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    const { data: invoice } = useQuery({
        queryKey: ["invoice-by-order", currentOrder?.invoice_id],
        queryFn: async () => {
            if (!currentOrder?.invoice_id) return null;
            const { data, error } = await supabase.from("invoices").select("*, customers(name)").eq("id", currentOrder.invoice_id).single();
            if (error) throw error;
            return data;
        },
        enabled: !!currentOrder?.invoice_id,
    });

    const { data: allStages } = useQuery({
        queryKey: ["order-stages", id],
        queryFn: async () => {
            if (!id) return [];
            const { data, error } = await supabase.from("order_stages").select("*").eq("order_id", id).order("created_at", { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // 🔐 Security & Loading
    if (!currentOrder) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 text-sm gap-2">
                <div className="h-6 w-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                <span>{t.loading}</span>
            </div>
        );
    }

    // Check if this vendor is assigned to any stage for this order
    const isVendorAssigned = !vendor || !allStages || allStages.length === 0 || allStages.some((s: any) => s.vendor_id === vendor.id);

    if (token && vendor && allStages && allStages.length > 0 && !isVendorAssigned) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full space-y-3">
                    <div className="h-12 w-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                        ⚠️
                    </div>
                    <h2 className="text-base font-bold text-slate-900">{t.task_not_assigned}</h2>
                    <p className="text-xs text-slate-500">
                        {t.task_not_assigned_desc}
                    </p>
                    <button
                        onClick={() => navigate(`/karigar/${token}`)}
                        className="w-full mt-2 py-2 px-4 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        {t.return_to_tasks}
                    </button>
                </div>
            </div>
        );
    }

    const numProducts = parseInt(currentOrder.metadata?.num_products || "1");

    const rawCustomerName = invoice?.customers?.name || "";
    const customerDisplayName = rawCustomerName
        ? translateCustomerName(rawCustomerName, lang)
        : (lang === "gu" ? "ગ્રાહક" : "Customer");

    const handleCopyMeasurements = (productNumber: number, productName: string, meas: any) => {
        if (!meas?.values) return;
        const lines = Object.entries(meas.values)
            .map(([k, v]) => `• ${translateFieldKey(k, lang)}: ${formatMeasurementValue(v, k, lang)}`)
            .join("\n");
        const templ = translateTemplateName(meas.template_name || (lang === "gu" ? "કપડાં" : "Garment"), lang);
        const fullText = `📐 ${productName} (${templ})\n${t.customer}: ${customerDisplayName}\n\n${lines}${meas.notes ? `\n\n${t.artisan_note} ${meas.notes}` : ""}`;

        navigator.clipboard.writeText(fullText);
        setCopiedIndex(productNumber);
        toast.success(lang === "gu" ? `${productName} ના માપ કોપી થઈ ગયા` : `Copied cutting specs for ${productName}`);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-10">
            {/* 📍 Header: Sticky & Compact with Segmented Language Switcher */}
            <div className="bg-white border-b sticky top-0 z-20 px-4 py-3 shadow-sm">
                <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer shrink-0"
                        >
                            <ArrowLeft className="h-5 w-5 text-slate-600" />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                                {t.invoice} #{invoice?.invoice_number}
                            </h1>
                            <p className="text-base font-bold text-slate-900 truncate mt-0.5" title={rawCustomerName}>
                                {customerDisplayName}
                            </p>
                        </div>
                    </div>


                    {/* Segmented Dual Language Switcher */}
                    <div className="flex items-center p-1 bg-slate-100 rounded-full border border-slate-200 shrink-0 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => handleSetLang("gu")}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                lang === "gu"
                                    ? "bg-purple-900 text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            🌐 ગુજરાતી
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSetLang("en")}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                lang === "en"
                                    ? "bg-purple-900 text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            English
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-md mx-auto space-y-4">
                {/* 🧵 Work Instructions */}
                <div className="space-y-4">
                    {Array.from({ length: numProducts }, (_, i) => {
                        const productNumber = i + 1;

                        const rawProductName =
                            currentOrder.metadata?.product_names?.[productNumber] ||
                            currentOrder.metadata?.item_name ||
                            `${t.item} ${productNumber}`;

                        // Translate garment item name
                        const productName = translateGarmentName(rawProductName, lang);

                        const productNotes =
                            currentOrder.metadata?.product_notes?.[productNumber] ||
                            currentOrder.notes ||
                            null;

                        const attachedMeasurement = currentOrder.metadata?.product_measurements?.[productNumber];
                        const templateName = attachedMeasurement?.template_name
                            ? translateTemplateName(attachedMeasurement.template_name, lang)
                            : (lang === "gu" ? "માપ વિગત" : "Specs");

                        return (
                            <div
                                key={productNumber}
                                className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3.5"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Notebook className="h-4 w-4 text-slate-400" />
                                        <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wide">
                                            {t.item} {productNumber}
                                        </h2>
                                    </div>

                                    {attachedMeasurement && (
                                        <Badge className="bg-purple-100 text-purple-900 hover:bg-purple-100 border border-purple-200 text-[10px] font-bold gap-1">
                                            <Ruler className="h-3 w-3 text-purple-700" />
                                            {templateName}
                                        </Badge>
                                    )}
                                </div>

                                <p className="text-lg font-bold text-slate-900 leading-snug">
                                    {productName}
                                </p>

                                {/* 📐 Attached Measurements for Karigar */}
                                {attachedMeasurement && attachedMeasurement.values && Object.keys(attachedMeasurement.values).length > 0 ? (
                                    <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/90 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Scissors className="h-3.5 w-3.5 text-purple-700" />
                                                <span className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                                                    {t.cutting_specs}
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleCopyMeasurements(productNumber, productName, attachedMeasurement)}
                                                className="text-[11px] font-semibold text-purple-800 bg-white hover:bg-purple-100 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1 transition-colors cursor-pointer"
                                            >
                                                {copiedIndex === productNumber ? (
                                                    <>
                                                        <Check className="h-3 w-3 text-emerald-600" /> {t.copied}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-3 w-3 text-purple-600" /> {t.copy_specs}
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* Grid of Measurements */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {Object.entries(attachedMeasurement.values).map(([key, val]) => (
                                                <div
                                                    key={key}
                                                    className="p-2 bg-white rounded-lg border border-purple-100/90 text-left shadow-2xs"
                                                >
                                                    <span className="text-[10px] uppercase text-slate-500 block font-semibold truncate" title={translateFieldKey(key, lang)}>
                                                        {translateFieldKey(key, lang)}
                                                    </span>
                                                    <span className="font-extrabold text-slate-900 text-sm">
                                                        {formatMeasurementValue(val, key, lang)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {attachedMeasurement.notes && (
                                            <div className="text-xs bg-white p-2.5 rounded-lg border border-purple-100 text-slate-700 leading-relaxed">
                                                <span className="font-bold text-purple-900">{t.artisan_note} </span>
                                                {attachedMeasurement.notes}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-2.5 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-500 text-xs flex items-center gap-2">
                                        <Ruler className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span>{t.no_measurements}</span>
                                    </div>
                                )}

                                {productNotes && (
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase text-slate-400 font-semibold">
                                            {t.work_notes}
                                        </p>
                                        <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-200 whitespace-pre-wrap leading-relaxed">
                                            {productNotes}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}