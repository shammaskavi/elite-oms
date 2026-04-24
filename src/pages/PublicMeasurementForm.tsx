import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
    CheckCircle2, Ruler, Info, ChevronRight,
    Loader2, User, Phone, ShoppingBag, MessageCircle,
    Check, X, Download
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

    const isFormIncomplete = () => {
        if (!name || !phone || selectedTemplates.length === 0) return true;
        for (const tplId of selectedTemplates) {
            const fields = fieldsMap[tplId] || [];
            for (const f of fields) {
                const value = formData[f.field_key];
                if (value === undefined || value === null || value === "") return true;
            }
        }
        return false;
    };

    const generatePDF = () => {
        const doc = new jsPDF();
        const timestamp = new Date().toLocaleDateString();

        // Branding Header
        doc.setFontSize(22);
        doc.setTextColor(190, 24, 93); // Pink-600
        doc.text("SAREE PALACE ELITE", 105, 20, { align: "center" });

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text("Boutique Measurement Summary", 105, 28, { align: "center" });

        // Customer Info
        doc.setTextColor(0);
        doc.setFontSize(11);
        doc.text(`Customer: ${name}`, 20, 45);
        doc.text(`Phone: ${phone}`, 20, 52);
        doc.text(`Date: ${timestamp}`, 20, 59);

        let currentY = 70;

        selectedTemplates.forEach((tplId) => {
            const template = templates.find(t => t.id === tplId);
            const fields = fieldsMap[tplId] || [];

            doc.setFontSize(14);
            doc.setTextColor(190, 24, 93);
            doc.text(`${template?.name} Measurements`, 20, currentY);

            const tableRows = fields.map(f => [
                f.label,
                `${formData[f.field_key]} ${f.unit || ""}`
            ]);

            autoTable(doc, {
                startY: currentY + 5,
                head: [['Measurement', 'Value']],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [30, 41, 59] }, // Slate-800
                margin: { left: 20, right: 20 }
            });

            currentY = (doc as any).lastAutoTable.finalY + 15;
        });

        doc.save(`${name.replace(/\s+/g, '_')}_Measurements.pdf`);
    };

    const handleSubmit = async () => {
        if (isFormIncomplete()) return;

        setSubmitting(true);
        try {
            const cleanedValues = Object.fromEntries(
                Object.entries(formData).map(([k, v]) => [
                    k, v === "true" || v === true ? true : v === "false" || v === false ? false : isNaN(Number(v)) ? v : Number(v),
                ])
            );

            // 1. Get or Create Customer
            const { data: existingCustomer } = await supabase.from("customers").select("id").eq("phone", phone).maybeSingle();
            let customerId = existingCustomer?.id;

            if (!customerId) {
                const { data: newCustomer } = await supabase.from("customers").insert({ name, phone }).select().single();
                customerId = newCustomer.id;
            }

            // 2. Insert measurements for each product
            for (const templateId of selectedTemplates) {
                const templateFields = fieldsMap[templateId] || [];
                const values = Object.fromEntries(templateFields.map((f) => [f.field_key, cleanedValues[f.field_key]]));

                const { error: insertError } = await supabase.from("customer_measurements").insert({
                    customer_id: customerId,
                    template_id: templateId,
                    values,
                    source: "customer",
                    status: "pending",
                });

                if (insertError) throw insertError;
            }

            // 3. Download PDF
            generatePDF();

            // 4. Finalize
            setSubmitting(false);
            setSuccess(true);
        } catch (err) {
            console.error(err);
            alert("Database connection failed. Please check your internet and try again.");
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white text-center px-6">
            <Loader2 className="w-10 h-10 animate-spin text-pink-600 mb-4" />
            <p className="text-gray-400 font-medium tracking-widest uppercase text-xs">Saree Palace Elite</p>
        </div>
    );

    if (success) return (
        <div className="min-h-screen flex items-center justify-center bg-white p-6 text-center">
            <div className="animate-in zoom-in duration-500 max-w-sm">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-3xl font-serif text-gray-900 mb-4">Confirmed!</h2>
                <p className="text-gray-500 mb-8">Measurements saved and PDF downloaded. We'll start crafting your perfect fit shortly.</p>
                <button
                    onClick={() => window.location.reload()}
                    className="text-pink-600 font-bold border-2 border-pink-100 px-6 py-2 rounded-full"
                >
                    Fill Another
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#FDFCFD] pb-32 font-sans">
            <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20 px-6 py-4 flex justify-between items-center shadow-sm">
                <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-pink-600 font-black">Elite Collection</p>
                    <h1 className="text-xl font-serif text-gray-900 italic tracking-tight">Saree Palace Elite</h1>
                </div>
                <Ruler className="text-gray-300 w-5 h-5" />
            </header>

            <main className="max-w-xl mx-auto p-6 pt-8">
                <section className="bg-slate-900 rounded-[2rem] p-8 mb-10 shadow-2xl shadow-pink-100 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-serif mb-2">Digital Studio</h2>
                        <p className="text-sm text-slate-400 leading-relaxed font-light">
                            Welcome, {name || 'valued client'}. Please provide your details for our tailoring masters.
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                </section>

                <div className="space-y-4 mb-10">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block px-1">1. Contact Identity</label>
                    <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-pink-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Full Name *"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-white border-2 border-gray-50 rounded-2xl pl-12 pr-4 py-4 focus:border-pink-500 focus:ring-8 focus:ring-pink-50/50 outline-none transition-all text-lg"
                        />
                    </div>
                    <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-pink-500 transition-colors" />
                        <input
                            type="tel"
                            placeholder="WhatsApp Number *"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-white border-2 border-gray-50 rounded-2xl pl-12 pr-4 py-4 focus:border-pink-500 focus:ring-8 focus:ring-pink-50/50 outline-none transition-all text-lg"
                        />
                    </div>
                </div>

                <div className="mb-10">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block px-1">2. Required Garments</label>
                    <div className="flex gap-2 flex-wrap">
                        {templates.map((tpl) => {
                            const isSelected = selectedTemplates.includes(tpl.id);
                            return (
                                <button
                                    key={tpl.id}
                                    onClick={() => setSelectedTemplates(prev => isSelected ? prev.filter(id => id !== tpl.id) : [...prev, tpl.id])}
                                    className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 border-2 ${isSelected ? "bg-slate-900 border-slate-900 text-white shadow-lg" : "bg-white border-gray-100 text-gray-400 hover:border-pink-200"
                                        }`}
                                >
                                    <ShoppingBag className="w-4 h-4" />
                                    {tpl.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {selectedTemplates.map((templateId) => {
                    const tplFields = fieldsMap[templateId] || [];
                    const templateName = templates.find(t => t.id === templateId)?.name;

                    return (
                        <div key={templateId} className="mb-12 bg-white rounded-[2rem] p-8 border border-gray-50 shadow-sm animate-in fade-in slide-in-from-bottom-6">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-600"><Ruler className="w-5 h-5" /></div>
                                <h3 className="text-xl font-serif text-gray-900">{templateName} Specs</h3>
                            </div>

                            <div className="space-y-8">
                                {tplFields.map((field) => (
                                    <div key={field.id} className="space-y-3">
                                        <label className="block text-xs font-black text-gray-500 uppercase tracking-tighter">
                                            {field.label} {field.unit && <span className="text-pink-400 font-normal ml-1 lowercase">({field.unit})</span>}
                                        </label>

                                        {(field.input_type === "text" || field.input_type === "number") && (
                                            <input
                                                type={field.input_type}
                                                placeholder={`0.0`}
                                                className="w-full bg-gray-50/50 border-2 border-transparent rounded-xl px-4 py-4 focus:bg-white focus:border-pink-500 outline-none transition-all text-xl font-medium"
                                                value={formData[field.field_key] || ""}
                                                onChange={(e) => setFormData({ ...formData, [field.field_key]: e.target.value })}
                                            />
                                        )}

                                        {field.input_type === "boolean" && (
                                            <div className="flex gap-3">
                                                {[
                                                    { label: 'Yes', value: true, icon: <Check className="w-4 h-4" /> },
                                                    { label: 'No', value: false, icon: <X className="w-4 h-4" /> }
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.label}
                                                        onClick={() => setFormData({ ...formData, [field.field_key]: opt.value })}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 font-black transition-all ${formData[field.field_key] === opt.value
                                                                ? "bg-pink-600 border-pink-600 text-white shadow-xl shadow-pink-100"
                                                                : "bg-white border-gray-100 text-gray-400"
                                                            }`}
                                                    >
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
                                                <option value="">Select Option</option>
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

            <a
                href="https://wa.me/918980937903?text=Hi Saree Palace Elite, I'm filling my measurements and have a question."
                target="_blank"
                rel="noreferrer"
                className="fixed bottom-28 right-6 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-90 transition-all z-50 group"
            >
                <MessageCircle className="w-6 h-6" />
                <span className="absolute right-full mr-4 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap tracking-widest">WHATSAPP SUPPORT</span>
            </a>

            <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-gray-100 p-6 z-30">
                <div className="max-w-xl mx-auto">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || isFormIncomplete()}
                        className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${submitting || isFormIncomplete()
                                ? "bg-gray-100 text-gray-300 shadow-none"
                                : "bg-pink-600 text-white shadow-2xl shadow-pink-200 active:scale-95 hover:bg-pink-700"
                            }`}
                    >
                        {submitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Download className="w-5 h-5" /> Submit & Download PDF
                            </>
                        )}
                    </button>
                    {isFormIncomplete() && (
                        <p className="text-[9px] text-center mt-4 text-gray-400 font-bold tracking-widest uppercase">
                            Please complete all mandatory fields to finalize
                        </p>
                    )}
                </div>
            </footer>
        </div>
    );
}