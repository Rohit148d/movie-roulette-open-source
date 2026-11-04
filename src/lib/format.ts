export function formatRuntime(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return "Runtime unknown";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

export function formatVotes(votes: number): string {
  if (votes >= 1_000_000) return `${(votes / 1_000_000).toFixed(1).replace(/\.0$/, "")}M votes`;
  if (votes >= 1_000) return `${(votes / 1_000).toFixed(1).replace(/\.0$/, "")}K votes`;
  return `${votes.toLocaleString("en-US")} votes`;
}

export function formatScore(score: number): string {
  return Number.isFinite(score) ? score.toFixed(1) : "—";
}

export function formatYear(year: number | null): string {
  return year ? String(year) : "Year unknown";
}

export function reelNumber(index: number): string {
  return String(Math.max(1, index)).padStart(2, "0");
}
