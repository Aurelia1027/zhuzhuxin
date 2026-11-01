# GitHub release and future deployment

Target repository: https://github.com/Aurelia1027/zhuzhuxin . The project display name remains Lumi Room.

The public release is built from an allowlisted snapshot. The original working tree, Blender projects, private environment files, private custom characters, historical models, caches, backups and temporary logs are not staged. Runtime room, shark, approved walking character and expression JPEGs are included. A manifest records file hashes.

`npm run release:audit` scans selected files and local Git history for credential patterns, private paths and oversized files. It is a useful check, not a proof that every possible secret or licensing issue is absent. `npm run release:prepare` creates an independent candidate and refuses to overwrite an existing candidate.

## Future hosting — not deployed

Live Demo: Coming Soon. No Render service, server, domain or paid API was provisioned for this release. Files in `deployment/` are examples only and require operator review, real HTTPS and operational validation before use. `vite preview` is a local preview, not production hosting.

`NODE_ENV=production` blocks paid AI entry points. Do not remove this gate to expose a key. Anonymous public paid chat, persistent visitor quotas and monetary budget enforcement are not implemented in the published release. A simple bounded rate limiter is not a spending cap. Render's ephemeral filesystem must not be relied on for a future persistent budget ledger.

The owner must separately authorize production AI activation after reliable external persistence, shared quota/concurrency controls, failure handling and offline tests are accepted. This release makes no paid Qwen requests.

## Updates

Use a clone of the published repository, edit only intended source files, run typecheck/tests/build/release audit, review `git diff --cached`, commit and push normally. Do not force push. Do not stage a private `.env` or your ignored custom character file.
