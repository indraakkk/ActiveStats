// Right-side panel listing overlays in z-order. Click to select; the X
// removes. Hooks straight into the same Atoms the canvas reads, so
// selection state stays consistent.
import { useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { overlaysAtom, selectedIdAtom } from "../store/editor-store";

const labelFor = (kind: string) =>
  kind === "stat-card"
    ? "Stat card"
    : kind.charAt(0).toUpperCase() + kind.slice(1);

export function LayerPanel() {
  const overlays = useAtomValue(overlaysAtom);
  const [selectedId, setSelectedId] = useAtom(selectedIdAtom);
  const setOverlays = useAtomSet(overlaysAtom);

  return (
    <aside className="flex w-60 flex-col border-l border-neutral-800 bg-neutral-950 text-sm">
      <div className="border-b border-neutral-800 px-3 py-2 font-semibold text-neutral-200">
        Layers
      </div>
      <div className="flex-1 overflow-y-auto">
        {overlays.length === 0 ? (
          <p className="p-3 text-neutral-500">
            Add overlays from the toolbar.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-900">
            {overlays.map((overlay) => {
              const isSelected = overlay.id === selectedId;
              return (
                <li key={overlay.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(overlay.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setSelectedId(overlay.id);
                    }}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 transition ${
                      isSelected
                        ? "bg-[#fc5200]/20 text-white"
                        : "text-neutral-300 hover:bg-neutral-900"
                    }`}
                  >
                    <span className="flex-1 truncate font-medium">
                      {labelFor(overlay.kind)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOverlays((prev) =>
                          prev.filter((o) => o.id !== overlay.id)
                        );
                        if (isSelected) setSelectedId(null);
                      }}
                      className="rounded px-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                      aria-label={`Delete ${overlay.kind}`}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
