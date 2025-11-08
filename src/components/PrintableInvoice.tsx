import React from 'react';
import {
    Document,
    Page,
    View,
    Text,
    StyleSheet,
    Image,
} from '@react-pdf/renderer';
import Logo from "../assets/logo.png";
import qr from "../assets/payment-qr.png";

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        padding: 25,
        fontFamily: 'Helvetica',
        fontSize: 11,
        border: '3pt solid #9C27B0',
        backgroundColor: '#fff',
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

    // Info section
    infoSection: {
        flexDirection: 'row',
        border: '0.5pt solid #bbb',
        borderTop: 0,
        fontSize: 11,
    },
    infoColLeft: { width: '65%', borderRight: '0.5pt solid #bbb' },
    infoColRight: { width: '35%' },
    infoRow: { flexDirection: 'row', borderBottom: '0.5pt solid #ddd', padding: 4 },
    infoRowDelivery: { flexDirection: 'row', padding: 4 },
    infoLabel: { width: '35%', fontWeight: 'bold', color: '#333' },
    infoValue: { width: '65%', color: '#444' },

    // Items Table
    table: { marginTop: 10 },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f5f5f5',
        borderTop: '0.5pt solid #bbb',
        borderBottom: '0.5pt solid #bbb',
        fontWeight: 'bold',
    },
    colSNo: { width: '7%', padding: 4, textAlign: 'center', borderRight: '0.5pt solid #ccc' },
    colParticulars: { width: '48%', padding: 4, borderRight: '0.5pt solid #ccc' },
    colQty: { width: '15%', padding: 4, textAlign: 'center', borderRight: '0.5pt solid #ccc' },
    colRate: { width: '15%', padding: 4, textAlign: 'right', borderRight: '0.5pt solid #ccc' },
    colAmount: { width: '15%', padding: 4, textAlign: 'right' },

    tableRow: { flexDirection: 'row', borderBottom: '0.5pt solid #eee' },
    tableCell: { padding: 4, color: '#333' },

    // Footer
    footerGrid: {
        flexDirection: 'row',
        marginTop: 15,
        borderTop: '0.5pt solid #bbb',
        minHeight: 120,
    },
    tnc: {
        width: '60%',
        padding: 8,
        borderRight: '0.5pt solid #ccc',
        fontSize: 9,
        lineHeight: 1.4,
    },
    tncTitle: {
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 4,
        color: '#9C27B0',
        borderBottom: '0.5pt solid #9C27B0',
        paddingBottom: 2,
    },
    tncItem: { marginBottom: 2 },
    tncCta: {
        // textTransform: 'uppercase',
        fontWeight: 'bold',
        color: '#9C27B0',
    },

    totalsBox: {
        width: '40%',
        flexDirection: 'column',
        backgroundColor: '#fafafa',
        borderLeft: '0.5pt solid #ccc',
    },
    totalRow: {
        flexDirection: 'row',
        borderBottom: '0.5pt solid #ddd',
        paddingVertical: 4,
        paddingHorizontal: 5,
    },
    totalLabel: {
        width: '55%',
        textAlign: 'right',
        paddingRight: 5,
        fontWeight: 'bold',
    },
    totalValue: {
        width: '45%',
        textAlign: 'right',
        fontWeight: 'bold',
        color: '#333',
    },
    balanceValue: { color: 'red' },

    remarksBox: { padding: 4, marginTop: 4, fontSize: 8, minHeight: 40 },
    remarksLabel: { fontWeight: 'bold', marginBottom: 2, color: '#9C27B0' },

    // Payment Mode Tag
    paymentTag: {
        marginTop: 6,
        textAlign: 'right',
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
    },

    // Signature
    signatureContainer: {
        textAlign: 'right',
    },
    signatureText: {
        fontWeight: 'bold',
        fontSize: 11,
        color: '#333',
    },
    thankText: {
        fontSize: 9,
        color: '#777',
        marginTop: 2,
    },
    // QR Code
    qrContainer: {
        // position: 'absolute',
        // bottom: 30, // Adjusted to place it near the bottom edge
        // left: 30,   // Adjusted to place it near the left edge
        width: 50,
        height: 50,
    },
    qrImage: {
        width: '100%',
        height: '100%',
        border: '1pt solid #9C27B0',
        borderRadius: 6,
    },
});

