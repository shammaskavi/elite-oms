import React from "react";
import {
    Document,
    Page,
    View,
    Text,
    StyleSheet,
    Image,
} from "@react-pdf/renderer";
import Logo from "../assets/logo.png";

const styles = StyleSheet.create({
    page: {
        padding: 24,
        fontFamily: "Helvetica",
        fontSize: 11,
        border: "3pt solid #9C27B0",
        backgroundColor: "#fff",
    },
    header: {
        flexDirection: "row",
        borderBottom: "1pt solid #9C27B0",
        paddingBottom: 6,
        marginBottom: 10,
        alignItems: "center",
    },
    // Header
    headerGrid: {
        flexDirection: 'row',
        borderBottom: '1pt solid #9C27B0',
        paddingBottom: 6,
        marginBottom: 8,
        alignItems: 'center',
    },
    logoBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '40%',
        paddingLeft: 5,
    },
    logo: { width: 'auto', height: 'auto', marginRight: 5 },
    contactInfo: { width: '60%', fontSize: 9.5, lineHeight: 1.4, textAlign: 'right' },

    // Info secti
    rightInfo: {
        marginLeft: "auto",
        textAlign: "right",
        fontSize: 9,
    },
    section: {
        border: "0.5pt solid #bbb",
        marginBottom: 10,
    },
    row: {
        flexDirection: "row",
        padding: 4,
        borderBottom: "0.5pt solid #eee",
    },
    label: { width: "40%", fontWeight: "bold" },
    value: { width: "60%" },

    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f5f5f5",
        borderBottom: "0.5pt solid #bbb",
        fontWeight: "bold",
    },

    colInvoice: { width: "20%", padding: 4 },
    colDate: { width: "20%", padding: 4 },
    colTotal: { width: "20%", padding: 4, textAlign: "right" },
    colApplied: { width: "20%", padding: 4, textAlign: "right" },
    colBalance: { width: "20%", padding: 4, textAlign: "right" },

    totalRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        padding: 6,
    },
    totalLabel: {
        width: "50%",
        textAlign: "right",
        fontWeight: "bold",
    },
    totalValue: {
        width: "50%",
        textAlign: "right",
        fontWeight: "bold",
    },
});

const money = (n: number) =>
    `Rs ${Number(n || 0).toLocaleString("en-IN")}`;

const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const getApplied = (a: any) => {
    // invoice_payments based allocation
    if (a.amount != null) return Number(a.amount);

    // legacy / fallback fields
    if (a.appliedAmount != null) return Number(a.appliedAmount);
    if (a.allocated_amount != null) return Number(a.allocated_amount);
    if (a.applied != null) return Number(a.applied);
    if (a.allocated != null) return Number(a.allocated);

    return 0;
};

const getRemaining = (a: any) => {
    if (a.isSettled === true) return 0;
    if (a.balance_due != null) return Number(a.balance_due);
    if (a.remainingDue != null) return Number(a.remainingDue);
    if (a.balanceDue != null) return Number(a.balanceDue);
    if (a.remaining != null) return Number(a.remaining);
    return 0;
};

const getInvoiceTotal = (a: any) => {
    if (a.invoice_total != null) return Number(a.invoice_total);
    if (a.invoiceTotal != null) return Number(a.invoiceTotal);
    if (a.total != null) return Number(a.total);
    return 0;
};

type ReceiptAllocation = {
    invoiceNumber: string;
    invoiceDate?: string;
    invoiceTotal?: number;
    appliedAmount?: number;
    remainingDue?: number;
    isSettled?: boolean;
    applied?: number;
    allocated?: number;
    allocated_amount?: number;
    balanceDue?: number;
};

type ReceiptVM = {
    id: string;
    receivedAt: string;
    amount: number;
    method: string;
    notes?: string;
    customer: {
        name: string;
        phone?: string;
    };
    allocations: ReceiptAllocation[];
};

