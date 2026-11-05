// The entries-open date, read from DATES.entriesOpen in src/site.ts so tests never
// carry a typed copy. (site.ts uses import.meta.env, so it is read as text, not imported.)
// Same wording as formatDate() / formatDateDay() in src/site.ts.
import { readFileSync } from 'node:fs';

const src = readFileSync('src/site.ts', 'utf8');
const day = (key) => {
  const d = new Date(`${src.match(new RegExp(`${key}:\\s*'(\\d{4}-\\d{2}-\\d{2})'`))[1]}T00:00:00Z`);
  const fmt = (opts) => d.toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
  const date = fmt({ day: 'numeric', month: 'long', year: 'numeric' });
  return { date, dayDate: `${fmt({ weekday: 'long' })} ${date}` };
};

export const ENTRIES_OPEN = day('entriesOpen').date; // 9 November 2026
export const ENTRIES_OPEN_DAY = day('entriesOpen').dayDate; // Monday 9 November 2026
export const DEADLINE_DAY = day('deadline').dayDate; // Sunday 17 January 2027
export const RESULTS_DAY = day('results').dayDate; // Wednesday 3 February 2027
