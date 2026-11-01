# 单角色动作：坐下 / 起身 / 求抱抱

2026-11-01。本地分支 `feat/single-character-actions`。未推送、未部署、未调用付费 Qwen。手机聊天版本先保存在独立本地检查点 `dae8177`。

## 当前交付状态

| 项目 | 状态 | 证据与限制 |
|---|---|---|
| 玩偶式坐姿 | 已接入，保留已知外观限制 | 用户明确接受已展示的臀腿牵拉后，采用较保守的35°整腿坐姿；不是人体屈膝动画。 |
| 坐下 / 保持 / 起身 | 已完成按钮流程 | 房间内实际看到 Seated；独立页面使用同一正式角色组件连续完成10次坐立，全部回到[-1.15,0.005,0.85]，pending=0。 |
| 坐姿先起身再走路或挥手 | 代码完成、离线队列验证通过 | 等待站立恢复和真实移动完成反馈；坐姿到书桌的完整浏览器复核未继续执行。 |
| 求抱抱 | 代码及按钮完成，未做视觉验收 | 用户要求停止测试、直接做下一动作后完成；不能声称正侧背面肩袖已通过本次验收。 |
| 新动作接入聊天 | 暂未开放 | 原AJV白名单和提示能力列表保持原样；按钮通过同一Action Bridge的封闭姿态适配器进入同一队列。未向AI宣告未验收的新动作。 |

## 修改文件

- `src/characters/characterPosture.ts`：新增 SitDown / Seated / StandUp / OpenArms AnimationClip、座位锚点、绝对位置插值和局部接近点边界。
- `src/characters/postureState.ts`：站立、坐下过渡、坐稳、起身状态及安全恢复。
- `src/characters/characterAnimations.ts`：仅扩展动作类型，原四个动作生成代码保持不变。
- `src/characters/ZhuZhuXinCharacter.tsx`：复用同一GLB克隆、AnimationMixer、脚底补偿和原Walk路径；新增姿态过渡及完成反馈。坐稳期间不套用为小幅摆腿设计的脚底抬升补偿。
- `src/characters/actionBridge.ts`：同一FIFO队列加入封闭按钮接口requestPose；坐稳即结束任务；重复姿态请求去重；取消等待当前姿态安全收尾。新增三个适配方法sitDown / standUp / openArms。
- `src/components/CharacterActionPanel.tsx`、`src/App.tsx`：沿用动作面板加入坐下、起身、求抱抱，显示坐稳与过渡状态；开发环境保留只读坐标输出。没有重复挂载Canvas。
- `src/main.tsx`、`src/single-actions-preview/`、`src/characters/seatingStudy.ts`：隔离的实际控制器验收页和旧坐姿候选研究页。
- `server/tests/posture.test.ts`、`package.json`：7项相关回归用例，新增test:posture并接入npm test。最后一轮实现后按用户要求未再次运行。

## 坐姿设计

使用原12骨骼正式模型`public/models/shuibuxin-walk.glb`，没有Hip、膝盖或肘关节。Leg.L / Leg.R按模型已保存的局部primary轴各前摆35°，上半身与手臂Rest Pose不变。

- 原Bed停靠点：[-1.15,0.005,0.85]。
- 床沿接近站立点：[-0.74,0.005,0.85]。
- 坐姿根节点锚点：[0.08,0.49,0.85]。
- 坐姿面向：世界-X方向（yaw=-π/2），减去原角色局部yaw后设置外层根节点。
- 起身恢复：先回接近站立点，再沿短接近段走回原Bed停靠点，之后才继续原Bed↔Desk走廊。

从书桌发起坐下时先复用原Walk到Bed，再走局部接近段、转身和后挪上床沿。2.2秒的玩偶式过渡有小幅整体抬升后落稳，不伪装成人体屈膝。位置由固定锚点求值，不累加偏移。坐稳使用Seated循环保持，任务完成由Mixer finished→Seated反馈确认；保持坐姿不占住队列。离开坐姿先StandUp，再回原站立点，才执行待走路/挥手/听Rap/求抱抱指令。

旧候选55°坐姿正面接近目标，但背面臀腿过渡和图案出现明显牵拉；35°仍有较轻牵拉。用户已明确表示可以加入、不影响。没有修权重、改变UV或藏起背面来宣称变形消失。

## 求抱抱设计

只控制已有Arm.L / Arm.R。手臂整体抬起30°，按模型局部轴镜像向前展开8°；Hand保持中性，袖子和小手沿用现有整臂权重。面向当前观察相机平滑转身后播放，1.1秒展开、默认保持2秒、1.1秒收回，再由AnimationMixer finished事件回到Idle。

保持时长通过组件openArmsHoldSeconds配置，接受0.2～10秒；隔离验收页使用6秒便于查看，房间默认2秒。坐姿下先起身。没有新肘骨、没有另一角色、没有接触约束；这是面向用户的单人求抱抱表达，不是真正双人拥抱。

## 已执行与停止的验收

