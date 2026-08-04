# Label Print Agent

Relays raw TSPL from the web app to the TSC TA210 over USB, so labels print in one
click with no browser print dialog.

## Why this exists

A browser cannot open a USB printer. It can only hand a rendered page to the print
driver, which rasterises it — and rasterising a barcode at 96dpi CSS then rescaling
to the printer's 203dpi destroys the bar-width precision that *is* the barcode's data.

This agent takes the opposite route: the app builds TSPL commands, the agent writes
them to the Windows spooler with datatype `RAW`, and the printer's own firmware draws
the QR code at exact dot pitch using its built-in bitmap fonts. Nothing is rescaled.

## Setup (once, on the PC the printer is plugged into)

1. Install [Node.js LTS](https://nodejs.org).
2. Copy this `print-agent` folder anywhere on that PC.
3. Double-click **`start-agent.bat`**. Leave the window open.
4. Double-click **`install-startup.bat`** so it launches automatically at login.

Then in the app: **Products → Printer Setup**. It will detect the agent and list the
printers Windows knows about. Pick the TSC and hit **Print Test Label**.

## Confirming the printer name

The name must match Windows exactly. Check under
*Settings → Bluetooth & devices → Printers & scanners* — it is usually
`TSC TA210` or `TSC TTP-244 Pro`. Or from PowerShell:

```powershell
Get-Printer | Select-Object Name
```

The agent's `/health` endpoint returns the same list, and the setup dialog shows it
as a dropdown, so you normally do not need to type it.

## Printing from phones

By default the agent binds to `127.0.0.1`, so only the shop PC can print to it.

To let staff print from their phones over the same WiFi, uncomment the `set BIND=0.0.0.0`
line in `start-agent.bat` and set the agent URL in Printer Setup to
`http://<shop-pc-ip>:9110`.

One caveat: browsers exempt `http://localhost` from mixed-content blocking, but they
do **not** exempt `http://192.168.x.x`. So a phone loading the app over HTTPS will have
the request blocked. Working around that means either running the app over plain HTTP
on the LAN, or moving to a job-queue design where the agent polls Supabase for pending
print jobs instead of accepting inbound connections. The queue approach is the one
commercial cloud-print services use; it is a sensible next step if phone printing
becomes important.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `9110` | Listen port. |
| `BIND` | `127.0.0.1` | Set to `0.0.0.0` to accept LAN connections. |
| `PRINTER_SHARE` | *(unset)* | Print via `copy /b` to a UNC share (e.g. `\\localhost\TSC`) instead of the spooler API. Only needed if the spooler path fails. |

## API

```
GET  /health   -> { ok, version, platform, printers[], defaultPrinter }
POST /print    -> { printer: "TSC TA210", data: "<TSPL>" }
```

## Security note

The agent accepts requests from any origin, because the app is served from several
places (localhost in dev, the deployed URL in production). Bound to loopback, the
exposure is limited to software already running on that PC, and the only thing it can
do is print a label. If you set `BIND=0.0.0.0`, anyone on the shop WiFi can print —
fine for a private network, worth reconsidering on shared or guest WiFi.

## Troubleshooting

**"Print agent is not running"** — the batch window is closed, or a firewall prompt was
declined. Restart `start-agent.bat` and allow access when Windows asks.

**"Windows has no printer named ..."** — the name in Printer Setup does not match.
Pick it from the dropdown instead of typing it.

**Labels print but drift or the printer hunts between labels** — the gap sensor is not
calibrated for this roll. Use **Calibrate Media** in Printer Setup, which sends
`GAPDETECT`. Do this after loading a new roll.

**Bars look grey or washed out** — raise Density. **Bars look bloated and merged** —
lower Density, or lower Speed. Speed 2 with Density 10 is a good starting point for
38×25mm stock; slower is always sharper.
