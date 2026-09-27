// Seeded randomness. Each draw is keyed by seed + turn + purpose, so the same seed and the same
// decisions always produce the same world reactions, regardless of call order.

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFor(seed: string, turn: number, purpose: string): () => number {
  return mulberry32(hashString(`${seed}:${turn}:${purpose}`));
}

/** Weighted choice. Items with zero or negative weight are never picked. */
export function weightedPick<T>(items: { item: T; weight: number }[], random: () => number): T {
  const valid = items.filter((i) => i.weight > 0);
  const total = valid.reduce((s, i) => s + i.weight, 0);
  let r = random() * total;
  for (const i of valid) {
    r -= i.weight;
    if (r <= 0) return i.item;
  }
  return valid[valid.length - 1].item;
}

export function newSeed(): string {
  const words = ["delta", "monsoon", "harbor", "copper", "summit", "river", "atlas", "ember", "cedar", "orbit", "quartz", "tide"];
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `${words[Math.floor(Math.random() * words.length)]}-${n}`;
}
