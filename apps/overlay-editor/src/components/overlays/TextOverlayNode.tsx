import { useRef } from "react";
import { Text } from "react-konva";
import Konva from "konva";
import type { TextOverlay } from "@strava-overlay/shared";
import type { OverlayNodeProps } from "./types";

export function TextOverlayNode({
  overlay,
  displayWidth: w,
  displayHeight: h,
  onSelect,
  onRef,
  onChange,
}: OverlayNodeProps<TextOverlay>) {
  const ref = useRef<Konva.Text | null>(null);
  return (
    <Text
      ref={(node) => {
        ref.current = node;
        onRef(node);
      }}
      x={overlay.x * w}
      y={overlay.y * h}
      width={overlay.width * w}
      text={overlay.text}
      fontFamily={overlay.fontFamily}
      fontSize={overlay.fontSize * h}
      fontStyle={overlay.fontWeight >= 700 ? "bold" : "normal"}
      fill={overlay.color}
      align={overlay.align}
      letterSpacing={overlay.letterSpacing}
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
        const newWidth = node.width() * scaleX;
        const newFontSize = (overlay.fontSize * h * scaleY) / h;
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: node.x() / w,
          y: node.y() / h,
          width: newWidth / w,
          fontSize: newFontSize,
          rotation: node.rotation(),
        });
      }}
    />
  );
}
