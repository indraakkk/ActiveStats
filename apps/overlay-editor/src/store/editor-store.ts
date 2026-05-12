// Editor state lives in Atoms (per SPEC §1.5.1 — no useState for shared
// state). Three components read/write these:
//   - Canvas: reads image/overlays/canvasDisplay, writes overlays on drag/resize
//   - Toolbar: writes overlays (add buttons), reads image for export
//   - LayerPanel: reads overlays/selectedId, writes selectedId
//
// Coordinates in `overlays` are relative ([0..1]). The live canvas multiplies
// by canvasDisplay; the export pipeline multiplies by the image's natural
// dimensions. Same overlay set, different scaling.
import { Atom } from "@effect-atom/atom-react";
import type { OverlayElement } from "@strava-overlay/shared";

export type LoadedImage = {
  readonly src: string;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
};

export const imageAtom = Atom.make<LoadedImage | null>(null);

export const overlaysAtom = Atom.make<ReadonlyArray<OverlayElement>>([]);

export const selectedIdAtom = Atom.make<string | null>(null);

export const canvasDisplayAtom = Atom.make<{ width: number; height: number }>({
  width: 0,
  height: 0,
});

export const selectedOverlayAtom = Atom.make((get) => {
  const id = get(selectedIdAtom);
  if (!id) return null;
  return get(overlaysAtom).find((o) => o.id === id) ?? null;
});
