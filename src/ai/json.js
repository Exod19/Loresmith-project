/**
 * Réparation d'un JSON tronqué : une longue réponse de l'IA peut s'arrêter au milieu d'un objet
 * quand elle atteint son plafond. On ferme la chaîne ouverte, on retire la virgule ou la clé
 * orpheline, puis on referme les tableaux et objets dans l'ordre : on garde tout ce qui est complet.
 */
export function repairJson(text) {
  const src = String(text || '');
  const start = src.indexOf('{');
  if (start === -1) return null;
  const body = src.slice(start);
  try {
    return JSON.parse(body);
  } catch {
    /* On tente la réparation ci-dessous. */
  }

  const stack = [];
  let inStr = false;
  let esc = false;
  let lastSafe = -1;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') {
      stack.pop();
      if (stack.length === 0) return tryParse(body.slice(0, i + 1));
    }
    if (!inStr && (c === ',' || c === '{' || c === '[')) lastSafe = i;
  }

  // Coupe au dernier séparateur sûr, puis referme ce qui reste ouvert.
  for (let cut = lastSafe; cut > 0; cut = body.lastIndexOf(',', cut - 1)) {
    let head = body.slice(0, body[cut] === ',' ? cut : cut + 1);
    const closers = closersFor(head);
    if (closers === null) continue;
    const parsed = tryParse(head + closers);
    if (parsed) return parsed;
  }
  return null;
}

function closersFor(text) {
  const stack = [];
  let inStr = false;
  let esc = false;
  for (const c of text) {
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') stack.pop();
  }
  if (inStr) return null;
  return stack.reverse().map((c) => (c === '{' ? '}' : ']')).join('');
}

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
