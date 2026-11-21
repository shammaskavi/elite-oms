# QZ Tray Setup Guide — Saree Palace Elite

This replaces the old command-line print agent with **QZ Tray** — the industry standard desktop service for silent 1-click label printing from web apps.

---

## Why QZ Tray?
* **No black command windows or Node.js:** It installs as a regular Windows program and runs silently in the background on startup.
* **100% Native 203 DPI Quality:** Barcodes and fonts are burned by the TSC TA210's own printhead — razor-sharp, zero browser blurring, zero cutoff.
* **1-Click Printing:** Select products in the app and click **Print Labels**. It prints immediately without any browser dialogs.

---

## 3-Minute Setup (Once, on the PC connected to the TSC TA210)

### Step 1: Download & Install QZ Tray
1. On the shop PC, open your browser and go to:
   **[https://qz.io/download/](https://qz.io/download/)**
2. Click the big green button to download the **Windows Installer (`.exe`)**.
3. Open the downloaded file, click **Next** through the screens, and finish the installation.
4. QZ Tray will automatically launch. You will see a small green printer icon in the Windows taskbar tray (near the clock).

---

### Step 2: Connect the App to QZ Tray
1. Open the Saree Palace Elite app in your browser:
   **[https://app.sareepalaceelite.in](https://app.sareepalaceelite.in)** (or your local/dev URL).
2. Go to **Products** in the sidebar.
3. Click the printer button or select an item and click **More → Printer Setup**.
4. You will see the connection badge update to **`QZ Tray Ready`** (Green).
5. In the **Printer Name** dropdown, select your printer:
   `TSC TA210` (or whichever name Windows gave to your label printer).

---

### Step 3: Approve Permission (First Time Only)
1. In the Printer Setup dialog, click **Print Test Label**.
2. A small QZ Tray window will pop up asking:
   > *"Allow app.sareepalaceelite.in to connect to QZ Tray?"*
3. **IMPORTANT:** Check the box:
   ☑️ **"Remember this decision"**
   Then click **Allow**.
4. The TSC TA210 will immediately print a test label with corner alignment brackets and a crisp test barcode.

---

### Step 4: Daily Use
That's it!
* Whenever staff wants to print garment tags:
  1. Go to **Products**.
  2. Select the items you want to print.
  3. Click the primary button: **"Print N Labels"**.
  4. The labels print instantly on the TSC TA210 at native 203 DPI with no cutoff!

---

### Troubleshooting & Tips

* **Gap Sensor Calibration (If labels ever drift):**
  If the printer ever feeds across the sticker gap instead of stopping at the perforation:
  1. Open **Printer Setup** in the app.
  2. Click **Calibrate Media**.
  3. The printer will feed 2-3 labels to auto-detect the gap sensors, and all subsequent prints will align perfectly.
* **QZ Tray icon missing from taskbar:**
  Search for **QZ Tray** in the Windows Start menu and open it. It is set to start automatically when Windows boots.
