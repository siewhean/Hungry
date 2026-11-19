# Nightly backup and size check (package 0.3)

The Free plan keeps no backups, so `.github/workflows/nightly-backup.yml` takes one every night.
It does two separate jobs:

- **backup**: dumps production (same dump as `scripts/db/backup.sh prod`), checks it, encrypts it with a key only the owner holds, and keeps it as a GitHub artifact: **14 nights** plus **one Sunday copy for 8 weeks**.
- **size-check**: reads the database size and the photo storage size. It fails when the database is at **400 MB** or storage at **800 MB** or more. Its login also counts as activity, so the project is not paused for being idle. GitHub emails a failed scheduled run only to the user who created the workflow or last changed its `schedule` cron line (or re-enabled it), and only if that user has Actions email notifications on (step 5 below).

Runs at 02:40 Singapore time (18:40 UTC). Schedules only run from `main`.

## One-time setup (owner)

### 1. Make the read-only login (Supabase SQL editor, project hungry-prod)

Pick a password of letters and digits only (no `@ : / ? #`), and keep it for step 3.

```sql
create role backup_ro login bypassrls password '<new password>';
grant pg_read_all_data to backup_ro;
alter role backup_ro set statement_timeout = 0;
```

This login can read everything (`bypassrls` lets `pg_dump` read tables that have row-level security) and change nothing. To remove it later: `drop owned by backup_ro; drop role backup_ro;`.

### 2. Make the key (on your Mac)

```bash
brew install age
age-keygen -o hungry-backup-key.txt
```

It prints `Public key: age1...`. **Put the whole `hungry-backup-key.txt` file in your password manager and delete the local copy.** Without it no backup can be opened, and anyone who has it can open all of them. Never paste the `AGE-SECRET-KEY-...` line anywhere else.

### 3. Add two GitHub secrets (repo Settings, Secrets and variables, Actions, New repository secret)

| Name | Value |
| --- | --- |
| `BACKUP_AGE_PUBLIC_KEY` | the `age1...` public key |
| `BACKUP_DB_URL` | `postgresql://backup_ro.frluxwpqqyomiqmjzavd:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` |

The URL uses the **session** pooler (port 5432): GitHub's runners are IPv4 only, and the direct host is IPv6. If your pooler host differs, copy it from Supabase, Connect, Session pooler, and replace the user with `backup_ro.<project ref>`.

### 4. Run it once

Actions, Nightly backup, Run workflow. Both jobs should be green and the run page lists the artifact `prod-nightly-<date>`.

### 5. Turn on failure emails

GitHub emails a failed **scheduled** run to the person who created the workflow or last changed its `schedule` line, which is the author of that commit, not necessarily whoever merges the PR. To make sure that person is you, after the merge open `nightly-backup.yml` in the GitHub web editor, change the cron minute (for example `40` to `41`), and commit. Then check GitHub Settings, Notifications, Actions: email on for failed workflows. A manual run only emails the person who starts it, so it proves your email setting works but not that scheduled failures reach you. Confirm the real path once: the first scheduled run after the 400 MB line fires (the size-check job fails while the database is over it) should email you; if no email arrives by the next morning, check the two settings above. If you blank `BACKUP_AGE_PUBLIC_KEY` for a manual test, set it back to the `age1...` public key afterwards, whether or not an email arrived, and run the workflow again to confirm it passes.

Optional repository variables to change the warning lines: `HUNGRY_DB_WARN_MB`, `HUNGRY_STORAGE_WARN_MB`.

## Opening a copy

Download the artifact (a `.tar.age` file; GitHub wraps it in a zip), then:

```bash
age -d -i hungry-backup-key.txt prod-<time>.tar.age | tar -xf -
```

You get a folder with `data.dump`, `schema.sql`, `rowstats.tsv`, `toc.txt`, `MANIFEST`, the same as `scripts/db/backup.sh`. The folder holds user emails: keep it on the encrypted Mac disk and delete it after the drill.

## Restore drill (do once, and write the time below)

Needs a scratch Postgres with the same extensions (PostGIS etc.), never staging or prod.

```bash
AGE_KEY_FILE=hungry-backup-key.txt scripts/db/restore-drill.sh prod-<time>.tar.age "<scratch db url>"
```

It checks the checksums, restores `data.dump`, recounts every table and compares with `rowstats.tsv`. It prints how long the restore took and `drill ok`, or lists the differences and fails.

| Date | Copy | Database size | Restore took | Result |
| --- | --- | --- | --- | --- |
| _not run yet_ | | | | |

Restoring production itself stays manual, as in `safe-migration-runbook.md` ("Restoring production").

## Limits

- Not in the copy: file bytes in Storage buckets (only their metadata rows), Edge Function secrets, Vault values, Auth dashboard settings.
- GitHub artifacts count against the repository's Actions storage (500 MB on the Free GitHub plan, more on paid plans). Copies of a large database add up: 14 + 8 files of N MB each. Watch the "Artifacts" total under Settings, Billing. If it fills, GitHub stops accepting new uploads and the backup job fails, which emails you.
- If a run fails (the email says so), the next night's copy still happens; nothing retries automatically.
