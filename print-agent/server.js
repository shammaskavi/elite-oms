#!/usr/bin/env node
/**
 * Saree Palace Elite — local label print agent.
 *
 * A browser cannot open a USB printer, so this small service runs on the PC the
 * TSC TA210 is plugged into and relays raw TSPL bytes to the Windows spooler
 * with the RAW datatype — bypassing the printer driver's rasteriser entirely.
 *
 * Zero npm dependencies. Node 18+.
 *
 *   node server.js
 *
 * Environment:
 *   PORT=9110          Port to listen on.
 *   BIND=127.0.0.1     Set to 0.0.0.0 to accept jobs from phones on the LAN.
 *   PRINTER_SHARE      Optional. If set, prints via `copy /b` to this UNC share
 *                      instead of the spooler API (e.g. \\localhost\TSC).
 */

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const PORT = Number(process.env.PORT || 9110);
const BIND = process.env.BIND || "127.0.0.1";
const PRINTER_SHARE = process.env.PRINTER_SHARE || "";
const VERSION = "1.0.0";

const IS_WINDOWS = process.platform === "win32";
const WORK_DIR = path.join(os.tmpdir(), "spe-print-agent");
const HELPER_DLL = path.join(WORK_DIR, "RawPrinterHelper.dll");

fs.mkdirSync(WORK_DIR, { recursive: true });

/**
 * Win32 spooler wrapper. Opening the printer with datatype "RAW" is what makes
 * the bytes reach the printer verbatim; anything else routes through the driver
 * and would re-render our TSPL as a bitmap.
 */
const RAW_PRINTER_HELPER_CS = `
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFOW {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static int SendFile(string printerName, string filePath) {
        byte[] bytes = File.ReadAllBytes(filePath);
        IntPtr hPrinter;
        DOCINFOW di = new DOCINFOW();
        di.pDocName = "SPE Label Job";
        di.pDataType = "RAW";

        if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero)) {
            return -1; // printer name not found
        }

        bool ok = false;
        try {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr unmanaged = Marshal.AllocCoTaskMem(bytes.Length);
                    try {
                        Marshal.Copy(bytes, 0, unmanaged, bytes.Length);
                        int written;
                        ok = WritePrinter(hPrinter, unmanaged, bytes.Length, out written);
                    } finally {
                        Marshal.FreeCoTaskMem(unmanaged);
                    }
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
        } finally {
            ClosePrinter(hPrinter);
        }
        return ok ? bytes.Length : -2; // spooler refused the job
    }
}
`;

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr?.trim() || err.message));
        resolve(stdout.toString());
      }
    );
  });
}

/**
 * Compile the spooler wrapper once at startup. Doing it per job would add a
 * second of csc time to every print.
 */
async function ensureHelperCompiled() {
  if (!IS_WINDOWS || PRINTER_SHARE) return;
  if (fs.existsSync(HELPER_DLL)) return;

  const csPath = path.join(WORK_DIR, "RawPrinterHelper.cs");
  fs.writeFileSync(csPath, RAW_PRINTER_HELPER_CS, "utf8");

  await runPowerShell(
    `$src = Get-Content -Raw '${csPath}'; Add-Type -TypeDefinition $src -OutputAssembly '${HELPER_DLL}' -OutputType Library`
  );
  console.log("Compiled raw print helper ->", HELPER_DLL);
}

async function listPrinters() {
  if (!IS_WINDOWS) {
    try {
      const out = await new Promise((resolve, reject) =>
        execFile("lpstat", ["-a"], (err, stdout) => (err ? reject(err) : resolve(stdout)))
      );
      return out.split("\n").map((l) => l.split(" ")[0]).filter(Boolean);
    } catch {
      return [];
    }
  }

  try {
    const out = await runPowerShell("Get-Printer | Select-Object -ExpandProperty Name");
    return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function sendToPrinter(printerName, data) {
  const jobPath = path.join(WORK_DIR, `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.prn`);
  // TSPL is ASCII; latin1 guarantees one byte per character with no BOM.
  fs.writeFileSync(jobPath, Buffer.from(data, "latin1"));

  try {
    if (!IS_WINDOWS) {
      await new Promise((resolve, reject) =>
        execFile("lp", ["-d", printerName, "-o", "raw", jobPath], (err, _o, stderr) =>
          err ? reject(new Error(stderr || err.message)) : resolve()
        )
      );
      return;
    }

    if (PRINTER_SHARE) {
      await runPowerShell(`cmd /c copy /b "${jobPath}" "${PRINTER_SHARE}"`);
      return;
    }

    const result = await runPowerShell(
      `Add-Type -Path '${HELPER_DLL}'; [RawPrinterHelper]::SendFile('${printerName.replace(/'/g, "''")}', '${jobPath}')`
    );

    const code = parseInt(result.trim(), 10);
    if (code === -1) {
      throw new Error(
        `Windows has no printer named "${printerName}". Check the exact name in Settings > Printers & scanners.`
      );
    }
    if (code === -2 || Number.isNaN(code)) {
      throw new Error("The print spooler rejected the job. Is the printer online and out of error state?");
    }
  } finally {
    fs.unlink(jobPath, () => {});
  }
}

function withCors(res, origin) {
  // The agent only ever prints labels, and binds to loopback by default.
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readBody(req, limitBytes = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("Job too large"));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  withCors(res, req.headers.origin);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    const printers = await listPrinters();
    const guess = printers.find((p) => /tsc|ta210|ttp/i.test(p)) || printers[0];
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, version: VERSION, platform: process.platform, printers, defaultPrinter: guess }));
  }

  if (req.method === "POST" && url.pathname === "/print") {
    try {
      const body = await readBody(req);
      const { printer, data } = JSON.parse(body);

      if (!printer || typeof printer !== "string") throw new Error("Missing printer name");
      if (!data || typeof data !== "string") throw new Error("Missing TSPL payload");

      await sendToPrinter(printer, data);
      console.log(`[${new Date().toISOString()}] printed ${data.length} bytes -> ${printer}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, bytes: data.length }));
    } catch (err) {
      console.error("Print failed:", err.message);
      res.writeHead(500, { "Content-Type": "text/plain" });
      return res.end(err.message);
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

ensureHelperCompiled()
  .catch((err) => {
    console.error("Could not compile the raw print helper:", err.message);
    console.error("Falling back to PRINTER_SHARE mode requires setting that environment variable.");
  })
  .finally(() => {
    server.listen(PORT, BIND, () => {
      console.log(`Saree Palace Elite print agent v${VERSION}`);
      console.log(`Listening on http://${BIND}:${PORT}`);
      console.log(`Health check: http://${BIND}:${PORT}/health`);
      if (BIND === "127.0.0.1") {
        console.log("Only this PC can print. Set BIND=0.0.0.0 to allow phones on the same WiFi.");
      }
    });
  });
