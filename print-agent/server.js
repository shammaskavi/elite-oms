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
 * Mirror everything to agent-log.txt beside this script. Logging from inside
 * Node keeps the console output unbuffered — piping the process through
 * PowerShell to tee it hides startup messages exactly when they matter most.
 */
const LOG_PATH = path.join(__dirname, "agent-log.txt");
try {
  fs.writeFileSync(LOG_PATH, `=== Print agent started ${new Date().toISOString()} ===\n`);
} catch {
  /* read-only folder: console output still works */
}

function tee(stream, original) {
  return (...args) => {
    original(...args);
    try {
      fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${stream} ${args.join(" ")}\n`);
    } catch {
      /* never let logging break printing */
    }
  };
}
console.log = tee("INFO", console.log.bind(console));
console.error = tee("ERROR", console.error.bind(console));

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
 * Compilation state. The C# compile can take 10-20s on a cold machine, so the
 * HTTP server must never wait on it — it starts listening immediately and this
 * records progress for /health and for any print that arrives early.
 */
const helperState = { ready: false, error: null, promise: null };

/**
 * Compile the spooler wrapper once at startup. Doing it per job would add a
 * second of csc time to every print.
 */
function ensureHelperCompiled() {
  if (helperState.promise) return helperState.promise;

  helperState.promise = (async () => {
    if (!IS_WINDOWS || PRINTER_SHARE) {
      helperState.ready = true;
      return;
    }
    if (fs.existsSync(HELPER_DLL)) {
      helperState.ready = true;
      return;
    }

    const csPath = path.join(WORK_DIR, "RawPrinterHelper.cs");
    fs.writeFileSync(csPath, RAW_PRINTER_HELPER_CS, "utf8");

    console.log("Compiling raw print helper (first run only, may take a moment)...");
    await runPowerShell(
      `$src = Get-Content -Raw '${csPath}'; Add-Type -TypeDefinition $src -OutputAssembly '${HELPER_DLL}' -OutputType Library`
    );
    helperState.ready = true;
    console.log("Compiled raw print helper ->", HELPER_DLL);
  })().catch((err) => {
    helperState.error = err.message;
    console.error("Could not compile the raw print helper:", err.message);
  });

  return helperState.promise;
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
  } catch (err) {
    console.error("Could not enumerate printers:", err.message);
    return [];
  }
}

/**
 * Spawning PowerShell costs seconds on a cold Windows box — far longer than a UI
 * health check should ever block for. So the list is refreshed in the background
 * and /health answers instantly from cache.
 */
let printerCache = null;
let printerRefresh = null;

function refreshPrinters() {
  if (printerRefresh) return printerRefresh;
  printerRefresh = listPrinters()
    .then((names) => {
      printerCache = names;
      return names;
    })
    .finally(() => {
      printerRefresh = null;
    });
  return printerRefresh;
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

    // A print can arrive before the first-run compile finishes.
    await ensureHelperCompiled();
    if (helperState.error) {
      throw new Error(`Raw print helper unavailable: ${helperState.error}`);
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

const handleRequest = async (req, res) => {
  withCors(res, req.headers.origin);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    // Answer from cache. Only the very first call waits, and even then it is
    // capped so the dialog never sits on a spinner.
    if (printerCache === null) {
      await Promise.race([refreshPrinters(), new Promise((r) => setTimeout(r, 6000))]);
    } else {
      refreshPrinters();
    }

    const printers = printerCache || [];
    const guess = printers.find((p) => /tsc|ta210|ttp/i.test(p)) || printers[0];

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        ok: true,
        version: VERSION,
        platform: process.platform,
        printers,
        defaultPrinter: guess,
        ready: helperState.ready,
        helperError: helperState.error,
      })
    );
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
};

/**
 * `node server.js --check` runs every prerequisite once and prints a verdict,
 * then exits. Faster to read out over a support call than tailing a live log.
 */
async function runDiagnostics() {
  const line = (label, value) => console.log(`  ${label.padEnd(22)} ${value}`);

  console.log("");
  console.log("=== Print agent self-check ===");
  console.log("");
  console.log("System");
  line("Node version", process.version);
  line("Platform", `${process.platform} ${process.arch}`);
  line("OS release", os.release());
  line("Agent folder", __dirname);
  line("Log file", LOG_PATH);

  console.log("");
  console.log("Port");
  const portFree = await new Promise((resolve) => {
    const probe = http.createServer();
    probe.on("error", () => resolve(false));
    probe.listen(PORT, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
  line(`Port ${PORT}`, portFree ? "available" : "IN USE by another program");

  console.log("");
  console.log("Raw print helper");
  await ensureHelperCompiled();
  if (helperState.error) {
    line("Status", `FAILED — ${helperState.error}`);
  } else {
    line("Status", helperState.ready ? "ready" : "not ready");
  }

  console.log("");
  console.log("Printers Windows can see");
  const printers = await listPrinters();
  if (printers.length === 0) {
    console.log("  (none found)");
  } else {
    printers.forEach((p) => {
      const likely = /tsc|ta210|ttp/i.test(p) ? "  <-- looks like your label printer" : "";
      console.log(`  - ${p}${likely}`);
    });
  }

  console.log("");
  const problems = [];
  if (!portFree) problems.push(`Port ${PORT} is already in use.`);
  if (helperState.error) problems.push("The raw print helper could not be built.");
  if (printers.length === 0) problems.push("Windows reports no installed printers.");

  if (problems.length === 0) {
    console.log("RESULT: All checks passed. Run start-agent.bat and leave it open.");
  } else {
    console.log("RESULT: Problems found:");
    problems.forEach((p) => console.log(`  * ${p}`));
  }
  console.log("");
}

if (process.argv.includes("--check")) {
  runDiagnostics()
    .catch((err) => console.error("Self-check crashed:", err.message))
    .finally(() => process.exit(0));
  return;
}

console.log(`Saree Palace Elite print agent v${VERSION}`);
console.log(`Node ${process.version} on ${process.platform} (${os.release()})`);

// Start these in the background. The server must be reachable immediately —
// making it wait on a cold PowerShell spawn is what made the browser time out.
ensureHelperCompiled();
refreshPrinters();

/**
 * On Windows, `localhost` usually resolves to ::1 before 127.0.0.1. Binding only
 * to IPv4 means the browser tries IPv6 first, fails, and falls back — a delay
 * that surfaces in the UI as "agent did not respond in time". So bind both
 * loopback stacks unless an explicit BIND was requested.
 */
const bindAddresses = process.env.BIND ? [process.env.BIND] : ["127.0.0.1", "::1"];
let listening = 0;

bindAddresses.forEach((address) => {
  const server = http.createServer(handleRequest);

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use on ${address}.`);
      console.error("The agent may already be running — check for another window before starting a second copy.");
    } else if (err.code === "EAFNOSUPPORT" || err.code === "EADDRNOTAVAIL") {
      // e.g. IPv6 disabled on this machine. Harmless as long as the other bind worked.
      console.log(`(${address} unavailable on this system, skipping)`);
    } else {
      console.error(`Listen failed on ${address}:`, err.message);
    }
  });

  server.listen(PORT, address, () => {
    listening++;
    const shown = address.includes(":") ? `[${address}]` : address;
    console.log(`Listening on http://${shown}:${PORT}`);
    if (listening === 1) {
      console.log(`Health check: http://localhost:${PORT}/health`);
      if (!process.env.BIND) {
        console.log("Only this PC can print. Set BIND=0.0.0.0 to allow phones on the same WiFi.");
      }
      console.log("Leave this window open while the shop is running.");
    }
  });
});
