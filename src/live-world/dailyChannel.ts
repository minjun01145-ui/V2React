/** A live channel per calendar day, so claims, events and boards from earlier days never pile up. */
export function dailyChannelId(prefix: string, now = new Date()): string {
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `${prefix}-${day}`;
}
