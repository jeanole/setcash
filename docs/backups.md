# Database & File Backups

## What is backed up automatically

The `postgres-backup` service in `docker-compose.yml` (image
`prodrigestivill/postgres-backup-local:15`) runs a nightly `pg_dump` of the
`setcash` Postgres database on the schedule `SCHEDULE=@daily`.

Retention:
- Daily dumps kept for **14 days** (`BACKUP_KEEP_DAYS`)
- Weekly dumps kept for **8 weeks** (`BACKUP_KEEP_WEEKS`)
- Monthly dumps kept for **6 months** (`BACKUP_KEEP_MONTHS`)

## Where dumps land

Dumps are written into the named Docker volume `vbudget-pg-backups`, mounted
at `/backups` inside the `postgres-backup` container. The image organizes
dumps by cadence, e.g.:

```
/backups/daily/setcash-YYYY-MM-DD_HH-mm-ss.sql.gz
/backups/weekly/setcash-YYYY-MM-DD_HH-mm-ss.sql.gz
/backups/monthly/setcash-YYYY-MM-DD_HH-mm-ss.sql.gz
```

On the host, inspect the volume path with:

```bash
docker volume inspect setcash_vbudget-pg-backups
```

## How to restore

1. Copy (or `docker cp`) the desired `.sql.gz` dump out of the
   `vbudget-pg-backups` volume and decompress it:

```bash
docker run --rm -v setcash_vbudget-pg-backups:/backups -v "$PWD":/out alpine \
  sh -c "gunzip -c /backups/daily/setcash-2026-07-04_00-00-00.sql.gz > /out/restore.sql"
```

2. Restore into the running `postgres` compose service (this will overwrite
   existing data — take a fresh backup first if unsure):

```bash
docker compose exec -T postgres psql -U setcash -d setcash < restore.sql
```

If the dump was produced with `pg_dump -Fc` (custom format), use `pg_restore`
instead:

```bash
docker compose exec -T postgres pg_restore -U setcash -d setcash --clean --if-exists < restore.dump
```

## Uploaded bill images are NOT covered

`pg_dump` only backs up the Postgres database. Bill images and other uploaded
files live in the separate `vbudget-uploads` volume and **must be backed up
independently**. Example nightly cron job on the host:

```bash
# /etc/cron.d/setcash-uploads-backup
0 3 * * * root docker run --rm -v setcash_vbudget-uploads:/data -v /srv/backups/uploads:/backup alpine \
  tar czf /backup/uploads-$(date +\%F).tar.gz -C /data .
```

A `restic` equivalent (supports incremental backups and off-host targets):

```bash
docker run --rm -v setcash_vbudget-uploads:/data -v /srv/restic-repo:/repo \
  -e RESTIC_REPOSITORY=/repo -e RESTIC_PASSWORD=change-me \
  restic/restic backup /data
```

## Recommendation: copy backups off-host

Both the Postgres dump volume (`vbudget-pg-backups`) and the uploads archive
should be copied off the host regularly (e.g. `rclone`/`restic` to S3-compatible
storage, or `rsync` to a separate backup server). A backup that only lives on
the same disk as the production data does not protect against disk failure or
host compromise.

## Test restores periodically

A backup you have never restored is not a verified backup. Periodically (e.g.
quarterly) restore the latest dump and an uploads archive into a scratch
environment and confirm the application starts and data looks correct.
