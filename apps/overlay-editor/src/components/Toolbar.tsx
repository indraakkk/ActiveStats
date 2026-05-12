// Top toolbar: add-overlay buttons + export. Export is an Atom-backed
// mutation (§1.5.4) so it inherits Effect interruption on unmount.
import { Effect } from "effect";
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import type { OverlayElement } from "@strava-overlay/shared";
import {
  imageAtom,
  overlaysAtom,
  selectedIdAtom,
} from "../store/editor-store";
import { runtimeAtom } from "../runtime";
import {
  newDividerOverlay,
  newRouteOverlay,
  newStatCardOverlay,
  newTextOverlay,
} from "../lib/factory";
import { exportLossless, type ExportArgs } from "../lib/export";

// runtimeAtom.fn yields a callable Effect. useAtomSet(fnAtom) returns a
// dispatcher; calling it runs the Effect with the runtime's services,
// auto-cancels on unmount. Defense in depth — using promiseExit mode so
// the click handler can surface failures.
const exportAtom = runtimeAtom.fn(
  Effect.fnUntraced(function* (args: ExportArgs) {
    const blob = yield* exportLossless(args);
    // Trigger the browser download. Imperative DOM at the leaf — wrapped
    // in Effect.sync to sequence cleanly with the preceding Effect.
    yield* Effect.sync(() => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `overlay-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  })
);

export function Toolbar() {
  const image = useAtomValue(imageAtom);
  const overlays = useAtomValue(overlaysAtom);
  const setOverlays = useAtomSet(overlaysAtom);
  const setSelectedId = useAtomSet(selectedIdAtom);
  const exportPng = useAtomSet(exportAtom);

  const add = (factory: () => OverlayElement) => {
    const overlay = factory();
    setOverlays((prev) => [...prev, overlay]);
    setSelectedId(overlay.id);
  };

  const onExport = () => {
    if (!image) return;
    exportPng({
      imageSrc: image.src,
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      overlays,
    });
  };

  return (
    <header className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-4 py-2 text-sm">
      <span className="mr-2 font-semibold text-neutral-100">Overlay Editor</span>
      <ToolbarButton onClick={() => add(newTextOverlay)}>+ Text</ToolbarButton>
      <ToolbarButton onClick={() => add(newStatCardOverlay)}>
        + Stat card
      </ToolbarButton>
      <ToolbarButton onClick={() => add(newRouteOverlay)}>+ Route</ToolbarButton>
      <ToolbarButton onClick={() => add(newDividerOverlay)}>
        + Divider
      </ToolbarButton>
      <div className="ml-auto flex items-center gap-3 text-neutral-400">
        {image && (
          <span className="font-mono text-xs">
            {image.naturalWidth} × {image.naturalHeight}
          </span>
        )}
        <button
          type="button"
          onClick={onExport}
          disabled={!image}
          className="rounded bg-[#fc5200] px-3 py-1.5 font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#e34a00]"
        >
          Export PNG
        </button>
      </div>
    </header>
  );
}

function ToolbarButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-800"
    >
      {children}
    </button>
  );
}
