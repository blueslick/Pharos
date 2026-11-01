// The entries-open date, read from DATES.entriesOpen in src/site.ts so tests never
// carry a typed copy. (site.ts uses import.meta.env, so it is read as text, not imported.)
// Same wording as formatDate() / formatDateDay() in src/site.ts.
import { readFileSync } from 'node:fs';

const iso = readFileSync('src/site.ts', 'utf8').match(/entriesOpen:\s*'(\d{4}-\d{2}-\d{2})'/)[1];
const d = new Date(`${iso}T00:00:00Z`);
const fmt = (opts) => d.toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

export const ENTRIES_OPEN = fmt({ day: 'numeric', month: 'long', year: 'numeric' }); // 5 November 2026
export const ENTRIES_OPEN_DAY = `${fmt({ weekday: 'long' })} ${ENTRIES_OPEN}`; // Thursday 5 November 2026
