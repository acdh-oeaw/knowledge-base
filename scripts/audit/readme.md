# @dariah-eric/audit

Read-only data-integrity checks against the knowledge-base database. Unlike `@dariah-eric/migrate`
(one-off data transformations) and `@dariah-eric/seed` (local fixtures), these scripts are meant to
run repeatedly — locally, in ci, or on a schedule — against live data. They never modify data; each
script prints findings, writes a tsv report to `.cache/`, and exits non-zero when findings exist.

## scripts

### `data:audit:paired-relations`

Some pairs of person-to-organisational-unit relations must always be entered together because they
record the same fact from two angles (e.g. `national_representative` /
`national_representative_deputy` for a country ⇔ `is_member_of` the General Assembly governance
body). Neither side is derived from the other — a user may enter either one first — so each rule is
checked in both directions. For each rule the script flags persons where:

- `missing_counterpart` — one side of the pair exists, but its counterpart was never entered
- `duration_mismatch` — both sides exist, but their durations don't line up

Consecutive rows separated by at most one day (e.g. a representative term followed by a deputy term)
are merged into one interval per side before comparison, since the other side is often entered as a
single continuous relation.

New rules can be added to the `pairedRelationRules` array in `@dariah-eric/database/integrity-service`.

```bash
pnpm --filter @dariah-eric/audit run data:audit:paired-relations
```

### `data:audit:duplicate-entities`

Lists persons, organisational units and projects which look like they were entered twice — the same
person under two email addresses, an institution imported once by a migration and once by hand, two
projects whose names differ by a typo.

Unlike every other script here this one reports **candidates, not violations**: nothing it finds is
provably wrong, and every pair needs a human to confirm it before the two documents are merged. Each
pair is scored by the signals which point at it, so that corroborating weak signals outrank a single
weak one:

| signal         | weight | matches when                                                       |
| -------------- | -----: | ------------------------------------------------------------------ |
| `orcid`, `ror` |    1.0 | both claim the same global identifier, in url or bare form         |
| `email`        |    0.8 | same mailbox                                                       |
| `name`         |    0.7 | names identical ignoring case, diacritics, punctuation, word order |
| `link`         |    0.6 | same website or social-media url, ignoring protocol/`www.`/slash   |
| `similar_name` |    0.5 | names ≥ 0.85 similar (Sørensen–Dice over bigrams)                  |
| `acronym`      |    0.3 | same acronym                                                       |

Only pairs scoring at least `--min-score` (default `0.5`) are reported, so `acronym` never reports
alone but does as soon as anything corroborates it. Raise it to cut noise, lower it for recall:

```bash
pnpm --filter @dariah-eric/audit run data:audit:duplicate-entities
pnpm --filter @dariah-eric/audit run data:audit:duplicate-entities -- --min-score 1
```

Expect false positives at the low end, mostly units which legitimately share a website (a country
and its national consortium) or share a naming pattern (`"X members working time for …"`). The
signals and weights live in `@dariah-eric/database/integrity-service`.

Requires `DATABASE_HOST`, `DATABASE_NAME`, `DATABASE_PASSWORD`, `DATABASE_PORT`, `DATABASE_USER` in
the environment.
