const crockfordBase32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const base = BigInt(32);
const byteShift = BigInt(8);

export function createUlid(now = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));

  return encodeTime(now) + encodeRandom(bytes);
}

function encodeTime(now: number): string {
  let value = BigInt(now);
  let output = "";

  for (let index = 0; index < 10; index += 1) {
    output = crockfordBase32[Number(value % base)] + output;
    value /= base;
  }

  return output;
}

function encodeRandom(bytes: Uint8Array): string {
  let value = BigInt(0);
  for (const byte of bytes) {
    value = (value << byteShift) | BigInt(byte);
  }

  let output = "";
  for (let index = 0; index < 16; index += 1) {
    output = crockfordBase32[Number(value % base)] + output;
    value /= base;
  }

  return output;
}
