# Week 07 — Netlify Functions + Qwen 最小可用接入

2026-11-01。开发分支：`feat/week07-netlify-qwen`。目标站点保持 `https://spontaneous-licorice-fbdd12.netlify.app/`。已通过 CLI 部署到现有生产站点；关闭模式验收后，所有者确认百炼硬停并授权开启，已完成 1 次真实 Qwen 联调，未重试。

## 已实现

- `netlify/functions/lumi.ts`：Netlify Web Request/Response 入口；`netlify.toml` 将原 `/api/*` 重写到同一个 Function，优先于 SPA 回退。
- `server/netlify/NetlifyDialogue.ts`：复用 QwenProvider、ActionIntent、StreamingDialogue、DialogueController 和完整 CharacterPromptBuilder。原 Node HTTP 服务及 PublicApiPolicy 的生产禁用逻辑保留；只有新的 Functions 适配器受显式公网开关控制。
- 为 ActionIntent、StreamingDialogue 增加可选的规则加载器注入，适配 Function 包内 Markdown 路径；不改提示词或官方 v0.2 原稿。
- `/api/action-intent` 一次调用返回经过原 AJV 校验的 reply、commands、expression。聊天仍通过同一个 Action Bridge 和表情控制器执行，不操作骨骼，不创建 Mixer。
- `/api/dialogue` 保留 JSON；`/api/dialogue/stream` 保留 delta/done SSE 格式，但本适配器缓冲到完整校验成功后返回，不能承诺逐 Token 网络输出。主聊天 UI 原本就使用非流式 action-intent。
- 元数据声明 AI 可用时，首次打开聊天默认选择 AI；用户手动选择 Demo 后不会被覆盖。API 禁用、额度不足、429、超时、网络失败或非法输出时，清楚标记并回退到本地 Demo，不自动重试或额外请求。停止生成不触发自动 Demo 回复。
- 原 Demo 预设提取为共享纯函数 `demoReply.ts`，供原服务端及浏览器故障回退使用；不把人物原稿打进前端。
- QwenProvider 仅识别有限白名单的额度错误码，不返回原始上游响应。支持 Arrearage、AllocationQuota.FreeTierOnly 和 429 等失败处理。

## 必要限制与实际边界

请求体 48 KiB；单条消息 1000 字符；历史最多保留 8 条、合计 4000 字符；完整提示词最多 32 KiB；输出最多 600 tokens；Qwen 超时 20 秒。单个热 Function 实例每 IP 每分钟 6 次、合计每分钟 30 次、并发 3；短期请求 ID 去重。IP 来自 Netlify 可信 context，而不是访客可伪造的转发头；不保存原始 IP 或聊天日志。

内存限流仅为基础防滥用，冷启动会重置，多实例之间不共享。根据用户最新要求，不实现 Redis、每人每日 20 次或全站每日人民币 30 元的数据库预算控制，也不宣称存在站点级精确费用上限。费用硬停由站点所有者在百炼后台确认，消费预警不能替代停止服务。

## Netlify 配置（不要在聊天或 GitHub 粘贴真实 Key）

在 Netlify 控制台打开**现有** spontaneous-licorice-fbdd12 项目，进入 **Project configuration → Environment variables → Add a variable**。界面若显示 Site configuration，选择对应的 Environment variables。

| 环境变量 | 值 / 范围 |
|---|---|
| `DASHSCOPE_API_KEY` | 你自己的百炼 Key；标为敏感，Functions scope，Production context |
| `QWEN_MODEL` | `qwen-plus`，或账户在该地域可用的模型 |
| `QWEN_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1`；必须与 Key 地域匹配 |
| `PUBLIC_QWEN_ENABLED` | **先设为 `false`**；仅在所有者确认百炼硬停并明确授权后改为 `true` |
| `CHARACTER_CUSTOM_ENABLED` | 默认 `false`；自定义人设仍按已有固定文件机制显式启用 |

