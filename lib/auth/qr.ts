import "server-only";

const BLOCKS: [number, ...[number, number][]][] = [
  [10, [1, 16]],
  [16, [1, 28]],
  [26, [1, 44]],
  [18, [2, 32]],
  [24, [2, 43]],
  [16, [4, 27]],
  [18, [4, 31]],
  [22, [2, 38], [2, 39]],
  [22, [3, 36], [2, 37]],
  [26, [4, 43], [1, 44]],
  [30, [1, 50], [4, 51]],
  [22, [6, 36], [2, 37]],
  [22, [8, 37], [1, 38]],
  [24, [4, 40], [5, 41]],
  [24, [5, 41], [5, 42]],
];
const ALIGN: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
];

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: number[], degree: number): number[] {
  const gen = rsGenerator(degree);
  const rem = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem.shift()!;
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
}

function codewords(bytes: Uint8Array): { version: number; words: number[] } {
  for (let v = 1; v <= BLOCKS.length; v++) {
    const [, ...groups] = BLOCKS[v - 1];
    const capacity = groups.reduce((s, [n, d]) => s + n * d, 0);
    const countBits = v < 10 ? 8 : 16;
    const needed = 4 + countBits + bytes.length * 8;
    if (needed > capacity * 8) continue;

    const bits: number[] = [];
    const put = (value: number, length: number) => {
      for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    };
    put(0b0100, 4);
    put(bytes.length, countBits);
    for (const b of bytes) put(b, 8);
    put(0, Math.min(4, capacity * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data: number[] = [];
    for (let i = 0; i < bits.length; i += 8)
      data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11)
      data.push(pad);
    return { version: v, words: interleave(v, data) };
  }
  throw new Error("Too long for a QR code");
}

function interleave(version: number, data: number[]): number[] {
  const [ecLen, ...groups] = BLOCKS[version - 1];
  const blocks: number[][] = [];
  let at = 0;
  for (const [count, len] of groups)
    for (let i = 0; i < count; i++) {
      blocks.push(data.slice(at, at + len));
      at += len;
    }
  const ecs = blocks.map((b) => rsRemainder(b, ecLen));
  const out: number[] = [];
  const longest = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < longest; i++)
    for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecLen; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

type Grid = { size: number; dark: boolean[][]; fixed: boolean[][] };

function baseGrid(version: number): Grid {
  const size = version * 4 + 17;
  const dark = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const fixed = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const set = (x: number, y: number, on: boolean) => {
    dark[y][x] = on;
    fixed[y][x] = true;
  };

  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }

  for (let i = 8; i < size - 8; i++) {
    set(i, 6, i % 2 === 0);
    set(6, i, i % 2 === 0);
  }

  const pos = ALIGN[version - 1];
  const last = pos.length - 1;
  pos.forEach((ay, i) =>
    pos.forEach((ax, j) => {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === last) ||
        (i === last && j === 0)
      )
        return;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );

  for (let i = 0; i < 9; i++) {
    if (!fixed[8][i]) set(i, 8, false);
    if (!fixed[i][8]) set(8, i, false);
  }
  for (let i = 0; i < 8; i++) {
    set(size - 1 - i, 8, false);
    set(8, size - 1 - i, false);
  }
  set(8, size - 8, true);

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const on = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, on);
      set(b, a, on);
    }
  }
  return { size, dark, fixed };
}

function placeData(grid: Grid, words: number[]) {
  const { size, dark, fixed } = grid;
  let bit = 0;
  const total = words.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (fixed[y][x]) continue;
        if (bit < total)
          dark[y][x] = ((words[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
        bit++;
      }
  }
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function withMask(grid: Grid, mask: number): boolean[][] {
  const { size, fixed } = grid;
  const dark = grid.dark.map((row) => row.slice());
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (!fixed[y][x] && MASKS[mask](x, y)) dark[y][x] = !dark[y][x];

  // format information: level M (00) and the mask
  const data = mask; // (0b00 << 3) | mask
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const on = (i: number) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) dark[i][8] = on(i);
  dark[7][8] = on(6);
  dark[8][8] = on(7);
  dark[8][7] = on(8);
  for (let i = 9; i < 15; i++) dark[8][14 - i] = on(i);
  for (let i = 0; i < 8; i++) dark[8][size - 1 - i] = on(i);
  for (let i = 8; i < 15; i++) dark[size - 15 + i][8] = on(i);
  dark[size - 8][8] = true;
  return dark;
}

function penalty(dark: boolean[][]): number {
  const size = dark.length;
  let score = 0;
  const lines = (get: (a: number, b: number) => boolean) => {
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b <= size; b++) {
        if (b < size && get(a, b) === get(a, b - 1)) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      for (let b = 0; b + 10 < size; b++) {
        const s = Array.from({ length: 11 }, (_, k) => get(a, b + k));
        const p = "10111010000";
        const str = s.map((v) => (v ? "1" : "0")).join("");
        if (str === p || str === [...p].reverse().join("")) score += 40;
      }
    }
  };
  lines((y, x) => dark[y][x]);
  lines((x, y) => dark[y][x]);
  let darkCount = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (dark[y][x]) darkCount++;
      if (
        x + 1 < size &&
        y + 1 < size &&
        dark[y][x] === dark[y][x + 1] &&
        dark[y][x] === dark[y + 1][x] &&
        dark[y][x] === dark[y + 1][x + 1]
      )
        score += 3;
    }
  score += Math.floor(Math.abs((darkCount * 20) / (size * size) - 10)) * 10;
  return score;
}

export function qrMatrix(text: string): boolean[][] {
  const { version, words } = codewords(new TextEncoder().encode(text));
  const grid = baseGrid(version);
  placeData(grid, words);
  let best: boolean[][] = [];
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const candidate = withMask(grid, m);
    const s = penalty(candidate);
    if (s < bestScore) {
      bestScore = s;
      best = candidate;
    }
  }
  return best;
}

export function qrSvg(
  text: string,
  { dark = "#0b0b12", light = "#ffffff" } = {},
) {
  const m = qrMatrix(text);
  const q = 4;
  const size = m.length + q * 2;
  let d = "";
  m.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) d += `M${x + q} ${y + q}h1v1h-1z`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${size}" height="${size}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
