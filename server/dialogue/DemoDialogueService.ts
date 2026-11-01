import type { DialogueRequest } from '../../src/types/dialogue.ts'
import type { PreparedCharacterPrompt } from '../prompts/CharacterPromptBuilder.ts'
import type { DialogueService, ModelReply } from './DialogueService.ts'

/** Explicit deterministic fixtures, separate from author few-shots and AI generation. */
export class DemoDialogueService implements DialogueService {
  readonly mode = 'demo' as const
  async reply(request: DialogueRequest, _prompt: PreparedCharacterPrompt): Promise<ModelReply> {
    const environment = { ...request.environment }
    let action: ModelReply['action'] = 'idle'
    let reply = '嗯…我刚好在发呆呢。想聊什么，你说。'
    if (/学习|工作|看书|读书/.test(request.message)) {
      action = 'read'; environment.lighting = 'day'
      reply = '那你学吧…我不打扰你。累了再叫我。'
    } else if (/放松|休息|难过|心情不好|累了/.test(request.message)) {
      action = 'sit'; environment.lighting = 'warm'
      reply = '先别想那么多了…要不要一起发会呆？'
    } else if (/你好|嗨|打招呼|你来|hello/i.test(request.message)) {
      action = 'wave'; reply = '你来啦…干嘛，想聊会儿？'
    }
    if (/夜间|关灯/.test(request.message)) environment.lighting = 'night'
    if (/下雨|雨天/.test(request.message)) environment.weather = 'rain'
    if (/晴天|停雨/.test(request.message)) environment.weather = 'clear'
    if (/lofi/i.test(request.message)) environment.music = 'lofi'
    else if (/ambient|氛围音乐/i.test(request.message)) environment.music = 'ambient'
    if (/关掉音乐|关闭音乐|停止音乐/.test(request.message)) environment.music = 'off'
    // Custom relationship is available to the service without becoming a new personality.
    if (request.relationship.mode === 'user-defined' && request.relationship.addressAs.trim()) {
      reply = `${request.relationship.addressAs.trim()}，${reply}`
    }
    return { reply, action, environment }
  }
}
