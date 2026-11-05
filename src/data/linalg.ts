/** Small dense linear-algebra helpers (no dependencies); mirrored in simulation/pfas_sentinel_core.py. */

export type Matrix = number[][];

export function transpose(a: Matrix): Matrix {
  return a[0].map((_, j) => a.map((row) => row[j]));
}

export function matMul(a: Matrix, b: Matrix): Matrix {
  return a.map((row) => b[0].map((_, j) => row.reduce((acc, v, k) => acc + v * b[k][j], 0)));
}

export function matVec(a: Matrix, x: number[]): number[] {
  return a.map((row) => row.reduce((acc, v, k) => acc + v * x[k], 0));
}

/** Solves A x = b by Gauss-Jordan elimination with partial pivoting. */
export function solveLinearSystem(a: Matrix, b: number[]): number[] {
  const n = b.length;
  const aug = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
    }
    if (Math.abs(aug[pivot][col]) < 1e-14) throw new Error('Singular matrix');
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const div = aug[col][col];
    for (let j = col; j <= n; j++) aug[col][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = aug[r][col];
      if (f === 0) continue;
      for (let j = col; j <= n; j++) aug[r][j] -= f * aug[col][j];
    }
  }
  return aug.map((row) => row[n]);
}

export function invert(a: Matrix): Matrix {
  const n = a.length;
  const cols = Array.from({ length: n }, (_, j) =>
    solveLinearSystem(a, Array.from({ length: n }, (__, i) => (i === j ? 1 : 0)))
  );
  return transpose(cols);
}

/** Ordinary (optionally ridge-stabilised) least squares: argmin ||X beta - y||^2 + ridge ||beta||^2. */
export function leastSquares(x: Matrix, y: number[], ridge = 0): number[] {
  const xt = transpose(x);
  const xtx = matMul(xt, x).map((row, i) => row.map((v, j) => v + (i === j ? ridge : 0)));
  return solveLinearSystem(xtx, matVec(xt, y));
}

/** Determinant via LU decomposition with partial pivoting. */
export function determinant(a: Matrix): number {
  const n = a.length;
  const m = a.map((row) => [...row]);
  let det = 1;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (m[pivot][col] === 0) return 0;
    if (pivot !== col) {
      [m[col], m[pivot]] = [m[pivot], m[col]];
      det = -det;
    }
    det *= m[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / m[col][col];
      for (let j = col; j < n; j++) m[r][j] -= f * m[col][j];
    }
  }
  return det;
}

/** Eigenvalues of a symmetric matrix by the cyclic Jacobi method (ascending order). */
export function symmetricEigenvalues(a: Matrix, sweeps = 60): number[] {
  const n = a.length;
  const m = a.map((row) => [...row]);
  for (let s = 0; s < sweeps; s++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += m[p][q] * m[p][q];
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(m[p][q]) < 1e-300) continue;
        const theta = (m[q][q] - m[p][p]) / (2 * m[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const sn = t * c;
        for (let k = 0; k < n; k++) {
          const mkp = m[k][p];
          const mkq = m[k][q];
          m[k][p] = c * mkp - sn * mkq;
          m[k][q] = sn * mkp + c * mkq;
        }
        for (let k = 0; k < n; k++) {
          const mpk = m[p][k];
          const mqk = m[q][k];
          m[p][k] = c * mpk - sn * mqk;
          m[q][k] = sn * mpk + c * mqk;
        }
      }
    }
  }
  return m.map((row, i) => row[i]).sort((x, y) => x - y);
}

/** Spectral (2-norm) condition number: ratio of largest to smallest singular value. */
export function conditionNumber2(a: Matrix): number {
  const eig = symmetricEigenvalues(matMul(transpose(a), a));
  return Math.sqrt(eig[eig.length - 1] / Math.max(eig[0], 1e-300));
}
