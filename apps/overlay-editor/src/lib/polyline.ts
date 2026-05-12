// Google-encoded polyline → array of [lat, lng]. Strava uses the standard
// Google algorithm. The library handles the bit-shifting; we just wrap it
// to return an empty array on bad input so the route overlay can render
// "no route" gracefully instead of crashing the canvas.
import polyline from "@mapbox/polyline";

export type LatLng = readonly [number, number];

export const decodePolyline = (encoded: string): ReadonlyArray<LatLng> => {
  if (!encoded) return [];
  try {
    return polyline.decode(encoded) as ReadonlyArray<LatLng>;
  } catch {
    return [];
  }
};

// A short, recognisable sample route used by "Add Route" in Phase 3 before
// real Strava polylines arrive in Phase 5. This is the canonical example
// from Google's polyline-algorithm docs — three points in California.
export const SAMPLE_POLYLINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
