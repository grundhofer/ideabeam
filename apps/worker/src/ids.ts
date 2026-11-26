// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// 128-bit random hex ids: admin tokens and participant ids. An admin token is a
// capability secret: whoever has the string moderates the wall, so it must be
// unguessable. (A wall's id is minted by its namespace, wall-stub.ts.)
export function generateSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time comparison for capability tokens. Uses the Workers runtime's
// timingSafeEqual; lengths are compared first since it requires equal sizes.
export function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  return crypto.subtle.timingSafeEqual(bufA, bufB);
}