兼容 `QWEN_API_KEY` 别名，但推荐沿用 DASHSCOPE_API_KEY。不要创建任何带 `VITE_` 前缀的 Key，不把 Key 写入 netlify.toml、源码或 dist。仅有 Key 不会启用生产 AI。旧 `QWEN_ENABLE_PAID_REQUESTS` 只保留原本地 Node 流程；Netlify 公网开关使用 PUBLIC_QWEN_ENABLED。

## 部署到现有站点

1. 将本分支的改动推到已有 `Aurelia1027/zhuzhuxin` 仓库；不要用含历史工作模型和私人文件的目录整体替换公开仓库。
2. 在现有 Netlify 项目的 **Build & deploy → Continuous deployment → Repository** 选择连接该 GitHub 仓库（可能显示 Link repository / Set up builds），先选择本测试分支。不要 Import a new project。
3. 构建命令 `npm run build`，发布目录 `dist`，Functions 目录 `netlify/functions`；根目录 netlify.toml 已提供配置，Node 24。
4. 保持 PUBLIC_QWEN_ENABLED=false，触发一次完整 Git 构建部署。查看 Function `lumi` 是否存在；访问 `/api/health` 应是 JSON、paidChat=disabled，`/api/character` 应是 v0.2、aiAvailable=false。不要仅拖拽 dist，这不会部署 Function。
5. 明确授权后，由所有者将 Production Functions 环境变量 PUBLIC_QWEN_ENABLED 改为 true，**重新部署**，刷新聊天面板。只修改环境变量而不重新部署不能保证新值生效。
6. 一条真实对话验收也需要另行授权，本轮未执行。失败时可立即将开关改回 false 并重新部署。

CLI 备选：在干净的仓库检出目录执行 `npx netlify-cli@27.16.1 login`，再 `npx netlify-cli@27.16.1 link` 并选择现有站点；`npx netlify-cli@27.16.1 deploy --build` 创建草稿部署。确认无误后由所有者决定生产发布，勿创建第二个站点。

## 验证结果

- `npm run typecheck`：通过。
- `npm test`：77 项通过（原 68 项 + 9 项 Netlify 测试）；旧测试保留，网络错误预期更新为用户要求的 Demo 回退。
- `npm run build`：通过，保留既有 Three.js 大 chunk 警告。
- `netlify-cli@27.16.1 build --offline`：通过，实际打包 lumi Function。
- CLI `functions:serve --offline --port 9999`：真实本机请求 health 200/paidChat disabled；character 200/v0.2/aiAvailable false；Demo 200；action-intent AI 503 PUBLIC_AI_DISABLED。
- Mock 覆盖：完整人设、单次 Qwen transport、动作及表情、AJV 拒绝未知动作、JSON/SSE 兼容、输入/Token/历史限制、三个付费入口共用实例限流、并发释放、取消、错误脱敏、429/额度错误、本地 Demo 回退；用既有 Bridge 的真实 observe 完成信号测试 Walk 后 ListenRap。
- 原有动作、表情、家具回归测试通过。真实 Netlify 生产 Function 与浏览器 Demo/3D/鲨鱼互动验收通过；其后已获授权并完成 1 次真实 Qwen 联调，结果见末节。

## 官方参考

