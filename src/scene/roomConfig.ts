import type { Position } from './palette'

export const room = { width: 8, depth: 6, height: 3.25 } as const
export const layout: Record<'bed' | 'desk' | 'cabinet' | 'shelf', Position> = {
  bed: [1.55, 0, 1.25],
  desk: [1.05, 0, -2.4],
  cabinet: [-2.12, 0, -2.65],
  shelf: [-0.84, 0, -2.65],
}

export const roomItems = {
  character: { name: '猪猪心', tag: 'YOUR ROOMMATE', description: '一只住在床边的短手臂毛绒室友。可以打个招呼，也可以一起安静待着。试试上方的挥手和听 Rap 动作。', detail: '毛绒室友 / 点击动作面板互动' },
  shark: { name: '灰鲨毛绒抱枕', tag: 'THE ROOMMATE', description: '点击这只大鲨鱼，它会轻轻浮起；再点一下，就回到床上。', detail: '灰色绒面 / 点击浮起与放回' },
  bed: { name: '棋盘格低床', tag: 'REST MODE', description: '低矮黑色床架、深灰被褥与黑白棋盘格。床靠房间右侧摆放，前方保留进入书桌区的过道。', detail: '黑色床架 / 棋盘格织物' },
  cabinet: { name: '球鞋陈列柜', tag: 'THE COLLECTION', description: '开放隔层与封闭收纳组合。常穿的鞋摆在台面，收藏的鞋留在独立陈列层。', detail: '哑光黑 / 多层收纳' },
  desk: { name: '蓝环电竞工作台', tag: 'AFTER HOURS', description: '点击书桌，猪猪心会走到桌旁再挥手。点击桌面台灯可单独开关桌灯；电竞椅暂不支持坐下。', detail: '冷蓝灯光 / 独立暖色桌灯' },
  shelf: { name: '高层收藏书架', tag: 'PERSONAL ARCHIVE', description: '靠墙的高层置物架收纳书、球鞋与小摆件。它位于鞋柜与书桌之间，让墙面形成连续的储物区。', detail: '2.65 米高 / 暖色层板灯' },
  door: { name: '深棕木门', tag: 'LEAVE THE NOISE', description: '深棕木门与黑白字母墙构成入口。传统门板纹理与现代黑色家具形成对比。', detail: '深棕木饰面 / 黑色五金' },
  typography: { name: '黑白字母拼贴墙', tag: 'TYPE / NO RULES', description: '不同字号、方向与密度的英文文字自由组合。用满墙黑白拼贴，让每天进门的第一眼都有自己的态度。', detail: '高对比字母拼贴 / 入口墙面' },
  window: { name: '黑色窗帘与窗景', tag: 'A DIFFERENT HOUR', description: '右侧窗户把日光引入房间。夜间切换为深蓝窗景，黑色褶皱窗帘与室内暖光形成层次。', detail: '右侧采光 / 深色织物' },
} as const

export type RoomItemId = keyof typeof roomItems
