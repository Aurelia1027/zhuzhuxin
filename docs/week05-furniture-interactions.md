# Week 05：现有 Blender 家具互动交付

2026-11-01；项目 E:/Projects/lumi-room；分支 feat/week04-action-bridge。

## 资产审计

直接读取当前GLB节点和场景加载代码，未重新分析角色绑定或性能。房间GLB的asset.generator为Blender，88个节点，9个顶层家具/建筑组；鲨鱼单独GLB含32个节点。

表中源文件C=`assets/blender/cozy-room.blend`，对应G=`public/models/cozy-room.glb`；S=`assets/blender/shark.blend`，对应SG=`public/models/shark.glb`。这些路径均相对上述项目根目录。所有下列家具都在现有房间加载，没有新增模型。

| 物件 | 源文件 / GLB | 当前加载 | 独立节点 | 原点击 | 原交互 | 可否安全新增 | 推荐/本次选择 |
|---|---|---|---|---|---|---|---|
| 鲨鱼抱枕 | S / SG | 是，SharkPlush | 整体独立 | 查看详情 | 详情/悬停 | 是，独立偏移组 | 浮起/放回，已实现 |
| 床/床品/棋盘毯 | C / G | 是 | Bed、CheckerThrow；其他部分合批 | 是 | 详情 | 是，整体选择 | 调原路线回床边并Idle |
| 电竞桌 | C / G | 是 | GamingDesk | 是 | 详情 | 是 | 走到Desk，真实抵达后Wave |
| 电竞椅 | C / G | 是 | GamingChair，4子网格 | 由桌组捕获 | 无坐姿 | 可识别，坐姿不具备 | SKIPPED Sit；点击只提示不坐下 |
| 桌面台灯 | C / G | 是 | DeskLamp、DeskLampDiffuser | 已有祖先拾取 | 原开关连带全部暖灯 | 是 | 独立调光、发光同步，已实现 |
| 键盘 | C / G | 是 | Keyboard | 由桌组捕获 | 详情 | 节点可操作，但无必要动作 | TODO；保留桌组互动 |
| 显示器/鼠标垫 | C / G | 是 | MonitorScreen、MouseMat；机体合批 | 由桌组捕获 | 详情 | 部分可操作 | TODO，不改屏幕或材质 |
| 音响 | C / G | 是 | Speaker及Driver已合批，无独立完整节点 | 由桌组捕获 | 无音乐播放 | 否，不能安全单独操作 | SKIPPED，不增加音乐按钮 |
| 鞋柜 | C / G | 是 | ShoeCabinet整体 | 是 | 详情 | 整体可选，柜门不可独立 | 保留详情；SKIPPED开门 |
| 柜门/柜体 | C / G | 是 | CabinetDoor已合批，只有CabinetHandle独立 | 由柜组捕获 | 无 | 否，不能带动把手冒充开门 | SKIPPED |
| 陈列鞋 | C / G | 是 | 按材质并入柜/书架 | 父组 | 无单鞋动画 | 否 | SKIPPED，不拆网格 |
| 书架 | C / G | 是 | Bookshelf整体 | 是 | 详情 | 可整体选择，不宜摇动整架 | TODO，保留查看 |
| 书本/收藏摆件 | C / G | 是 | 书名节点已合批，无完整独立书本 | 父组 | 无阅读 | 否 | SKIPPED Read，不创建书模型 |
| 落地灯 | C / G | 是 | Lamps/FloorLamp | 无独立物品入口 | 原全局暖灯控制 | 可，但本轮不增互动 | TODO，保持原控制 |
| 顶灯 | C / G | 是 | CeilingFixture | 无 | 内视角显示/原暖灯状态 | 可，但不动建筑灯具 | TODO |
| 绿植 | C / G | 是 | Plants整体；按材质合批 | 无 | 无 | 整组可选，单盆不安全 | TODO，保持静态 |
| 木门 | C / G | 是 | Door整体、把手独立；门扇/框已合批 | 是 | 详情 | 查看可，完整铰链门扇不可 | SKIPPED开门，保留详情 |
| 窗户/窗帘 | C / G | 是 | Window、WindowAssembly、合批帘布 | 是 | 详情/日夜窗景 | 查看可；分帘缺节点 | TODO，不拉伸帘布 |
| 墙/地板/天花板 | C / G | 是 | RoomShell及Cutaway各面 | 无 | 原相机剖视 | 保留原行为 | TODO，不移动建筑 |

无可直接接入的独立播放器、完整单本书或抱持挂点；不会将可见合批部件说成不存在，也不会将它们冒充可独立互动资产。assets/blender中的pinkpig、zhuzhuxin、shuibuxin及各绑定/减面历史副本是人物或历史文件，不属于当前加载的家具，本轮不接入。

字母墙、海报、地毯及窗景覆盖层仍是原Canvas/Three实现，不属于本次新增互动对象，未为它们添加新功能。

