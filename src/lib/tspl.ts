/**
 * TSPL2 command generation for TSC TA210 (and TSPL-compatible) label printers.
 *
 * Why this exists: rendering barcodes as HTML/SVG and going through the browser
 * print dialog rasterises at 96dpi CSS and lets the driver rescale to 203dpi.
 * That ratio (2.115) is non-integer, so bar widths — which ARE the data in a
 * barcode — get smeared and the symbol falls out of spec.
 *
 * Sending TSPL means the printer's own firmware draws the code at exact dot
 * pitch, using bitmap fonts designed for 203dpi. Nothing is ever rescaled.
 */

/** TSC TA210 head resolution. 203.2 dpi, addressed as a flat 8 dots/mm. */
export const DOTS_PER_MM = 8;

export const mmToDots = (millimetres: number) => Math.round(millimetres * DOTS_PER_MM);

/**
 * Cell metrics of the printer's internal bitmap fonts, in dots, at multiplier 1.
 * Knowing these exactly is what lets us truncate text to fit instead of
 * letting it overflow the label (the old HTML labels collided mid-word).
 */
export const TSPL_FONTS = {
  "1": { width: 8, height: 12 },
  "2": { width: 12, height: 20 },
  "3": { width: 16, height: 24 },
  "4": { width: 24, height: 32 },
  "5": { width: 32, height: 48 },
} as const;

export type TsplFont = keyof typeof TSPL_FONTS;

export interface LabelMedia {
  /** Full media web width, sent as the TSPL SIZE width. */
  webWidthMm: number;
  /** One physical label's width. */
  labelWidthMm: number;
  /** One physical label's height (also the feed pitch). */
  labelHeightMm: number;
  /** Labels across the web. 1 for single-column stock, 2 for the 2-up roll. */
  columns: number;
  /** Distance from one column's left edge to the next column's left edge. */
  columnPitchMm: number;
  /** Unprinted margin before the first column. */
  leftMarginMm: number;
  /** Vertical gap between label rows, for the gap sensor. */
  gapMm: number;
  /** Gap sensor offset. Leave at 0 unless calibration says otherwise. */
  gapOffsetMm: number;
  /** Print speed in inches/sec. Lower is sharper. TA210 tops out at 5. */
  speed: number;
  /** Head energy, 0-15. Too low gives grey bars, too high bleeds them together. */
  density: number;
  /** 1 feeds the label out readable-side-up. */
  direction: 0 | 1;
  /** QR module size in dots. 4 => ~10.5mm symbol, comfortable for phone cameras. */
  qrCellWidth: number;
  /** QR error correction. M tolerates ~15% damage — right for garment tags. */
  qrEcc: "L" | "M" | "Q" | "H";
}

export const DEFAULT_MEDIA: LabelMedia = {
  webWidthMm: 80,
  labelWidthMm: 38,
  labelHeightMm: 25,
  columns: 2,
  columnPitchMm: 40,
  leftMarginMm: 1,
  gapMm: 2,
  gapOffsetMm: 0,
  speed: 2,
  density: 10,
  direction: 1,
  qrCellWidth: 4,
  qrEcc: "M",
};

export interface GarmentLabel {
  storeName: string;
  category?: string | null;
  name: string;
  color?: string | null;
  size?: string | null;
  mrp?: number | null;
  /** The value encoded in the QR. Must match what the scanner looks up. */
  code: string;
  /** Optional obfuscated cost marking. */
  costCode?: string | null;
}

/**
 * The internal bitmap fonts are codepage-bound and have no glyph for most
 * non-ASCII characters — including the rupee sign, which is why prices have to
 * be written "Rs." rather than "₹". Anything unrepresentable is dropped rather
 * than printed as a garbage glyph.
 */
