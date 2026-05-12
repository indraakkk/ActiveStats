import { useMemo, useRef } from "react";
import { Group, Line, Circle } from "react-konva";
import Konva from "konva";
import type { RouteOverlay } from "@strava-overlay/shared";
import { decodePolyline } from "../../lib/polyline";
import type { OverlayNodeProps } from "./types";

export function RouteOverlayNode({
  overlay,
  displayWidth: w,
  displayHeight: h,
  onSelect,
  onRef,
  onChange,
}: OverlayNodeProps<RouteOverlay>) {
  const ref = useRef<Konva.Group | null>(null);

  const projection = useMemo(() => {
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
    const scale = Math.min(boxW / lngRange, boxH / latRange);
    const drawnW = lngRange * scale;
    const drawnH = latRange * scale;
    const offsetX = boxX + (boxW - drawnW) / 2;
    const offsetY = boxY + (boxH - drawnH) / 2;
    const points: number[] = [];
    for (const [lat, lng] of coords) {
      points.push(offsetX + (lng - minLng) * scale);
      points.push(offsetY + (maxLat - lat) * scale);
    }
    return { points };
  }, [overlay.polyline, overlay.x, overlay.y, overlay.width, overlay.height, w, h]);

  if (!projection) return null;

  return (
    <Group
      ref={(node) => {
        ref.current = node;
        onRef(node);
      }}
      rotation={overlay.rotation}
      opacity={overlay.opacity}
      draggable
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      onDragEnd={(e) => {
        // Group is positioned at 0,0 in absolute coords; dragging moves
        // its origin. Translate the delta back into the bbox via x/y.
        const dx = e.target.x();
        const dy = e.target.y();
        e.target.x(0);
        e.target.y(0);
        onChange({
          x: overlay.x + dx / w,
          y: overlay.y + dy / h,
        });
      }}
      onTransformEnd={() => {
        const node = ref.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          width: overlay.width * scaleX,
          height: overlay.height * scaleY,
          rotation: node.rotation(),
        });
      }}
    >
      <Line
        points={projection.points}
        stroke={overlay.strokeColor}
        strokeWidth={overlay.strokeWidth * h}
        lineCap="round"
        lineJoin="round"
      />
      {overlay.showStartEnd && (
        <>
          <Circle
            x={projection.points[0]}
            y={projection.points[1]}
            radius={overlay.strokeWidth * h * 1.6}
            fill="#10b981"
            listening={false}
          />
          <Circle
            x={projection.points[projection.points.length - 2]}
            y={projection.points[projection.points.length - 1]}
            radius={overlay.strokeWidth * h * 1.6}
            fill="#ef4444"
            listening={false}
          />
        </>
      )}
    </Group>
  );
}
