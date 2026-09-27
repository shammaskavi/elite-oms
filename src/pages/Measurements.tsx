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
import { Plus, Search, Link as LinkIcon, Copy, Check, Printer, Edit2, Ruler } from "lucide-react";
import { toast } from "sonner";
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
    const [copied, setCopied] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editedValues, setEditedValues] = useState<Record<string, any>>({});

    // 1. Fetch from customer_measurements table
    const { data: customerMeasurements = [], isLoading: cmLoading } = useQuery({
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

    // 2. Fetch order-attached measurements from orders table
    const { data: ordersWithMeasurements = [], isLoading: ordersLoading } = useQuery({
        queryKey: ["orders-with-product-measurements"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("orders")
                .select(`
                    id,
                    order_code,
                    created_at,
                    metadata,
                    customers(name)
                `)
                .not("metadata->product_measurements", "is", null)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data || [];
        },
    });

    // Merge both into a unified list
    const measurements = React.useMemo(() => {
        const orderList: any[] = [];
        ordersWithMeasurements.forEach((ord: any) => {
            const pMeasurements = ord.metadata?.product_measurements || {};
            const pNames = ord.metadata?.product_names || {};
            Object.entries(pMeasurements).forEach(([pNumStr, mData]: [string, any]) => {
                if (!mData || !mData.values || Object.keys(mData.values).length === 0) return;
                const pNum = parseInt(pNumStr);
                const pName = pNames[pNum] || mData.profile_name || mData.template_name || `Piece #${pNum}`;

                orderList.push({
                    id: `order_${ord.id}_${pNum}`,
                    is_order_attachment: true,
                    order_id: ord.id,
                    product_number: pNum,
                    raw_order_metadata: ord.metadata,
                    name: `${pName} (Order #${ord.order_code || ord.id.slice(0, 5)})`,
                    template_id: mData.template_id || null,
                    measurement_templates: { name: mData.template_name || "Garment Specs" },
                    created_at: mData.attached_at || ord.created_at,
                    source: "order_attachment",
                    status: "verified",
                    values: mData.values || {},
                    customers: ord.customers,
                });
            });
        });

        return [...customerMeasurements, ...orderList].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }, [customerMeasurements, ordersWithMeasurements]);

    const isLoading = cmLoading || ordersLoading;

    // Fetch fields for template (if available)
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
        mutationFn: async ({
            measurement,
            values,
        }: {
            measurement: any;
            values: Record<string, any>;
        }) => {
            if (measurement.is_order_attachment) {
                // Update in orders table
                const currentMeta = measurement.raw_order_metadata || {};
                const pMeasurements = currentMeta.product_measurements || {};
                const pNum = measurement.product_number;

                const updatedMeasurements = {
                    ...pMeasurements,
                    [pNum]: {
                        ...pMeasurements[pNum],
                        values,
                        attached_at: new Date().toISOString(),
                    },
                };

                const { error } = await (supabase as any)
                    .from("orders")
                    .update({
                        metadata: {
                            ...currentMeta,
                            product_measurements: updatedMeasurements,
                        },
                    })
                    .eq("id", measurement.order_id);

                if (error) throw error;
            } else {
                // Update in customer_measurements table
                const { error } = await supabase
                    .from("customer_measurements")
                    .update({ values })
                    .eq("id", measurement.id);
                if (error) throw error;
            }
        },
        onSuccess: (_, { measurement, values }) => {
            queryClient.invalidateQueries({ queryKey: ["customer-measurements"] });
            queryClient.invalidateQueries({ queryKey: ["orders-with-product-measurements"] });
            if (measurement.order_id) {
                queryClient.invalidateQueries({ queryKey: ["order", measurement.order_id] });
                queryClient.invalidateQueries({ queryKey: ["orders"] });
            }
            setSelectedMeasurement((prev: any) =>
                prev ? { ...prev, values } : prev
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
        saveMutation.mutate({
            measurement: selectedMeasurement,
            values: editedValues,
        });
    };

    const handleCancelEdit = () => {
        setEditedValues(selectedMeasurement?.values || {});
        setIsEditing(false);
    };

    const handleCopy = () => {
        if (!selectedMeasurement) return;

        const customerName = selectedMeasurement.customers?.name || "Customer";
        const profileName = selectedMeasurement.name || "";
        const templateName = selectedMeasurement.measurement_templates?.name || "Garment Measurements";
        const values = isEditing ? editedValues : (selectedMeasurement.values || {});

        let text = `📐 ${profileName ? `${profileName} • ` : ""}${templateName}\nCustomer: ${customerName}\n\n`;

        const entries = Object.entries(values);
        if (entries.length > 0) {
            text += entries
                .map(([key, value]) => {
                    const fieldObj = templateFields.find((f: any) => f.field_key === key);
                    const label = fieldObj?.label || key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                    const val = value === true ? "Yes" : value === false ? "No" : String(value ?? "");
                    const formattedVal = val && !isNaN(Number(val)) && !val.includes('"') ? `${val}"` : val;
                    return `• ${label}: ${formattedVal}`;
                })
                .join("\n");
        } else {
            text += "• No measurements recorded";
        }

        const notes = selectedMeasurement.notes || selectedMeasurement.raw_order_metadata?.product_notes?.[selectedMeasurement.product_number];
        if (notes) {
            text += `\n\n📝 Note: ${notes}`;
        }

        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Measurement specs copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
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

    const filteredMeasurements = measurements.filter((m: any) => {
        const matchesSearch =
            m.customers?.name?.toLowerCase().includes(search.toLowerCase()) ||
            m.name?.toLowerCase().includes(search.toLowerCase());

        const matchesTemplate = filterTemplate
            ? m.measurement_templates?.name === filterTemplate
            : true;

        return matchesSearch && matchesTemplate;
    });

    // Build the list of fields to display in the modal:
    // If templateFields has entries, use them; otherwise, render every key present in editedValues!
    const fieldsToRender = React.useMemo(() => {
        if (templateFields.length > 0) {
            return templateFields.map((f: any) => ({
                field_key: f.field_key,
                label: f.label || f.field_key.replace(/_/g, " "),
                input_type: f.input_type || "text",
                options: f.options || [],
            }));
        }

        // Fallback: render all keys directly from values
        return Object.keys(editedValues).map((key) => {
            const val = editedValues[key];
            const isBool = typeof val === "boolean" || val === "true" || val === "false";
            const isNum = typeof val === "number" || (!isNaN(Number(val)) && val !== "");

            return {
                field_key: key,
                label: key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase()),
                input_type: isBool ? "boolean" : isNum ? "number" : "text",
                options: [],
            };
        });
    }, [templateFields, editedValues]);

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

                        {filteredMeasurements.map((m: any) => (
                            <div
                                key={m.id}
                                onClick={() => setSelectedMeasurement(m)}
                                className="grid grid-cols-4 px-4 py-4 text-sm border-b cursor-pointer hover:bg-gray-50 items-center transition-colors"
                            >
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {m.customers?.name || "Customer"}
                                    </p>
                                    {m.name && (
                                        <p className="text-xs text-gray-500">{m.name}</p>
                                    )}
                                </div>

                                <div className="text-gray-600">
                                    {m.measurement_templates?.name || "Garment Specs"}
                                </div>

                                <div className="text-gray-500 text-xs">
                                    {new Date(m.created_at).toLocaleDateString()}
                                </div>

                                <div>
                                    <StatusBadge status={m.status || "verified"} />
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </Card>

            {/* Popup Modal */}
            {selectedMeasurement && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold leading-tight">
                                {selectedMeasurement.customers?.name || "Customer"} {selectedMeasurement.name ? `- ${selectedMeasurement.name}` : ""}
                            </h2>
                            <button
                                onClick={() => setSelectedMeasurement(null)}
                                className="text-gray-500 hover:text-gray-700 text-lg p-1"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-sm text-gray-500 mb-6">
                            {selectedMeasurement.measurement_templates?.name || "Garment Measurements"}
                        </p>

                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-3 font-semibold">
                            Measurements
                        </div>

                        {fieldsToRender.length === 0 ? (
                            <div className="py-6 text-center text-sm text-gray-500 border rounded-lg bg-gray-50">
                                No measurement values recorded for this item.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {fieldsToRender.map((field: any) => {
                                    const key = field.field_key;
                                    const value = editedValues[key];
                                    const formattedKey = field.label;

                                    const displayValue =
                                        value === true ? "Yes" : value === false ? "No" : String(value ?? "—");

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
                                                                [key]: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value),
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
                                                <span className="font-medium text-sm text-gray-900">{displayValue}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-6 pt-4 border-t flex flex-wrap justify-between items-center gap-2">
                            {!isEditing ? (
                                <>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleCopy}
                                            className="px-3.5 py-1.5 rounded-md text-xs font-semibold border border-purple-200 bg-purple-50 text-purple-900 hover:bg-purple-100 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-700" />}
                                            {copied ? "Copied!" : "Copy Specs"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setIsEditing(true)}
                                            className="border px-3 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <Edit2 className="w-3.5 h-3.5 text-slate-500" /> Edit
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handlePrint}
                                            className="border px-3 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <Printer className="w-3.5 h-3.5 text-slate-500" /> Print
                                        </button>
                                    </div>

                                    {selectedMeasurement.status !== "verified" && !selectedMeasurement.is_order_attachment && (
                                        <button
                                            type="button"
                                            onClick={() => handleVerify(selectedMeasurement.id)}
                                            className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs"
                                        >
                                            Mark as Verified
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="flex gap-2 ml-auto">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="border px-4 py-2 rounded text-sm hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>

                                    <Button
                                        onClick={handleSave}
                                        disabled={saveMutation.isLoading}
                                    >
                                        {saveMutation.isLoading ? "Saving..." : "Save Changes"}
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