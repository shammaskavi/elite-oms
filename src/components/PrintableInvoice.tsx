import React from 'react';
import {
    Document,
    Page,
    View,
    Text,
    StyleSheet,
    Image,
} from '@react-pdf/renderer';
import Logo from "../assets/logo-full.png";
import qr from "../assets/payment-qr.png";
import FloralBanner from "../assets/banner.jpg";

// ---------------- ROTATING EASTER EGGS ----------------
const EASTER_EGGS = [
    {
        tag: "WEAVER'S SECRET · 01",
        text: "Each thread of your custom saree carries the soul of Anand's heritage. Minor natural variations in the weave are hallmarks of genuine handloom artistry.",
    },
    {
        tag: "CARE RITUAL · 02",
        text: "Refold your silk sarees every 3 months along different creases to prevent pure zari threads from stressing along fold lines.",
    },
    {
        tag: "HERITAGE NOTE · 03",
        text: "Real zari is crafted from fine silver wire electroplated with gold—store your heirloom pieces wrapped in pure unbleached muslin, never plastic.",
    },
    {
        tag: "DRAPE LORE · 04",
        text: "Over 100 documented regional saree drapes exist across India, each engineered for local climate, grace, and movement.",
    },
    {
        tag: "GOLDEN THREAD · 05",
        text: "You unlocked a VIP stitch! Mention code 'ELITE-SILK' on your next visit to Saree Palace Elite for complimentary saree fall & pico.",
    },
    {
        tag: "STYLE ARCHIVE · 06",
        text: "Air your heirloom silks in indirect shade for two hours after an event before tucking them back into your wardrobe.",
    },
];

