import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function GenerateMeasurementLinkModal({
    open,
    onClose,
    customerId,
    customerName,
}: {
    open: boolean;
    onClose: () => void;
    customerId?: string;
    customerName?: string;
}) {
    const [templates, setTemplates] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);

    const [selectedCustomer, setSelectedCustomer] = useState(customerId || "");
    const [selectedTemplate, setSelectedTemplate] = useState("");
    const [link, setLink] = useState("");

    useEffect(() => {
        if (!open) return;

        const fetchData = async () => {
            const { data: t } = await supabase.from("measurement_templates").select("*");
            setTemplates(t || []);

            if (!customerId) {
                const { data: c } = await supabase.from("customers").select("id, name");
                setCustomers(c || []);
            }
        };

        fetchData();
    }, [open]);

    const handleGenerate = async () => {
        const token = crypto.randomUUID();

        const { error } = await supabase.from("measurement_links").insert({
            token,
            customer_id: selectedCustomer,
            template_id: selectedTemplate,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        if (error) {
            console.error(error);
            alert("Error generating link");
            return;
        }

        const finalLink = `${window.location.origin}/m/${token}`;
        setLink(finalLink);
    };

    const copyLink = () => {
        navigator.clipboard.writeText(link);
        alert("Link copied!");
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-4">
                <h2 className="text-lg font-semibold">Generate Measurement Link</h2>

                {/* Customer */}
                {customerId ? (
                    <div className="text-sm text-gray-600">
                        Customer: <span className="font-medium">{customerName}</span>
                    </div>
                ) : (
                    <select
                        value={selectedCustomer}
                        onChange={(e) => setSelectedCustomer(e.target.value)}
                        className="border p-2 rounded w-full"
                    >
                        <option value="">Select Customer</option>
                        {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                )}

                {/* Template */}
                <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="border p-2 rounded w-full"
                >
                    <option value="">Select Template</option>
                    {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name}
                        </option>
                    ))}
                </select>

                {/* Generate */}
                {!link ? (
                    <button
                        onClick={handleGenerate}
                        className="w-full bg-slate-900 text-white py-2 rounded"
                    >
                        Generate Link
                    </button>
                ) : (
                    <div className="space-y-2">
                        <input
                            value={link}
                            readOnly
                            className="w-full border p-2 rounded text-sm"
                        />
                        <button
                            onClick={copyLink}
                            className="w-full bg-green-600 text-white py-2 rounded"
                        >
                            Copy Link
                        </button>
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="text-sm text-gray-500 w-full"
                >
                    Close
                </button>
            </div>
        </div>
    );
}