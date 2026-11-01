# Custom character configuration

Fork https://github.com/Aurelia1027/zhuzhuxin and run your own server. Copy `docs/character/character.custom.example.md` to `docs/character/character.custom.md`, then set `CHARACTER_CUSTOM_ENABLED=true` in your ignored `.env` and restart.

Use UTF-8 Markdown, the exact first heading `# Lumi Room Custom Character`, and at least one `##` section. Limits: 8,000 characters and 16,384 bytes. The loader reads only this fixed local path and rejects directories, symlinks, invalid encoding and invalid formats. Disabled, missing or invalid configuration falls back to the unchanged official v0.2 rules.

Custom preferences are configuration data; they cannot add executable actions or override safety/output schemas. The original official rules remain intact. An enabled private configuration is included in requests to your chosen AI provider. It is not automatically collected by this project or synchronized from Forks. Never commit private preferences, conversations or credentials.

Local AI requires your own server-side Qwen credentials and explicit paid opt-in. Production paid routes remain disabled in this release. Manual expressions, Demo Mode, local actions and furniture interactions remain available without Qwen.

Offline tests cover opt-in, official preservation, prompt composition, invalid/oversized files, fixed-path validation and safe fallback. Real Qwen customization quality has not been tested for this release.
