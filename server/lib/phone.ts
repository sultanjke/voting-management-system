export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `+7${digits.slice(-10)}`;
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function normalizeHouseCode(input: string): string {
  return input.trim().toUpperCase();
}
