---
id: T-049
type: ticket
title: One deploy script for both servers — PROD run by hand over SSH, DEV on a timer
status: todo
depends_on: [T-015]
refs:
  - docs/architecture/decisions/ADR-027-a-deploy-is-a-script-on-the-server-triggered-over-ssh.md
  - docs/architecture/decisions/ADR-003-migrator-image.md
  - docs/tech-stack.md
  - docker-compose.prod.yml
  - README.md
---

## Goal

Replace the typed deploy procedure in README's "Deploying to the VPS" with one
committed script, used on two servers: PROD, where a person runs it over SSH
with a `sha-` tag and nothing is scheduled, and DEV — the development machine —
where a systemd timer runs it with `latest`. The shape and what was rejected are
ADR-027.

## Acceptance criteria

- [ ] A script in the repository (e.g. `scripts/deploy/deploy.sh`) takes the
      image tag as its one required argument and, in this order: pulls `web`
      and `migrate` at that tag (`--profile tools`); reads the commit from the
      `web` image's `org.opencontainers.image.revision` label and checks the
      server's copy of the repository out at it; runs `migrate`, then `up -d`;
      checks that the site answers at the server's health-check URL. Any failed
      step stops it with a non-zero exit and a message naming the step.
- [ ] Before `migrate` it takes a `pg_dump` of the database into a backup
      directory, and does not migrate if the dump failed.
- [ ] The deployed tag is persisted, so a bare `docker compose -f
      docker-compose.prod.yml up -d` run afterwards keeps it rather than
      falling back to `latest`.
- [ ] Every run appends one line to a log on the server — time, tag, revision,
      result — and on success prints the `sha-<short-sha>` tag of the revision
      that was running before, read from that image's
      `org.opencontainers.image.revision` label rather than from the tag it was
      started under, so the printed value is one the PROD check below accepts
      even when the previous deploy ran `latest`. That value is what a rollback
      passes back in.
- [ ] Bash has read the whole script before the checkout step runs, so checking
      out a revision with a different version of the script does not change what
      the running script does. Demonstrated by a deploy across a commit that
      modifies the script.
- [ ] Two runs cannot overlap on one server: a second run exits non-zero
      without touching the stack while the first holds a lock.
- [ ] On a server configured as PROD (a variable in its `.env`, documented in
      `.env.example`) the script refuses `latest` and any tag that is not
      `sha-<hex>`.
- [ ] The script needs no GitHub credentials: the clone is over HTTPS, and both
      images are pulled anonymously.
- [ ] DEV: a systemd service and timer, committed to the repository, run the
      script with `latest` from a directory that is not the development working
      tree, under its own Compose project name, so the dev Postgres from
      `docker-compose.yml` and the DEV stack share no container or volume.
- [ ] The health-check URL is a variable in each server's `.env`, documented in
      `.env.example`, and defaults to `https://${CADDY_DOMAIN}`. README states
      what DEV's `.env` sets for it and for `CADDY_DOMAIN`, and which host ports
      the DEV stack binds, so the check passes on DEV without a DEV-only branch
      in the script.
- [ ] README's "Deploying to the VPS" describes both servers: first deploy, a
      deploy (`ssh <prod> …/deploy.sh sha-…`), a rollback (the same command
      with an older tag, plus the hand-run down step for a schema change), and
      installing the DEV timer. The manual three-command sequence is no longer
      the documented procedure, and `docker-compose.prod.yml`'s header comment
      points at the script instead of repeating it. `.env.example`'s
      `IMAGE_TAG` comment says the script sets that value, and no longer tells
      the operator to pin a tag there by hand for a rollout or a rollback.
- [ ] Demonstrated on DEV: a merge to `main` is running on DEV within one timer
      interval, with no command typed.

## Notes

- No GitHub workflow changes: nothing in `ci.yml` learns about either server
  (ADR-027).
- Out of scope: a dedicated deploy user and a forced-command SSH key on PROD,
  and pinning the workflow's actions to commit SHAs. Neither blocks this ticket.