## 控制与保护

新增 `src/interactions/roomInteractions.ts` 是物品入口适配器，不是第二套角色调度。bed/desk只提交原ActionPlan到既有ActionBridge，由原moving/dock和Wave完成回报推进。App原onCharacterPlayback同时让适配器了解角色是否加载/移动；不修改原Bridge核心、Mixer、骨骼或Walk。

角色忙或有原AI任务时拒绝重复家具请求；AI后续指令仍由原FIFO处理。鲨鱼/台灯与身体动作独立，可并行；不触碰表情状态。Bridge失败会清空依赖，不补播Wave，也不猜测抵达。

鲨鱼在新的局部偏移组中阻尼趋近固定高度0/.28（原scale1.05下约0/.294世界单位）和轻微滚转0/.035弧度；完成依据真实帧状态归零/到位。模型、材质和家具基准位置不变。快速点击期间锁定，避免累积位移。

桌灯实例发光材质及现有点光源平滑趋近目标强度；关闭只影响桌灯。全局暖灯预设变化时同步桌灯目标，落地灯原逻辑保留。台灯祖先节点拾取阻止事件冒泡，避免误触桌面Walk；电竞椅只展示限制提示，不播放假Sit。

新增四个轻量按钮作为小屏入口，和3D点击调用同一request接口；鼠标悬停给出具体提示。Sit、抱持、Read、开柜门及音频均未开放入口。

## 实现与验收

| 项目 | 状态 | 实测证据/限制 |
|---|---|---|
| 鲨鱼浮起/放回 | PASS | 直接点击GLB鲨鱼出现新提示并独立升起，按钮放回及窄屏点击回位；shark-up.jpg、mobile.jpg；无明显新穿模 |
| 书桌移动与Wave | PASS | 直接点击GLB桌面捕获移动状态，最终Desk Idle并回报“挥手完成”；同停靠点重触发取得Wave截图；desk-start.jpg、desk-arrived.jpg、wave.jpg |
| 床边互动 | PASS | 点击床面选中床，回到Bed Idle；bed-and-lamp-off.jpg、final.jpg。沿用原安全路线；未声称有坐姿 |
| 台灯独立开关 | PASS | 直接点DeskLamp显示独立提示；桌灯关闭而落地灯保持亮；双击第二次反馈“正在调光”；lamp-off.jpg、lamp-click.jpg |
| 快速重复点击/排队/失败依赖 | PASS | 7项家具离线测试覆盖锁定、到达、原队列优先和失败；浏览器灯双击实际反馈 |
| 窄屏按钮布局与点击 | PASS | 390×844浏览器视口，滚动到按钮并点击放回；mobile.jpg；不是手机硬件测试 |
| 手机真实触摸/微信浏览器 | PARTIAL | 未取得真机，需要发布前目标设备确认；保留标准onClick和40px最小按钮高度 |
| 浏览器错误 | PASS | 最终采集warn/error为空，browser-check.json；截图Canvas fallback文本不等于WebGL失败 |
| 类型、全测试、生产构建 | PASS | npm run typecheck、npm test 63项（原56+家具7）、npm run build退出0；原Three/R3F大包提示仍在 |
| 表情、Wave/Walk/ListenRap、聊天、环境回归 | PASS | 原离线测试全部保留并通过；实际浏览器观察角色/灯光/日夜/相机；未重复九状态表情验收 |
| 真实Qwen聊天回归 | PARTIAL | 本轮付费调用0，只有Mock；历史真实验收不冒充本轮结果 |
| Sit、Read、抱鲨鱼、开柜门、音乐播放 | SKIPPED | 无已验收姿态/挂点或独立完整部件，不添加不稳定入口 |

浏览器验收期间页面也出现了用户侧状态变化，截图仅证明各张实际状态，不冒充无中断录像。walking.jpg作为过程记录，不单凭它推断完整时序；时序另由原Bridge真实完成信号和回归测试验证。

## 文件、回退与发布边界

新增：src/interactions/roomInteractions.ts、assetHit.ts；src/components/FurnitureInteractionPanel.tsx；server/tests/furniture.test.ts。

修改：src/App.tsx、src/scene/RoomScene.tsx、BlenderRoom.tsx、InteractiveObject.tsx、SharkPlush.tsx、roomConfig.ts；src/styles.css；package.json。

备份：backups/before-week05-furniture-20261101。38项保护哈希一致，包括全部顶层Blender源工程/网页GLB、表情资源、角色原稿、角色组件、动画/Walk、ActionBridge、QwenProvider及输出协议。未覆盖源资产、改家具位置或调用API。

本地交付完成，刷新 http://127.0.0.1:5173/ 查看。尚未公开部署；真机触摸、微信浏览器和线上资源加载需部署后验收。无Sit/Read按钮；不承诺所有内部构件或所有设备均无穿模。

截图和日志位于 docs/week05-furniture/。
