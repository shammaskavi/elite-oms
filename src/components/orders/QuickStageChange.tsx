import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Loader2 } from "lucide-react";

export interface QuickStageAdvanceArgs {
  orderId: string;
  productNumber: number | string;
  productName?: string;
  currentStage: string;
  targetStage: string;
  vendorName: string | null;
}

interface QuickStageChangeProps {
  orderId: string;
  productNumber: number | string;
  productName?: string;
  currentStage: string;
  /** Canonical, ordered list of workflow stage names. */
  stages: string[];
  vendors: { id: string; name: string }[];
  onAdvance: (args: QuickStageAdvanceArgs) => void;
  isPending?: boolean;
  /** The stage badge that acts as the popover trigger. */
  children: React.ReactNode;
}

const UNASSIGNED = "__unassigned__";

/**
 * Compact, per-product stage advancer surfaced on the Orders table.
 *
 * - Advances ONE product (identified by product_number) to a later stage.
 * - Forward-only, and "Delivered" is intentionally excluded here — delivering
 *   the whole order is a separate order-level action, so one product can't
 *   wrongly mark a multi-item order delivered.
 * - Stops click propagation so opening it never navigates to the order detail.
 */
export function QuickStageChange({
  orderId,
  productNumber,
  productName,
  currentStage,
  stages,
  vendors,
  onAdvance,
  isPending = false,
  children,
}: QuickStageChangeProps) {
  const [open, setOpen] = useState(false);

  // Stages strictly after the current one, excluding "Delivered".
  const forwardStages = useMemo(() => {
    const idx = stages.findIndex(
      (s) => s.toLowerCase() === (currentStage || "").toLowerCase()
    );
    const base = idx >= 0 ? stages.slice(idx + 1) : stages;
    return base.filter((s) => s.toLowerCase() !== "delivered");
  }, [stages, currentStage]);

  const [targetStage, setTargetStage] = useState<string>("");
  const [vendorName, setVendorName] = useState<string>(UNASSIGNED);

  // Reset the form whenever the popover opens so it reflects the current state.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setTargetStage(forwardStages[0] || "");
      setVendorName(UNASSIGNED);
    }
  };

  const canMove = !!targetStage && !isPending;

  const handleMove = () => {
    if (!targetStage) return;
    onAdvance({
      orderId,
      productNumber,
      productName,
      currentStage,
      targetStage,
      vendorName: vendorName === UNASSIGNED ? null : vendorName,
    });
    setOpen(false);
  };

  // Dedupe vendor names (several vendor records can share a name).
  const vendorNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    (vendors || []).forEach((v) => {
      const n = (v?.name || "").trim();
      if (n && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    });
    return out.sort((a, b) => a.localeCompare(b));
  }, [vendors]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Do not let the click bubble to the row (which navigates to detail).
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          title="Advance stage"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2.5">
          <div>
            <p className="text-xs font-semibold text-foreground truncate">
              {productName || "Garment"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Current stage: <span className="font-medium">{currentStage}</span>
            </p>
          </div>

          {forwardStages.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-1">
              No further production stages. Use the order's “Mark Delivered”
              action to complete it.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Move to
                </label>
                <Select value={targetStage} onValueChange={setTargetStage}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {forwardStages.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Vendor (optional)
                </label>
                <Select value={vendorName} onValueChange={setVendorName}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[220px]">
                    <SelectItem value={UNASSIGNED} className="text-xs">
                      Unassigned
                    </SelectItem>
                    {vendorNames.map((n) => (
                      <SelectItem key={n} value={n} className="text-xs">
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                size="sm"
                className="w-full h-8 text-xs"
                disabled={!canMove}
                onClick={handleMove}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                )}
                Move to {targetStage || "…"}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default QuickStageChange;
