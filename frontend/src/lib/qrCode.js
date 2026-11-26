// Minimal QR encoder for fixed-length EventSphere ticket codes (QR version 1-L).
// Version 1-L supports up to 17 ASCII bytes, enough for ES- plus 10 hex digits.
const SIZE = 21;
const DATA_CODEWORDS = 19;
const ECC_CODEWORDS = 7;

const gfMultiply = (x, y) => {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
};

const reedSolomonDivisor = (degree) => {
  let result = [1];
  let root = 1;
  for (let i = 0; i < degree; i++) {
    const next = Array(result.length + 1).fill(0);
    result.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMultiply(coefficient, root);
    });
    result = next;
    root = gfMultiply(root, 2);
  }
  return result;
};

const reedSolomonRemainder = (data, divisor) => {
  const result = Array(divisor.length - 1).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    for (let i = 0; i < result.length; i++) result[i] ^= gfMultiply(divisor[i + 1], factor);
  }
  return result;
};

const appendBits = (target, value, length) => {
  for (let i = length - 1; i >= 0; i--) target.push((value >>> i) & 1);
};

const makeCodewords = (value) => {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 17 || bytes.some((byte) => byte > 0x7f)) {
    throw new Error('Ticket QR supports ASCII values up to 17 characters.');
  }
  const bits = [];
  appendBits(bits, 0b0100, 4); // byte mode
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  const capacity = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0; data.length < DATA_CODEWORDS; pad++) data.push(pad % 2 === 0 ? 0xec : 0x11);
  return [...data, ...reedSolomonRemainder(data, reedSolomonDivisor(ECC_CODEWORDS))];
};

const makeMatrix = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

const drawFinder = (matrix, left, top) => {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = left + dx;
      const y = top + dy;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark = inside && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      matrix[y][x] = dark;
    }
  }
};

const drawFunctionPatterns = (matrix) => {
  drawFinder(matrix, 0, 0);
  drawFinder(matrix, SIZE - 7, 0);
  drawFinder(matrix, 0, SIZE - 7);
  for (let i = 8; i < SIZE - 8; i++) {
    const dark = i % 2 === 0;
    if (matrix[6][i] === null) matrix[6][i] = dark;
    if (matrix[i][6] === null) matrix[i][6] = dark;
  }
  // Reserve the two format-information areas and the fixed dark module.
  for (let i = 0; i <= 5; i++) matrix[i][8] = false;
  matrix[7][8] = false;
  matrix[8][8] = false;
  matrix[8][7] = false;
  for (let i = 9; i < 15; i++) matrix[8][14 - i] = false;
  for (let i = 0; i < 8; i++) matrix[8][SIZE - 1 - i] = false;
  for (let i = 8; i < 15; i++) matrix[SIZE - 15 + i][8] = false;
  matrix[SIZE - 8][8] = true;
};

const formatBits = () => {
  const data = 0b01000; // error correction level L, mask pattern 0
  let remainder = data;
  for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  return ((data << 10) | remainder) ^ 0x5412;
};

const drawFormatBits = (matrix) => {
  const bits = formatBits();
  const bit = (i) => ((bits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) matrix[i][8] = bit(i);
  matrix[7][8] = bit(6);
  matrix[8][8] = bit(7);
  matrix[8][7] = bit(8);
  for (let i = 9; i < 15; i++) matrix[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) matrix[8][SIZE - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) matrix[SIZE - 15 + i][8] = bit(i);
  matrix[SIZE - 8][8] = true;
};

export function encodeTicketQr(value) {
  const matrix = makeMatrix();
  drawFunctionPatterns(matrix);
  const codewords = makeCodewords(String(value));
  const dataBits = codewords.flatMap((byte) => Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1));
  let bitIndex = 0;
  let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < SIZE; vertical++) {
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset++) {
        const x = right - offset;
        if (matrix[y][x] !== null) continue;
        let dark = bitIndex < dataBits.length ? dataBits[bitIndex++] === 1 : false;
        if ((x + y) % 2 === 0) dark = !dark; // mask pattern 0
        matrix[y][x] = dark;
      }
    }
    upward = !upward;
  }
  drawFormatBits(matrix);
  return matrix;
}