- [Netlify Function API](https://docs.netlify.com/build/functions/api/)
- [Functions 环境变量及重新部署规则](https://docs.netlify.com/build/functions/environment-variables/)
- [Netlify Function 打包配置](https://docs.netlify.com/build/functions/configuration/)
- [百炼错误码](https://help.aliyun.com/en/model-studio/error-code)

**当前生产付费状态：开启。所有者已确认百炼达到预算停止服务，并明确授权正式开启和 1 次真实联调；本次联调通过，未重试。**

## 先前完成的关闭模式部署与公网验收

- 站点 ID：849a5338-c73d-47f2-a3db-d708b308af5c；未创建第二个站点。
- 部署 ID：6ae6ede1b22f701b216e6500；[部署记录](https://app.netlify.com/projects/spontaneous-licorice-fbdd12/deploys/6ae6ede1b22f701b216e6500)。实际上传24个静态文件及1个 lumi Function。
- [代码分支](https://github.com/Aurelia1027/zhuzhuxin/tree/feat/week07-netlify-qwen)，实现提交8f18eb12de5bfd2308ecf320d2c1adf35b594146；GitHub CI通过。main未改变。本轮采用CLI部署，不需要先连接GitHub；持续部署以后可选。
- 最终部署产物：23个前端文件、80个Function文件；环境文件/备份/无关工作模型检查通过；已知密钥值匹配数0；官方人物原稿原始字节一致。
- 本地Netlify打包会跟踪动态文件读取，已在included_files中显式排除.env和工作目录；未把发现过.env的初期本地产物上传。Windows部署检出关闭换行自动转换，避免人物原稿字节变化。最终采用独立普通检出目录，避免嵌套worktree的路径污染。
- 公网GET /api/health：200，paidChat=disabled；GET /api/character：200，v0.2、aiAvailable=false，sha256与验收源文件一致。
- 公网POST /api/dialogue（Demo）：200；POST /api/action-intent及/api/dialogue/stream（AI）：503 PUBLIC_AI_DISABLED；跨站请求403。没有调用真实Qwen。
- 公网浏览器：3D房间、床、鞋柜、书桌、鲨鱼和猪猪心显示；角色Idle；聊天显示Demo Mode且Qwen选项禁用；“你好”收到明确标注Demo的预设回复。鲨鱼浮起交互完成；浏览器warning/error日志为空。截图保存在本地D:/pythonProject11/lumi-room-netlify-demo-live.png。
- 25个保护文件（官方原稿、GLB、Blender工程、既有骨骼/动画/Action Bridge及家具逻辑等）哈希复核一致。
- 本次部署使用部署级PUBLIC_QWEN_ENABLED=false覆盖。后续开启需要一次新的部署，移除该false覆盖或明确使用PUBLIC_QWEN_ENABLED=true；单改站点变量不能证明旧部署已开启。
- 上述为开启前的验收记录；最新生产状态和真实测试结果见下节。
## 已授权开启与唯一一次真实 Qwen 联调（2026-11-01）

- 所有者回复“确认硬停，授权开启并测试 1 次”，授权内容同时包含正式开放访客调用、完整v0.2人设及默认房间上下文、无历史、600输出tokens上限、失败不重试并关闭。
- 启用部署：6ae6efee99680016471f8816；[部署记录](https://app.netlify.com/projects/spontaneous-licorice-fbdd12/deploys/6ae6efee99680016471f8816)，同一站点，同一已验收代码，部署级 PUBLIC_QWEN_ENABLED=true。
- 只读公网复核：health.paidChat=configured；character.aiAvailable=true；人设仍v0.2，sha256仍为7c48e1f06fe2312dc9906622fefc6c7e8ec5affa8454f33c8bed9ed239d4ffc7。
- 在浏览器刷新以清空历史，打开聊天，确认自动选择 Qwen AI。仅发送一次授权测试：“今天有点累，陪我聊两句，也朝我挥挥手吧。”；没有手动或自动重试，也没有额外发起付费API抓包请求。
- 实际回复：“你来啦，等你好久了呢...”。界面显示“猪猪心 · AI 生成”，保持Qwen AI模式，没有出现Demo回退。
- 既有Action Bridge实际反馈“挥手完成 · 待执行 0”；表情面板选中“开心微笑”，并启用“跟随聊天”。3D房间和人物继续显示；浏览器error/warn日志为空。
- 证明截图：D:/pythonProject11/lumi-room-qwen-live-accepted.png。未记录Key、完整Prompt或私人聊天。实际Token和计费金额未在生产浏览器中暴露，本次没有测量，费用以百炼账单为准。
- 结论：这1个真实对话+挥手+表情样例通过，可以分享现有网址给朋友使用真实AI聊天；不代表所有复杂语义、手机或网络环境均已验收。无需额外Netlify登录授权，也无需先连接GitHub。
- 当前按所有者授权保持生产Qwen开启。基础限流仍仅限热实例；费用硬停依赖所有者已确认的百炼后台设置。要停止公网付费聊天，重新部署并设置PUBLIC_QWEN_ENABLED=false。