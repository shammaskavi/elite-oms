export type DashboardPhase = "morning" | "midday" | "evening";

export function getDashboardPhase(now = new Date()): DashboardPhase {
    const hour = now.getHours();

    if (hour >= 9 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "midday";
    return "evening";
}

function isSameDay(date: Date, compareTo: Date) {
    return (
        date.getDate() === compareTo.getDate() &&
        date.getMonth() === compareTo.getMonth() &&
        date.getFullYear() === compareTo.getFullYear()
    );
}

export interface DashboardSummaryItem {
    id: string;
    label: string;
    value: string;
    intent?: "positive" | "warning" | "neutral";
    action?: {
        route: string;
        state?: any;
    };
}

interface SummaryInput {
    invoices: any[];
    orders: any[];
    payments: any[];
    now?: Date;
}

export function deriveDashboardSummary({
    invoices,
    orders,
    payments,
    now = new Date(),
}: SummaryInput): {
    phase: DashboardPhase;
    title: string;
    items: DashboardSummaryItem[];
} {
    const phase = getDashboardPhase(now);
    const today = now;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (phase === "morning") {
        const revenueYesterday = payments
            .filter(p => isSameDay(new Date(p.date), yesterday))
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);

        const deliveriesToday = orders.filter(o =>
            o.metadata?.delivery_date &&
            isSameDay(new Date(o.metadata.delivery_date), today)
        ).length;

        return {
            phase,
            title: "Good Morning 👋 Here’s today at a glance",
            items: [
                {
                    id: "rev-yesterday",
                    label: "Revenue received yesterday",
                    value: `₹${revenueYesterday.toLocaleString("en-IN")}`,
                    intent: "positive",
                    action: {
                        route: "/invoices",
                        state: { filter: "payments_yesterday" },
                    },
                },
                {
                    id: "deliveries-today",
                    label: "Deliveries scheduled today",
                    value: `${deliveriesToday}`,
                    action: {
                        route: "/orders",
                        state: { deliveryDate: "today" },
                    },
                },
            ],
        };
    }

    if (phase === "midday") {
        const receivedToday = payments
            .filter(p => isSameDay(new Date(p.date), today))
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);

        return {
            phase,
            title: "Mid-day check-in",
            items: [
                {
                    id: "money-today",
                    label: "Money received so far today",
                    value: `₹${receivedToday.toLocaleString("en-IN")}`,
                    intent: "positive",
                    action: {
                        route: "/invoices",
                        state: { filter: "payments_today" },
                    },
                },
            ],
        };
    }

    // Evening
    const invoicesToday = invoices.filter(inv =>
        isSameDay(new Date(inv.created_at), today)
    ).length;

    return {
        phase,
        title: "Good Evening 👋 Here's how today went",
        items: [
            {
                id: "invoices-today",
                label: "You created invoices today",
                value: `${invoicesToday}`,
                action: {
                    route: "/invoices",
                    state: { filter: "today" },
                },
            },
        ],
    };
}