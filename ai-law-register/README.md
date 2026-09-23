# AI Law Register

A static, searchable register of binding AI laws, soft-law instruments, standards and international processes, covering civilian and military uses of AI. Built with plain HTML, CSS and JavaScript, so it hosts free on GitHub Pages with no build step.

## Publish on GitHub Pages

1. Create a new GitHub repository and push this folder to the `main` branch.
2. In the repository, open **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Push again (or run the workflow from the **Actions** tab). The site goes live at `https://<your-username>.github.io/<repo-name>/`.

The workflow in `.github/workflows/deploy.yml` validates the data first and only deploys if it passes.

## Preview locally

```bash
python -m http.server -d site 8000
```

Then open http://localhost:8000. (Opening `index.html` directly will not work, because browsers block the data files.)

## Sections

The site has two kinds of page:

- **Register, Timeline, Compare** — the interactive database. Filter, search, sort, open an entry, or compare up to three side by side.
- **Overview, Civilian AI, Military AI, Industry, National and regional, Key points** — a narrative reference built from a compiled framework note (September 2026), laid out as consolidated tables, UN resolution trackers with vote counts, and a comparison of the two advocacy coalitions in military AI governance. Rows link through to the matching register entry where one exists, and a warning icon marks anything not yet independently verified.

Both draw on the same `site/data/instruments.json`, so an entry edited once (including through the admin page) updates everywhere it appears.

## Project layout

| Path | Purpose |
|---|---|
| `site/index.html`, `site/assets/` | The website |
| `site/admin/` | Control panel for adding and editing register entries |
| `site/data/instruments.json` | One entry per law, instrument or process |
| `site/data/sections.json` | Content for the narrative reference pages |
| `site/data/glossary.json` | Plain-language glossary |
| `schema/instrument.schema.json` | Rules every register entry must follow |
| `scripts/validate.py` | Checks both data files: schema, duplicate ids, broken cross-references, row/column counts |

## Control panel (admin page)

Once deployed, open `https://<your-username>.github.io/<repo-name>/admin/`. It lets you add, edit and delete entries through a form, with the same checks as `scripts/validate.py`, and saves all your changes as a single commit. The deploy workflow then republishes the site.

1. In GitHub, create a **fine-grained personal access token** (Settings > Developer settings). Restrict it to this repository and give it **Contents: Read and write**.
2. On the admin page, enter the token and choose **Connect and load entries**. The token stays in the browser tab's memory only and is never stored.
3. Add or edit entries, then choose **Save to GitHub**.

Access control is GitHub's own: the admin page is public but unlinked and marked `noindex`, and nobody can publish without a token that has write access to the repository. Use **Work without a token** to edit locally and download the updated JSON instead.

Limits: the admin edits `instruments.json` only, which drives the Register, Timeline and Compare pages. The narrative reference pages (Civilian AI, Military AI, Industry, National and regional) are separate tables in `site/data/sections.json`; entries there carry a `sections` tag noting which page they're featured on, but adding that tag alone does not add a table row — new rows on those pages are still added by hand, in `site/data/sections.json`. Glossary changes are also made by hand, in `site/data/glossary.json`. If two people edit at once, GitHub rejects the second save and the admin asks you to reload, so nothing is silently overwritten.

## Add or edit an entry by hand

1. Copy an existing object in `site/data/instruments.json` and change its fields.
2. Set `url` to the official text or official page.
3. After checking the entry against that source, set `last_verified` to today's date (`YYYY-MM-DD`).
4. Run `pip install jsonschema && python scripts/validate.py`.
5. Commit and push.

## Data policy

The seed entries were drafted from general knowledge and a compiled reference note, and none has been checked against its primary source yet. The site labels each of them "Not yet checked". Verify each one, add its source link, and set `last_verified` before treating the register as authoritative. Entries with `"verify": true` describe fast-moving situations (for example, entry-into-force dates or pending bills) and should be rechecked regularly.

Rows on the narrative reference pages carry the same caveat: a warning icon marks anything the source material didn't fully confirm (a date, a bill's status, an exact title). `scripts/validate.py` checks that every `ref` on those pages points to a real register entry and that every row has the right number of cells, but it does not check factual accuracy — that still needs a human pass against primary sources.

## Ideas for next steps

- A world map view with countries coloured by regulatory approach
- A negotiation tracker for live texts such as the CCW rolling text
- A scheduled GitHub Action that flags entries not verified in 90 days
- Multilingual summaries