// ---------------- HELPER ----------------
const formatCurrency = (amount: number | string, decimals = 2): string => {
    const num = parseFloat(String(amount));
    if (isNaN(num)) return `Rs 0.00`;
    return `Rs ${num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

// ---------------- INTERFACES ----------------
interface InvoiceItem {
    name: string;
    qty: number;
    unit_price: number;
}
interface Customer {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
}
interface RawPayload {
    items: InvoiceItem[];
    payment_method?: string;
    paid_amount?: number;
    remarks?: string;
}
interface InvoiceData {
    invoice_number: string;
    date: string;
    delivery_date?: string;
    total: number;
    subtotal: number;
    tax: number;
    customers: Customer | null;
    raw_payload: RawPayload | null;
    gstin?: string;
    isPaid?: boolean;
    remainingBalance?: number;
}

// ---------------- COMPONENT ----------------
export const PrintableInvoice: React.FC<{ data: InvoiceData }> = ({ data }) => {
    const {
        invoice_number,
        date,
        delivery_date,
        total,
        subtotal,
        tax,
        customers,
        raw_payload,
        isPaid = false,
        remainingBalance = 0,
        gstin = '24AGLPA3890M1Z5',
    } = data;

    const items = raw_payload?.items || [];
    const paidAmount = parseFloat(String(raw_payload?.paid_amount || 0));
    const finalTotal = parseFloat(String(total || subtotal || 0));
    const fillerCount = Math.max(0, 12 - items.length);

    return (
        <Document title={`Invoice-${invoice_number}`}>
            {/* change it to a4 if anything breaks  */}
            <Page size="A4" style={styles.page} wrap>
                <Text style={{ fontStyle: "italic", fontSize: 9 }}>Bill Of Supply / Order Record</Text>
                {/* GSTIN */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3 }}>
                    <Text style={{ fontSize: 8, color: '#555' }}>GSTIN: {gstin}</Text>
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

                {/* Customer Info */}
                <View style={styles.infoSection}>
                    <View style={styles.infoColLeft}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Customer:</Text>
                            <Text style={styles.infoValue}>{customers?.name || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Address:</Text>
                            <Text style={styles.infoValue}>{customers?.address || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Mobile:</Text>
                            <Text style={styles.infoValue}>{customers?.phone || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Email:</Text>
                            <Text style={styles.infoValue}>{customers?.email || 'N/A'}</Text>
                        </View>
                    </View>

                    <View style={styles.infoColRight}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Invoice No:</Text>
                            <Text style={styles.infoValue}>{invoice_number}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Date:</Text>
                            <Text style={styles.infoValue}>
                                {new Date(date).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: '2-digit',
                                })}
                            </Text>
                        </View>
                        <View style={styles.infoRowDelivery}>
                            <Text style={styles.infoLabel}>Delivery Date:</Text>
                            <Text style={styles.infoValue}>
                                {new Date(delivery_date).toLocaleDateString('en-IN', {
                                    weekday: 'short', // e.g., "Sat"
                                    day: '2-digit',
                                    month: 'short',
                                    year: '2-digit',
                                })}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Items Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={styles.colSNo}>S.NO.</Text>
                        <Text style={styles.colParticulars}>DESCRIPTION</Text>
                        <Text style={styles.colQty}>QTY</Text>
                        <Text style={styles.colRate}>RATE</Text>
                        <Text style={styles.colAmount}>AMOUNT</Text>
                    </View>

                    {items.map((item, index) => (
                        <View key={index} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { width: '7%', textAlign: 'center' }]}>{index + 1}</Text>
                            <Text style={[styles.tableCell, { width: '48%' }]}>{item.name}</Text>
                            <Text style={[styles.tableCell, { width: '15%', textAlign: 'center' }]}>{item.qty}</Text>
                            <Text style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>{formatCurrency(item.unit_price)}</Text>
                            <Text style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>
                                {formatCurrency(item.qty * item.unit_price)}
                            </Text>
                        </View>
                    ))}

                    {Array.from({ length: fillerCount }).map((_, i) => (
                        <View key={`filler-${i}`} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { width: '7%' }]}></Text>
                            <Text style={[styles.tableCell, { width: '48%' }]}></Text>
                            <Text style={[styles.tableCell, { width: '15%' }]}></Text>
                            <Text style={[styles.tableCell, { width: '15%' }]}></Text>
                            <Text style={[styles.tableCell, { width: '15%' }]}></Text>
                        </View>
                    ))}
                </View>

                {/* Footer */}
                <View style={styles.footerGrid} fixed>
                    <View style={styles.tnc}>
                        <View style={styles.remarksBox}>
                            <Text style={styles.remarksLabel}>Remarks:</Text>
                            <Text>{raw_payload?.remarks || ''}</Text>
                        </View>

                        <Text style={styles.tncTitle}>TERMS & CONDITIONS</Text>
                        <Text style={styles.tncItem}>No guarantee on color, fabric, or zari; dry-clean only. Goods once sold are not returnable or exchangeable. Customizations may incur extra charges. Payment is due within 30 days; overdue payments attract 18% annual interest. We are not liable for loss or damage during transit. All disputes are subject to Anand jurisdiction only.</Text>
                        <Text style={styles.tncCta}>For Order Pickups & Enquiries: 02692 352706</Text>
                    </View>

                    <View style={styles.totalsBox}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>SUBTOTAL</Text>
                            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
                        </View>
                        {tax > 0 && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>TAX</Text>
                                <Text style={styles.totalValue}>{formatCurrency(tax)}</Text>
                            </View>
                        )}
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>TOTAL</Text>
                            <Text style={styles.totalValue}>{formatCurrency(finalTotal)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>PAID</Text>
                            <Text style={styles.totalValue}>{formatCurrency(paidAmount)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={[styles.totalLabel]}>BALANCE</Text>
                            <Text
                                style={[
                                    styles.totalValue,
                                    remainingBalance > 0 ? styles.balanceValue : { color: '#4CAF50' },
                                ]}
                            >
                                {remainingBalance > 0 ? formatCurrency(remainingBalance) : 'PAID'}
                            </Text>
                        </View>
                        <View style={styles.totalRow}>
                            <View style={styles.qrContainer}>
                                <Image src={qr} style={styles.qrImage} />
                            </View>
                        </View>

                        {/* Payment Mode Tag */}
                        {raw_payload?.payment_method && (
                            <Text style={styles.paymentTag}>
                                Payment Mode: {raw_payload.payment_method.toUpperCase()}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Signature */}
                <View style={styles.signatureContainer}>
                    <Text style={styles.signatureText}>For Saree Palace Elite</Text>
                    <Text style={styles.thankText}>Thank you for your purchase!</Text>
                </View>
            </Page>
        </Document>
    );
};

