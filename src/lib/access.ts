// The optional access code of a hosted copy, sent by the browser as HTTP Basic credentials.
// The user name is ignored, the password is the code.
export function accessAllowed(authorization: string | null, code: string | undefined): boolean {
  if (!code) return true;
  if (!authorization?.startsWith("Basic ")) return false;
  try {
    const [, ...password] = atob(authorization.slice(6)).split(":");
    return password.join(":") === code;
  } catch {
    return false;
  }
}
