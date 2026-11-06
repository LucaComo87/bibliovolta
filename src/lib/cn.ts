/** Unisce classi CSS ignorando i valori falsi. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
