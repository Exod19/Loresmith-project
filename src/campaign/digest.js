/** Ce qui s'est passé dans les séances déjà écrites, en bref, pour la suivante. Le vécu (compte rendu) prime sur le prévu. */
export function previousDigest(campaign, beforeSession) {
  const reports = campaign.sessionReports || [];
  return (campaign.sessions || [])
    .filter((s) => s.sessionNumber < beforeSession && (s.detailed || reports.some((r) => r.sessionId === s.id)))
    .map((s) => {
      const r = reports.find((x) => x.sessionId === s.id && (x.summary || (x.consequences || []).length));
      if (r) {
        const cons = (r.consequences || []).length ? ` Conséquences : ${r.consequences.map((c) => String(c).replace(/[.\s]+$/, '')).join(' ; ')}.` : '';
        const seeds = (r.futureSeeds || []).length ? ` Pistes ouvertes : ${r.futureSeeds.map((c) => String(c).replace(/[.\s]+$/, '')).join(' ; ')}.` : '';
        return `S${s.sessionNumber} ${s.title} (JOUÉE) : ${r.summary}${cons}${seeds}`;
      }
      return `S${s.sessionNumber} ${s.title} : ${s.summary}${s.cliffhanger ? ` (fin : ${s.cliffhanger})` : ''}`;
    })
    .join('\n');
}
