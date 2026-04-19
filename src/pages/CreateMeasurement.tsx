import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check } from "lucide-react";

export default function CreateMeasurement() {
    const [customers, setCustomers] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [fields, setFields] = useState<any[]>([]);

    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [openCustomer, setOpenCustomer] = useState(false);
    const [customerSearch, setCustomerSearch] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState("");

    const [formData, setFormData] = useState<Record<string, any>>({});

    // Fetch customers + templates
    useEffect(() => {
        const fetchData = async () => {
            const { data: customersData } = await supabase.from("customers").select("id, name");
            const { data: templatesData } = await supabase.from("measurement_templates").select("*");

            setCustomers(customersData || []);
            setTemplates(templatesData || []);
        };

        fetchData();
    }, []);

    // Fetch fields when template changes
    useEffect(() => {
        if (!selectedTemplate) return;

        const fetchFields = async () => {
            const { data } = await supabase
                .from("measurement_fields")
                .select("*")
                .eq("template_id", selectedTemplate)
                .order("order_index", { ascending: true });

            setFields(data || []);
        };

        fetchFields();
    }, [selectedTemplate]);

    const handleSave = async () => {
        if (!selectedCustomer || !selectedTemplate) {
            alert("Select customer and template");
            return;
        }

        const cleanedValues = Object.fromEntries(
            Object.entries(formData)
                .filter(([k]) => k !== "name")
                .map(([k, v]) => [
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
                customer_id: selectedCustomer,
                template_id: selectedTemplate,
                name: formData.name || null,
                values: cleanedValues,
                source: "admin",
                status: "verified",
            });

        if (error) {
            console.error(error);
            alert("Error saving measurements");
            return;
        }

        alert("Measurements saved!");

        setFormData({});
        setSelectedTemplate("");
    };

    return (
        <div className="p-8 space-y-8">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold">Add Measurement</h1>
                <p className="text-sm text-gray-500">Create and save customer measurements</p>
            </div>

            <div className="space-y-4">

                <input
                    type="text"
                    placeholder="Measurement Name (e.g. Regular Fit, Wedding Blouse)"
                    className="border p-3 rounded w-full"
                    value={formData.name || ""}
                    onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                    }
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Customer Select (Command Pattern) */}
                    <Popover open={openCustomer} onOpenChange={setOpenCustomer}>
                        <PopoverTrigger asChild>
                            <button className="border p-3 rounded w-full text-left">
                                {selectedCustomer
                                    ? customers.find((c) => c.id === selectedCustomer)?.name
                                    : "Select or create customer"}
                            </button>
                        </PopoverTrigger>

                        <PopoverContent className="w-full p-0">
                            <Command>
                                <CommandInput
                                    placeholder="Search customer..."
                                    value={customerSearch}
                                    onValueChange={setCustomerSearch}
                                />

                                <CommandList>
                                    <CommandEmpty>
                                        <div
                                            className="p-2 text-blue-600 cursor-pointer"
                                            onClick={async () => {
                                                const { data, error } = await supabase
                                                    .from("customers")
                                                    .insert({ name: customerSearch })
                                                    .select()
                                                    .single();

                                                if (error) {
                                                    console.error(error);
                                                    alert("Error creating customer");
                                                    return;
                                                }

                                                setCustomers((prev) => [...prev, data]);
                                                setSelectedCustomer(data.id);
                                                setOpenCustomer(false);
                                                setCustomerSearch("");
                                            }}
                                        >
                                            + Create "{customerSearch}"
                                        </div>
                                    </CommandEmpty>

                                    <CommandGroup>
                                        {customers
                                            .filter((c) =>
                                                c.name.toLowerCase().includes(customerSearch.toLowerCase())
                                            )
                                            .map((c) => (
                                                <CommandItem
                                                    key={c.id}
                                                    value={c.name}
                                                    onSelect={() => {
                                                        setSelectedCustomer(c.id);
                                                        setOpenCustomer(false);
                                                        setCustomerSearch("");
                                                    }}
                                                    className="flex items-center justify-between"
                                                >
                                                    {c.name}
                                                    {selectedCustomer === c.id && (
                                                        <Check className="w-4 h-4" />
                                                    )}
                                                </CommandItem>
                                            ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {/* Template Select */}
                    <select
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        className="border p-3 rounded w-full"
                    >
                        <option value="">Select Template</option>
                        {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Dynamic Fields */}
            {fields.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fields.map((field) => (
                        <div key={field.id} className="space-y-1">
                            <label className="font-medium text-sm text-gray-700">
                                {field.label}
                                {field.unit && (
                                    <span className="text-gray-400 ml-1">({field.unit})</span>
                                )}
                            </label>

                            {field.input_type === "number" && (
                                <input
                                    type="number"
                                    className="border p-2 rounded w-full"
                                    value={formData[field.field_key] || ""}
                                    onChange={(e) =>
                                        setFormData({ ...formData, [field.field_key]: e.target.value })
                                    }
                                />
                            )}

                            {field.input_type === "text" && (
                                <input
                                    type="text"
                                    className="border p-2 rounded w-full"
                                    value={formData[field.field_key] || ""}
                                    onChange={(e) =>
                                        setFormData({ ...formData, [field.field_key]: e.target.value })
                                    }
                                />
                            )}

                            {field.input_type === "dropdown" && (
                                <select
                                    className="border p-2 rounded w-full"
                                    value={formData[field.field_key] || ""}
                                    onChange={(e) =>
                                        setFormData({ ...formData, [field.field_key]: e.target.value })
                                    }
                                >
                                    <option value="">Select</option>
                                    {field.options?.map((opt: string) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {field.input_type === "boolean" && (
                                <select
                                    className="border p-2 rounded w-full"
                                    value={formData[field.field_key] || ""}
                                    onChange={(e) =>
                                        setFormData({ ...formData, [field.field_key]: e.target.value })
                                    }
                                >
                                    <option value="">Select</option>
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                </select>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Save */}
            {fields.length > 0 && (
                <button
                    onClick={handleSave}
                    className="bg-slate-900 text-white px-6 py-3 rounded hover:bg-slate-800 transition"
                >
                    Save Measurements
                </button>
            )}
        </div>
    );
}