- 新增姿态之前，手机适配的typecheck、原77项测试和build通过，详见`docs/mobile-chat-experience.md`。
- 本轮角色与预览的TypeScript检查曾通过。
- 新增7项姿态测试已通过：重复请求、状态保持、取消恢复、绝对锚点十次往返、原四个Clip与Rest数据保留、队列真实完成反馈、旧命令与非法参数兼容。
- 浏览器正式控制器验收页实际完成10次坐下/起身：10个落点均精确为[-1.15,0.005,0.85]，最终standing / Idle / moving=false / transitioning=false / pending=0。
- 用户随后要求“别测试了直接做下一个动作”。因此最后的求抱抱面向相机接入及收尾改动后，**没有再运行typecheck、完整npm test或build，没有继续浏览器动作验收**。
- 求抱抱正面/侧面/背面、坐姿转Walk完整流程、连续取消与移动端新按钮最终回归仍未验收。不能以已有单元测试代替这些视觉检查。

## 预览与截图

本地Mock开发服务运行时：

- 房间与新增按钮：http://127.0.0.1:5175/
- 正式组件的独立动作页：http://127.0.0.1:5175/?preview=single-actions
- 旧候选研究页：http://127.0.0.1:5175/?preview=single-actions-study

已取得的候选截图在`docs/single-character-actions/`：seated-55-front.png、seated-55-side-bed.png、seated-55-side-unoccluded.png、seated-55-back-stretch.png、seated-35-back.png。它们用于记录坐姿外观限制，不是求抱抱通过截图。按停止测试要求，没有补拍最终求抱抱图片。

## 文件保护与发布

本轮备份位于`backups/before-single-character-actions-20261101/`。57个受保护文件SHA256核验一致，包括模型、Blender、官方人物原稿、环境文件、QwenProvider、Functions及已完成手机聊天文件/布局CSS/RoomViewport。原characterWalk.ts未改；家具和房间布局未改。原先工作区未提交内容保留，没有reset、clean或force push。

坐姿已获用户接受其已知牵拉，但求抱抱仍只有实现状态。后续如继续验收，应优先查看求抱抱肩袖三视角和坐姿转走路，确认后再最小增量开放AI动作Schema及本地短语。当前不修改QwenProvider、部署配置或官方人物原稿，不发布生产。
## 快速新增：点头 / 摇头

用户要求不再测试、直接增加其他动作后，新增characterGestures.ts，并最小接入原角色组件、动作类型、Action Bridge、App和原动作面板。

- 点头Nod：1.8秒，沿已保存Head.primary轴小幅点头两次，最大6°。
- 摇头ShakeHead：1.8秒，沿Head.yaw轴左右摇头，最大幅度不超过8°，首尾平滑归零。
- 同一个AnimationMixer一次播放，finished事件返回Idle；坐姿下沿现有策略先起身，走路时排队，不修改模型和骨架。
- 房间面板新增“点头”“摇头”按钮；AI Schema和能力提示保持原样。
- 按用户要求没有新增测试运行、构建或浏览器验收；这两项仅标记代码接入完成。未推送、未部署、没有付费API调用。
## 快速新增：转身 / 回到我面前

- 转身TurnAround：站立状态下平滑原地旋转180°，不改变位置；坐姿先起身。
- 回到我面前ComeToMe：复用旧Walk回到固定Bed停靠点[-1.15,0.005,0.85]，再转向当前相机；已在Bed时只转向镜头。不是走向任意相机坐标，不是任意点寻路。
- characterRootActions.ts提供封闭AJV指令校验及相机朝向计算。只允许turn_around / come_to_me，不接受坐标、骨骼名称、代码或额外字段。
- 同一Action Bridge排队和去重；实际转向角度达到阈值后才发送带指令序号的完成反馈。ComeToMe必须等旧Walk真实抵达后转向，不用计时器猜完成。移动/转向时取消沿用安全收尾策略。
- 原动作面板和独立动作页均增加按钮。聊天本地识别“转身 / 转个身 / 转过去 / 转半圈”和“回到我面前 / 回我面前 / 回到我这边 / 过来找我 / 回到镜头前”；否定、引用及混合复杂聊天不按关键词强行执行。
- ChatPanel布局、正式模型、Blender、人设、QwenProvider及部署配置未改。新增短指令在本地执行，不产生Qwen调用；AI的远程输出白名单与提示能力未扩展。
- 按用户此前要求，本轮未运行测试、类型检查、构建或浏览器验收，不能标记视觉验收通过；仅本地代码接入，未推送或部署。
## 快速新增：跳跃 / 跳舞 / 床边打盹与Blender家具联动

按用户要求继续实际开发，且不运行测试或发布。

### 动作