export const PrintableReceipt = ({ receipt }: { receipt: ReceiptVM }) => {
    const totalApplied = receipt.allocations.reduce(
        (sum, a) => sum + Number(getApplied(a) || 0),
        0
    );

    return (
        <Document title={`Receipt-${receipt.id}`}>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <Text style={{ fontStyle: "italic", fontSize: 9 }}>Payment Receipt</Text>
                {/* GSTIN */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3 }}>
                    <Text style={{ fontSize: 8, color: '#555' }}>GSTIN: 24AGLPA3890M1Z5</Text>
                </View>

                {/* Header */}
                <View style={styles.headerGrid}>
                    <View style={styles.logoBrand}>
                        <Image src={Logo} style={styles.logo} />
                    </View>
                    <View style={styles.contactInfo}>
                        <Text>Opp: G.P.O., City Point, Near Old Bus Stop, Anand - 388 001</Text>
                        <Text>Ph: 02692-352706 (Store) | 99250 41003</Text>
                        <Text>email: sareepalaceanand@gmail.com | www.sareepalaceelite.com</Text>
                    </View>
                </View>

                {/* Customer */}
                <View style={styles.section}>
                    <View style={styles.row}>
                        <Text style={styles.label}>Customer</Text>
                        <Text style={styles.value}>{receipt.customer.name}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Phone</Text>
                        <Text style={styles.value}>{receipt.customer.phone || "—"}</Text>
                    </View>

                    <View style={styles.row}>
                        <Text style={styles.label}>Receipt No</Text>
                        <Text style={styles.value}>
                            {receipt.id.slice(0, 8).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Date</Text>
                        <Text style={styles.value}>
                            {new Date(receipt.receivedAt).toLocaleDateString("en-IN")}
                        </Text>
                    </View>
                </View>

                {/* Payment summary */}
                <View style={styles.section}>
                    <View style={styles.row}>
                        <Text style={styles.label}>Amount Received</Text>
                        <Text style={styles.value}>{money(receipt.amount)}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Method</Text>
                        <Text style={styles.value}>{(receipt.method || "—").toUpperCase()}</Text>
                    </View>
                    {receipt.notes && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Notes</Text>
                            <Text style={styles.value}>{receipt.notes}</Text>
                        </View>
                    )}
                </View>

                <Text style={{ fontWeight: "bold", marginTop: 25, marginBottom: 10 }}>Payment for</Text>
                {/* Allocation table */}
                <View>
                    <View style={styles.tableHeader}>
                        <Text style={styles.colInvoice}>Invoice</Text>
                        <Text style={styles.colDate}>Date</Text>
                        <Text style={styles.colTotal}>Invoice Total</Text>
                        <Text style={styles.colApplied}>Applied</Text>
                        <Text style={styles.colBalance}>Balance Due</Text>
                    </View>

                    {receipt.allocations.map((a, i) => {
                        const applied = getApplied(a);
                        const remaining = getRemaining(a);
                        const total = getInvoiceTotal(a);
                        const settled = a.isSettled === true || getRemaining(a) === 0;

                        return (
                            <View key={i} style={styles.row}>
                                <Text style={styles.colInvoice}>{a.invoiceNumber}</Text>
                                <Text style={styles.colDate}>{formatDate(a.invoiceDate)}</Text>
                                <Text style={styles.colTotal}>{money(total)}</Text>
                                <Text style={styles.colApplied}>{money(applied)}</Text>
                                <Text style={styles.colBalance}>
                                    {settled ? "SETTLED" : money(remaining)}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* Totals */}
                {/* <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Applied (This Receipt)</Text>
                    <Text style={styles.totalValue}>{money(totalApplied)}</Text>
                </View> */}

                <View style={{ marginTop: 10 }}>
                    <Text style={{ fontSize: 9, fontStyle: "italic" }}>
                        This receipt confirms payment received and its allocation against
                        listed invoices.
                    </Text>
                </View>

                <View style={{ marginTop: 20, textAlign: "right" }}>
                    <Text>For Saree Palace Elite</Text>
                    <Text style={{ fontSize: 9 }}>Thank you</Text>
                </View>
            </Page>
        </Document>
    );
};