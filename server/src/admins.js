/**
 * Administrateurs de l'application : ils seuls changent ce qui vaut pour tout le monde (étiquettes de la Banque
 * Loresmith). Liste d'adresses dans la variable `ADMIN_EMAILS` du projet Pages (séparées par des virgules) ; à défaut,
 * le compte du propriétaire du projet.
 */
const DEFAULT_ADMINS = 'sam@groupeadjuvant.ca';

export function isAdminEmail(env, email) {
  if (!email) return false;
  const list = String(env?.ADMIN_EMAILS ?? DEFAULT_ADMINS).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(String(email).trim().toLowerCase());
}
