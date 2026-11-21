import qz from "qz-tray";

export interface QzProbeResult {
  connected: boolean;
  printers: string[];
  defaultPrinter?: string;
  error?: string;
}

class QzService {
  private connectingPromise: Promise<boolean> | null = null;

  async isConnected(): Promise<boolean> {
    try {
      return qz.websocket.isActive();
    } catch {
      return false;
    }
  }

  /**
   * Fast probe to see if QZ Tray is actively running on localhost.
   * Uses a short 1.5s timeout so the UI never hangs if QZ Tray is not open.
   */
  async probe(timeoutMs = 1500): Promise<QzProbeResult> {
    try {
      if (qz.websocket.isActive()) {
        const printers = await this.getPrinters();
        const def = await this.getDefaultPrinter().catch(() => undefined);
        return { connected: true, printers, defaultPrinter: def };
      }

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("QZ Tray connection timed out")), timeoutMs)
      );

      await Promise.race([
        qz.websocket.connect({ retries: 0, delay: 0 }),
        timeoutPromise,
      ]);

      const printers = await this.getPrinters();
      const def = await this.getDefaultPrinter().catch(() => undefined);
      return { connected: true, printers, defaultPrinter: def };
    } catch (err: any) {
      return {
        connected: false,
        printers: [],
        error: err?.message || "QZ Tray is not running",
      };
    }
  }

  async connect(): Promise<boolean> {
    if (qz.websocket.isActive()) {
      return true;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = (async () => {
      try {
        await qz.websocket.connect({
          retries: 1,
          delay: 0.5,
        });
        return true;
      } catch (err) {
        console.warn("QZ Tray connect failed:", err);
        return false;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  async disconnect(): Promise<void> {
    try {
      if (qz.websocket.isActive()) {
        await qz.websocket.disconnect();
      }
    } catch (err) {
      console.warn("QZ Tray disconnect error:", err);
    }
  }

  async getPrinters(): Promise<string[]> {
    if (!qz.websocket.isActive()) {
      const ok = await this.connect();
      if (!ok) return [];
    }
    const list = await qz.printers.find();
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }

  async getDefaultPrinter(): Promise<string | undefined> {
    if (!qz.websocket.isActive()) {
      const ok = await this.connect();
      if (!ok) return undefined;
    }
    return (await qz.printers.getDefault()) || undefined;
  }

  async findTscPrinter(preferredName?: string): Promise<string | null> {
    const printers = await this.getPrinters();
    if (preferredName && printers.includes(preferredName)) {
      return preferredName;
    }
    // Search for TSC or label printer
    const match = printers.find(
      (p) =>
        p.toLowerCase().includes("tsc") ||
        p.toLowerCase().includes("ta210") ||
        p.toLowerCase().includes("ttp") ||
        p.toLowerCase().includes("label") ||
        p.toLowerCase().includes("barcode")
    );
    return match || printers[0] || null;
  }

  async printRawTspl(printerName: string, tspl: string): Promise<void> {
    const ok = await this.connect();
    if (!ok) {
      throw new Error("Cannot connect to QZ Tray. Is QZ Tray running in the system tray?");
    }

    // Verify printer exists or match loosely
    let target = printerName;
    const printers = await this.getPrinters();
    if (!printers.includes(target)) {
      const matched = await this.findTscPrinter(printerName);
      if (matched) {
        target = matched;
      } else {
        throw new Error(
          `Printer "${printerName}" was not found in Windows. Available printers: ${printers.join(", ") || "none"}`
        );
      }
    }

    const config = qz.configs.create(target);
    const data = [
      {
        type: "raw",
        format: "command",
        flavor: "plain",
        data: tspl,
      },
    ];

    await qz.print(config, data);
  }
}

export const qzService = new QzService();
