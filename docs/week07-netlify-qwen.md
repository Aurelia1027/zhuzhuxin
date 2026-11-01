# Week 07 — Netlify Functions + Qwen 最小可用接入

2026-11-01。开发分支：`feat/week07-netlify-qwen`。目标站点保持 `https://spontaneous-licorice-fbdd12.netlify.app/`。本轮没有部署生产站点，没有开启或测试真实付费请求。

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
- 原有动作、表情、家具回归测试通过。未在真实 Netlify 生产运行 Function，也未做新的真实 Qwen 或浏览器视觉验收，不将它们标为通过。

## 官方参考

- [Netlify Function API](https://docs.netlify.com/build/functions/api/)
- [Functions 环境变量及重新部署规则](https://docs.netlify.com/build/functions/environment-variables/)
- [Netlify Function 打包配置](https://docs.netlify.com/build/functions/configuration/)
- [百炼错误码](https://help.aliyun.com/en/model-studio/error-code)

**当前生产付费状态：关闭；需要所有者填写服务端 Key、确认百炼硬停、连接现有站点并明确授权开启。**
