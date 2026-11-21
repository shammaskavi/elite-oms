/**
 * Client for thermal label printing supporting both QZ Tray (recommended)
 * and the legacy local Node print agent.
 */

import { DEFAULT_MEDIA, LabelMedia } from "./tspl";
import { qzService } from "./qzService";

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
  activeService: "qz-tray" | "agent" | "none";
  version?: string;
  printers?: string[];
  defaultPrinter?: string;
  /** False while the agent is still compiling its raw-print helper on first run. */
  ready?: boolean;
  /** Set if the helper failed to build — printing will not work until resolved. */
  helperError?: string | null;
  error?: string;
}

/** Probes QZ Tray first (preferred), falling back to the local Node print agent. */
export async function probeAgent(settings: PrinterSettings = loadPrinterSettings()): Promise<AgentStatus> {
  // 1. Try QZ Tray first
  try {
    const qzRes = await qzService.probe(1500);
    if (qzRes.connected) {
      return {
        online: true,
        activeService: "qz-tray",
        version: "QZ Tray",
        printers: qzRes.printers,
        defaultPrinter: qzRes.defaultPrinter,
        ready: true,
        helperError: null,
      };
    }
  } catch {
    // Continue to legacy agent check
  }

  // 2. Fall back to local Node print agent
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${settings.agentUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const body = await res.json();
      return {
        online: true,
        activeService: "agent",
        version: body.version,
        printers: body.printers,
        defaultPrinter: body.defaultPrinter,
        ready: body.ready !== false,
        helperError: body.helperError ?? null,
      };
    }
  } catch {
    // Both offline
  }

  return {
    online: false,
    activeService: "none",
    error: "No printer service detected. Please open QZ Tray or start the print agent.",
  };
}

export class PrintAgentOfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrintAgentOfflineError";
  }
}

/** Sends a prepared TSPL job to the printer via QZ Tray (preferred) or Node print agent. */
export async function sendTsplJob(
  tspl: string,
  settings: PrinterSettings = loadPrinterSettings()
): Promise<{ service: "qz-tray" | "agent" }> {
  if (!tspl.trim()) return { service: "qz-tray" };

  // 1. Attempt printing via QZ Tray first
  try {
    const qzConnected = await qzService.connect();
    if (qzConnected) {
      await qzService.printRawTspl(settings.printerName, tspl);
      return { service: "qz-tray" };
    }
  } catch (qzErr: any) {
    console.warn("QZ Tray print attempt failed, attempting agent fallback:", qzErr);
  }

  // 2. Fall back to local Node print agent if available
  try {
    const res = await fetch(`${settings.agentUrl}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printer: settings.printerName, data: tspl }),
    });

    if (res.ok) {
      return { service: "agent" };
    }
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Printer agent rejected the job (HTTP ${res.status})`);
  } catch (agentErr: any) {
    if (agentErr?.message && !agentErr.message.includes("fetch")) {
      throw agentErr;
    }
  }

  // Both failed
  throw new PrintAgentOfflineError(
    "Label printer service is not running on this PC. Please launch QZ Tray (recommended) or the Print Agent."
  );
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
