/**
 * Accès à l'IA configurée dans Réglages (fournisseur compatible OpenAI, clé de l'utilisateur).
 * Même stockage que la couche IA de l'application : rien n'est envoyé sans clé.
 */
const AI_KEY = 'loresmith:ai:v1';
const DEFAULT_MODEL: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  openrouter: 'meta-llama/llama-4-maverick:free',
  groq: 'openai/gpt-oss-120b',
  openai: 'gpt-4o-mini',
};

type AIConfig = { provider?: string; baseUrl?: string; model?: string; apiKey?: string };

function config(): AIConfig | null {
  try {
    const raw = localStorage.getItem(AI_KEY);
    return raw ? (JSON.parse(raw) as AIConfig) : null;
  } catch {
    return null;
  }
}

/** Vrai si une clé d'IA est enregistrée dans Réglages. */
export const aiReady = () => !!config()?.apiKey;

/** Pose une question à l'IA et renvoie sa réponse en texte. */
export async function askAI(system: string, user: string, opts: { json?: boolean } = {}): Promise<string> {
  const ai = config();
  if (!ai?.apiKey) throw new Error('Configure l’IA dans Réglages (clé API manquante).');
  const model = (ai.model || '').trim() || DEFAULT_MODEL[ai.provider ?? ''];
  if (!model || !ai.baseUrl) throw new Error('Indique le fournisseur et le modèle dans Réglages.');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` };
  if (ai.provider === 'openrouter') { headers['HTTP-Referer'] = 'https://loresmith.local'; headers['X-Title'] = 'Loresmith'; }
  const res = await fetch(`${ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: opts.json ? `${user}\n\nRéponds UNIQUEMENT en JSON valide, sans Markdown.` : user },
      ],
      temperature: opts.json ? 0.3 : 0.75,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) throw new Error(`L’IA a répondu ${res.status}. Vérifie la clé et le modèle dans Réglages.`);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new Error('Réponse vide de l’IA.');
  return text.trim();
}

/** Extrait le premier objet JSON d'une réponse (tolère un bloc de code autour). */
export function parseJson<T>(text: string): T | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}
