import { DIR_DX, DIR_DY } from './catalog';
import { doorCells, idx, inBounds } from './grid';
import type { Board, FlowInfo } from './types';

function bfs(board: Board, empty: Uint8Array, starts: number[]): Int32Array {
  const dist = new Int32Array(board.cols * board.rows).fill(-1);
  const queue: number[] = [];
  for (const s of starts) {
    if (empty[s]) {
      dist[s] = 0;
      queue.push(s);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const cx = cur % board.cols;
    const cy = Math.floor(cur / board.cols);
    for (let d = 0; d < 4; d++) {
      const nx = cx + DIR_DX[d];
      const ny = cy + DIR_DY[d];
      if (!inBounds(board, nx, ny)) continue;
      const ni = idx(board, nx, ny);
      if (!empty[ni] || dist[ni] !== -1) continue;
      dist[ni] = dist[cur] + 1;
      queue.push(ni);
    }
  }
  return dist;
}

/** 可达性 + 主动线（门 → 最远空地的所有最短路径格子） */
export function computeFlow(board: Board, occ: Int32Array): FlowInfo {
  const n = board.cols * board.rows;
  const empty = new Uint8Array(n);
  for (let i = 0; i < n; i++) empty[i] = occ[i] === -1 ? 1 : 0;
  const starts = doorCells(board).map((c) => idx(board, c.x, c.y));
  const dist = bfs(board, empty, starts);

  const unreachable: number[] = [];
  let far = -1;
  let farDist = -1;
  for (let i = 0; i < n; i++) {
    if (!empty[i]) continue;
    if (dist[i] === -1) unreachable.push(i);
    else if (dist[i] > farDist) {
      farDist = dist[i];
      far = i;
    }
  }

  const mainPath = new Uint8Array(n);
  if (far >= 0 && farDist > 0) {
    const back = bfs(board, empty, [far]);
    for (let i = 0; i < n; i++) {
      if (dist[i] >= 0 && back[i] >= 0 && dist[i] + back[i] === farDist) mainPath[i] = 1;
    }
  }
  return { empty, dist, mainPath, unreachable };
}

/** 某格 4 邻域是否触及主动线 */
export function touchesMainPath(board: Board, flow: FlowInfo, x: number, y: number) {
  for (let d = 0; d < 4; d++) {
    const nx = x + DIR_DX[d];
    const ny = y + DIR_DY[d];
    if (inBounds(board, nx, ny) && flow.mainPath[idx(board, nx, ny)]) return true;
  }
  return false;
}
