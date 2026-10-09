/**
 * Target shapes are built from simple primitives in a 100 × 100 "shape space" (origin top-left,
 * y pointing down). A primitive with `cut: true` is subtracted (holes such as eyes or windows).
 * Rasterising, rendering and scoring all work from these primitives, so a new sculpture is just data.
 */
interface PrimitiveBase {
  /** Subtract instead of add. */
  cut?: boolean;
}

export type Primitive = PrimitiveBase &
  (
    | { kind: 'circle'; x: number; y: number; r: number }
    | { kind: 'ring'; x: number; y: number; r: number; inner: number }
    | { kind: 'ellipse'; x: number; y: number; rx: number; ry: number; rot?: number }
    /** Rectangle centred on (x, y), optional corner radius and rotation (radians). */
    | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number; rot?: number }
    /** Polygon given as a flat list [x0, y0, x1, y1, ...] – triangles, letters, symbols, custom outlines. */
    | { kind: 'poly'; pts: number[] }
    /** Line segment with round caps – stems, limbs, branches. */
    | { kind: 'capsule'; x1: number; y1: number; x2: number; y2: number; r: number }
    /** Point-cloud target: union of discs of radius r around each point. */
    | { kind: 'points'; pts: number[]; r: number }
  );

export interface TargetShape {
  id: string;
  name: string;
  primitives: Primitive[];
}

/** Where a shape is placed on the stage. */
export interface TargetPlacement {
  shape: string;
  /** Stage position of the shape's centre (shape-space 50, 50). */
  x: number;
  y: number;
  /** Pixels per shape unit – the shape is `100 * size` px wide. */
  size: number;
  /** Rotation in radians around the centre. */
  rotation?: number;
  /** Mirror horizontally. */
  flip?: boolean;
}
