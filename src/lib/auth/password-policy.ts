/** Regole per le password dei docenti (verificate sul server). */
export const PASSWORD_MIN_LENGTH = 10;

export function passwordProblems(password: string, opts: { email: string; initialPassword?: string }): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push(`almeno ${PASSWORD_MIN_LENGTH} caratteri`);
  if (password.length > 72) problems.push("al massimo 72 caratteri");
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) problems.push("almeno una lettera e un numero");
  const lower = password.toLowerCase();
  if (opts.initialPassword && lower === opts.initialPassword.toLowerCase()) problems.push("diversa dalla password iniziale");
  const local = opts.email.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) problems.push("senza il tuo nome utente");
  return problems;
}
