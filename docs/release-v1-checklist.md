# Lumi Room public release checklist

Date: 2026-11-01. Scope: GitHub source and required runtime assets; no website deployment or paid API activation.

| Item | Status / evidence |
|---|---|
| Official character v0.2, accepted models/rigs and room layout | Preserve existing files; no modeling changes |
| Custom character loader | Fixed path, explicit opt-in, bounded UTF-8 Markdown, official fallback |
| Windows test cleanup | Empty test directory removed with `rmdir`; fixture tree cleanup stays bounded to its unique temporary directory |
| Offline checks | Run typecheck, complete test suite, build and release audit before push; final results supplied with release handoff |
| Privacy | Allowlisted snapshot omits private configuration, conversation logs, backups, cache and working Blender files |
| History | Original history scanned; published snapshot uses independent clean history so unrelated local working files are preserved |
| Licensing | Code MIT; owner attests asset public-distribution permission; asset/likeness rights are separately documented |
| Runtime assets | Room, shark, walking character GLBs and all expression JPEGs included |
| Qwen | Server-side key only; production paid routes disabled; zero paid release tests |
| Complex Qwen semantics | One prior real complex-command case reached Desk + ListenRap; broader semantic acceptance remains incomplete |
| AI expressions | Mock integration tested; real Qwen semantic selection still unverified |
| Public AI budget protection | TODO; not included as an enabled feature |
| Website / HTTPS / mainland access | TODO; Live Demo Coming Soon |
| Sit / Read / HugShark | Not implemented |

Publication completion is confirmed only by the actual remote default branch and pushed commit, not by this checklist alone. Pattern-based scanning does not independently establish every third-party permission; retain the owner's permission records.
