import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function PublicMeasurement() {
    const { token } = useParams();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [linkData, setLinkData] = useState<any>(null);
    const [fields, setFields] = useState<any[]>([]);
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        const init = async () => {
            try {
                if (!token) {
                    setError("Invalid link");
                    setLoading(false);
                    return;
                }

                const { data: link, error: linkError } = await supabase
                    .from("measurement_links")
                    .select(`*, customers(name), measurement_templates(name)`)
                    .eq("token", token)
                    .single();

                if (linkError || !link) {
                    setError("Invalid link");
                    setLoading(false);
                    return;
                }

                if (link.status !== "active") {
                    setError("This link has already been used");
                    setLoading(false);
                    return;
                }

                if (link.expires_at && new Date(link.expires_at) < new Date()) {
                    setError("This link has expired");
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
                    setError("Failed to load measurement fields");
                    setLoading(false);
                    return;
                }

                setFields(fieldData || []);
                setLoading(false);
            } catch (err) {
                console.error(err);
                setError("Something went wrong while loading");
                setLoading(false);
            }
        };

        init();
    }, [token]);

    const handleSubmit = async () => {
        if (!linkData) return;

        if (Object.keys(formData).length === 0) {
            setError("Please fill at least one measurement");
            return;
        }

        setSubmitting(true);

        const cleanedValues = Object.fromEntries(
            Object.entries(formData).map(([k, v]) => [
                k,
                v === "true"
                    ? true
                    : v === "false"
                        ? false
                        : isNaN(Number(v))
                            ? v
                            : Number(v),
            ])
        );

        const { error } = await supabase
            .from("customer_measurements")
            .insert({
                customer_id: linkData.customer_id,
                template_id: linkData.template_id,
                values: cleanedValues,
                source: "customer",
                status: "pending",
            });

        if (error) {
            console.error(error);
            setError("Something went wrong. Please try again.");
            setSubmitting(false);
            return;
        }

        await supabase
            .from("measurement_links")
            .update({ status: "used" })
            .eq("id", linkData.id);

        setSubmitting(false);
        setSuccess(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center text-center p-6">
                <div>
                    <p className="text-red-500 font-medium">{error}</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center text-center p-6">
                <div className="space-y-3">
                    <h2 className="text-xl font-semibold">You're all set 🎉</h2>
                    <p className="text-gray-500">
                        We've received your measurements. Our team will review them shortly.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex justify-center p-4">
            <div className="w-full max-w-xl bg-white rounded-xl shadow p-6 space-y-6">
                {/* Header */}
                <div className="space-y-1">
                    <h1 className="text-xl font-semibold">
                        Enter Your Measurements
                    </h1>
                    <p className="text-sm text-gray-500">
                        For: {linkData.customers?.name}
                    </p>
                    <p className="text-sm text-gray-400">
                        Garment: {linkData.measurement_templates?.name}
                    </p>
                </div>
                <p className="text-sm text-gray-500">
                    Please fill in the measurements carefully. If you're unsure, you can skip — we will assist you later.
                </p>

                {/* Fields */}
                <div className="space-y-5">
                    {fields.map((field) => {
                        const label = field.label;

                        return (
                            <div key={field.id} className="space-y-1">
                                {field.image_url && (
                                    <img src={field.image_url} className="w-24 rounded mb-2" />
                                )}
                                <label className="text-sm text-gray-600">
                                    {label}
                                    {field.unit && (
                                        <span className="text-gray-400 ml-1">
                                            ({field.unit})
                                        </span>
                                    )}
                                </label>

                                {field.input_type === "number" && (
                                    <input
                                        type="number"
                                        className="w-full border rounded p-2"
                                        value={formData[field.field_key] || ""}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                [field.field_key]: e.target.value,
                                            })
                                        }
                                    />
                                )}

                                {field.input_type === "text" && (
                                    <input
                                        type="text"
                                        className="w-full border rounded p-2"
                                        value={formData[field.field_key] || ""}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                [field.field_key]: e.target.value,
                                            })
                                        }
                                    />
                                )}

                                {field.input_type === "dropdown" && (
                                    <select
                                        className="w-full border rounded p-2"
                                        value={formData[field.field_key] || ""}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                [field.field_key]: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="">Select</option>
                                        {(field.options || []).map((opt: string) => (
                                            <option key={opt} value={opt}>
                                                {opt}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {field.input_type === "boolean" && (
                                    <select
                                        className="w-full border rounded p-2"
                                        value={formData[field.field_key] || ""}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                [field.field_key]: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="">Select</option>
                                        <option value="true">Yes</option>
                                        <option value="false">No</option>
                                    </select>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`w-full py-3 rounded transition ${submitting ? "bg-gray-300 text-gray-500" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                >
                    {submitting ? "Submitting..." : "Submit Measurements"}
                </button>
                <p className="text-xs text-gray-400 text-center">
                    Your measurements will be reviewed before final use.
                </p>
            </div>
        </div>
    );
}