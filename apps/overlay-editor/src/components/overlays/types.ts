// Common props for the four per-overlay-kind react-konva components.
// `overlay` is narrowed per file.
import type Konva from "konva";
import type { OverlayElement } from "@strava-overlay/shared";

export type OverlayNodeProps<T extends OverlayElement> = {
  readonly overlay: T;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onRef: (node: Konva.Node | null) => void;
  readonly onChange: (patch: Partial<T>) => void;
};
