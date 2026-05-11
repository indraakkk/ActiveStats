// Live preview canvas. Konva Stage sized to the available container, image
// scaled to fit while preserving aspect ratio. Overlays are rendered via
// react-konva components — one component per overlay kind, sharing the
// same coord math as the export pipeline (lib/export.ts).
//
// Drag and transform write back to the store in RELATIVE coords by
// dividing the new absolute values by canvasDisplay dimensions, so the
// stored model stays resolution-independent (anti-pattern: pixel coords).
import { useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import {
  canvasDisplayAtom,
  imageAtom,
  overlaysAtom,
  selectedIdAtom,
} from "../store/editor-store";
import { TextOverlayNode } from "./overlays/TextOverlayNode";
import { StatCardOverlayNode } from "./overlays/StatCardOverlayNode";
import { RouteOverlayNode } from "./overlays/RouteOverlayNode";
import { DividerOverlayNode } from "./overlays/DividerOverlayNode";

export function Canvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
  const [htmlImage, setHtmlImage] = useState<HTMLImageElement | null>(null);

  const image = useAtomValue(imageAtom);
  const overlays = useAtomValue(overlaysAtom);
  const [selectedId, setSelectedId] = useAtom(selectedIdAtom);
  const setOverlays = useAtomSet(overlaysAtom);
  const [display, setDisplay] = useAtom(canvasDisplayAtom);

  // Compute display size to fit container while preserving image aspect ratio.
  useEffect(() => {
    if (!image) return;
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const maxW = el.clientWidth;
      const maxH = el.clientHeight;
      if (maxW === 0 || maxH === 0) return;
      const aspect = image.naturalWidth / image.naturalHeight;
      let w = maxW;
      let h = maxW / aspect;
      if (h > maxH) {
        h = maxH;
        w = maxH * aspect;
      }
      setDisplay({ width: Math.floor(w), height: Math.floor(h) });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [image, setDisplay]);

  // Load the HTMLImageElement once when image src changes. Plain Image
  // because the editor's preview path is best-effort — failures here are
  // visual only; the export pipeline uses its own Effect-wrapped load.
  useEffect(() => {
    if (!image) {
      setHtmlImage(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setHtmlImage(img);
    img.src = image.src;
    return () => {
      img.onload = null;
    };
  }, [image]);

  // Attach the Transformer to whichever node matches selectedId.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = nodeRefs.current.get(selectedId);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, overlays]);

  if (!image || display.width === 0 || display.height === 0) {
    return (
      <div ref={containerRef} className="flex-1 min-h-0 min-w-0 bg-neutral-900" />
    );
  }

  const handleStageClick = (
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (e.target === e.target.getStage()) setSelectedId(null);
  };

  const registerNode = (id: string, node: Konva.Node | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 min-w-0 flex items-center justify-center bg-neutral-900 p-4"
    >
      <Stage
        ref={stageRef}
        width={display.width}
        height={display.height}
        onMouseDown={handleStageClick}
        onTouchStart={handleStageClick}
        className="shadow-2xl"
      >
        <Layer>
          {htmlImage && (
            <KonvaImage
              image={htmlImage}
              x={0}
              y={0}
              width={display.width}
              height={display.height}
              listening={false}
            />
          )}
          {overlays.map((overlay) => {
            const common = {
              key: overlay.id,
              overlay,
              displayWidth: display.width,
              displayHeight: display.height,
              isSelected: overlay.id === selectedId,
              onSelect: () => setSelectedId(overlay.id),
              onRef: (n: Konva.Node | null) => registerNode(overlay.id, n),
              onChange: (patch: Partial<typeof overlay>) => {
                setOverlays((prev) =>
                  prev.map((o) =>
                    o.id === overlay.id
                      ? ({ ...o, ...patch } as typeof o)
                      : o
                  )
                );
              },
            };
            switch (overlay.kind) {
              case "text":
                return <TextOverlayNode {...common} overlay={overlay} />;
              case "stat-card":
                return <StatCardOverlayNode {...common} overlay={overlay} />;
              case "route":
                return <RouteOverlayNode {...common} overlay={overlay} />;
              case "divider":
                return <DividerOverlayNode {...common} overlay={overlay} />;
            }
          })}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            anchorSize={10}
            borderStroke="#fc5200"
            anchorStroke="#fc5200"
            anchorFill="#fff"
          />
        </Layer>
      </Stage>
    </div>
  );
}

