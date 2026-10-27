// Voix ElevenLabs par personnage : race, genre et personnalité déduits de la fiche PNJ.
// Chaque personnage garde la même voix (choix stable à partir de son nom).

const API = 'https://api.elevenlabs.io/v1';
const MODEL_ID = 'eleven_multilingual_v2';

const VOICE_IDS = {
  George: 'JBFqnCBsd6RMkjVDRZzb',
  Callum: 'N2lVS1w4EtoT3dr4eOWO',
  Harry: 'SOYHLrjzK2X1ezoPC6cr',
  Bill: 'pqHfZKP75CvOlQylNhV4',
  Lily: 'pFZP5JQG7iQjIQuC4Bku',
  Alice: 'Xb7hH8MSUJpSbSDYk0k2',
  Daniel: 'onwK4e9ZLuTAKqWW03F9',
  Sarah: 'EXAVITQu4vr4xnSDxMaL',
  Laura: 'FGY2WhTYpPnrIDTdsKH5',
  Adam: 'pNInz6obpgDQGcFmaJgB',
  Brian: 'nPczCjzI2devNBz1zQrb',
  Jessica: 'cgSgspJ2msm6clMCkdW9',
  Matilda: 'XrExE9yKIg1WjnnlVkGX',
  Chris: 'iP95p4xoKVk53GoZ742B',
  Will: 'bIHbv24MWmeRgasZH58o',
  Eric: 'cjVigY5qzO86Huf0OWal',
};

// Race → pool de voix (plusieurs par genre : le hash du nom choisit, pour que deux PNJ ne sonnent pas pareil).
const RACES = [
  { match: /elf|elfe|elfique|drow/i, male: ['Daniel', 'George'], female: ['Lily', 'Alice'] },
  { match: /nain|naine|dwarf|dwarv/i, male: ['Harry', 'Bill'], female: ['Sarah', 'Matilda'] },
  { match: /orc|ogre|gobours|troll|brute/i, male: ['Adam', 'Harry'], female: ['Sarah', 'Adam'] },
  { match: /gobelin|kobold|gnome|halfelin|halfling|lutin|petit/i, male: ['Callum', 'Will'], female: ['Laura', 'Jessica'] },
  { match: /tiefelin|tieffelin|tiefling|démon|demon|diable/i, male: ['Brian', 'Eric'], female: ['Jessica', 'Laura'] },
  { match: /ancien|dragon|sage|liche|spectre|fantôme|aberration/i, male: ['Bill', 'Brian'], female: ['Matilda', 'Lily'] },
];
const HUMAN = { male: ['George', 'Chris', 'Daniel'], female: ['Alice', 'Matilda', 'Lily'] };

const FEMALE_WORDS = /\b(femme|dame|reine|sorcière|fille|elle|mère|tante|sœur|épouse|naine|gobeline|prêtresse|marchande|vieille|matrone)\b/i;
const MALE_WORDS = /\b(homme|roi|seigneur|garçon|fils|père|oncle|frère|époux|chef|guerrier|vieux)\b/i;

// Personnalité → réglages de voix (stabilité basse = voix plus vivante, expressive = plus de style).
const PERSONALITIES = [
  { match: /nerveu|hésita|peureu|craintif|anxieu|timide|bégay/i, stability: 0.3, style: 0.45 },
  { match: /colér|brutal|fier|agressi|furieu|dominant|hargneu/i, stability: 0.4, style: 0.6 },
  { match: /calme|sage|grave|lent|posé|solennel|serein|mystérieu/i, stability: 0.8, style: 0.15 },
  { match: /malin|ironi|rusé|trickster|sarcast|espiègle|opportun|manipul/i, stability: 0.35, style: 0.7 },
  { match: /chaleur|chaleureu|bienveill|gentil|amical|doux|jovial/i, stability: 0.6, style: 0.3 },
];
const DEFAULT_TONE = { stability: 0.55, style: 0.35 };

function hashStr(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Texte de la fiche PNJ, utilisé pour deviner race, genre et personnalité. */
function sheetText(npc) {
  return [npc.kind, npc.role, npc.description, npc.voice, npc.motivation, npc.attitude, npc.note]
    .filter(Boolean)
    .join(' ');
}

function guessGender(npc, text) {
  if (npc.gender === 'male' || npc.gender === 'female') return npc.gender;
  if (FEMALE_WORDS.test(text)) return 'female';
  if (MALE_WORDS.test(text)) return 'male';
  return hashStr(npc.name || '') % 2 ? 'female' : 'male';
}

/**
 * Profil de voix d'un PNJ : { voiceName, voiceId, settings }.
 * `npc` : { name, kind, role, description, voice, motivation, attitude, gender? }
 */
export function voiceProfileFor(npc) {
  const text = sheetText(npc);
  const gender = guessGender(npc, text);
  const race = RACES.find((r) => r.match.test(text));
  const pool = race ? race[gender] : HUMAN[gender];
  const voiceName = pool[hashStr(npc.name || '') % pool.length];

  const tone = PERSONALITIES.find((p) => p.match.test(text)) || DEFAULT_TONE;

  return {
    voiceName,
    voiceId: VOICE_IDS[voiceName],
    settings: {
      stability: tone.stability,
      similarity_boost: 0.8,
      style: tone.style,
      use_speaker_boost: true,
    },
  };
}

/** Retire les indications de jeu entre crochets et les marqueurs Markdown avant lecture. */
export function cleanForSpeech(text) {
  return String(text)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[*_#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Transforme une réplique en audio (Blob MP3). */
export async function synthesizeSpeech(text, profile, apiKey) {
  if (!apiKey) throw new Error('Clé ElevenLabs manquante (Réglages).');
  const clean = cleanForSpeech(text);
  if (!clean) throw new Error('Rien à lire.');

  const res = await fetch(`${API}/text-to-speech/${profile.voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
    body: JSON.stringify({ text: clean, model_id: MODEL_ID, voice_settings: profile.settings }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}${detail ? ' — ' + detail.slice(0, 160) : ''}`);
  }
  return res.blob();
}
