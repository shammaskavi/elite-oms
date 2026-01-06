import { useEffect, useState } from "react";
import { derivePaymentStatus } from "@/lib/derivePaymentStatus";
import { deriveInvoiceState } from "@/lib/deriveInvoiceState";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, Phone, MapPin, FileText, ShoppingBag, DollarSign, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InvoiceView } from "@/components/InvoiceView";

function safeParsePayload(raw: any) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

export default function CustomerDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
    const [reminderMessage, setReminderMessage] = useState("");
    const [reminderDialogOpen, setReminderDialogOpen] = useState(false);

    // ---- customer ----
    const { data: customer } = useQuery({
        queryKey: ["customer", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("customers")
                .select("*")
                .eq("id", id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // ---- invoices (join customers so modal has customer fields) ----
    const { data: invoices } = useQuery({
        queryKey: ["customer-invoices", id],
        queryFn: async () => {
            // join customers fields — customer data will be available on invoice.customers
            const { data, error } = await supabase
                .from("invoices")
                .select("*, customers(name,phone,address)")
                .eq("customer_id", id)
                .order("date", { ascending: false });

            if (error) throw error;
            return data || [];
        },
        enabled: !!id,
    });


    // ---- invoice payments (true payment history) ----
    // ---- invoice payments (true payment history) ----
    const { data: invoicePayments } = useQuery({
        queryKey: ["invoice-payments", id],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("invoice_payments")
                .select(
                    `
                id,
                date,
                amount,
                method,
                invoices!inner (
                    id,
                    invoice_number,
                    customer_id
                )
                `
                )
                .eq("invoices.customer_id", id)     // only this customer's invoices
                .order("date", { ascending: false });

            if (error) throw error;
            return data ?? [];
        },
        enabled: !!id,
    });


    // ---- orders ----
    const { data: orders } = useQuery({
        queryKey: ["customer-orders", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select("*")
                .eq("customer_id", id)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!id,
    });

    // ---- summary stats ----
    const totalInvoices = invoices?.length || 0;
    const totalOrders = orders?.length || 0;

    // total billed
    const totalBilled = (invoices || []).reduce((sum, inv) => {
        const n = parseFloat(String(inv.total ?? 0));
        return sum + (isNaN(n) ? 0 : n);
    }, 0);


    const [invoicesWithStatus, setInvoicesWithStatus] = useState<any[]>([]);
    useEffect(() => {
        if (!invoices) return;

        const loadStatuses = async () => {
            const enriched = await Promise.all(
                invoices.map(async inv => {
                    const payment = await derivePaymentStatus(inv);
                    const state = deriveInvoiceState(inv, payment);
                    return {
                        ...inv,
                        __payment: payment,
                        __state: state,
                    };
                })
            );

            setInvoicesWithStatus(enriched);
        };

        loadStatuses();
    }, [invoices]);

    const totalPaid = invoicesWithStatus.reduce((sum, inv) => sum + inv.__payment.paid, 0);
    const outstandingBalance = invoicesWithStatus.reduce(
        (sum, inv) => sum + (inv.__state?.collectibleDue ?? 0),
        0
    );
    const hasUnpaidInvoices = invoicesWithStatus.some(
        inv => inv.__state?.collectibleDue > 0
    );


    // ---- payment history ----
    const payments = (invoicePayments || []).map((p: any) => ({
        id: p.id,
        date: p.date,
        invoice_number: p.invoices?.invoice_number || "N/A",
        method: p.method || "N/A",
        amount: parseFloat(String(p.amount || 0)),
    }));

    // const getPaymentStatusBadge = (invoice: any) => {
    //     const isSettled = invoice.settled === true;
    //     const state = invoice.__state?.state;
    //     if (isSettled) {
    //         return <Badge variant="success">SETTLED</Badge>;
    //     }
    //     switch (invoice.__payment.status) {
    //         case "paid": return <Badge variant="success">PAID</Badge>;
    //         case "partial": return <Badge variant="warning">PARTIAL</Badge>;
    //         default: return <Badge variant="destructive">UNPAID</Badge>;
    //     }
    // };
    const getPaymentStatusBadge = (invoice: any) => {
        const state = invoice.__state?.label;
        // Business override always wins
        if (state === "settled") {
            return <Badge variant="success">SETTLED</Badge>;
        }

        // Otherwise show payment truth
        switch (invoice.__payment.status) {
            case "paid":
                return <Badge variant="success">PAID</Badge>;
            case "partial":
                return <Badge variant="info">PARTIAL</Badge>;
            default:
                return <Badge variant="warning">UNPAID</Badge>;
        }
    };

    const getOrderStatusBadge = (status: string) => {
        const variants: any = {
            pending: "warning",
            processing: "info",
            ready: "success",
            dispatched: "info",
            delivered: "success",
            cancelled: "destructive",
        };
        return <Badge variant={variants[status] || "default"}>{(status || "").toUpperCase()}</Badge>;
    };

    const handleSendReminder = () => {
        toast({
            title: "Reminder Sent",
            description: `Payment reminder sent to ${customer?.name || "customer"}`,
        });
        setReminderMessage("");
        setReminderDialogOpen(false);
    };

    if (!customer) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p className="text-muted-foreground">Loading customer details...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Invoice Dialog */}
            {selectedInvoice && (
                <InvoiceView
                    invoice={selectedInvoice}
                    open={invoiceDialogOpen}
                    onOpenChange={(open) => {
                        setInvoiceDialogOpen(open);
                        if (!open) setSelectedInvoice(null);
                    }}
                />
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-bold truncate">{customer.name}</h1>
                        <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground">
                            {customer.phone && (
                                <div className="flex items-center gap-1">
                                    <Phone className="h-4 w-4" />
                                    {customer.phone}
                                </div>
                            )}
                            {customer.email && (
                                <div className="flex items-center gap-1">
                                    <Mail className="h-4 w-4" />
                                    {customer.email}
                                </div>
                            )}
                            {customer.address && (
                                <div className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    {customer.address}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {hasUnpaidInvoices && (
                    <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-auto">
                                <AlertCircle className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">Send Payment Reminder</span>
                                <span className="sm:hidden">Reminder</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Send Payment Reminder</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label>Message</Label>
                                    <Textarea
                                        placeholder="Enter reminder message..."
                                        value={reminderMessage}
                                        onChange={(e) => setReminderMessage(e.target.value)}
                                        rows={4}
                                    />
                                </div>
                                <Button onClick={handleSendReminder} className="w-full">Send Reminder</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{totalBilled.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                        <DollarSign className="h-4 w-4 text-success" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-success">₹{totalPaid.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                        <AlertCircle className="h-4 w-4 text-warning" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-warning">₹{outstandingBalance.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOrders}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalInvoices}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="invoices" className="w-full">
                <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="invoices" className="text-xs sm:text-sm">Invoices</TabsTrigger>
                    <TabsTrigger value="orders" className="text-xs sm:text-sm">Orders</TabsTrigger>
                    <TabsTrigger value="payments" className="text-xs sm:text-sm">Payments</TabsTrigger>
                </TabsList>

                <TabsContent value="invoices" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Invoice History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Invoice Number</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Total Amount</TableHead>
                                            <TableHead className="text-right">Amount Paid</TableHead>
                                            <TableHead className="text-right">Balance</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoicesWithStatus.map((invoice) => {
                                            const { paid } = invoice.__payment;
                                            const remaining = invoice.__state?.collectibleDue ?? invoice.__payment.remaining;
                                            const total = parseFloat(String(invoice.total ?? 0)) || 0;
                                            return (
                                                <TableRow key={invoice.id}>
                                                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                                                    <TableCell>{invoice.date ? new Date(invoice.date).toLocaleDateString() : "-"}</TableCell>
                                                    <TableCell>{getPaymentStatusBadge(invoice)}</TableCell>
                                                    <TableCell className="text-right">₹{total.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">₹{paid.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">₹{remaining.toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="sm" onClick={() => {
                                                            // invoice now includes customers thanks to the select() join above
                                                            setSelectedInvoice(invoice);
                                                            setInvoiceDialogOpen(true);
                                                        }}>
                                                            View
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}

                                        {(!invoices || invoices.length === 0) && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                                    No invoices found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="orders" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Order History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Order ID</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Total Amount</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orders?.map((order) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="font-medium">{order.order_code}</TableCell>
                                                <TableCell>{order.created_at ? new Date(order.created_at).toLocaleDateString() : "-"}</TableCell>
                                                <TableCell>{getOrderStatusBadge(order.order_status)}</TableCell>
                                                <TableCell className="text-right">₹{(parseFloat(String(order.total_amount || 0)) || 0).toFixed(2)}</TableCell>
                                                <TableCell>
                                                    <Link to={`/orders/${order.id}`}>
                                                        <Button variant="ghost" size="sm">View</Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {(!orders || orders.length === 0) && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                    No orders found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payments" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Payment History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Invoice</TableHead>
                                            <TableHead>Payment Method</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payments.length > 0 ? (
                                            payments.map(payment => (
                                                <TableRow key={payment.id}>
                                                    <TableCell>{payment.date ? new Date(payment.date).toLocaleDateString() : "-"}</TableCell>
                                                    <TableCell className="font-medium">{payment.invoice_number}</TableCell>
                                                    <TableCell>{payment.method}</TableCell>
                                                    <TableCell className="text-right">₹{payment.amount.toFixed(2)}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                    No payments found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}