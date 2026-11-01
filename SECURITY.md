# Security / 安全

Do not report secrets or private conversations in a public issue. If a credential has been exposed, revoke/rotate it at the provider immediately before discussing history cleanup. Removing a working-tree file does not remove its Git history or existing clones.

The public production API intentionally disables paid AI. Do not remove that gate as a substitute for authentication, persistent spend reservations, provider budget controls, content controls or compliance review. Rate limiting is not a monetary budget. Local AI is owner-opt-in and may incur provider charges.

Run `npm run release:audit` before preparing a release. It scans release text and reachable Git history for common credential patterns and private file paths, and reports paths/types only. It is not a complete secret scanner or proof of legal clearance. Never use `git add .` in the working project: existing backups and private source material must remain excluded.

A private security contact / GitHub private vulnerability reporting must be configured when the repository is created; no contact address is invented here. Until then, use the existing private maintainer channel.
