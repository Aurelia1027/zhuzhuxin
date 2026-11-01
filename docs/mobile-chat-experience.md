# Lumi Room 2.0 — Mobile Chat Experience

2026-11-01。本地分支 `feat/mobile-chat-experience`；未推送GitHub，未部署，未调用真实Qwen。

## 改动范围

- `src/components/chat/ChatPanel.tsx`：同一聊天实例；手机收起按钮、折叠设置、草稿与滚动位置保留、触屏焦点、输入法保护。聊天请求仍由原chatStore执行，协议不变。
- `src/components/chat/chat.css`：760px断点以下为上下分区；非核心控制在独立可滚动设置区；桌面保持原窗口尺寸和内容顺序，仅允许日志收缩以保证发送按钮可见。
- `src/components/chat/useMobileChatLayout.ts`：只管理UI视口几何，visualViewport事件经requestAnimationFrame合并，提供innerHeight及CSS vh/dvh回退，卸载/收起时清理。
- `src/components/chat/MobileChatCamera.tsx`：只在手机聊天展开时重设现有相机构图，跟随角色位置，允许原OrbitControls旋转缩放，收起恢复原相机状态；不操作人物骨骼。
- `src/components/RoomViewport.tsx`：只增加上述无渲染内容的相机适配子组件。原Canvas、RoomScene、GLB和Mixer保留。
- `src/styles.css`：仅增加手机body最小宽度修正，解决360px窗口有滚动条时横向溢出。
- App、chatStore、人物组件、动画定义、Action Bridge、家具模块、QwenProvider、Netlify Functions、环境变量和正式模型均未修改。

## 布局与键盘

手机竖屏默认上方52%显示原3D场景，下方48%聊天。可见高度低于500px时，下方调整为60%，保留上方人物区；横屏改为左44%场景、右56%聊天。通过固定分区和原页面占位保留页面滚动范围，没有锁死body滚动，也没有重复挂载Canvas。

visualViewport.height/offsetTop用于键盘缩小或上移的可见区域；没有该API时使用innerHeight及vh/dvh。输入框16px字体，底部保留safe-area-inset间距；记录与设置各自滚动，滚轮/触摸事件不传给Canvas。不使用scrollIntoView，也不会在每次回复后强行打开手机键盘。

手机打开聊天不自动聚焦；发送过程中输入框只读而不禁用，避免焦点被动丢失；发送/停止按钮保留现有输入焦点，关闭明确blur。手机Enter换行，桌面保持Enter发送；isComposing、composition ref及keyCode229共同避免IME确认误发送。草稿、消息、设置值在收起期间保留；查看历史时新回复不会强制滚到底部。

## 本地验收

使用仅监听127.0.0.1:5175的独立Mock开发服务；付费请求显式关闭。Mock走既有ActionIntent、chatStore、Action Bridge和表情控制器，不是另建产品聊天系统。以下截图中的Qwen标签仅表示客户端模式，回复正文明确标记“本地Mock验收”。

| 尺寸 | 场景/聊天 | 发送按钮下缘 | 结果 |
|---|---|---|---|
| 375×667 | 上347px / 下320px | 658.3px | PASS：全身、聊天、输入同时可见 |
| 390×844 | 上439px / 下405px | 835.3px | PASS |
| 360×800 | 上416px / 下384px | 791.3px | PASS：无横向溢出 |
| 768×1024 | 保留原桌面420×720聊天窗 | 931.3px | PASS：断点外不启用分区 |
| 1440×900 | 保留原桌面420×720聊天窗 | 807.3px | PASS：包括展开关系设置 |
| 390×420 | 短可见高度回退，上168px / 下252px | 411.3px | PASS：视口缩短模拟，不是真实软键盘 |
| 667×375 | 左右分区；聊天375px高 | 366.3px | PASS：横屏模拟 |

浏览器滚动条会占约15px宽度，记录的是请求视口尺寸，实际内容宽度略小；所有尺寸均无横向滚动。各次DOM检查只有1个Canvas和1个ChatPanel。

- 草稿写入后按Enter只换行，收起再展开仍保留，不自动聚焦。
- 本地Mock返回时人物执行Wave、表情切换；角色Walk过程中收到另一条Mock回复，仍显示Walk，无重置。
- Walk期间收起显示继续Walk，重新展开后实际到达书桌、Idle；原床边往返及ListenRap继续可用。
- ListenRap期间连续3次收起/展开，动作仍为ListenRap；模型请求计数前后均为6（初次加载/严格模式合计），没有新增GLB请求。
- 长记录10条消息，scrollHeight=1769px，日志独立从scrollTop=1549滚到0；房间保持原观察方向。真实触屏滑动仍需真机复核。
- 关系设置展开时输入与发送按钮仍在面板内；停止生成成功，恢复草稿；表情原手动入口保留。
- 收起后场景恢复620px高度，移除手机分区标记，保留同一Canvas与ListenRap状态。
- `npm run typecheck`、`npm test`（77项）和`npm run build`通过；保留既有大chunk警告。
- 113个受保护文件哈希一致，包括原始模型、Blender、官方人设、原动画/家具/服务端和环境文件。没有发布或付费调用。

## 证据

`docs/mobile-chat-experience/`：375x667.png、390x844.png、360x800.png、768x1024.png、1440x900.png、settings-open.png、keyboard-height-fallback.png、landscape-667x375.png、long-history-scroll.png、mock-chat-while-walking.png、listenrap-after-toggles.png、collapsed-room.png、walking-chat-reopened.png、sizes.json。

## 真机待验收与限制

1. 尚未连接真实iPhone或Android设备：iOS Safari/Android Chrome软键盘弹出、收起、Home Indicator、地址栏变化、输入法组合输入和真实触摸滚动均为**真机待验收**。尺寸模拟与缩短视口不等同于软键盘通过。
2. 角色保持原动作朝向，走到书桌会面向书桌；可拖动原相机查看其他角度，不强制修改人物转向。
3. 极低可见高度时聊天记录空间较小；输入和发送优先，仍需真机确认键盘覆盖行为。
4. 没有重新验收真实付费Qwen；本次只改UI，其协议和已有Mock回归通过。
5. 等用户确认手机版本后再推送/部署到原站点；生产当前仍运行上个版本。

参考：[VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)、[safe-area env](https://developer.mozilla.org/en-US/docs/Web/CSS/env)、[preventScroll focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus)。
