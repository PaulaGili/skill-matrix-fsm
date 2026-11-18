# Sample files for the import

Three files to try the import without making your own. "Import" is behind the three dots of the matrix.

The persons in them are demo persons of the shared FSM company and the skills are those of `npm run seed`, so the app finds them. The results below are for the data right after the seed. The import creates assignments and uploads no file. Every row is shown before anything is saved, and each imported row can be undone on the Changes page.

| File | What happens |
|---|---|
| `usual-titles.xlsx` | Six rows, all ready. Real Excel dates, one row without a level, one without a start date. |
| `odd-titles.xlsx` | Titles like "MA" and "Quali". Without AI the columns are not found. "Match columns with AI" finds them: three rows ready, and a warning names the two columns that are not used. |
| `problems.csv` | Two rows ready. Every other row says why it cannot be imported: unknown person, already assigned, unknown skill, unknown level, unreadable date, end before start, the same row twice. |

A row shows "The person already has this skill" when it was imported before. Undo it on the Changes page, or remove the assignment in the matrix, and it is ready again.

To try a certificate, use `tests/fixtures/sample-certificate.pdf`. It holds no personal data, so it can be saved to FSM.
