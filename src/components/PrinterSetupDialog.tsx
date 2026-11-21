import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Printer, Ruler, RefreshCw } from "lucide-react";
import {
  AgentStatus,
  DEFAULT_SETTINGS,
  PrinterSettings,
  loadPrinterSettings,
  probeAgent,
  savePrinterSettings,
  sendTsplJob,
} from "@/lib/labelPrint";
import { buildCalibrationJob, buildGapCalibrationJob } from "@/lib/tspl";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrinterSetupDialog({ open, onOpenChange }: Props) {
  const [settings, setSettings] = useState<PrinterSettings>(loadPrinterSettings);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const check = async (next: PrinterSettings = settings) => {
    setChecking(true);
    const result = await probeAgent(next);
    setStatus(result);
    setChecking(false);

    // Adopt the agent's suggestion only while the user is still on the default,
    // so a deliberate choice is never overwritten.
    if (result.online && result.defaultPrinter && next.printerName === DEFAULT_SETTINGS.printerName) {
      setSettings((prev) => ({ ...prev, printerName: result.defaultPrinter! }));
    }
    return result;
  };

  useEffect(() => {
    if (open) {
      const stored = loadPrinterSettings();
      setSettings(stored);
      check(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateMedia = (key: keyof PrinterSettings["media"], value: number) => {
    setSettings((prev) => ({ ...prev, media: { ...prev.media, [key]: value } }));
  };

  const runJob = async (label: string, tspl: string) => {
    setBusy(label);
    try {
      savePrinterSettings(settings);
      await sendTsplJob(tspl, settings);
      toast.success(`${label} sent to ${settings.printerName}`);
    } catch (err: any) {
      toast.error(err?.message || `${label} failed`);
    } finally {
      setBusy(null);
    }
  };

  const numberField = (
    id: string,
    labelText: string,
    key: keyof PrinterSettings["media"],
    opts: { min?: number; max?: number; step?: number; hint?: string } = {}
  ) => (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[11px] font-semibold">
        {labelText}
      </Label>
      <Input
        id={id}
        type="number"
        className="h-8 text-xs"
        min={opts.min}
        max={opts.max}
        step={opts.step ?? 1}
        value={settings.media[key] as number}
        onChange={(e) => updateMedia(key, Number(e.target.value))}
      />
      {opts.hint && <p className="text-[10px] text-muted-foreground leading-tight">{opts.hint}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Label Printer Setup
          </DialogTitle>
          <DialogDescription className="text-xs">
            Labels are drawn by the printer itself using TSPL commands, so they print at full
            203&nbsp;dpi with no browser scaling.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Connection Status */}
          <div className="rounded-lg border p-3.5 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Printer Connection
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {status?.activeService === "qz-tray"
                    ? "Silent 1-click thermal printing via QZ Tray"
                    : status?.activeService === "agent"
                    ? "Connected via local Print Agent"
                    : "No print service detected"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {checking ? (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking
                  </Badge>
                ) : status?.online && status.activeService === "qz-tray" ? (
                  <Badge className="gap-1 text-[10px] bg-emerald-600 hover:bg-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> QZ Tray Ready
                  </Badge>
                ) : status?.online ? (
                  <Badge className="gap-1 text-[10px] bg-blue-600 hover:bg-blue-600">
                    <CheckCircle2 className="w-3 h-3" /> Agent Connected
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1 text-[10px]">
                    <XCircle className="w-3 h-3" /> Offline
                  </Badge>
                )}
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => check()}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="printer-name" className="text-[11px] font-semibold">
                Printer Name (Windows)
              </Label>
              {status?.online && status.printers && status.printers.length > 0 ? (
                <Select
                  value={settings.printerName}
                  onValueChange={(value) => setSettings((prev) => ({ ...prev, printerName: value }))}
                >
                  <SelectTrigger id="printer-name" className="h-8 text-xs">
                    <SelectValue placeholder="Select printer" />
                  </SelectTrigger>
                  <SelectContent>
                    {status.printers.map((name) => (
                      <SelectItem key={name} value={name} className="text-xs">
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="printer-name"
                  className="h-8 text-xs font-mono"
                  placeholder="e.g. TSC TA210"
                  value={settings.printerName}
                  onChange={(e) => setSettings((prev) => ({ ...prev, printerName: e.target.value }))}
                />
              )}
              <p className="text-[10px] text-muted-foreground">
                Must match the printer name in Windows Printers &amp; Scanners (e.g. <code>TSC TA210</code>).
              </p>
            </div>

            {!status?.online && !checking && (
              <div className="text-[11px] text-muted-foreground leading-relaxed space-y-2 border-t pt-2.5">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2 text-foreground">
                  <p className="font-semibold text-xs mb-1">Recommended: Install QZ Tray (2 minutes)</p>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    QZ Tray runs silently in the background on the shop PC. No black command windows or Node.js required.
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px]">
                    <li>
                      Download and install QZ Tray on this PC:{" "}
                      <a
                        href="https://qz.io/download/"
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium underline text-primary"
                      >
                        qz.io/download
                      </a>
                    </li>
                    <li>Launch QZ Tray (it will appear in your Windows taskbar tray).</li>
                    <li>
                      Hit the <strong>Refresh</strong> button above. When QZ Tray pops up, check{" "}
                      <em>&quot;Remember this decision&quot;</em> and click <strong>Allow</strong>.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {status?.online && status.helperError && (
              <p className="text-[10px] leading-relaxed text-destructive border-t pt-2">
                Agent is running but its raw-print helper failed to build: {status.helperError}
              </p>
            )}
          </div>

          {/* Media geometry */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Label Stock
            </span>
            <div className="grid grid-cols-3 gap-2">
              {numberField("label-w", "Label W (mm)", "labelWidthMm")}
              {numberField("label-h", "Label H (mm)", "labelHeightMm")}
              {numberField("web-w", "Roll W (mm)", "webWidthMm", { hint: "Total media width" })}
              {numberField("cols", "Columns", "columns", { min: 1, max: 4 })}
              {numberField("pitch", "Col pitch (mm)", "columnPitchMm", { hint: "Left edge to left edge" })}
              {numberField("left-margin", "Left margin (mm)", "leftMarginMm", { step: 0.5 })}
              {numberField("gap", "Row gap (mm)", "gapMm", { step: 0.5 })}
              {numberField("gap-offset", "Gap offset (mm)", "gapOffsetMm", { step: 0.5 })}
              {numberField("qr-cell", "QR cell (dots)", "qrCellWidth", {
                min: 2,
                max: 8,
                hint: "4 ≈ 10.5mm code",
              })}
            </div>
          </div>

          {/* Print quality */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Print Quality
            </span>
            <div className="grid grid-cols-2 gap-2">
              {numberField("speed", "Speed (ips)", "speed", {
                min: 1,
                max: 5,
                hint: "Lower is sharper. Start at 2.",
              })}
              {numberField("density", "Density", "density", {
                min: 0,
                max: 15,
                hint: "Grey bars? raise. Merged bars? lower.",
              })}
              {numberField("min-module", "Min bar width (dots)", "minBarcodeModule", {
                min: 1,
                max: 4,
                hint: "Floor, not fixed. 1 lets long codes fit; short codes still use 2.",
              })}
              <div className="space-y-1">
                <Label htmlFor="font-style" className="text-[11px] font-semibold">
                  Label font
                </Label>
                <Select
                  value={settings.media.fontStyle}
                  onValueChange={(value) =>
                    setSettings((prev) => ({
                      ...prev,
                      media: { ...prev.media, fontStyle: value as "scalable" | "bitmap" },
                    }))
                  }
                >
                  <SelectTrigger id="font-style" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scalable" className="text-xs">
                      Proportional
                    </SelectItem>
                    <SelectItem value="bitmap" className="text-xs">
                      Fixed-width
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Proportional matches the supplier tags.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!!busy}
            onClick={() => runJob("Media calibration", buildGapCalibrationJob(settings.media))}
          >
            {busy === "Media calibration" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Ruler className="w-3.5 h-3.5" />
            )}
            Calibrate Media
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!!busy}
            onClick={() => runJob("Test label", buildCalibrationJob(settings.media))}
          >
            {busy === "Test label" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Printer className="w-3.5 h-3.5" />
            )}
            Print Test Label
          </Button>
          <Button
            size="sm"
            onClick={() => {
              savePrinterSettings(settings);
              toast.success("Printer settings saved");
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
