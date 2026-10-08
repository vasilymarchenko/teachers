---
id: ADR-027
title: A deploy is a script on the server, run over SSH by a person — GitHub never reaches a server
status: accepted
date: 2026-10-08
ticket: T-049
---

## Context

T-015 left the deploy as a procedure in `README.md`: on the VPS, `git pull` when
`docker-compose.prod.yml` or `Caddyfile` changed, then `--profile tools pull`,
`run --rm migrate`, `up -d`, with `IMAGE_TAG` in `.env` edited by hand for a
rollback. Every step is typed, and two of them can be silently skipped — the
`git pull`, and `--profile tools` (README "First deploy" says what a stale
migrator does).

There are now two servers. The machine development happens on also serves a
**DEV** environment; **PROD** is a separate VPS. GitHub Actions already
publishes `teachers` and `teachers-migrator` to GHCR from every green commit on
`main`, tagged `latest` and `sha-<short-sha>` (ADR-007), and both packages can
be pulled anonymously.

The repository is public. Its workflow logs are public, and everything a
workflow can reach is reachable by whatever code runs in it — a compromised
third-party action included.

## Options

1. **A GitHub Actions job deploys over SSH.** Status and timing show in GitHub,
   and the deploy needs no login. It costs an SSH private key for each server in
   the secrets of a public repository, and an SSH port reachable from GitHub's
   runner address ranges (or a VPN action in front of it). Every action the
   deploy job uses becomes code that can reach production.
2. **A self-hosted runner on the server.** GitHub's documentation advises
   against it for public repositories: a workflow from a contribution can end up
   executing on the machine. Rejected without further weighing.
3. **The server pulls on a timer** (a systemd timer, or Watchtower). No inbound
   access and no credentials in GitHub. Production changes whenever a tag
   moves, with nobody watching, and a failed migration is discovered by its
   consequences unless a notification channel is built as well. Watchtower
   additionally cannot run `migrate` before `up -d`.
4. **A script on the server, run by a person over SSH with the tag as its
   argument.** No inbound access beyond the SSH the operator already has, no
   credentials in GitHub, and nothing scheduled on the production server. It
   costs a login per deploy, and GitHub shows no deployment record.

## Decision

Option 4 for PROD, and the same script for DEV.

- One script, committed to the repository, is the only deploy procedure. It
  takes the image tag as its argument, pulls both images at that tag, brings
  the server's copy of the deploy files to the commit the image was built from
  (read from the image's `org.opencontainers.image.revision` label), runs
  `migrate` then `up -d`, checks that the site answers, persists the deployed
  tag so a later bare `docker compose up -d` keeps it, and records the deploy.
  A rollback is the same script with an older tag.
- On PROD nothing runs on a schedule. The script runs only when a person
  invokes it — `ssh <prod> <path>/deploy.sh sha-<short-sha>` — and refuses
  `latest` there, so what PROD runs is always a named commit.
- On DEV a systemd timer runs the same script with `latest`, so DEV follows
  `main`. DEV is the only server with a scheduled deploy.
- No GitHub workflow holds a credential for, or opens a connection to, either
  server. Promotion is a person choosing a `sha-` tag that DEV already ran.

## Consequences

The trust boundary stays where it is today: what GitHub can do ends at GHCR,
and a compromised workflow can publish a bad image but cannot install it on
PROD — a person still has to choose that tag. Nothing deploy-related has to be
kept secret in the repository.

What it costs: a PROD deploy needs an SSH session, there is no deployment
history in GitHub (the script's own log on the server is the record), and
nothing guarantees the tag deployed to PROD was ever run on DEV — that is the
operator's discipline, not a check.

Because the script checks out deploy files at a revision while it is itself one
of those files, it must be written so that bash has read all of it before the
checkout runs.

Revisit if more than one person deploys (a shared log in GitHub becomes worth
the credentials of option 1), if deploys become frequent enough that the SSH
step is the bottleneck, or if PROD needs a guarantee that the deployed tag
passed DEV — then promotion becomes a gated step somewhere, not a habit.
