import { useRef } from "react";
import { Group, Rect, Text } from "react-konva";
import Konva from "konva";
import type { StatCardOverlay } from "@strava-overlay/shared";
import type { OverlayNodeProps } from "./types";

export function StatCardOverlayNode({
  overlay,
  displayWidth: w,
  displayHeight: h,
  onSelect,
  onRef,
  onChange,
}: OverlayNodeProps<StatCardOverlay>) {
  const ref = useRef<Konva.Group | null>(null);
  const cardW = overlay.width * w;
  const cardH = overlay.height * h;
  const rowCount = Math.max(1, overlay.stats.length);
  const rowH = cardH / rowCount;
  const valueFontSize = Math.min(rowH * 0.55, cardW * 0.12);
  const labelFontSize = valueFontSize * 0.55;

  return (
    <Group
      ref={(node) => {
        ref.current = node;
        onRef(node);
      }}
      x={overlay.x * w}
      y={overlay.y * h}
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
        onChange({
          x: node.x() / w,
          y: node.y() / h,
          width: (cardW * scaleX) / w,
          height: (cardH * scaleY) / h,
          rotation: node.rotation(),
        });
      }}
    >
      {overlay.style === "boxed" && (
        <Rect
          x={0}
          y={0}
          width={cardW}
          height={cardH}
          fill="rgba(0,0,0,0.55)"
          cornerRadius={cardW * 0.02}
          listening={false}
        />
      )}
      {overlay.stats.map((stat, i) => {
        const rowTop = rowH * i;
        return (
          <Group key={i} listening={false}>
            <Text
              x={cardW * 0.05}
              y={rowTop + rowH * 0.12}
              width={cardW * 0.9}
              text={stat.label}
              fontFamily={overlay.fontFamily}
              fontSize={labelFontSize}
              fill={overlay.color}
              opacity={0.8}
            />
            <Text
              x={cardW * 0.05}
              y={rowTop + rowH * 0.12 + labelFontSize * 1.1}
              width={cardW * 0.9}
              text={stat.value}
              fontFamily={overlay.fontFamily}
              fontSize={valueFontSize}
              fontStyle="bold"
              fill={overlay.color}
            />
          </Group>
        );
      })}
    </Group>
  );
}
