/**
 * Marque un texte à traduire défini hors d'un composant (listes, statuts).
 * Ne traduit rien : la traduction se fait à l'affichage avec t(texte).
 * Le script `npm run i18n:check` repère ces textes.
 */
export function msg(text: string): string {
  return text;
}
