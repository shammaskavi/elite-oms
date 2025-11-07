import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, TrendingUp, Edit2 } from "lucide-react";

interface OrderSummaryProps {
    order: any;
    stages: any[];
    totalStages: number;
    timelineName: string;
    editingName: boolean;
    onNameChange: (name: string) => void;
    onStartEdit: () => void;
    onSaveName: () => void;
    onCancelEdit: () => void;
}

export function OrderSummary({
    order,
    stages,
    totalStages,
    timelineName,
    editingName,
    onNameChange,
    onStartEdit,
    onSaveName,
    onCancelEdit
}: OrderSummaryProps) {
    const deliveryDate = order.metadata?.delivery_date ? new Date(order.metadata.delivery_date) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilDelivery = deliveryDate ? Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

    const completedStages = stages?.filter((s: any) => s.status === "done").length || 0;
    const currentStage = stages?.find((s: any) => s.status === "in_progress");
    const progressPercentage = Math.round((completedStages / totalStages) * 100);

    const getDeliveryStatusColor = () => {
        if (!daysUntilDelivery) return "";
        if (daysUntilDelivery < 0) return "text-destructive";
        if (daysUntilDelivery <= 3) return "text-warning";
        return "text-success";
    };

    const getDeliveryStatusText = () => {
        if (!daysUntilDelivery) return "Not set";
        if (daysUntilDelivery < 0) return `Overdue by ${Math.abs(daysUntilDelivery)} ${Math.abs(daysUntilDelivery) === 1 ? 'day' : 'days'}`;
        if (daysUntilDelivery === 0) return "Due Today";
        return `Due in ${daysUntilDelivery} ${daysUntilDelivery === 1 ? 'day' : 'days'}`;
    };

    return (
        <Card className="p-4 bg-muted/30 border-l-4 border-primary">
            <div className="space-y-3">
                {/* Product Title Section */}
                <div className="mb-3 pb-3 border-b">
                    {!editingName ? (
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold">{timelineName}</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onStartEdit}
                                className="h-7 w-7 p-0"
                            >
                                <Edit2 className="h-3 w-3" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <Input
                                value={timelineName}
                                onChange={(e) => onNameChange(e.target.value)}
                                className="h-9"
                                autoFocus
                            />
                            <Button size="sm" onClick={onSaveName}>
                                Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={onCancelEdit}>
                                Cancel
                            </Button>
                        </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                        Order: {order.order_code} | Amount: ₹{order.total_amount}
                    </p>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Current Stage</span>
                        </div>
                        <p className="text-lg font-bold mt-1">{currentStage?.stage_name || "Pending"}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-muted-foreground">Progress</span>
                        <p className="text-lg font-bold">{progressPercentage}%</p>
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Stages Complete</span>
                    <span className="font-medium">{completedStages}/{totalStages}</span>
                </div>

                <div className="w-full bg-muted rounded-full h-2">
                    <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>

                {deliveryDate && (
                    <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Expected Delivery</span>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-semibold">
                                {deliveryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <p className={`text-xs font-medium ${getDeliveryStatusColor()}`}>
                                {getDeliveryStatusText()}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}