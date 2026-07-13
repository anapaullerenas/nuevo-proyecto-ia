const ACCESS_EXCEPTION_EMAILS = new Set([
  "lalocmtz@gmail.com",
  "anapaulopezlle@gmail.com",
]);

export function isAccessException(email: string) {
  return ACCESS_EXCEPTION_EMAILS.has(email.trim().toLowerCase());
}

export function hasUnlimitedAccessEmail(email: string | null | undefined) {
  return Boolean(email && ACCESS_EXCEPTION_EMAILS.has(email.trim().toLowerCase()));
}
