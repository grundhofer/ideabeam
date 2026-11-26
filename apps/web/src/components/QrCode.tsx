// QrCode.tsx: a QR code as inline SVG. It stays sharp at any size, from a phone to a meeting-room projector. The
// encoder arrives through a dynamic import, so Vite splits it into its own file and the wall's file does not carry
// it. From RetroBeam (docs/HERKUNFT.md), without its small form with a size per module: here the code is shown large
// alone, at a dozen pixels per module, where a pixel of bleed does not matter.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { QrPath } from "../lib/qr";

export function QrCode({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation();
  // tagged with the text it encodes, so a changed value never shows the old code for a frame
  const [qr, setQr] = useState<(QrPath & { value: string }) | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    import("../lib/qr").then(
      ({ qrPath }) => {
        if (!cancelled) setQr({ value, ...qrPath(value) });
      },
      () => {
        // The file can fail to load, most likely in a tab still running the previous deploy, whose file names no
        // longer exist. The link under the code still works: say so instead of waiting for ever.
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) {
    return (
      <p className="app-qr app-qr--failed" data-testid="qr-failed">
        {t("wall.qrFailed")}
      </p>
    );
  }
  if (qr === null || qr.value !== value) {
    // the same box as the code, so nothing jumps when it lands; still (sebaro has no pulse)
    return <div className="app-qr app-qr--waiting" aria-hidden="true" />;
  }
  return (
    <svg
      className="app-qr"
      data-testid="qr-code"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      // no anti-aliased seams between neighbouring modules: a grey hairline is enough to trip a scanner
      shapeRendering="crispEdges"
      // Dark on light in both modes (sebaro, core rule 7: an image a machine reads stays dark on light, in the light
      // theme's colours with a light margin)
      data-theme="light"
    >
      {/* its own light ground: the quiet zone has to be light whatever stands behind it */}
      <rect className="app-qr__ground" width={qr.size} height={qr.size} />
      <path className="app-qr__modules" d={qr.path} />
    </svg>
  );
}
