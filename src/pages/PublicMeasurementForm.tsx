import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Ruler, Info, ChevronRight, Loader2 } from "lucide-react";

export default function PublicMeasurement() {
    const { token } = useParams();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [linkData, setLinkData] = useState<any>(null);
    const [fields, setFields] = useState<any[]>([]);
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


                if (link.expires_at && new Date(link.expires_at) < new Date()) {
                    setError("This link has expired for security reasons.");
                    setLoading(false);
                    return;
                }

                setLinkData(link);

                const { data: fieldData, error: fieldError } = await supabase
                    .from("measurement_fields")
                    .select("*")
                    .eq("template_id", link.template_id)
                    .order("order_index");

                if (fieldError) {
                    setError("Failed to load form fields.");
                    setLoading(false);
                    return;
                }

                setFields(fieldData || []);
                setLoading(false);
            } catch (err) {
                setError("An unexpected error occurred.");
                setLoading(false);
            }
        };

        init();
    }, [token]);

    // NOTE:
    // This is an open measurement link.
    // Multiple users can submit using the same link.
    // We do NOT mark the link as used after submission.
    const handleSubmit = async () => {
        if (!linkData) return;
        if (Object.keys(formData).length === 0) {
            alert("Please fill in at least one measurement field.");
            return;
        }

        setSubmitting(true);
        const cleanedValues = Object.fromEntries(
            Object.entries(formData).map(([k, v]) => [
                k,
                v === "true" ? true : v === "false" ? false : isNaN(Number(v)) ? v : Number(v),
            ])
        );

        // Validate name & phone
        if (!name || !phone) {
            alert("Please enter your name and phone number.");
            setSubmitting(false);
            return;
        }

        // Check existing customer
        const { data: existingCustomer } = await supabase
            .from("customers")
            .select("id")
            .eq("phone", phone)
            .single();

        let customerId = existingCustomer?.id;

        // Create if not exists
        if (!customerId) {
            const { data: newCustomer, error: createError } = await supabase
                .from("customers")
                .insert({ name, phone })
                .select()
                .single();

            if (createError) {
                setError("Failed to create customer.");
                setSubmitting(false);
                return;
            }

            customerId = newCustomer.id;
        }

        // Save measurement
        const { error } = await supabase.from("customer_measurements").insert({
            customer_id: customerId,
            template_id: linkData.template_id,
            values: cleanedValues,
            source: "customer",
            status: "pending",
        });

        if (error) {
            setError("Failed to submit. Please try again.");
            setSubmitting(false);
            return;
        }

        setSubmitting(false);
        setSuccess(true);
    };

    // Progress Calculation
    const filledFields = Object.keys(formData).length;
    const progress = Math.round((filledFields / fields.length) * 100) || 0;

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white">
                <Loader2 className="w-10 h-10 animate-spin text-pink-600 mb-4" />
                <p className="text-gray-400 font-medium tracking-wide">SAREE PALACE ELITE</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
                    <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Info className="text-red-500 w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Notice</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button onClick={() => window.location.reload()} className="text-pink-600 font-semibold underline">Try Again</button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white p-6">
                <div className="text-center animate-in fade-in zoom-in duration-500">
                    <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6" />
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Thank you!</h2>
                    <p className="text-gray-500 max-w-sm mx-auto">
                        Your measurements have been received successfully.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFCFD] pb-20">
            {/* Elegant Header */}
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
                <div className="max-w-xl mx-auto flex justify-between items-end">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-pink-600 font-bold mb-1">Boutique Measurement</p>
                        <h1 className="text-xl font-serif text-gray-900 leading-none">Saree Palace Elite</h1>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Step 1 of 1</p>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                            <div
                                className="h-full bg-pink-500 transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-xl mx-auto p-6 pt-8">
                {/* Context Card */}
                <div className="bg-slate-900 text-white rounded-2xl p-6 mb-8 shadow-xl shadow-pink-100/50">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-medium opacity-90">Enter Your Details</h2>
                            <p className="text-pink-300 text-sm font-semibold">{linkData.measurement_templates?.name}</p>
                        </div>
                        <Ruler className="text-pink-400 opacity-50 w-8 h-8" />
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center text-xs opacity-70">
                        <Info className="w-4 h-4 mr-2" />
                        Please provide measurements in {fields[0]?.unit || "inches"}
                    </div>
                </div>

                {/* User Details */}
                <div className="space-y-4 mb-8">
                    <input
                        type="text"
                        placeholder="Your Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-50 transition-all text-lg"
                    />

                    <input
                        type="tel"
                        placeholder="Phone Number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-50 transition-all text-lg"
                    />
                </div>

                {/* Form Fields */}
                <div className="space-y-10">
                    {fields.map((field) => (
                        <div key={field.id} className="group animate-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                            <div className="flex flex-col md:flex-row gap-4">
                                {field.image_url && (
                                    <div className="w-full md:w-32 h-32 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
                                        <img
                                            src={field.image_url}
                                            alt={field.label}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                    </div>
                                )}
                                <div className="flex-1 space-y-3">
                                    <label className="block text-base font-semibold text-gray-800">
                                        {field.label}
                                        {field.unit && <span className="text-gray-400 font-normal ml-1">({field.unit})</span>}
                                    </label>

                                    <div className="relative">
                                        {(field.input_type === "number" || field.input_type === "text") && (
                                            <input
                                                type={field.input_type}
                                                placeholder={field.input_type === "number" ? "0.0" : "Enter detail..."}
                                                className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-50 transition-all text-lg"
                                                value={formData[field.field_key] || ""}
                                                onChange={(e) => setFormData({ ...formData, [field.field_key]: e.target.value })}
                                            />
                                        )}

                                        {field.input_type === "dropdown" && (
                                            <select
                                                className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition-all text-lg appearance-none"
                                                value={formData[field.field_key] || ""}
                                                onChange={(e) => setFormData({ ...formData, [field.field_key]: e.target.value })}
                                            >
                                                <option value="">Select style</option>
                                                {(field.options || []).map((opt: string) => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        )}

                                        {field.input_type === "boolean" && (
                                            <div className="flex gap-3">
                                                {["true", "false"].map((val) => (
                                                    <button
                                                        key={val}
                                                        onClick={() => setFormData({ ...formData, [field.field_key]: val })}
                                                        className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all ${formData[field.field_key] === val
                                                            ? "border-pink-500 bg-pink-50 text-pink-700"
                                                            : "border-gray-100 bg-white text-gray-500"
                                                            }`}
                                                    >
                                                        {val === "true" ? "Yes" : "No"}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-400 italic">Optional field — skip if unsure.</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Sticky Mobile Footer Action */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-lg border-t border-gray-100">
                <div className="max-w-xl mx-auto flex gap-4 items-center">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={`flex-1 py-4 rounded-xl font-bold text-white shadow-lg shadow-pink-200 transition-all flex items-center justify-center gap-2 ${submitting ? "bg-gray-400" : "bg-gradient-to-r from-pink-600 to-rose-500 active:scale-95"
                            }`}
                    >
                        {submitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                Complete Submission <ChevronRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}