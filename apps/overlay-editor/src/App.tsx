// Root layout. Without a photo: drop zone fills the viewport. With a
// photo: top toolbar, centre canvas, right layer panel — the editor.
import { useAtomValue } from "@effect-atom/atom-react";
import { imageAtom } from "./store/editor-store";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/Toolbar";
import { LayerPanel } from "./components/LayerPanel";
import { DropZone } from "./components/DropZone";

export default function App() {
  const image = useAtomValue(imageAtom);

  if (!image) {
    return (
      <main className="flex min-h-screen flex-col bg-neutral-950 p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">
            🎨 Overlay Editor
          </h1>
          <p className="text-sm text-neutral-400">
            Phase 3 — drop a photo, add overlays, export PNG at native resolution.
          </p>
        </header>
        <DropZone />
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Canvas />
        <LayerPanel />
      </div>
    </main>
  );
}
