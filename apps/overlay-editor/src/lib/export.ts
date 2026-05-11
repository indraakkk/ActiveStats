// Lossless PNG export — the engineering heart of Phase 3.
//
// The trick: the visible canvas is sized to the viewport (small), but the
// exported PNG must be the photo's native resolution. So we render to a
// FRESH offscreen Konva stage at the image's naturalWidth × naturalHeight,
// pixelRatio: 1, then serialise that. Overlays are stored in relative
// coords so the same set scales 1:1 to either canvas (§1.5.5).
//
// Effect boundaries per §1.5.5:
//   - loadImage: Effect.async (image load is async + fallible + cancellable)
//   - renderToBlob: plain synchronous Konva calls, wrapped in Effect.try at
//     the call site. NOT wrapping every Konva.add() in Effect.sync.
//
// Anti-pattern dodged (spec): NOT capturing the visible canvas, NOT using
// html2canvas/dom-to-image, NOT using pixelRatio > 1 (the offscreen stage
// is already at native size — multiplying just inflates file size).

import Konva from "konva";
import { Data, Effect } from "effect";
import type { OverlayElement } from "@strava-overlay/shared";
import { decodePolyline } from "./polyline";

export class ImageLoadError extends Data.TaggedError("ImageLoadError")<{
  readonly src: string;
  readonly cause: unknown;
}> {}

export class ExportRenderError extends Data.TaggedError("ExportRenderError")<{
  readonly cause: unknown;
}> {}

export type ExportArgs = {
  readonly imageSrc: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly overlays: ReadonlyArray<OverlayElement>;
};

export const exportLossless = (
  args: ExportArgs
): Effect.Effect<Blob, ImageLoadError | ExportRenderError> =>
  Effect.gen(function* () {
    const img = yield* loadImage(args.imageSrc);
    return yield* Effect.try({
      try: () => renderToBlob(img, args),
      catch: (cause) => new ExportRenderError({ cause }),
    });
  });

// Image loading via Effect.async — cleanup fires on fiber interruption
// (component unmount mid-export), so the half-loaded image is dereferenced
// and the network request is abortable in supporting browsers.
const loadImage = (
  src: string
): Effect.Effect<HTMLImageElement, ImageLoadError> =>
  Effect.async<HTMLImageElement, ImageLoadError>((resume) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resume(Effect.succeed(img));
    img.onerror = (cause) =>
      resume(Effect.fail(new ImageLoadError({ src, cause })));
    img.src = src;
    return Effect.sync(() => {
      img.onload = null;
      img.onerror = null;
      img.src = "";
    });
  });