function toPrintableAscii(value: string): string {
  return (value ?? "")
    .replace(/[₹]/g, "Rs.")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

/** In TSPL, backslash is the escape character and quotes delimit content. */
function escapeTspl(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Truncate to what actually fits, so text can never overrun the label edge. */
function fitToWidth(value: string, font: TsplFont, multiplier: number, availableDots: number): string {
  const charWidth = TSPL_FONTS[font].width * multiplier;
  const maxChars = Math.floor(availableDots / charWidth);
  if (maxChars <= 0) return "";
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
}

function textWidth(value: string, font: TsplFont, multiplier: number): number {
  return value.length * TSPL_FONTS[font].width * multiplier;
}

class LabelBuilder {
  private lines: string[] = [];

  text(x: number, y: number, font: TsplFont, multiplier: number, value: string) {
    const clean = escapeTspl(toPrintableAscii(value));
    if (!clean) return;
    this.lines.push(`TEXT ${x},${y},"${font}",0,${multiplier},${multiplier},"${clean}"`);
  }

  /** Right-aligns by measuring the string against the known font cell width. */
  textRight(rightEdge: number, y: number, font: TsplFont, multiplier: number, value: string) {
    const clean = toPrintableAscii(value);
    if (!clean) return;
    this.text(rightEdge - textWidth(clean, font, multiplier), y, font, multiplier, clean);
  }

  bar(x: number, y: number, width: number, height: number) {
    this.lines.push(`BAR ${x},${y},${width},${height}`);
  }

  qrcode(x: number, y: number, ecc: LabelMedia["qrEcc"], cellWidth: number, value: string) {
    this.lines.push(`QRCODE ${x},${y},${ecc},${cellWidth},A,0,"${escapeTspl(toPrintableAscii(value))}"`);
  }

  dataMatrix(x: number, y: number, widthDots: number, heightDots: number, value: string) {
    this.lines.push(`DMATRIX ${x},${y},${widthDots},${heightDots},"${escapeTspl(toPrintableAscii(value))}"`);
  }

  code128(x: number, y: number, heightDots: number, narrowDots: number, value: string) {
    this.lines.push(
      `BARCODE ${x},${y},"128",${heightDots},0,0,${narrowDots},${narrowDots * 2},"${escapeTspl(toPrintableAscii(value))}"`
    );
  }

  raw(command: string) {
    this.lines.push(command);
  }

  toString() {
    return this.lines.join("\r\n");
  }
}

/**
 * Draws one garment tag at the given origin.
 *
 * Layout keeps the QR isolated in the left column so it retains a clear quiet
 * zone on all four sides — Code 39 in the old labels ran flush to the label
 * edge, which alone is enough to make a symbol unreadable.
 */
function drawGarmentLabel(builder: LabelBuilder, originX: number, originY: number, media: LabelMedia, label: GarmentLabel) {
  const labelWidth = mmToDots(media.labelWidthMm);
  const pad = mmToDots(1.5);
  const left = originX + pad;
  const right = originX + labelWidth - pad;
  const innerWidth = right - left;

  // Header: store name, with category right-aligned on the same baseline.
  const category = toPrintableAscii(label.category || "");
  const storeMax = innerWidth - (category ? textWidth(category, "1", 1) + 8 : 0);
  builder.text(left, originY + 4, "1", 1, fitToWidth(label.storeName, "1", 1, storeMax));
  if (category) {
    builder.textRight(right, originY + 4, "1", 1, fitToWidth(category, "1", 1, innerWidth * 0.3));
  }

  // Thin separator line
  builder.bar(left, originY + 18, innerWidth, 1);

  // Product name (Y=22)
  builder.text(left, originY + 22, "2", 1, fitToWidth(label.name, "2", 1, innerWidth));

  // Color & Size side-by-side (Y=44)
  const colText = `COL: ${label.color || "N/A"}`;
  const szText = `SZ: ${label.size || "FREE"}`;
  builder.text(left, originY + 44, "1", 1, fitToWidth(colText, "1", 1, innerWidth * 0.5));
  builder.textRight(right, originY + 44, "1", 1, fitToWidth(szText, "1", 1, innerWidth * 0.5));

  // Price & Cost Code side-by-side (Y=58)
  const priceVal = `Rs.${Math.round(label.mrp || 0).toLocaleString("en-IN")}`;
  builder.text(left, originY + 62, "1", 1, "MRP");
  
  // Choose font for price depending on length
  const priceFont: TsplFont = textWidth(priceVal, "3", 1) <= innerWidth * 0.5 ? "3" : "2";
  builder.text(left + 28, originY + 58, priceFont, 1, fitToWidth(priceVal, priceFont, 1, innerWidth * 0.5));

  if (label.costCode) {
    builder.textRight(right, originY + 62, "1", 1, fitToWidth(label.costCode, "1", 1, innerWidth * 0.4));
  }

  // Centered 1D Code-128 Barcode (Y=88)
  const codeVal = label.code || "00000000";
  const barcodeWidth = (35 + 11 * codeVal.length) * 1;
  const barcodeX = originX + Math.round((labelWidth - barcodeWidth) / 2);
  const barcodeHeight = 70; // 8.75mm high
  
  builder.code128(barcodeX, originY + 88, barcodeHeight, 1, codeVal);

  // SKU Text centered below barcode (Y=168)
  const skuWidth = textWidth(codeVal, "1", 1);
  const skuX = originX + Math.round((labelWidth - skuWidth) / 2);
  builder.text(skuX, originY + 166, "1", 1, codeVal);
}

/**
 * Media setup. Sent ONCE per job, never per label — repeating SIZE/GAP mid-job
 * makes some TSC firmware re-run media detection between labels, which shows up
 * as the printer hunting and dragging the roll.
 */
function mediaPreamble(media: LabelMedia): string[] {
  return [
    `SIZE ${media.webWidthMm} mm,${media.labelHeightMm} mm`,
    `GAP ${media.gapMm} mm,${media.gapOffsetMm} mm`,
    `DIRECTION ${media.direction}`,
    `REFERENCE 0,0`,
    `OFFSET 0 mm`,
    `SPEED ${media.speed}`,
    `DENSITY ${media.density}`,
    `SET TEAR ON`,
  ];
}

/**
 * Builds a complete print job. Each form holds `media.columns` labels
 * side-by-side and is committed with its own PRINT, so the printer advances
 * exactly one label pitch per row and never leaves a trailing blank.
 */
export function buildGarmentLabelJob(labels: GarmentLabel[], media: LabelMedia = DEFAULT_MEDIA): string {
  if (labels.length === 0) return "";

  const builder = new LabelBuilder();
  mediaPreamble(media).forEach((cmd) => builder.raw(cmd));

  const columns = Math.max(1, media.columns);

  for (let i = 0; i < labels.length; i += columns) {
    builder.raw("CLS");

    for (let col = 0; col < columns; col++) {
      const label = labels[i + col];
      if (!label) continue;
      const originX = mmToDots(media.leftMarginMm + col * media.columnPitchMm);
      drawGarmentLabel(builder, originX, 0, media, label);
    }

    builder.raw("PRINT 1,1");
  }

  return builder.toString() + "\r\n";
}

export interface ShelfLabel {
  title: string;
  name: string;
  /** Encoded value — must match the location barcode stored in the database. */
  code: string;
  subCode?: string | null;
}

/**
 * Shelf/rack tags. Centred QR, larger than a garment tag's, because these get
 * scanned at arm's length while walking the aisle rather than held up close.
 */
export function buildShelfLabelJob(labels: ShelfLabel[], media: LabelMedia = DEFAULT_MEDIA): string {
  if (labels.length === 0) return "";

  const builder = new LabelBuilder();
  mediaPreamble(media).forEach((cmd) => builder.raw(cmd));

  const columns = Math.max(1, media.columns);
  const labelWidth = mmToDots(media.labelWidthMm);
  const pad = mmToDots(1.5);

  for (let i = 0; i < labels.length; i += columns) {
    builder.raw("CLS");

    for (let col = 0; col < columns; col++) {
      const label = labels[i + col];
      if (!label) continue;

      const originX = mmToDots(media.leftMarginMm + col * media.columnPitchMm);
      const left = originX + pad;
      const right = originX + labelWidth - pad;
      const innerWidth = labelWidth - pad * 2;

      builder.text(left, 4, "1", 1, fitToWidth(label.title, "1", 1, innerWidth));
      builder.bar(left, 18, innerWidth, 1);
      builder.text(left, 22, "2", 1, fitToWidth(label.name, "2", 1, innerWidth));

      const codeVal = label.code || "";
      const barcodeWidth = (35 + 11 * codeVal.length) * 1;
      const barcodeX = originX + Math.round((labelWidth - barcodeWidth) / 2);
      const barcodeHeight = 75; // 9.3mm high
      
      builder.code128(barcodeX, 64, barcodeHeight, 1, codeVal);

      const footer = label.subCode ? `${codeVal} (${label.subCode})` : codeVal;
      const footerWidth = textWidth(footer, "1", 1);
      builder.text(originX + Math.round((labelWidth - footerWidth) / 2), 160, "1", 1, footer);
    }

    builder.raw("PRINT 1,1");
  }

  return builder.toString() + "\r\n";
}

/**
 * Test pattern for dialling in media geometry and head energy.
 * Prints corner registration marks so misalignment is visible at a glance,
 * plus the same QR the real labels use so scannability can be confirmed.
 */
export function buildCalibrationJob(media: LabelMedia = DEFAULT_MEDIA): string {
  const builder = new LabelBuilder();
  mediaPreamble(media).forEach((cmd) => builder.raw(cmd));
  builder.raw("CLS");

  const labelWidth = mmToDots(media.labelWidthMm);
  const labelHeight = mmToDots(media.labelHeightMm);

  for (let col = 0; col < Math.max(1, media.columns); col++) {
    const originX = mmToDots(media.leftMarginMm + col * media.columnPitchMm);

    // Corner brackets: if any is clipped, the geometry is wrong.
    builder.bar(originX, 0, 24, 3);
    builder.bar(originX, 0, 3, 24);
    builder.bar(originX + labelWidth - 24, 0, 24, 3);
    builder.bar(originX + labelWidth - 3, 0, 3, 24);
    builder.bar(originX, labelHeight - 3, 24, 3);
    builder.bar(originX, labelHeight - 24, 3, 24);
    builder.bar(originX + labelWidth - 24, labelHeight - 3, 24, 3);
    builder.bar(originX + labelWidth - 3, labelHeight - 24, 3, 24);

    builder.text(originX + 30, 30, "1", 1, `SPD ${media.speed} DEN ${media.density}`);
    builder.text(originX + 30, 46, "1", 1, `${media.labelWidthMm}x${media.labelHeightMm}mm C${col + 1}`);

    const codeVal = "SPE-CALIBRATION";
    const barcodeWidth = (35 + 11 * codeVal.length) * 1;
    const barcodeX = originX + Math.round((labelWidth - barcodeWidth) / 2);
    builder.code128(barcodeX, 70, 75, 1, codeVal);
  }

  builder.raw("PRINT 1,1");
  return builder.toString() + "\r\n";
}

/**
 * Asks the printer to auto-measure the media gap. Run this once after loading a
 * new roll — uncalibrated gap detection is what makes the printer hunt and drag
 * between labels.
 */
export function buildGapCalibrationJob(media: LabelMedia = DEFAULT_MEDIA): string {
  return [
    `SIZE ${media.webWidthMm} mm,${media.labelHeightMm} mm`,
    `GAP ${media.gapMm} mm,${media.gapOffsetMm} mm`,
    `DIRECTION ${media.direction}`,
    `SPEED ${media.speed}`,
    `DENSITY ${media.density}`,
    `SET TEAR ON`,
    `GAPDETECT`,
    "",
  ].join("\r\n");
}
