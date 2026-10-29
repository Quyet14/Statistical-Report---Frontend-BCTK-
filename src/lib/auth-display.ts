export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  return `${name.length > 1 ? name.slice(0, Math.min(2, name.length - 1)) : ""}***@${domain}`;
}
