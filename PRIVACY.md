# Privacy and voluntary ideas / 隐私与自愿投稿

- The project does not automatically scan or synchronize Forks/private repositories. It has no character-submission database, hidden telemetry or chat-history upload endpoint.
- Local browser chat stays in memory until a reload. AI requests send the current message, bounded conversation history, room context, official rules and explicitly enabled custom configuration to the deployment owner's configured Qwen service. This is necessary inference traffic, not a submission to the project author. Do not include sensitive data.
- `character.custom.md` is ignored by Git and disabled unless the owner sets CHARACTER_CUSTOM_ENABLED=true. It is never served as a static file. Do not upload your private file to the official website or a public PR.
- Server diagnostics contain only aggregate usage, safe validation paths and timings. No application log intentionally stores full user messages, complete prompts, custom Markdown or API keys. The supplied API reverse-proxy location disables access logs. Your cloud/network provider may independently process operational metadata; its terms apply.
- Public v1 is Demo-only; anonymous paid AI endpoints are closed. No promise of free unlimited access to the author's API is made.

## Sharing is optional / 投稿完全自愿

Fork and use the game without submitting anything. If you deliberately open a public character-idea PR, maintainers and other GitHub users can read it; accepted ideas may improve future character versions. Review your diff first. Share only original material you are willing to publish, with clear permission. Never submit API keys, private chats or sensitive information.

Request removal through the repository maintainer contact / issue, without reposting sensitive content. A maintainer can remove current repository content, but cannot guarantee erasure from public Git history, forks, clones, caches or other people's copies. GitHub privacy/support channels may also be needed. No repository exists publicly yet, so the final maintainer contact must be added during publication.

部署者应在上线前补齐自己的联系渠道、实际云服务商、隐私条款和投诉处理信息。本说明只描述当前代码，不代替其自身的数据处理责任。