// Pure synchronous Konva pipeline. Wrapped once in Effect.try by the caller;
// no need to wrap every internal call (§1.5.5 anti-pattern).
function renderToBlob(img: HTMLImageElement, args: ExportArgs): Blob {
  const { imageWidth, imageHeight, overlays } = args;

  const container = document.createElement("div");
  container.style.cssText = `position:absolute;left:-99999px;top:-99999px;width:${imageWidth}px;height:${imageHeight}px;`;
  document.body.appendChild(container);

  try {
    const stage = new Konva.Stage({
      container,
      width: imageWidth,
      height: imageHeight,
    });
    const layer = new Konva.Layer();
    stage.add(layer);

    layer.add(
      new Konva.Image({
        image: img,
        x: 0,
        y: 0,
        width: imageWidth,
        height: imageHeight,
      })
    );

    for (const overlay of overlays) {
      const node = renderOverlayToKonva(overlay, imageWidth, imageHeight);
      if (node) layer.add(node);
    }
    layer.draw();

    // pixelRatio: 1 — stage is already at native size, no upscaling needed.
    const dataUrl = stage.toDataURL({
      mimeType: "image/png",
      pixelRatio: 1,
    });
    stage.destroy();
    return dataUrlToBlob(dataUrl);
  } finally {
    document.body.removeChild(container);
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

// Imperative Konva node construction per overlay kind. The live canvas
// (Canvas.tsx) renders the same overlay set via react-konva components —
// they're parallel but use the same coord math and read the same atoms.
export function renderOverlayToKonva(
  overlay: OverlayElement,
  w: number,
  h: number
): Konva.Shape | Konva.Group | null {
  switch (overlay.kind) {
    case "text":
      return new Konva.Text({
        x: overlay.x * w,
        y: overlay.y * h,
        width: overlay.width * w,
        text: overlay.text,
        fontFamily: overlay.fontFamily,
        fontSize: overlay.fontSize * h,
        fontStyle: overlay.fontWeight >= 700 ? "bold" : "normal",
        fill: overlay.color,
        align: overlay.align,
        letterSpacing: overlay.letterSpacing,
        rotation: overlay.rotation,
        opacity: overlay.opacity,
      });

    case "stat-card": {
      const cardW = overlay.width * w;
      const cardH = overlay.height * h;
      const group = new Konva.Group({
        x: overlay.x * w,
        y: overlay.y * h,
        rotation: overlay.rotation,
        opacity: overlay.opacity,
      });
      if (overlay.style === "boxed") {
        group.add(
          new Konva.Rect({
            x: 0,
            y: 0,
            width: cardW,
            height: cardH,
            fill: "rgba(0,0,0,0.55)",
            cornerRadius: cardW * 0.02,
          })
        );
      }
      const rowCount = Math.max(1, overlay.stats.length);
      const rowH = cardH / rowCount;
      const valueFontSize = Math.min(rowH * 0.55, cardW * 0.12);
      const labelFontSize = valueFontSize * 0.55;
      overlay.stats.forEach((stat, i) => {
        const rowTop = rowH * i;
        group.add(
          new Konva.Text({
            x: cardW * 0.05,
            y: rowTop + rowH * 0.12,
            width: cardW * 0.9,
            text: stat.label,
            fontFamily: overlay.fontFamily,
            fontSize: labelFontSize,
            fontStyle: "normal",
            fill: overlay.color,
            opacity: 0.8,
          })
        );
        group.add(
          new Konva.Text({
            x: cardW * 0.05,
            y: rowTop + rowH * 0.12 + labelFontSize * 1.1,
            width: cardW * 0.9,
            text: stat.value,
            fontFamily: overlay.fontFamily,
            fontSize: valueFontSize,
            fontStyle: "bold",
            fill: overlay.color,
          })
        );
      });
      return group;
    }

    case "route": {
      const coords = decodePolyline(overlay.polyline);
      if (coords.length < 2) return null;

      const boxX = overlay.x * w;
      const boxY = overlay.y * h;
      const boxW = overlay.width * w;
      const boxH = overlay.height * h;

      let minLat = Infinity,
        maxLat = -Infinity,
        minLng = Infinity,
        maxLng = -Infinity;
      for (const [lat, lng] of coords) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
      const lngRange = maxLng - minLng || 1;
      const latRange = maxLat - minLat || 1;
      // Preserve aspect ratio; the longer axis fills the bbox.
      const scale = Math.min(boxW / lngRange, boxH / latRange);
      const drawnW = lngRange * scale;
      const drawnH = latRange * scale;
      const offsetX = boxX + (boxW - drawnW) / 2;
      const offsetY = boxY + (boxH - drawnH) / 2;

      const points: number[] = [];
      for (const [lat, lng] of coords) {
        // Flip Y because lat increases northward, canvas Y increases downward.
        points.push(offsetX + (lng - minLng) * scale);
        points.push(offsetY + (maxLat - lat) * scale);
      }

      const group = new Konva.Group({
        rotation: overlay.rotation,
        opacity: overlay.opacity,
      });
      group.add(
        new Konva.Line({
          points,
          stroke: overlay.strokeColor,
          strokeWidth: overlay.strokeWidth * h,
          lineCap: "round",
          lineJoin: "round",
        })
      );
      if (overlay.showStartEnd) {
        const dotR = overlay.strokeWidth * h * 1.6;
        group.add(
          new Konva.Circle({
            x: points[0],
            y: points[1],
            radius: dotR,
            fill: "#10b981",
          })
        );
        group.add(
          new Konva.Circle({
            x: points[points.length - 2],
            y: points[points.length - 1],
            radius: dotR,
            fill: "#ef4444",
          })
        );
      }
      return group;
    }

    case "divider": {
      const isHorizontal = overlay.orientation === "horizontal";
      return new Konva.Rect({
        x: overlay.x * w,
        y: overlay.y * h,
        width: isHorizontal ? overlay.width * w : overlay.thickness * w,
        height: isHorizontal ? overlay.thickness * h : overlay.height * h,
        fill: overlay.color,
        rotation: overlay.rotation,
        opacity: overlay.opacity,
      });
    }
  }
}
