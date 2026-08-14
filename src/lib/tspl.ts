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
  /**
   * Narrowest Code 128 bar, in printer dots, at 203dpi (1 dot = 0.125mm).
   *
   * This is a floor, not a fixed width: each label still uses the widest module
   * its code can fit in, so short codes print at 2 dots and only long ones drop
   * to 1. Set to 2 to refuse to go below 0.25mm, at the cost of long codes
   * overflowing the label.
   */
  minBarcodeModule: number;
  /**
   * "scalable" uses the printer's built-in proportional typeface, matching the
   * look of the supplier reference labels. "bitmap" uses the fixed-width
   * internal fonts — blockier, but every glyph width is exactly known.
   */
  fontStyle: "scalable" | "bitmap";
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
  minBarcodeModule: 1,
  fontStyle: "scalable",
};

export interface GarmentLabel {
  /** Top-left kicker, e.g. "SAREE". */
  category?: string | null;
  /** Top-right kicker, e.g. "BANDHNI". */
  collection?: string | null;
  /** Main description line. */
  name: string;
  /** Sub-detail shown lower-left, e.g. fabric "DOLA". */
  detail?: string | null;
  /** Shown lower-right, e.g. "6.30MTRS" or a garment size. */
  size?: string | null;
  /** Colour name, given its own emphasised line. */
  color?: string | null;
  mrp?: number | null;
  /** The value encoded in the barcode. Must match what the scanner looks up. */
  code: string;
  /** Small reference printed bottom-right, e.g. supplier or lot code. */
  vendorCode?: string | null;
  /** @deprecated Kept so existing callers keep compiling; use vendorCode. */
  costCode?: string | null;
  /** @deprecated No longer printed — the reference labels carry no store name. */
  storeName?: string;
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

/**
 * A text style is either one of the printer's fixed bitmap fonts, or the
 * built-in scalable Monotype CG Triumvirate ("0"). The scalable font is
 * proportional, so it looks like a proper typeface rather than a terminal —
 * which is what the supplier reference labels use.
 */
export type TextStyle =
  | { kind: "bitmap"; font: TsplFont; mult?: number }
  | { kind: "scalable"; pt: number };

/** 203 dpi head: one typographic point is 203/72 dots. */
const DOTS_PER_POINT = DOTS_PER_MM * 25.4 / 72;

/**
 * Triumvirate is proportional, so exact widths are only known to the printer.
 * 0.62em per character is a deliberate over-estimate across upper-case Latin —
 * it makes truncation land slightly early rather than letting text run off the
 * label edge, which is the failure that actually matters.
 */
const SCALABLE_WIDTH_RATIO = 0.62;

function styleCharWidth(style: TextStyle): number {
  return style.kind === "bitmap"
    ? TSPL_FONTS[style.font].width * (style.mult ?? 1)
    : style.pt * DOTS_PER_POINT * SCALABLE_WIDTH_RATIO;
}

export function styleHeight(style: TextStyle): number {
  return style.kind === "bitmap"
    ? TSPL_FONTS[style.font].height * (style.mult ?? 1)
    : Math.round(style.pt * DOTS_PER_POINT);
}

function textWidth(value: string, style: TextStyle): number {
  return Math.round(value.length * styleCharWidth(style));
}

/** Truncate to what actually fits, so text can never overrun the label edge. */
function fitToWidth(value: string, style: TextStyle, availableDots: number): string {
  const maxChars = Math.floor(availableDots / styleCharWidth(style));
  if (maxChars <= 0) return "";
  return value.length <= maxChars ? value : value.slice(0, maxChars);
}

class LabelBuilder {
  private lines: string[] = [];

  text(x: number, y: number, style: TextStyle, value: string) {
    const clean = escapeTspl(toPrintableAscii(value));
    if (!clean) return;
    if (style.kind === "bitmap") {
      const m = style.mult ?? 1;
      this.lines.push(`TEXT ${x},${y},"${style.font}",0,${m},${m},"${clean}"`);
    } else {
      // For font "0" the multiplication params carry the point size instead.
      this.lines.push(`TEXT ${x},${y},"0",0,${style.pt},${style.pt},"${clean}"`);
    }
  }

  /** Right-aligns by measuring the string against the style's advance width. */
  textRight(rightEdge: number, y: number, style: TextStyle, value: string) {
    const clean = toPrintableAscii(value);
    if (!clean) return;
    this.text(rightEdge - textWidth(clean, style), y, style, clean);
  }

  bar(x: number, y: number, width: number, height: number) {
    this.lines.push(`BAR ${x},${y},${width},${height}`);
  }

