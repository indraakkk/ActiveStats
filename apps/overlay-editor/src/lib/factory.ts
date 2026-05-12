// Default overlay factories used by the toolbar's "Add ..." buttons.
// Each returns an overlay positioned roughly mid-canvas at a reasonable
// default size. id is a random opaque string.
import type {
  DividerOverlay,
  OverlayElement,
  RouteOverlay,
  StatCardOverlay,
  TextOverlay,
} from "@strava-overlay/shared";
import { SAMPLE_POLYLINE } from "./polyline";

const newId = () =>
  `o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const newTextOverlay = (): TextOverlay => ({
  id: newId(),
  kind: "text",
  x: 0.1,
  y: 0.1,
  width: 0.5,
  height: 0.08,
  rotation: 0,
  opacity: 1,
  text: "Your text",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 0.06,
  fontWeight: 700,
  color: "#ffffff",
  align: "left",
  letterSpacing: 0,
});

export const newStatCardOverlay = (): StatCardOverlay => ({
  id: newId(),
  kind: "stat-card",
  x: 0.05,
  y: 0.7,
  width: 0.4,
  height: 0.25,
  rotation: 0,
  opacity: 1,
  stats: [
    { label: "Distance", value: "21.33 km" },
    { label: "Pace", value: "5:02 /km" },
    { label: "Time", value: "1:47:19" },
  ],
  style: "boxed",
  color: "#ffffff",
  fontFamily: "Inter, system-ui, sans-serif",
});

export const newRouteOverlay = (): RouteOverlay => ({
  id: newId(),
  kind: "route",
  x: 0.55,
  y: 0.65,
  width: 0.4,
  height: 0.3,
  rotation: 0,
  opacity: 1,
  polyline: SAMPLE_POLYLINE,
  strokeColor: "#fc5200",
  strokeWidth: 0.008,
  showStartEnd: true,
});

export const newDividerOverlay = (): DividerOverlay => ({
  id: newId(),
  kind: "divider",
  x: 0.1,
  y: 0.5,
  width: 0.8,
  height: 0.005,
  rotation: 0,
  opacity: 1,
  orientation: "horizontal",
  color: "#ffffff",
  thickness: 0.005,
});

export const isOverlayKind = (k: string): k is OverlayElement["kind"] =>
  k === "text" || k === "stat-card" || k === "route" || k === "divider";
