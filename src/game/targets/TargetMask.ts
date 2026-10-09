import type { TargetPlacement } from './TargetDefinition';
import { placementsContain } from './TargetShapes';

/** Far-away distance used for samples outside the mask grid. */
const FAR = 10000;

/**
 * Rasterised target: an inside/outside grid plus a signed distance field (negative inside) and its
 * gradient. The particle simulation samples it every step (catching / containing particles) and the
 * score calculator uses its coverage cells.
 *
 * `offsetX/offsetY` shift the whole mask at runtime – used by moving targets.
 */
export class TargetMask {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly inside: Uint8Array;
  readonly sdf: Float32Array;
  readonly gradX: Float32Array;
  readonly gradY: Float32Array;
  /** Target area in px². */
  readonly area: number;
  readonly bounds: { minX: number; minY: number; maxX: number; maxY: number };
  readonly centroidX: number;
  readonly centroidY: number;
  offsetX = 0;
  offsetY = 0;

  // Coverage grid (see ScoreCalculator).
  coverageCell = 0;
  coverageCols = 0;
  coverageRows = 0;
  /** 1 where the coverage cell centre lies inside the target. */
  coverageTarget = new Uint8Array(0);
  coverageTargetCount = 0;
  /** Stamps used to mark covered cells without clearing the array each measurement. */
  coverageStamp = new Uint32Array(0);
  /** Stamp of the latest measurement: a target cell is covered when coverageStamp[k] === coverageStampId. */
  coverageStampId = 0;

  constructor(
    readonly placements: readonly TargetPlacement[],
    readonly width: number,
    readonly height: number,
    cell = 6,
  ) {
    this.cell = cell;
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(height / cell);
    const n = this.cols * this.rows;
    this.inside = new Uint8Array(n);
    let count = 0;
    let sx = 0;
    let sy = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let r = 0; r < this.rows; r++) {
      const y = (r + 0.5) * cell;
      for (let c = 0; c < this.cols; c++) {
        const x = (c + 0.5) * cell;
        if (placementsContain(placements, x, y)) {
          this.inside[r * this.cols + c] = 1;
          count++;
          sx += x;
          sy += y;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    this.area = count * cell * cell;
    this.centroidX = count ? sx / count : width / 2;
    this.centroidY = count ? sy / count : height / 2;
    this.bounds = count ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    // Signed distance: distance to the nearest outside cell (inside) / nearest inside cell (outside).
    const toInside = squaredEdt(this.inside, this.cols, this.rows, 1);
    const toOutside = squaredEdt(this.inside, this.cols, this.rows, 0);
    this.sdf = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.sdf[i] = this.inside[i] ? -(Math.sqrt(toOutside[i]) - 0.5) * cell : (Math.sqrt(toInside[i]) - 0.5) * cell;
    }
    // Normalised gradient (points outwards, towards increasing distance).
    this.gradX = new Float32Array(n);
    this.gradY = new Float32Array(n);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        const gx = this.sdf[r * this.cols + Math.min(c + 1, this.cols - 1)] - this.sdf[r * this.cols + Math.max(c - 1, 0)];
        const gy = this.sdf[Math.min(r + 1, this.rows - 1) * this.cols + c] - this.sdf[Math.max(r - 1, 0) * this.cols + c];
        const len = Math.hypot(gx, gy);
        if (len > 1e-6) {
          this.gradX[i] = gx / len;
          this.gradY[i] = gy / len;
        }
      }
    }
  }

  private index(x: number, y: number): number {
    const c = Math.floor((x - this.offsetX) / this.cell);
    const r = Math.floor((y - this.offsetY) / this.cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  /** Signed distance in px (negative inside the target). */
  signedDistance(x: number, y: number): number {
    const i = this.index(x, y);
    return i < 0 ? FAR : this.sdf[i];
  }

  contains(x: number, y: number): boolean {
    const i = this.index(x, y);
    return i >= 0 && this.inside[i] === 1;
  }

  /** Writes [signedDistance, gradX, gradY] into `out`. */
  sample(x: number, y: number, out: Float64Array | number[]): void {
    const i = this.index(x, y);
    if (i < 0) {
      out[0] = FAR;
      out[1] = 0;
      out[2] = 0;
      return;
    }
    out[0] = this.sdf[i];
    out[1] = this.gradX[i];
    out[2] = this.gradY[i];
  }

  /**
   * Prepares the coverage grid. A cell counts as part of the target when its centre is inside.
   * Cells are slightly larger than the particle spacing so an evenly filled target covers every cell.
   */
  buildCoverage(cellSize: number): void {
    this.coverageCell = cellSize;
    this.coverageCols = Math.ceil(this.width / cellSize);
    this.coverageRows = Math.ceil(this.height / cellSize);
    const n = this.coverageCols * this.coverageRows;
    this.coverageTarget = new Uint8Array(n);
    this.coverageStamp = new Uint32Array(n);
    this.coverageStampId = 0;
    let count = 0;
    for (let r = 0; r < this.coverageRows; r++) {
      for (let c = 0; c < this.coverageCols; c++) {
        const x = (c + 0.5) * cellSize;
        const y = (r + 0.5) * cellSize;
        const mc = Math.floor(x / this.cell);
        const mr = Math.floor(y / this.cell);
        if (mc < this.cols && mr < this.rows && this.inside[mr * this.cols + mc]) {
          this.coverageTarget[r * this.coverageCols + c] = 1;
          count++;
        }
      }
    }
    this.coverageTargetCount = count;
  }

  /** Centres of all target coverage cells (stage space, without offset). Used by hints and previews. */
  coverageCenters(): number[] {
    const pts: number[] = [];
    for (let r = 0; r < this.coverageRows; r++) {
      for (let c = 0; c < this.coverageCols; c++) {
        if (this.coverageTarget[r * this.coverageCols + c]) pts.push((c + 0.5) * this.coverageCell, (r + 0.5) * this.coverageCell);
      }
    }
    return pts;
  }
}

/**
 * Exact squared Euclidean distance transform (Felzenszwalb & Huttenlocher) measured in cells:
 * for every cell, the squared distance to the nearest cell whose value equals `feature`.
 */
export function squaredEdt(grid: Uint8Array, cols: number, rows: number, feature: number): Float32Array {
  const INF = 1e12;
  const out = new Float32Array(cols * rows);
  for (let i = 0; i < out.length; i++) out[i] = grid[i] === feature ? 0 : INF;
  const size = Math.max(cols, rows);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  const pass = (n: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
  };
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) f[r] = out[r * cols + c];
    pass(rows);
    for (let r = 0; r < rows; r++) out[r * cols + c] = d[r];
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) f[c] = out[r * cols + c];
    pass(cols);
    for (let c = 0; c < cols; c++) out[r * cols + c] = d[c];
  }
  return out;
}
