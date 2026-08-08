# Shop PC Setup — Follow In Order

Written to be worked through on a remote session. Every step has a check.
Do not move to the next step until the current check passes.

**Time needed:** about 15 minutes, plus a Node.js download.

---

## Before you start

- The TSC TA210 must be plugged into this PC by USB and switched on.
- Labels loaded, ribbon in (if it is the thermal-transfer version).
- You need to be able to install software on this PC.

**Important:** the app must be open **on this same PC** for printing to work.
The agent listens on `localhost`, which only that machine can reach. Printing from a
phone or a different computer needs the extra setup in `README.md`.

---

## Step 0 — Get the folder onto the PC

Copy the whole `print-agent` folder to the shop PC. Over AnyDesk, the file-transfer
panel is easiest.

Put it somewhere permanent and easy to type, for example:

```
C:\SareePalace\print-agent
```

Do **not** leave it in Downloads or a temp folder — Step 3 points Windows at this
location permanently, so it must not move afterwards.

**Check:** open that folder. You should see `1-CHECK.bat`, `2-START.bat`,
`3-AUTOSTART.bat`, and `server.js`.

---

## Step 1 — Run `1-CHECK.bat`

Double-click it. A black window opens and prints a report.

This changes nothing on the PC. It only inspects it.

**If it says Node.js is not installed** (most likely, and the reason the earlier
attempt failed):

1. Go to <https://nodejs.org>
2. Click the big green **LTS** button
3. Run the installer, click Next through every screen
4. Leave the "Tools for Native Modules" checkbox **unticked** — not needed
5. **Close the black window and run `1-CHECK.bat` again.** A fresh window is required
   before Windows can see Node.

**Check:** the last line reads

```
RESULT: All checks passed. Run 2-START.bat next.
```

Also note the printer list in that report. One line should be marked
`<-- looks like your label printer`. **Write that name down exactly** — you need it in
Step 5. If nothing is marked, note whichever name is the TSC.

> If the result reports `Port 9110 is already in use`, an old copy is still running.
> Close any stray black windows and run `1-CHECK.bat` again.

---

## Step 2 — Run `2-START.bat`

Double-click it. The window stays open and shows:

```
Listening on http://127.0.0.1:9110
Listening on http://[::1]:9110
```

Both lines matter. **Minimise this window — do not close it.**

**Check:** both `Listening` lines appear and the window stays open.

If it closes instantly or shows an error, open `agent-log.txt` in that same folder.
It records exactly why it stopped.

---

## Step 3 — Confirm from the browser

On the shop PC, open a new browser tab and go to:

```
http://localhost:9110/health
```

**Check:** you see text starting with `{"ok":true`.

This is the single most important check. If this works, the agent is running
correctly and anything still failing is on the app side, not the PC.

If the browser says it cannot connect, go back to Step 2.

---

## Step 4 — Run `3-AUTOSTART.bat`

Double-click it once. This makes the agent start by itself whenever the PC is
switched on, so staff never have to do any of this again.

**Check:** it says setup is complete.

To confirm later: restart the PC, wait a minute, then repeat Step 3.

---

## Step 5 — Point the app at the printer

In the app on that PC:

1. Go to **Products & Inventory**
2. Tick any one product (the toolbar only appears with something selected)
3. Click **More** → **Printer Setup**

Then:

- **Agent URL** — leave as `http://localhost:9110`
- The badge top-right should read **Connected** in green.
  If it says Offline, click the refresh arrow beside it.
- **Printer** — this is now a dropdown. Pick the TSC name from Step 1.
- Click **Save**

**Check:** the badge reads Connected and the Printer dropdown shows the TSC.

---

## Step 6 — Calibrate the labels

Still in Printer Setup, click **Calibrate Media**.

The printer will feed a few blank labels and measure the gap between them. This is
what stops it dragging and hunting between labels.

**Do this again any time a new roll is loaded.**

**Check:** the printer feeds a couple of labels and stops cleanly.

---

## Step 7 — Print a test label

Click **Print Test Label**.

It prints a label with a bracket in each of the four corners, the current speed and
density, and a QR code.

**Check all four corners are fully printed and none is cut off.**

| What you see | What to change |
| --- | --- |
| All four corners visible, QR crisp | Done — go to Step 8 |
| Right side cut off | Reduce **Col pitch**, or check **Roll W** matches the real roll |
| Left side cut off | Increase **Left margin** |
| Top or bottom cut off | **Label H** does not match the real label |
| Prints across two labels | **Label H** or **Row gap** is wrong — measure with a ruler |
| Bars/text look grey and faint | Raise **Density** by 2 |
| Bars look fat and smudged together | Lower **Density** by 2, or lower **Speed** to 1 |

Change a value, click **Print Test Label** again. Repeat until the corners are clean.
Click **Save** when it looks right.

> The defaults assume 38×25mm labels, 2 across, on an 80mm roll. If your stock differs,
> measure one label with a ruler and enter the real numbers.

---

## Step 8 — Print real labels

1. Close Printer Setup
2. On the Products list, tick a few products
3. Click the **Print N Labels** button

They should print immediately, with no print dialog and no page setup.

**Check:** scan one of the printed QR codes with the app's camera scanner
(**Scan Lookup**). It should pull up the correct product.

That closes the loop — printed and scanned both working.

---

## Daily use from here

Nothing. The agent starts with the PC and runs minimised.

Select products → **Print N Labels**. That is the whole workflow.

The only recurring task: click **Calibrate Media** when loading a new roll.

---

## If it breaks later

Work through these in order:

1. Open `http://localhost:9110/health` on the shop PC.
   `{"ok":true` means the agent is fine — the problem is elsewhere.
2. If that fails, look for the minimised Print Agent window in the taskbar.
   If it is gone, double-click `2-START.bat`.
3. Read `agent-log.txt` in the `print-agent` folder. It says why it stopped.
4. Run `1-CHECK.bat` for a full re-diagnosis.

**Printer prints blank labels** — ribbon fitted the wrong way round, or the label
stock is the wrong type (direct thermal vs thermal transfer) for the current mode.

**Printer feeds several labels per print** — run **Calibrate Media** again.

**Barcodes will not scan** — raise Density by 2 and drop Speed to 1, then reprint.
Thermal heads spread heat, and too fast plus too light makes bars merge.
