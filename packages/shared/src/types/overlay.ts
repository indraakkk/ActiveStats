// Overlay model used by the editor (live canvas + export pipeline) and the
// design-history app (when it serialises saved designs).
//
// All positions and sizes are stored as RELATIVE coordinates (RelCoord, in
// [0..1] normalized against the image's natural dimensions). The same
// overlay set renders at a small display resolution in the editor and at
// the photo's native resolution at export time — multiplying by the
// appropriate dimension is the only difference. Storing pixel values would
// break the moment the display canvas resized.

export type RelCoord = number;

export type BaseOverlay = {
  readonly id: string;
  readonly x: RelCoord;
  readonly y: RelCoord;
  readonly width: RelCoord;
  readonly height: RelCoord;
  readonly rotation: number;
  readonly opacity: number;
};

export type TextOverlay = BaseOverlay & {
  readonly kind: "text";
  readonly text: string;
  readonly fontFamily: string;
  readonly fontSize: RelCoord;
  readonly fontWeight: number;
  readonly color: string;
  readonly align: "left" | "center" | "right";
  readonly letterSpacing: number;
};

export type StatCardOverlay = BaseOverlay & {
  readonly kind: "stat-card";
  readonly stats: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  readonly style: "minimal" | "boxed";
  readonly color: string;
  readonly fontFamily: string;
};

export type RouteOverlay = BaseOverlay & {
  readonly kind: "route";
  readonly polyline: string;
  readonly strokeColor: string;
  readonly strokeWidth: RelCoord;
  readonly showStartEnd: boolean;
};

export type DividerOverlay = BaseOverlay & {
  readonly kind: "divider";
  readonly orientation: "horizontal" | "vertical";
  readonly color: string;
  readonly thickness: RelCoord;
};

export type OverlayElement =
  | TextOverlay
  | StatCardOverlay
  | RouteOverlay
  | DividerOverlay;

export type OverlayKind = OverlayElement["kind"];
