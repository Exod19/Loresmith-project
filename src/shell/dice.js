// Parseur de jets : « 2d6+3 », « 1d20 + 1d4 - 1 », « 2d20kh1 » (avantage), « 4d6kh3 ».
const TERM = /([+-]?)\s*(?:(\d*)d(\d+|%)(?:(kh|kl)(\d+))?|(\d+))/gi;

function rand(sides) {
  if (window.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return (buf[0] % sides) + 1;
  }
  return Math.floor(Math.random() * sides) + 1;
}

export function rollExpression(raw) {
  const expr = String(raw || '').replace(/\s+/g, '').toLowerCase();
  if (!expr) throw new Error('Expression vide.');
  let total = 0;
  let consumed = 0;
  const parts = [];
  TERM.lastIndex = 0;
  let m;
  while ((m = TERM.exec(expr))) {
    if (m.index !== consumed) break;
    consumed = TERM.lastIndex;
    const sign = m[1] === '-' ? -1 : 1;
    if (m[6]) {
      const n = Number(m[6]);
      total += sign * n;
      parts.push({ sign, flat: n });
      continue;
    }
    const count = Math.min(Number(m[2] || 1), 100);
    const sides = m[3] === '%' ? 100 : Number(m[3]);
    if (!count || !sides || sides > 1000) throw new Error('Dé invalide.');
    const rolls = Array.from({ length: count }, () => rand(sides));
    let kept = rolls.map((v, i) => i);
    if (m[4]) {
      const k = Math.min(Number(m[5] || 1), count);
      const order = rolls
        .map((v, i) => [v, i])
        .sort((a, b) => (m[4] === 'kh' ? b[0] - a[0] : a[0] - b[0]));
      kept = order.slice(0, k).map(([, i]) => i);
    }
    const sum = kept.reduce((acc, i) => acc + rolls[i], 0);
    total += sign * sum;
    parts.push({ sign, count, sides, rolls, kept, keep: m[4] ? m[4] + (m[5] || 1) : '' });
  }
  if (consumed !== expr.length || !parts.length) {
    throw new Error('Format attendu : 2d6+3, 1d20+1d4, 2d20kh1…');
  }
  return { expr, total, parts, detail: describe(parts) };
}

function describe(parts) {
  return parts
    .map((p, i) => {
      const s = p.sign < 0 ? '− ' : i ? '+ ' : '';
      if (p.flat !== undefined) return s + p.flat;
      const dice = p.rolls
        .map((v, idx) => (p.kept.includes(idx) ? String(v) : `~${v}~`))
        .join(', ');
      return `${s}[${dice}]`;
    })
    .join(' ');
}

// Une seule face d20 « naturelle » : utile pour signaler critiques et échecs critiques.
export function naturalD20(result) {
  const d = result.parts.filter((p) => p.sides === 20 && p.flat === undefined);
  if (d.length !== 1) return null;
  const keptVals = d[0].kept.map((i) => d[0].rolls[i]);
  return keptVals.length === 1 ? keptVals[0] : null;
}