- Jump：1.2秒单次玩偶小跳；起跳、落地使用可视抬升组，最大目标高度为角色显示高度的12%（房间角色约0.174单位），保持原脚底蒙皮补偿独立。没有膝关节或网格挤压。Mixer完成事件返回Idle；取消等待落地安全收尾。
- Dance：3.2秒原创循环。双腿反相±6°，双臂10～26°交替摆动，头与身体轻微节奏摇摆；无横向位移、无音乐。Idle或后续动作可结束。进入稳定循环即释放队列。
- Sleep：第一版是“走到床边→沿用坐下→低头闭眼打盹→保持”。不是躺卧动画，没有实现被子包裹、床垫形变或躺卧碰撞。Head约6°、Spine约2°，整腿保持既有35°坐姿。
- WakeUp：从打盹恢复坐姿。走路或其他站立动作先唤醒，再沿原起身流程恢复站立；睡眠任务进入稳定循环后结束，不无限占住队列。
- 闭眼复用现有blink表情与绑定器，手动表情优先；醒来恢复现有聊天表情，不重做表情贴图或控制器。

### 家具能力检查与接入

读取实际cozy-room.glb节点名，Bed、GamingDesk、DeskLamp、GamingChair、ShoeCabinet、Bookshelf、Window、Lamps、Plants均存在。家具由独立节点加载，原床、书桌、台灯、鲨鱼点击接口可复用，无须重建Blender资源。

在原房间互动面板增加：

- 床边坐下：现有Bed位置与坐姿锚点。
- 床边打盹：Bed接近路线、坐姿与闭眼打盹。
- 去书桌跳舞：先沿原Walk真实到达Desk，再执行Dance；同一动作队列保证顺序。

原点击床回床边、书桌旁挥手、桌灯开关、鲨鱼浮起/放回继续保留。没有声称已实现拥抱/拿起鲨鱼、翻书、开柜门或电竞椅坐下；这些需要独立接触、姿态或部件动画验证。

### 文件与接口

新增src/characters/characterActivities.ts，最小接入角色组件、动作类型、Action Bridge、App、动作面板、useCharacterExpression、roomInteractions及FurnitureInteractionPanel。独立动作页同步增加四个按钮。

本地聊天支持明确短指令“跳起来 / 跳一下”“跳舞 / 跳个舞”“睡觉 / 去床边睡觉 / 打个盹”“醒来 / 醒醒 / 起床”。它们走现有本地识别器与封闭动作白名单，不调用Qwen。Qwen远程输出Schema和能力提示未新增未验收动作；复杂聊天不强制按关键词执行。

### 状态与限制

以上为代码接入完成，未运行本轮测试、TypeScript检查、构建或浏览器动作验收，未确认实际跳跃落地、舞蹈肩袖和睡眠家具接触效果。既有“跳起来应拒绝”的测试期望已过时，后续恢复测试时需要更新为本地jump；不能声称当前完整测试通过。

模型、Blender、骨骼、权重、家具布局、官方人设、QwenProvider、Functions、密钥及部署配置未修改。已先备份被改代码。手机聊天布局文件未修改。当前只在本地，不推送或部署；朋友访问原Netlify网址仍是旧版本。用户确认发布后沿用原站点，无需更换分享链接。
## 2026-11-01 已授权发布

用户明确回复“你更新吧”，授权将本轮手机适配与单角色动作更新到原GitHub和Netlify。

- 已推送代码提交：d6be7df3fc68589720169215605268870aca39e8；main与feat/mobile-chat-actions-release均正常快进，无force push。
- 原站点：https://spontaneous-licorice-fbdd12.netlify.app/ 。部署ID：6ae751dfa077966bf9d86f22。页面+1个lumi Function实际部署，没有新建站点。
- 发布前生产构建与类型检查通过；84项离线测试通过。仅修正两处已经过时的本地“跳起来应拒绝”断言。没有新增完整动作视觉验收或付费Qwen测试。
- 独立依赖打包修复了最初联接依赖造成的人设路径污染；有问题的包未上传。最终27个前端文件、80个Function文件检查通过：0个已知密钥值匹配、无.env/备份/源模型工程，官方原稿字节一致，运行GLB仅cozy-room、shark、shuibuxin-walk三个。
- 公网GET首页200，加载新资源index-BuOniT9H.js；health.paidChat=configured；character.aiAvailable=true、version=0.2、sha256=7c48e1f06fe2312dc9906622fefc6c7e8ec5affa8454f33c8bed9ed239d4ffc7。GET action-intent返回405，路由存在且要求POST。未发送真实聊天。
- 正式模型、Blender源文件、官方原稿、QwenProvider、Functions源码及netlify.toml相对上次生产代码没有变更。此前已授权的生产Qwen开关保持开启。
- 公网浏览器首次50MB角色GLB下载Failed to fetch；刷新后实际显示3D房间、家具和猪猪心Idle，聊天面板为Qwen AI，原稿v0.2。390×844手机尺寸下角色与聊天上下分区同时可见，只有一个Canvas；截图见docs/mobile-chat-experience/live-390x844.png和live-desktop.png。本次没有发送消息，不是新的真实付费对话验收。首次大模型加载仍慢，手机真实键盘及各新增动作完整视觉验收仍待完成。

上文“未发布/未构建”的文字是开发阶段记录，本节为后续发布状态。