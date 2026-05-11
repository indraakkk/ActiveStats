import { useRef } from "react";
import { Rect } from "react-konva";
import Konva from "konva";
import type { DividerOverlay } from "@strava-overlay/shared";
import type { OverlayNodeProps } from "./types";

export function DividerOverlayNode({
  overlay,
  displayWidth: w,
  displayHeight: h,
  onSelect,
  onRef,
  onChange,
}: OverlayNodeProps<DividerOverlay>) {
  const ref = useRef<Konva.Rect | null>(null);
  const isHorizontal = overlay.orientation === "horizontal";
  const width = isHorizontal ? overlay.width * w : overlay.thickness * w;
  const height = isHorizontal ? overlay.thickness * h : overlay.height * h;
  return (
    <Rect
      ref={(node) => {
        ref.current = node;
        onRef(node);
      }}
      x={overlay.x * w}
      y={overlay.y * h}
      width={width}
      height={height}
      fill={overlay.color}
      rotation={overlay.rotation}
      opacity={overlay.opacity}
      draggable
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      onDragEnd={(e) =>
        onChange({ x: e.target.x() / w, y: e.target.y() / h })
      }
      onTransformEnd={() => {
        const node = ref.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const newWidth = width * scaleX;
        const newHeight = height * scaleY;
        onChange({
          x: node.x() / w,
          y: node.y() / h,
          width: isHorizontal ? newWidth / w : overlay.width,
          height: isHorizontal ? overlay.height : newHeight / h,
          thickness: isHorizontal ? newHeight / h : newWidth / w,
          rotation: node.rotation(),
        });
      }}
    />
  );
}
