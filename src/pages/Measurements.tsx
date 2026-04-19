import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import GenerateMeasurementLinkModal from "@/components/measurements/GenerateMeasurementLinkModal";

export default function Measurements() {
    const [measurements, setMeasurements] = useState<any[]>([]);
    const [selectedMeasurement, setSelectedMeasurement] = useState<any | null>(null);
    const [search, setSearch] = useState("");
    const [filterTemplate, setFilterTemplate] = useState("");
    const navigate = useNavigate();
    const [openGenerateLink, setOpenGenerateLink] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editedValues, setEditedValues] = useState<Record<string, any>>({});
    const [templateFields, setTemplateFields] = useState<any[]>([]);

    useEffect(() => {
        const fetchProfiles = async () => {
            const { data } = await supabase
                .from("customer_measurements")
                .select(`
          id,
          name,
          template_id,
          created_at,
          source,
          status,
          values,
          customers(name),
          measurement_templates(name)
        `)
                .order("created_at", { ascending: false });

            setMeasurements(data || []);
        };

        fetchProfiles();
    }, []);

    useEffect(() => {
        if (selectedMeasurement) {
            setEditedValues(selectedMeasurement.values || {});
            setIsEditing(false);

            const fetchFields = async () => {
                const { data } = await supabase
                    .from("measurement_fields")
                    .select("*")
                    .eq("template_id", selectedMeasurement.template_id);

                setTemplateFields(data || []);
            };

            fetchFields();
        }
    }, [selectedMeasurement]);

    const handleVerify = async (id: string) => {
        const { error } = await supabase
            .from("customer_measurements")
            .update({ status: "verified" })
            .eq("id", id);

        if (error) {
            console.error(error);
            alert("Error verifying measurement");
            return;
        }

        setMeasurements((prev) =>
            prev.map((m) =>
                m.id === id ? { ...m, status: "verified" } : m
            )
        );

        setSelectedMeasurement((prev: any) =>
            prev ? { ...prev, status: "verified" } : prev
        );
    };

    const handleSave = async () => {
        if (!selectedMeasurement) return;

        const { error } = await supabase
            .from("customer_measurements")
            .update({ values: editedValues })
            .eq("id", selectedMeasurement.id);

        if (error) {
            console.error(error);
            alert("Error saving changes");
            return;
        }

        setMeasurements((prev) =>
            prev.map((m) =>
                m.id === selectedMeasurement.id ? { ...m, values: editedValues } : m
            )
        );

        setSelectedMeasurement((prev: any) =>
            prev ? { ...prev, values: editedValues } : prev
        );

        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditedValues(selectedMeasurement?.values || {});
        setIsEditing(false);
    };

    const handlePrint = () => {
        console.log("print");
    };

    const filteredMeasurements = measurements.filter((m) => {
        const matchesSearch =
            m.customers?.name?.toLowerCase().includes(search.toLowerCase()) ||
            m.name?.toLowerCase().includes(search.toLowerCase());

        const matchesTemplate = filterTemplate
            ? m.measurement_templates?.name === filterTemplate
            : true;

        return matchesSearch && matchesTemplate;
    });

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold">Measurements</h1>
                    <p className="text-sm text-gray-500">
                        Manage and reuse customer measurements
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setOpenGenerateLink(true)}
                        className="border border-slate-900 text-slate-900 px-4 py-2 rounded hover:bg-slate-100 transition"
                    >
                        Generate Measurement Link
                    </button>

                    <button
                        onClick={() => navigate("/measurements/new")}
                        className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 transition"
                    >
                        + Add Measurement
                    </button>
                </div>
            </div>

            <div className="flex gap-4">
                <input
                    type="text"
                    placeholder="Search by customer or name"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border p-2 rounded w-full"
                />

                <select
                    value={filterTemplate}
                    onChange={(e) => setFilterTemplate(e.target.value)}
                    className="border p-2 rounded"
                >
                    <option value="">All Templates</option>
                    {[...new Set(measurements.map((m) => m.measurement_templates?.name))].map(
                        (t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        )
                    )}
                </select>
            </div>

            <div className="space-y-4">
                {filteredMeasurements.map((m) => {
                    const previewEntries = Object.entries(m.values || {}).slice(0, 2);

                    return (
                        <div
                            key={m.id}
                            onClick={() => setSelectedMeasurement(m)}
                            className="border p-4 rounded flex justify-between items-center cursor-pointer hover:bg-gray-50"
                        >
                            <div className="space-y-1">
                                <p className="font-medium">
                                    {m.customers?.name} {m.name ? `- ${m.name}` : ""}
                                </p>

                                <p className="text-sm text-gray-500">
                                    {m.measurement_templates?.name}
                                </p>

                                <p className="text-sm text-gray-400">
                                    {previewEntries
                                        .map(([k, v]) => `${k}: ${v}`)
                                        .join(", ")}
                                </p>
                            </div>

                            <div className="text-right space-y-1">
                                <p className="text-xs text-gray-400">
                                    {new Date(m.created_at).toLocaleDateString()}
                                </p>

                                <p
                                    className={`text-xs px-2 py-1 rounded inline-block ${m.status === "verified"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-yellow-100 text-yellow-700"
                                        }`}
                                >
                                    {m.status}
                                </p>
                            </div>
                        </div>
                    );
                })}
                {filteredMeasurements.length === 0 && (
                    <div className="text-center text-gray-500 py-10">
                        No measurements found
                    </div>
                )}
            </div>

            {selectedMeasurement && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold leading-tight">
                                {selectedMeasurement.customers?.name} {selectedMeasurement.name ? `- ${selectedMeasurement.name}` : ""}
                            </h2>
                            <button
                                onClick={() => setSelectedMeasurement(null)}
                                className="text-gray-500"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-sm text-gray-500 mb-6">
                            {selectedMeasurement.measurement_templates?.name}
                        </p>

                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                            Measurements
                        </div>

                        <div className="space-y-2">
                            {templateFields.map((field) => {
                                const key = field.field_key;
                                const value = editedValues[key];

                                const formattedKey = field.label;

                                const displayValue =
                                    value === true ? "Yes" : value === false ? "No" : String(value ?? "");

                                return (
                                    <div key={key} className="flex justify-between items-center border-b pb-2">
                                        <span className="text-gray-600 text-sm">{formattedKey}</span>

                                        {isEditing ? (
                                            field.input_type === "number" ? (
                                                <input
                                                    type="number"
                                                    className="border rounded px-2 py-1 text-sm w-32 text-right"
                                                    value={value ?? ""}
                                                    onChange={(e) =>
                                                        setEditedValues((prev) => ({
                                                            ...prev,
                                                            [key]: Number(e.target.value),
                                                        }))
                                                    }
                                                />
                                            ) : field.input_type === "dropdown" ? (
                                                <select
                                                    className="border rounded px-2 py-1 text-sm w-32 text-right"
                                                    value={value ?? ""}
                                                    onChange={(e) =>
                                                        setEditedValues((prev) => ({
                                                            ...prev,
                                                            [key]: e.target.value,
                                                        }))
                                                    }
                                                >
                                                    <option value="">Select</option>
                                                    {(field.options || []).map((opt: string) => (
                                                        <option key={opt} value={opt}>
                                                            {opt}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : field.input_type === "boolean" ? (
                                                <select
                                                    className="border rounded px-2 py-1 text-sm w-32 text-right"
                                                    value={String(value)}
                                                    onChange={(e) =>
                                                        setEditedValues((prev) => ({
                                                            ...prev,
                                                            [key]: e.target.value === "true",
                                                        }))
                                                    }
                                                >
                                                    <option value="true">Yes</option>
                                                    <option value="false">No</option>
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    className="border rounded px-2 py-1 text-sm w-32 text-right"
                                                    value={value ?? ""}
                                                    onChange={(e) =>
                                                        setEditedValues((prev) => ({
                                                            ...prev,
                                                            [key]: e.target.value,
                                                        }))
                                                    }
                                                />
                                            )
                                        ) : (
                                            <span className="font-medium text-sm">{displayValue}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-6 pt-4 border-t flex justify-between items-center">
                            {!isEditing ? (
                                <>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="border px-4 py-2 rounded text-sm"
                                        >
                                            Edit
                                        </button>

                                        <button
                                            onClick={handlePrint}
                                            className="border px-4 py-2 rounded text-sm"
                                        >
                                            Print
                                        </button>
                                    </div>

                                    {selectedMeasurement.status !== "verified" && (
                                        <button
                                            onClick={() => handleVerify(selectedMeasurement.id)}
                                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                                        >
                                            Mark as Verified
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="flex gap-2 ml-auto">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="border px-4 py-2 rounded text-sm"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        onClick={handleSave}
                                        className="bg-slate-900 text-white px-4 py-2 rounded text-sm"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <GenerateMeasurementLinkModal
                open={openGenerateLink}
                onClose={() => setOpenGenerateLink(false)}
            />
        </div>
    );
}