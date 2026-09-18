import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import GenerateMeasurementLinkModal from "@/components/measurements/GenerateMeasurementLinkModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Link as LinkIcon } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons";
import { StatusBadge } from "@/components/StatusBadge";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function Measurements() {
    useDocumentTitle("Measurements");
    const queryClient = useQueryClient();
    const [selectedMeasurement, setSelectedMeasurement] = useState<any | null>(null);
    const [search, setSearch] = useState("");
    const [filterTemplate, setFilterTemplate] = useState("");
    const navigate = useNavigate();
    const [openGenerateLink, setOpenGenerateLink] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editedValues, setEditedValues] = useState<Record<string, any>>({});

    const { data: measurements = [], isLoading } = useQuery({
        queryKey: ["customer-measurements"],
        queryFn: async () => {
            const { data, error } = await supabase
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

            if (error) throw error;
            return data || [];
        },
    });

    const { data: templateFields = [] } = useQuery({
        queryKey: ["measurement-template-fields", selectedMeasurement?.template_id],
        queryFn: async () => {
            if (!selectedMeasurement?.template_id) return [];
            const { data, error } = await supabase
                .from("measurement_fields")
                .select("*")
                .eq("template_id", selectedMeasurement.template_id);

            if (error) throw error;
            return data || [];
        },
        enabled: !!selectedMeasurement?.template_id,
    });

    useEffect(() => {
        if (selectedMeasurement) {
            setEditedValues(selectedMeasurement.values || {});
            setIsEditing(false);
        }
    }, [selectedMeasurement]);

    const verifyMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("customer_measurements")
                .update({ status: "verified" })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ["customer-measurements"] });
            setSelectedMeasurement((prev: any) =>
                prev?.id === id ? { ...prev, status: "verified" } : prev
            );
        },
        onError: (error) => {
            console.error(error);
            alert("Error verifying measurement");
        },
    });

    const saveMutation = useMutation({
        mutationFn: async ({ id, values }: { id: string; values: Record<string, any> }) => {
            const { error } = await supabase
                .from("customer_measurements")
                .update({ values })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: (_, { id, values }) => {
            queryClient.invalidateQueries({ queryKey: ["customer-measurements"] });
            setSelectedMeasurement((prev: any) =>
                prev?.id === id ? { ...prev, values } : prev
            );
            setIsEditing(false);
        },
        onError: (error) => {
            console.error(error);
            alert("Error saving changes");
        },
    });

    const handleVerify = (id: string) => {
        verifyMutation.mutate(id);
    };

    const handleSave = () => {
        if (!selectedMeasurement) return;
        saveMutation.mutate({ id: selectedMeasurement.id, values: editedValues });
    };

    const handleCancelEdit = () => {
        setEditedValues(selectedMeasurement?.values || {});
        setIsEditing(false);
    };

    const handlePrint = () => {
        if (!selectedMeasurement) return;

        const values = selectedMeasurement.values || {};

        const customerName = selectedMeasurement.customers?.name || "Customer";
        const templateName = selectedMeasurement.measurement_templates?.name || "Measurements";

        let content = "";

        content += "ELITE SAREE PALACE\n\n";
        content += `Customer: ${customerName}\n`;

        if (selectedMeasurement.customers?.phone) {
            content += `Phone: ${selectedMeasurement.customers.phone}\n`;
        }

        content += "\n";
        content += `--- ${templateName.toUpperCase()} ---\n\n`;

        Object.entries(values).forEach(([key, value]) => {
            const label = key.replace(/_/g, " ");
            const formattedLabel = label.charAt(0).toUpperCase() + label.slice(1);

            const val =
                value === true ? "Yes" :
                    value === false ? "No" :
                        value;

            content += `${formattedLabel}: ${val}\n`;
        });

        content += "\n--------------------------\n";
        content += "Thank you\n";

        const printArea = document.getElementById("print-area");
        if (!printArea) return;

        printArea.innerHTML = `<pre>${content}</pre>`;

        window.print();
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
        <div className="space-y-6">
            <style>
                {`
            @media print {
              body * {
                visibility: hidden;
              }

              #print-area, #print-area * {
                visibility: visible;
              }

              #print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
            }
            `}
            </style>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Measurements</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage, verify, and reuse bespoke customer measurements
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setOpenGenerateLink(true)}
                        className="gap-1.5"
                    >
                        <LinkIcon className="w-4 h-4" /> Generate Link
                    </Button>

                    <Button
                        onClick={() => navigate("/measurements/new")}
                        className="gap-1.5"
                    >
                        <Plus className="w-4 h-4" /> Add Measurement
                    </Button>
                </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search measurements by customer..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <div className="w-full sm:w-[220px]">
                    <Select value={filterTemplate || "all"} onValueChange={(val) => setFilterTemplate(val === "all" ? "" : val)}>
                        <SelectTrigger>
                            <SelectValue placeholder="All Templates" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Templates</SelectItem>
                            {Array.from(new Set(measurements.map((m: any) => m.measurement_templates?.name).filter(Boolean))).map(
                                (t: any) => (
                                    <SelectItem key={t} value={t}>
                                        {t}
                                    </SelectItem>
                                )
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table-style list */}
            <Card className="overflow-hidden p-0 shadow-sm">
                {isLoading ? (
                    <TableSkeleton
                        columns={["Customer", "Template", "Date", "Status"]}
                        rows={6}
                    />
                ) : filteredMeasurements.length === 0 ? (
                    <div className="text-center text-gray-500 py-10">
                        No measurements found
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-4 px-4 py-3 text-xs font-semibold text-gray-500 border-b bg-muted/20">
                            <span>Customer</span>
                            <span>Template</span>
                            <span>Date</span>
                            <span>Status</span>
                        </div>

                        {filteredMeasurements.map((m) => (
                            <div
                                key={m.id}
                                onClick={() => setSelectedMeasurement(m)}
                                className="grid grid-cols-4 px-4 py-4 text-sm border-b cursor-pointer hover:bg-gray-50 items-center transition-colors"
                            >
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {m.customers?.name}
                                    </p>
                                    {m.name && (
                                        <p className="text-xs text-gray-500">{m.name}</p>
                                    )}
                                </div>

                                <div className="text-gray-600">
                                    {m.measurement_templates?.name}
                                </div>

                                <div className="text-gray-500 text-xs">
                                    {new Date(m.created_at).toLocaleDateString()}
                                </div>

                                <div>
                                    <StatusBadge status={m.status} />
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </Card>

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

                                    <Button
                                        onClick={handleSave}
                                    >
                                        Save Changes
                                    </Button>
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
            <div id="print-area" style={{ display: "none" }} />
        </div>
    );
}