const getEasterEgg = (invoiceNumber: string, customEgg?: string) => {
    if (customEgg) {
        return { tag: "SPECIAL EDITION NOTE", text: customEgg };
    }
    const hash = String(invoiceNumber || '0')
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return EASTER_EGGS[hash % EASTER_EGGS.length];
};

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        paddingTop: 0,
        paddingHorizontal: 0,
        paddingBottom: 92, // Safe zone for anchored bottom footer on multi-page invoices
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: '#27272A',
        backgroundColor: '#FFFFFF',
    },

    // Repeating Hero Banner + Top Brand Row
    fixedHeaderWrapper: {
        marginBottom: 16,
    },
    floralBanner: {
        width: '100%',
        height: 52,
        objectFit: 'cover',
        opacity: 0.85,
    },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 36,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottom: '0.5pt solid #E4E4E7',
    },
    logoBlock: {
        width: '50%',
    },
    logo: {
        width: 135,
        height: 'auto',
        marginBottom: 4,
    },
    docRecordTag: {
        fontSize: 8,
        fontStyle: 'italic',
        color: '#71717A',
    },
    invoiceTitleBlock: {
        width: '50%',
        textAlign: 'right',
    },
    invoiceWord: {
        fontFamily: 'Times-Roman',
        fontSize: 20,
        letterSpacing: 1.5,
        color: '#18181B',
    },
    invoiceNum: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#831843',
        marginTop: 2,
        letterSpacing: 0.4,
    },
    gstinSub: {
        fontSize: 7.5,
        color: '#71717A',
        marginTop: 2,
    },

    // Main Content Body
    bodyContainer: {
        paddingHorizontal: 36,
    },

    // 3-Column Editorial Metadata (FROM / BILL TO / DATES)
    metaThreeCol: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 16,
        marginBottom: 16,
        borderBottom: '0.5pt solid #E4E4E7',
    },
    metaColFrom: {
        width: '34%',
        paddingRight: 8,
    },
    metaColTo: {
        width: '38%',
        paddingHorizontal: 8,
        borderLeft: '0.5pt solid #F4F4F5',
        borderRight: '0.5pt solid #F4F4F5',
    },
    metaColDates: {
        width: '28%',
        paddingLeft: 8,
        textAlign: 'right',
    },
    microLabel: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#A1A1AA',
        letterSpacing: 0.9,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    entityPrimary: {
        fontSize: 9.5,
        fontWeight: 'bold',
        color: '#18181B',
        marginBottom: 2,
    },
    entitySub: {
        fontSize: 8,
        color: '#52525B',
        lineHeight: 1.45,
    },

    // Borderless Minimal Items Table
    table: {
        width: '100%',
        marginBottom: 16,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderBottom: '0.75pt solid #18181B',
        paddingBottom: 6,
        marginBottom: 4,
    },
    th: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#71717A',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottom: '0.5pt solid #F4F4F5',
    },
    colSNo: { width: '7%', textAlign: 'left', color: '#A1A1AA' },
    colDesc: { width: '48%', textAlign: 'left', color: '#18181B', paddingRight: 6 },
    colQty: { width: '13%', textAlign: 'center', color: '#52525B' },
    colRate: { width: '16%', textAlign: 'right', color: '#52525B' },
    colAmt: { width: '16%', textAlign: 'right', fontWeight: 'bold', color: '#18181B' },

    // Closing Split: Left (Remarks, Payment History, Easter Egg) | Right (Totals, Status, QR, Signature)
    closingGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginTop: 4,
    },
    leftColumn: {
        width: '54%',
        paddingRight: 16,
    },
    rightColumn: {
        width: '42%',
    },

    // Remarks & Payment History Cards
    infoBlock: {
        marginBottom: 12,
    },
    remarksText: {
        fontSize: 8.2,
        color: '#3F3F46',
        lineHeight: 1.4,
        fontStyle: 'italic',
    },
    paymentHistoryBox: {
        marginBottom: 12,
        paddingTop: 6,
        borderTop: '0.5pt solid #E4E4E7',
    },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3,
        borderBottom: '0.5pt solid #F4F4F5',
        fontSize: 8,
        color: '#52525B',
    },

    // Easter Egg Blush Callout Card
    easterEggCard: {
        paddingVertical: 9,
        paddingHorizontal: 11,
        backgroundColor: '#FDF2F8',
        borderLeft: '2pt solid #BE185D',
        borderRadius: 3,
        marginBottom: 10,
    },
    easterTag: {
        fontSize: 6.8,
        fontWeight: 'bold',
        color: '#9D174D',
        letterSpacing: 0.9,
        marginBottom: 3,
    },
    easterText: {
        fontSize: 8,
        color: '#3F3F46',
        lineHeight: 1.4,
    },

    // Right Column Totals & Status
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3.5,
    },
    totalKey: {
        fontSize: 8.5,
        color: '#71717A',
    },
    totalVal: {
        fontSize: 8.5,
        fontWeight: 'bold',
        color: '#18181B',
    },
    discountText: {
        color: '#9D174D',
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 7,
        marginTop: 4,
        borderTop: '0.75pt solid #18181B',
        borderBottom: '0.75pt solid #18181B',
    },
    grandKey: {
        fontSize: 9.5,
        fontWeight: 'bold',
        color: '#18181B',
    },
    grandVal: {
        fontSize: 10.5,
        fontWeight: 'bold',
        color: '#831843',
    },
    balancePill: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
        paddingVertical: 5,
        paddingHorizontal: 8,
        backgroundColor: '#FAFAFA',
        borderRadius: 3,
        border: '0.5pt solid #E4E4E7',
    },
    statusPaidBadge: {
        fontSize: 8.5,
        fontWeight: 'bold',
        color: '#059669',
    },
    statusDueBadge: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#DC2626',
    },
    paymentModeTag: {
        marginTop: 5,
        textAlign: 'right',
        fontSize: 7.8,
        color: '#71717A',
        fontStyle: 'italic',
    },

    // QR & Authorized Signatory
    qrSignatureBlock: {
        marginTop: 14,
        paddingTop: 10,
        borderTop: '0.5pt solid #E4E4E7',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    qrWrap: {
        alignItems: 'flex-start',
    },
    qrImage: {
        width: 58,
        height: 58,
        marginBottom: 3,
    },
    qrCaption: {
        fontSize: 6.8,
        fontWeight: 'bold',
        color: '#71717A',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    signatureBlock: {
        textAlign: 'right',
    },
    signText: {
        fontFamily: 'Times-Roman',
        fontSize: 10,
        fontWeight: 'bold',
        color: '#18181B',
    },
    thankText: {
        fontSize: 7.8,
        color: '#71717A',
        marginTop: 2,
    },

    // Anchored Fixed Footer (Terms, Pickup CTA & Page Counter)
    fixedFooter: {
        position: 'absolute',
        bottom: 22,
        left: 36,
        right: 36,
        paddingTop: 8,
        borderTop: '0.5pt solid #E4E4E7',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    termsContainer: {
        width: '84%',
    },
    pickupCta: {
        fontSize: 7.5,
        fontWeight: 'bold',
        color: '#831843',
        marginBottom: 2,
    },
    termsText: {
        fontSize: 6.7,
        color: '#71717A',
        lineHeight: 1.35,
    },
    pageCounter: {
        width: '14%',
        textAlign: 'right',
        fontSize: 7.5,
        fontWeight: 'bold',
        color: '#71717A',
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
    discount?: number;
    remarks?: string;
    easter_egg?: string; // Optional manual override from DB/CMS
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
    paidAmount?: number;
}

// ---------------- COMPONENT ----------------
export const PrintableInvoice: React.FC<{ data: InvoiceData; payments?: any[] }> = ({
    data,
    payments = [],
}) => {
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
    const paidAmount = Number(data.paidAmount ?? raw_payload?.paid_amount ?? 0);
    const discount = parseFloat(String(raw_payload?.discount || 0));
    const finalTotal = parseFloat(String(total || subtotal || 0));
    const easterEgg = getEasterEgg(invoice_number, raw_payload?.easter_egg);
    const isSettled = isPaid || remainingBalance <= 0;

    return (
        <Document title={`Invoice-${invoice_number}`}>
            <Page size="A4" style={styles.page} wrap>
                {/* 1. REPEATING BOTANICAL BANNER + BRAND HEADER */}
                <View style={styles.fixedHeaderWrapper} fixed>
                    <Image src={FloralBanner} style={styles.floralBanner} />
                    <View style={styles.headerBar}>
                        <View style={styles.logoBlock}>
                            <Image src={Logo} style={styles.logo} />
                            <Text style={styles.docRecordTag}>Bill Of Supply / Order Record</Text>
                        </View>
                        <View style={styles.invoiceTitleBlock}>
                            <Text style={styles.invoiceWord}>INVOICE</Text>
                            <Text style={styles.invoiceNum}>#{invoice_number}</Text>
                            <Text style={styles.gstinSub}>GSTIN: {gstin}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.bodyContainer}>
                    {/* 2. 3-COLUMN EDITORIAL METADATA (FROM / BILL TO / ORDER & DELIVERY DATES) */}
                    <View style={styles.metaThreeCol} wrap={false}>
                        <View style={styles.metaColFrom}>
                            <Text style={styles.microLabel}>From</Text>
                            <Text style={styles.entityPrimary}>Saree Palace Elite</Text>
                            <Text style={styles.entitySub}>
                                Opp: G.P.O., City Point, Near Old Bus Stop, Anand - 388 001{'\n'}
                                Ph: 02692-352706 (Store) | 99250 41003{'\n'}
                                sareepalaceanand@gmail.com{'\n'}
                                www.sareepalaceelite.com
                            </Text>
                        </View>

                        <View style={styles.metaColTo}>
                            <Text style={styles.microLabel}>Bill To</Text>
                            <Text style={styles.entityPrimary}>
                                {customers?.name || 'N/A'}
                            </Text>
                            <Text style={styles.entitySub}>
                                Address: {customers?.address || 'N/A'}{'\n'}
                                Mobile: {customers?.phone || 'N/A'}{'\n'}
                                Email: {customers?.email || 'N/A'}
                            </Text>
                        </View>

                        <View style={styles.metaColDates}>
                            <Text style={styles.microLabel}>Order Date</Text>
                            <Text style={[styles.entityPrimary, { marginBottom: 8 }]}>
                                {date
                                    ? new Date(date).toLocaleDateString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: '2-digit',
                                    })
                                    : 'N/A'}
                            </Text>

                            <Text style={styles.microLabel}>Delivery Date</Text>
                            <Text style={styles.entityPrimary}>
                                {delivery_date
                                    ? new Date(delivery_date).toLocaleDateString('en-IN', {
                                        weekday: 'short',
                                        day: '2-digit',
                                        month: 'short',
                                        year: '2-digit',
                                    })
                                    : 'N/A'}
                            </Text>
                        </View>
                    </View>

                    {/* 3. BORDERLESS MINIMAL ITEMS TABLE */}
                    <View style={styles.table}>
                        <View style={styles.tableHeader} fixed>
                            <Text style={[styles.th, styles.colSNo]}>S.No.</Text>
                            <Text style={[styles.th, styles.colDesc]}>Description</Text>
                            <Text style={[styles.th, styles.colQty]}>Qty</Text>
                            <Text style={[styles.th, styles.colRate]}>Rate</Text>
                            <Text style={[styles.th, styles.colAmt]}>Amount</Text>
                        </View>

                        {items.map((item, index) => (
                            <View key={index} style={styles.tableRow} wrap={false}>
                                <Text style={styles.colSNo}>{index + 1}</Text>
                                <Text style={styles.colDesc}>{item.name}</Text>
                                <Text style={styles.colQty}>{item.qty}</Text>
                                <Text style={styles.colRate}>
                                    {formatCurrency(item.unit_price)}
                                </Text>
                                <Text style={styles.colAmt}>
                                    {formatCurrency(item.qty * item.unit_price)}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* 4. CLOSING SUMMARY, PAYMENT HISTORY, EASTER EGG, QR & SIGNATURE */}
                    <View style={styles.closingGrid} wrap={false}>
                        {/* Left Column: Remarks, Payment History & Rotating Easter Egg */}
                        <View style={styles.leftColumn}>
                            {raw_payload?.remarks && (
                                <View style={styles.infoBlock}>
                                    <Text style={styles.microLabel}>Remarks</Text>
                                    <Text style={styles.remarksText}>{raw_payload.remarks}</Text>
                                </View>
                            )}

                            {payments.length > 0 && (
                                <View style={styles.paymentHistoryBox}>
                                    <Text style={styles.microLabel}>Payment History</Text>
                                    {payments.map((p, i) => (
                                        <View key={i} style={styles.paymentRow}>
                                            <Text>
                                                {new Date(p.date).toLocaleDateString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: '2-digit',
                                                })}{' '}
                                                - {p.method?.toUpperCase() || 'N/A'}
                                            </Text>
                                            <Text style={{ fontWeight: 'bold', color: '#18181B' }}>
                                                {formatCurrency(p.amount)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Dynamic Rotating Easter Egg */}
                            <View style={styles.easterEggCard}>
                                <Text style={styles.easterTag}>{easterEgg.tag}</Text>
                                <Text style={styles.easterText}>{easterEgg.text}</Text>
                            </View>
                        </View>

                        {/* Right Column: Financial Totals, Paid/Due Status, QR & Signatory */}
                        <View style={styles.rightColumn}>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalKey}>Subtotal</Text>
                                <Text style={styles.totalVal}>{formatCurrency(subtotal)}</Text>
                            </View>

                            {discount > 0 && (
                                <View style={styles.totalRow}>
                                    <Text style={[styles.totalKey, styles.discountText]}>
                                        Discount
                                    </Text>
                                    <Text style={[styles.totalVal, styles.discountText]}>
                                        -{formatCurrency(discount)}
                                    </Text>
                                </View>
                            )}

                            {tax > 0 && (
                                <View style={styles.totalRow}>
                                    <Text style={styles.totalKey}>Tax</Text>
                                    <Text style={styles.totalVal}>{formatCurrency(tax)}</Text>
                                </View>
                            )}

                            <View style={styles.grandTotalRow}>
                                <Text style={styles.grandKey}>Total</Text>
                                <Text style={styles.grandVal}>{formatCurrency(finalTotal)}</Text>
                            </View>

                            <View style={[styles.totalRow, { marginTop: 4 }]}>
                                <Text style={styles.totalKey}>Paid</Text>
                                <Text style={styles.totalVal}>{formatCurrency(paidAmount)}</Text>
                            </View>

                            <View style={styles.balancePill}>
                                <Text style={styles.totalKey}>Balance</Text>
                                <Text
                                    style={
                                        isSettled ? styles.statusPaidBadge : styles.statusDueBadge
                                    }
                                >
                                    {isSettled ? 'PAID' : formatCurrency(remainingBalance)}
                                </Text>
                            </View>

                            {raw_payload?.payment_method && (
                                <Text style={styles.paymentModeTag}>
                                    Payment Mode: {raw_payload.payment_method.toUpperCase()}
                                </Text>
                            )}

                            {/* QR Code & Signature */}
                            <View style={styles.qrSignatureBlock}>
                                <View style={styles.qrWrap}>
                                    <Image src={qr} style={styles.qrImage} />
                                    <Text style={styles.qrCaption}>Scan to Pay</Text>
                                </View>

                                <View style={styles.signatureBlock}>
                                    <Text style={styles.signText}>For Saree Palace Elite</Text>
                                    <Text style={styles.thankText}>
                                        Thank you for your purchase!
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 5. ANCHORED FOOTER: PICKUP CTA, TERMS & PAGE NUMBER */}
                <View style={styles.fixedFooter} fixed>
                    <View style={styles.termsContainer}>
                        <Text style={styles.pickupCta}>
                            For Order Pickups & Enquiries: 02692-352706
                        </Text>
                        <Text style={styles.termsText}>
                            No guarantee on color, fabric, or zari; dry-clean only. Goods once sold
                            are not returnable or exchangeable. Customizations may incur extra
                            charges. Payment is due within 30 days; overdue payments attract 18%
                            annual interest. We are not liable for loss or damage during transit.
                            All disputes are subject to Anand jurisdiction only.
                        </Text>
                    </View>
                    <Text
                        style={styles.pageCounter}
                        render={({ pageNumber, totalPages }) =>
                            `Page ${pageNumber} of ${totalPages}`
                        }
                    />
                </View>
            </Page>
        </Document>
    );
};