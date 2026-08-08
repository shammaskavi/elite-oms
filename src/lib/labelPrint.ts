/**
 * Client for the local label print agent.
 *
 * The browser cannot open a USB printer directly, so a small service runs on
 * the shop PC and relays raw TSPL bytes to the Windows spooler. The app talks
 * to it over plain HTTP on localhost — which browsers exempt from mixed-content
 * blocking, so this works even when the app itself is served over HTTPS.
 */

import { DEFAULT_MEDIA, LabelMedia } from "./tspl";

export interface PrinterSettings {
  agentUrl: string;
  printerName: string;
  media: LabelMedia;
}

const SETTINGS_KEY = "spe.labelPrinter.settings.v1";

export const DEFAULT_SETTINGS: PrinterSettings = {
  agentUrl: "http://localhost:9110",
  printerName: "TSC TA210",
  media: DEFAULT_MEDIA,
};

export function loadPrinterSettings(): PrinterSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // Merge rather than replace, so settings saved by an older build don't come
    // back missing fields added since.
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      media: { ...DEFAULT_MEDIA, ...(parsed.media || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function savePrinterSettings(settings: PrinterSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export interface AgentStatus {
  online: boolean;
  version?: string;
  printers?: string[];
  defaultPrinter?: string;
  /** False while the agent is still compiling its raw-print helper on first run. */
  ready?: boolean;
  /** Set if the helper failed to build — printing will not work until resolved. */
  helperError?: string | null;
  error?: string;
}

export async function probeAgent(settings: PrinterSettings = loadPrinterSettings()): Promise<AgentStatus> {
  try {
    // Generous: the agent's first health check on a cold Windows box has to
    // spawn PowerShell to enumerate printers, which is not fast.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${settings.agentUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { online: false, error: `Agent responded ${res.status}` };
    const body = await res.json();
    return {
      online: true,
      version: body.version,
      printers: body.printers,
      defaultPrinter: body.defaultPrinter,
      ready: body.ready !== false,
      helperError: body.helperError ?? null,
    };
  } catch (err: any) {
    return {
      online: false,
      error:
        err?.name === "AbortError"
          ? "Agent did not respond in time. Is another program using port 9110?"
          : "Could not reach the print agent on this PC.",
    };
  }
}

export class PrintAgentOfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrintAgentOfflineError";
  }
}

/** Sends a prepared TSPL job to the printer. Resolves once the spooler accepts it. */
export async function sendTsplJob(tspl: string, settings: PrinterSettings = loadPrinterSettings()): Promise<void> {
  if (!tspl.trim()) return;

  let res: Response;
  try {
    res = await fetch(`${settings.agentUrl}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printer: settings.printerName, data: tspl }),
    });
  } catch {
    throw new PrintAgentOfflineError(
      "Print agent is not running on this PC. Start it, or use Printer Setup to check the connection."
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Printer rejected the job (HTTP ${res.status})`);
  }
}

/**
 * Escape hatch when the agent is unavailable: hand the user the raw job so it
 * can be sent manually with `copy /b job.prn \\localhost\<share>`.
 */
export function downloadTsplJob(tspl: string, filename = "labels.prn") {
  const blob = new Blob([tspl], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
