// qr.ts: the QR code of a wall's link, encoded here in the tab: the link never goes to a QR service, and nothing is
// fetched to draw it. This module is the only importer of `uqr` and is itself only ever loaded with a dynamic import
// (components/QrCode.tsx), so the encoder stays out of the wall's file for everyone who never shows the code.
// From RetroBeam (docs/HERKUNFT.md).
import { encode } from "uqr";

// The four-module light margin the QR spec asks for. Phone cameras find the code by its finder squares, and dark
// edges right beside them are exactly what makes a scan from across a meeting room fail.
export const QR_QUIET_ZONE = 4;

export interface QrPath {
  /** Modules per side, quiet zone included: the SVG viewBox. */
  size: number;
  /** Every dark module as one SVG path, in module units. */
  path: string;
}

export function qrPath(text: string): QrPath {
  // Level M (15 % recovery): a projected code loses a corner to glare or a head in the way, and a wall's link is
  // short enough that M still fits a small version with big modules, easy to scan.
  const { data, size } = encode(text, { ecc: "M", border: QR_QUIET_ZONE });
  // One path of horizontal runs rather than a <rect> per module: one element scales to a projector as cheaply as to
  // a phone.
  let path = "";
  data.forEach((row, y) => {
    let x = 0;
    while (x < size) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < size && row[end]) end += 1;
      path += `M${x} ${y}h${end - x}v1h${x - end}z`;
      x = end;
    }
  });
  return { size, path };
}
