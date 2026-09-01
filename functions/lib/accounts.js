function cleanText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

const reservedUsernames = new Set(["admin", "administrator", "fqc", "officer", "president", "support", "treasurer"]);

export function usernameForInput(value) {
  const username = cleanText(value, 24).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])$/.test(username)) return "";
  return reservedUsernames.has(username) ? "" : username;
}

export function usernameForSignupEmail(email) {
  const value = cleanText(email, 180).toLowerCase();
  if (!/^[^\s@]+@ufl\.edu$/.test(value)) return "";
  return usernameForInput(value.split("@")[0]);
}

export function automaticUsernameCandidates(value, count = 50) {
  const base = usernameForInput(value);
  if (!base) return [];
  const candidates = [base];
  for (let suffix = 2; suffix <= Math.max(2, Math.min(100, Number(count) || 50)); suffix += 1) {
    const suffixText = `.${suffix}`;
    const stem = base.slice(0, 24 - suffixText.length).replace(/[._]+$/g, "");
    const candidate = usernameForInput(`${stem}${suffixText}`);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}
