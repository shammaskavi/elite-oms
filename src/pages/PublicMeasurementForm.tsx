import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
    CheckCircle2, Ruler, Info, ChevronRight,
    Loader2, User, Phone, ShoppingBag, MessageCircle,
    Check, X
} from "lucide-react";

export default function PublicMeasurement() {
    const { token } = useParams();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [linkData, setLinkData] = useState<any>(null);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
    const [fieldsMap, setFieldsMap] = useState<Record<string, any[]>>({});

    const [formData, setFormData] = useState<any>({});
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");

    useEffect(() => {
        const init = async () => {
            try {
                if (!token) {
                    setError("Invalid or expired link.");
                    setLoading(false);
                    return;
                }
                const { data: link, error: linkError } = await supabase
                    .from("measurement_links")
                    .select(`*, customers(name), measurement_templates(name)`)
                    .eq("token", token)
                    .single();

                if (linkError || !link) {
                    setError("This measurement link is no longer valid.");
                    setLoading(false);
                    return;
                }
                setLinkData(link);

                const { data: templatesData } = await supabase.from("measurement_templates").select("*");
                setTemplates(templatesData || []);

                const { data: fieldData } = await supabase.from("measurement_fields").select("*").order("order_index");
                const grouped: Record<string, any[]> = {};
                (fieldData || []).forEach((f) => {
                    if (!grouped[f.template_id]) grouped[f.template_id] = [];
                    grouped[f.template_id].push(f);
                });

                setFieldsMap(grouped);
                setLoading(false);
            } catch (err) {
                setError("An unexpected error occurred.");
                setLoading(false);
            }
        };
        init();
    }, [token]);

    // Validation Logic: Checks if all visible fields have a value
    const isFormIncomplete = () => {
        if (!name || !phone || selectedTemplates.length === 0) return true;

        for (const tplId of selectedTemplates) {
            const fields = fieldsMap[tplId] || [];
            for (const f of fields) {
                const value = formData[f.field_key];
                // Check for null, undefined, or empty string. 
                // Boolean 'false' is a valid value, so we specifically check for that.
                if (value === undefined || value === null || value === "") return true;
            }
        }
        return false;
    };

    const handleSubmit = async () => {
        if (isFormIncomplete()) return;

        setSubmitting(true);
        const cleanedValues = Object.fromEntries(
            Object.entries(formData).map(([k, v]) => [
                k, v === "true" || v === true ? true : v === "false" || v === false ? false : isNaN(Number(v)) ? v : Number(v),
            ])
        );

        const { data: existingCustomer } = await supabase.from("customers").select("id").eq("phone", phone).maybeSingle();
        let customerId = existingCustomer?.id;

        if (!customerId) {
            const { data: newCustomer } = await supabase.from("customers").insert({ name, phone }).select().single();
            customerId = newCustomer.id;
        }

        for (const templateId of selectedTemplates) {
            const templateFields = fieldsMap[templateId] || [];
            const values = Object.fromEntries(templateFields.map((f) => [f.field_key, cleanedValues[f.field_key]]));

            await supabase.from("customer_measurements").insert({
                customer_id: customerId,
                template_id: templateId,
                values,
                source: "customer",
                status: "pending",
            });
        }

        setSubmitting(false);
        setSuccess(true);
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white">
            <Loader2 className="w-10 h-10 animate-spin text-pink-600 mb-4" />
            <p className="text-gray-400 font-medium tracking-widest uppercase text-xs">Saree Palace Elite</p>
        </div>
    );

    if (success) return (
        <div className="min-h-screen flex items-center justify-center bg-white p-6 text-center">
            <div className="animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-3xl font-serif text-gray-900 mb-2">Perfect Fit Awaits!</h2>
                <p className="text-gray-500 max-w-xs mx-auto">We've received your measurements, {name}. Our team will contact you if we need any clarifications.</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#FDFCFD] pb-32">
            {/* Elegant Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20 px-6 py-4 flex justify-between items-center">
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-pink-600 font-bold">Boutique Concierge</p>
                    <h1 className="text-xl font-serif text-gray-900 italic">Saree Palace Elite</h1>
                </div>
                <Ruler className="text-gray-300 w-6 h-6" />
            </header>

            <main className="max-w-xl mx-auto p-6 pt-8">
                {/* Branding Card */}
                <section className="bg-slate-900 rounded-3xl p-8 mb-10 shadow-2xl shadow-pink-100 relative overflow-hidden text-white">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-serif mb-2 text-pink-100">Measurement Portal</h2>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Welcome to the Elite experience. Please provide your exact measurements for a flawless finish.
                        </p>
                    </div>
                </section>

                {/* Step 1: Identity */}
                <div className="space-y-4 mb-10">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest block">1. Your Details</label>
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                        <input
                            type="text"
                            placeholder="Full Name *"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-white border-2 border-gray-50 rounded-2xl pl-12 pr-4 py-4 focus:border-pink-500 focus:ring-4 focus:ring-pink-50 outline-none transition-all text-lg shadow-sm"
                        />
                    </div>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                        <input
                            type="tel"
                            placeholder="WhatsApp Number *"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-white border-2 border-gray-50 rounded-2xl pl-12 pr-4 py-4 focus:border-pink-500 focus:ring-4 focus:ring-pink-50 outline-none transition-all text-lg shadow-sm"
                        />
                    </div>
                </div>

                {/* Step 2: Selection */}
                <div className="mb-10">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 block">2. Select Garments</label>
                    <div className="flex gap-3 flex-wrap">
                        {templates.map((tpl) => {
                            const isSelected = selectedTemplates.includes(tpl.id);
                            return (
                                <button
                                    key={tpl.id}
                                    onClick={() => setSelectedTemplates(prev => isSelected ? prev.filter(id => id !== tpl.id) : [...prev, tpl.id])}
                                    className={`px-6 py-3 rounded-full text-sm font-semibold transition-all flex items-center gap-2 border-2 ${isSelected ? "bg-pink-600 border-pink-600 text-white shadow-lg shadow-pink-200" : "bg-white border-gray-100 text-gray-500 hover:border-pink-200 shadow-sm"
                                        }`}
                                >
                                    <ShoppingBag className={`w-4 h-4 ${isSelected ? "text-pink-200" : "text-gray-300"}`} />
                                    {tpl.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Step 3: Measurement Forms */}
                {selectedTemplates.map((templateId) => {
                    const tplFields = fieldsMap[templateId] || [];
                    const templateName = templates.find(t => t.id === templateId)?.name;

                    return (
                        <div key={templateId} className="mb-12 bg-white rounded-3xl p-6 border border-gray-50 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                            <h3 className="text-xl font-serif text-pink-700 mb-8 border-b border-pink-50 pb-4">
                                {templateName} Measurements
                            </h3>

                            <div className="space-y-8">
                                {tplFields.map((field) => (
                                    <div key={field.id} className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-700">
                                            {field.label} {field.unit && <span className="text-gray-400 font-normal ml-1">({field.unit})</span>}
                                        </label>

                                        {(field.input_type === "text" || field.input_type === "number") && (
                                            <input
                                                type={field.input_type}
                                                placeholder={`Enter ${field.label.toLowerCase()}`}
                                                className="w-full bg-gray-50/50 border-2 border-transparent rounded-xl px-4 py-4 focus:bg-white focus:border-pink-500 outline-none transition-all text-lg"
                                                value={formData[field.field_key] || ""}
                                                onChange={(e) => setFormData({ ...formData, [field.field_key]: e.target.value })}
                                            />
                                        )}

                                        {/* IMPROVEMENT: Yes/No Toggle for Can-Can / Pads */}
                                        {field.input_type === "boolean" && (
                                            <div className="flex gap-4">
                                                {[
                                                    { label: 'Yes', value: true, icon: <Check className="w-4 h-4" /> },
                                                    { label: 'No', value: false, icon: <X className="w-4 h-4" /> }
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.label}
                                                        onClick={() => setFormData({ ...formData, [field.field_key]: opt.value })}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 font-bold transition-all ${formData[field.field_key] === opt.value
                                                            ? "bg-pink-600 border-pink-600 text-white shadow-md"
                                                            : "bg-white border-gray-100 text-gray-400 hover:border-pink-100"
                                                            }`}
                                                    >
                                                        {opt.icon}
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {field.input_type === "dropdown" && (
                                            <select
                                                className="w-full bg-gray-50/50 border-2 border-transparent rounded-xl px-4 py-4 focus:bg-white focus:border-pink-500 outline-none transition-all text-lg appearance-none"
                                                value={formData[field.field_key] || ""}
                                                onChange={(e) => setFormData({ ...formData, [field.field_key]: e.target.value })}
                                            >
                                                <option value="">Choose Option</option>
                                                {(field.options || []).map((opt: string) => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </main>

            {/* Support Widget */}
            <a
                href="https://wa.me/918980937903?text=Hi Saree Palace Elite, I'm filling out the measurement form and need some help."
                target="_blank"
                rel="noreferrer"
                className="fixed bottom-28 right-6 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform z-50 flex items-center justify-center group"
            >
                <MessageCircle className="w-6 h-6" />
                <span className="absolute right-full mr-4 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-lg whitespace-nowrap font-bold tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">NEED HELP?</span>
            </a>

            {/* Action Bar */}
            <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 p-6 z-30">
                <div className="max-w-xl mx-auto">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || isFormIncomplete()}
                        className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${submitting || isFormIncomplete()
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                            : "bg-slate-900 text-white shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-95"
                            }`}
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Complete My Fit"}
                        {!submitting && <ChevronRight className="w-5 h-5" />}
                    </button>
                    {isFormIncomplete() && (
                        <p className="text-[10px] text-center mt-3 text-gray-400 font-bold tracking-wider uppercase">
                            Please ensure all details are filled to unlock submission
                        </p>
                    )}
                </div>
            </footer>
        </div>
    );
}