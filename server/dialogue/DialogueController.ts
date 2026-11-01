import { randomUUID } from 'node:crypto'
import { isDialogueRequest, parseDialogueResponse } from '../../src/types/dialogue.ts'
import type { DialogueResponse } from '../../src/types/dialogue.ts'
import { CharacterRulesLoader } from '../character/CharacterRulesLoader.ts'
import { CharacterPromptBuilder } from '../prompts/CharacterPromptBuilder.ts'
import { DemoDialogueService } from './DemoDialogueService.ts'
import { MiniSGLangDialogueService } from './MiniSGLangDialogueService.ts'
import type { DialogueService } from './DialogueService.ts'

export class InvalidRequestError extends Error {}
export class DialogueController {
  private readonly loader: CharacterRulesLoader
  private readonly builder = new CharacterPromptBuilder()
  private readonly demo: DialogueService
  private readonly ai: DialogueService
  constructor(loader = new CharacterRulesLoader(), demo: DialogueService = new DemoDialogueService(), ai: DialogueService = new MiniSGLangDialogueService()) {
    this.loader = loader; this.demo = demo; this.ai = ai
  }
  async metadata() {
    const rules = await this.loader.load()
    return { ...rules.metadata, demoAvailable: true, aiAvailable: false } as const
  }
  async respond(value: unknown): Promise<DialogueResponse> {
    if (!isDialogueRequest(value)) throw new InvalidRequestError()
    const rules = await this.loader.load()
    const prompt = this.builder.build(value, rules)
    const service = value.mode === 'demo' ? this.demo : this.ai
    const response = await service.reply(value, prompt)
    const validated = parseDialogueResponse({ ...response, requestId: randomUUID(), mode: value.mode, rules: rules.metadata })
    const privateLines = (rules.sections.get(10) ?? '').split(/\r?\n/).map(line => line.replace(/^[-\s]+/, '')).filter(line => line.length >= 24)
    if (validated.reply.includes(rules.content.trim()) || (rules.custom&&validated.reply.includes(rules.custom.content)) || privateLines.some(line => validated.reply.includes(line))) {
      throw new Error('Internal character rules must not be returned to the browser')
    }
    return validated
  }
}
