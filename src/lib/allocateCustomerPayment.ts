import { supabase } from "@/integrations/supabase/client";
import { derivePaymentStatus } from "@/lib/derivePaymentStatus";
import { deriveInvoiceState } from "@/lib/deriveInvoiceState";
import { allocatePaymentFIFO } from "@/lib/allocatePaymentFIFO";

type AllocatePaymentInput = {
    customerId: string;
    customerPaymentId: string;
    amount: number;
};

export async function allocateCustomerPayment(
    input: AllocatePaymentInput
) {
    console.log("🚀 allocateCustomerPayment START", input);
    console.log("ALLOCATE CUSTOMER PAYMENT started with input:", input);
    const { customerId } = input;

    // 1️⃣ Fetch invoices for customer
    const { data: invoices, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", customerId)
        .order("date", { ascending: true })
        .order("invoice_number", { ascending: true });

    console.log("📄 Raw invoices fetched:", invoices?.length, invoices);

    if (error) {
        throw error;
    }

    if (!invoices || invoices.length === 0) {
        return {
            eligibleInvoices: [],
        };
    }

    // 2️⃣ Enrich invoices with derived state
    const enriched = await Promise.all(
        invoices.map(async (invoice) => {
            const payment = await derivePaymentStatus(invoice);
            const state = deriveInvoiceState(invoice, payment);

            console.log("🔎 Deriving state for invoice", invoice.invoice_number, {
                payment,
                state,
            });

            return {
                invoice,
                payment,
                state,
            };
        })
    );

    // 3️⃣ Filter eligible invoices (VERY IMPORTANT)
    const eligibleInvoices = enriched.filter(({ state }) => {
        return (
            state.isSettled !== true &&
            state.collectibleDue > 0
        );
    });
    console.log(
        eligibleInvoices.map(e => ({
            invoice: e.invoice.invoice_number,
            due: e.state.collectibleDue,
            isSettled: e.state.isSettled,
        }))
    );
    console.log("✅ Eligible invoices count:", eligibleInvoices.length);

    // 4️⃣ FIFO sort (extra safety)
    eligibleInvoices.sort((a, b) => {
        const d1 = new Date(a.invoice.date).getTime();
        const d2 = new Date(b.invoice.date).getTime();

        if (d1 !== d2) return d1 - d2;
        return a.invoice.invoice_number.localeCompare(b.invoice.invoice_number);

    });

    console.log("ELIGIBLE INVOICES FOR ALLOCATION:", eligibleInvoices.map(e => ({
        invoice: e.invoice.invoice_number,
        collectibleDue: e.state.collectibleDue,
        isSettled: e.state.isSettled,
        state: e.state.label,
    })));

    // 5️⃣ Perform FIFO allocation
    console.log("🧮 Running FIFO allocation with amount:", input.amount);
    const allocations = allocatePaymentFIFO(
        eligibleInvoices.map(e => ({
            invoice_id: e.invoice.id,
            invoice_number: e.invoice.invoice_number,
            collectibleDue: e.state.collectibleDue,
        })),
        input.amount
    );
    console.log("📦 Allocation result:", allocations);

    if (allocations.length === 0) {
        return {
            eligibleInvoices,
            allocations: [],
        };
    }

    // 6️⃣ Persist allocations as invoice_payments
    const invoicePaymentRows = allocations.map(a => ({
        invoice_id: a.invoice_id,
        amount: a.allocated,
        method: "customer_payment",
        remarks: "Allocated from customer payment",
        customer_payment_id: input.customerPaymentId,
    }));

    console.log("📝 Inserting invoice_payments:", invoicePaymentRows);

    const { error: invoicePaymentError } = await (supabase as any)
        .from("invoice_payments")
        .insert(invoicePaymentRows);

    if (invoicePaymentError) {
        console.error("❌ Failed inserting invoice_payments", invoicePaymentError);
        throw invoicePaymentError;
    }

    console.log("✅ invoice_payments inserted successfully");

    return {
        eligibleInvoices,
        allocations,
    };



}