  /** Inverts a rectangle — used for the white-on-black currency mark. */
  reverse(x: number, y: number, width: number, height: number) {
    this.lines.push(`REVERSE ${x},${y},${width},${height}`);
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
 * Code 128 symbol width in modules. Set C packs two digits per symbol, so an
 * all-numeric code is close to half the width of the same length in Set B —
 * which is the whole reason supplier labels use numeric article codes.
 */
export function code128Modules(value: string): number {
  const symbols = /^[0-9]+$/.test(value) && value.length >= 4
    ? Math.ceil(value.length / 2)
    : value.length;
  // start + data + check + stop(13)
  return 11 + symbols * 11 + 11 + 13;
}

/**
 * Largest module width that still fits, floored at the media's minimum.
 * Below about 2 dots (0.25mm) at 203dpi, thermal bar growth starts pushing the
 * symbol out of spec and phone cameras stop reading it reliably.
 */
export function pickBarcodeModule(value: string, availableDots: number, minModule: number): {
  module: number;
  width: number;
  /** False when even a 1-dot module cannot fit — the symbol would run off the label. */
  fits: boolean;
  /** True when the code only fits by going below the reliable module width. */
  belowMinimum: boolean;
} {
  const modules = code128Modules(value);
  const widest = Math.floor(availableDots / modules);

  if (widest >= minModule) {
    const module = Math.min(4, widest);
    return { module, width: modules * module, fits: true, belowMinimum: false };
  }

  // Cannot honour the minimum. Degrade to the widest module that still fits
  // rather than printing a symbol that runs off the edge of the label.
  const module = Math.max(1, widest);
  return { module, width: modules * module, fits: modules * module <= availableDots, belowMinimum: true };
}

/**
 * Reports codes that will not print reliably at the configured module width,
 * so the UI can warn before a whole roll is wasted.
 */
export function findUnscannableCodes(
  codes: string[],
  media: LabelMedia = DEFAULT_MEDIA
): { code: string; widthMm: number }[] {
  const innerWidth = mmToDots(media.labelWidthMm) - mmToDots(1.2) * 2;
  return codes
    .map((code) => ({ code, result: pickBarcodeModule(code, innerWidth, media.minBarcodeModule) }))
    .filter(({ result }) => result.belowMinimum || !result.fits)
    .map(({ code, result }) => ({
      code,
      widthMm: Math.round((code128Modules(code) * media.minBarcodeModule) / DOTS_PER_MM * 10) / 10,
    }));
}

/**
 * Draws one garment tag, following the layout of the supplier reference labels:
 * no store branding, a strong price line with a reversed currency mark, and a
 * full-width barcode with its human-readable value beneath.
 */
function drawGarmentLabel(builder: LabelBuilder, originX: number, originY: number, media: LabelMedia, label: GarmentLabel) {
  const labelWidth = mmToDots(media.labelWidthMm);
  const labelHeight = mmToDots(media.labelHeightMm);
  const pad = mmToDots(1.2);
  const left = originX + pad;
  const right = originX + labelWidth - pad;
  const innerWidth = right - left;

  const scalable = media.fontStyle !== "bitmap";
  const S = {
    kicker: scalable ? ({ kind: "scalable", pt: 6 } as TextStyle) : ({ kind: "bitmap", font: "1" } as TextStyle),
    name: scalable ? ({ kind: "scalable", pt: 7 } as TextStyle) : ({ kind: "bitmap", font: "1" } as TextStyle),
    color: scalable ? ({ kind: "scalable", pt: 8 } as TextStyle) : ({ kind: "bitmap", font: "2" } as TextStyle),
    price: scalable ? ({ kind: "scalable", pt: 12 } as TextStyle) : ({ kind: "bitmap", font: "3" } as TextStyle),
    micro: scalable ? ({ kind: "scalable", pt: 6 } as TextStyle) : ({ kind: "bitmap", font: "1" } as TextStyle),
  };

  let y = originY + 2;

  // Row 1 — category left, collection right.
  const collection = toPrintableAscii(label.collection || "");
  if (collection) {
    builder.textRight(right, y, S.kicker, fitToWidth(collection, S.kicker, innerWidth * 0.45));
  }
  const categoryRoom = innerWidth - (collection ? textWidth(collection, S.kicker) + 10 : 0);
  builder.text(left, y, S.kicker, fitToWidth(label.category || "", S.kicker, categoryRoom));
  y += styleHeight(S.kicker) + 3;

  // Row 2 — description.
  builder.text(left, y, S.name, fitToWidth(label.name, S.name, innerWidth));
  y += styleHeight(S.name) + 2;

  // Row 3 — detail left, size/length right.
  const detail = toPrintableAscii(label.detail || "");
  const sizeText = toPrintableAscii(label.size || "");
  if (sizeText) {
    builder.textRight(right, y, S.micro, fitToWidth(sizeText, S.micro, innerWidth * 0.45));
  }
  if (detail) {
    const room = innerWidth - (sizeText ? textWidth(sizeText, S.micro) + 10 : 0);
    builder.text(left, y, S.micro, fitToWidth(detail, S.micro, room));
  }
  if (detail || sizeText) y += styleHeight(S.micro) + 2;

  // Row 4 — colour, emphasised on its own line.
  if (label.color) {
    builder.text(left, y, S.color, fitToWidth(label.color, S.color, innerWidth));
    y += styleHeight(S.color) + 2;
  }

  // Row 5 — price, with a reversed currency mark standing in for the rupee
  // glyph (the printer's internal fonts have no codepoint for it).
  const priceText = Math.round(label.mrp || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const markW = Math.round(styleHeight(S.price) * 0.72);
  const markH = styleHeight(S.price);
  builder.text(left + 2, y + Math.round(markH * 0.18), S.micro, "RS");
  builder.reverse(left, y, markW, markH);
  builder.text(
    left + markW + 6,
    y,
    S.price,
    fitToWidth(priceText, S.price, innerWidth - markW - 6)
  );
  y += markH + 4;

  // Barcode — as wide as the label allows, at the largest safe module width.
  const codeVal = toPrintableAscii(label.code || "00000000");
  const { module, width: barcodeWidth } = pickBarcodeModule(codeVal, innerWidth, media.minBarcodeModule);

  const footerH = styleHeight(S.micro);
  // One footer line carries the readable code and the vendor reference, keeping
  // as much of the remaining height as possible for the bars themselves — a
  // Code 128 symbol needs ~6.4mm of bar height to scan dependably.
  const barcodeHeight = Math.max(48, labelHeight - (y - originY) - footerH - 6);
  const barcodeX = originX + Math.max(pad, Math.round((labelWidth - barcodeWidth) / 2));

  builder.code128(barcodeX, y, barcodeHeight, module, codeVal);
  y += barcodeHeight + 2;

  // Footer: readable code left, vendor reference right.
  const vendor = toPrintableAscii(String(label.vendorCode || label.costCode || ""));
  if (vendor) {
    builder.textRight(right, y, S.micro, fitToWidth(vendor, S.micro, innerWidth * 0.45));
  }
  const codeRoom = innerWidth - (vendor ? textWidth(vendor, S.micro) + 10 : 0);
  builder.text(left, y, S.micro, fitToWidth(codeVal, S.micro, codeRoom));
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

      const scalable = media.fontStyle !== "bitmap";
      const titleStyle: TextStyle = scalable ? { kind: "scalable", pt: 6 } : { kind: "bitmap", font: "1" };
      const nameStyle: TextStyle = scalable ? { kind: "scalable", pt: 9 } : { kind: "bitmap", font: "2" };

      builder.text(left, 4, titleStyle, fitToWidth(label.title, titleStyle, innerWidth));
      builder.bar(left, 18, innerWidth, 1);
      builder.text(left, 22, nameStyle, fitToWidth(label.name, nameStyle, innerWidth));

      const codeVal = toPrintableAscii(label.code || "");
      const { module, width: barcodeWidth } = pickBarcodeModule(codeVal, innerWidth, media.minBarcodeModule);
      const barcodeX = originX + Math.max(pad, Math.round((labelWidth - barcodeWidth) / 2));

      builder.code128(barcodeX, 64, 75, module, codeVal);

      const footer = label.subCode ? `${codeVal} (${label.subCode})` : codeVal;
      const footerWidth = textWidth(footer, titleStyle);
      builder.text(originX + Math.round((labelWidth - footerWidth) / 2), 160, titleStyle, footer);
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

    const infoStyle: TextStyle = { kind: "bitmap", font: "1" };
    builder.text(originX + 30, 30, infoStyle, `SPD ${media.speed} DEN ${media.density}`);
    builder.text(originX + 30, 46, infoStyle, `${media.labelWidthMm}x${media.labelHeightMm}mm C${col + 1}`);

    // Numeric so the test symbol uses Set C, exercising the same encoding the
    // real labels use when the code is all digits.
    const codeVal = "012504010752";
    const { module, width: barcodeWidth } = pickBarcodeModule(codeVal, labelWidth - 24, media.minBarcodeModule);
    const barcodeX = originX + Math.round((labelWidth - barcodeWidth) / 2);
    builder.code128(barcodeX, 70, 75, module, codeVal);
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
