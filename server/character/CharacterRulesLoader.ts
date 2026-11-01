import { characterIdentity } from '../../src/types/characterIdentity.ts'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import type { RulesMetadata } from '../../src/types/dialogue.ts'
import { characterRulesPath } from './config.ts'
import { CustomCharacterLoader } from './CustomCharacterLoader.ts'
import type { CustomCharacter, CustomCharacterResult } from './CustomCharacterLoader.ts'

export interface CharacterRules { content: string; metadata: RulesMetadata; sections: ReadonlyMap<number, string>; custom?:CustomCharacter; customizationStatus?:CustomCharacterResult['status'] }
export class RulesLoadError extends Error {
  constructor() { super('角色原稿缺失、版本不支持或章节不完整；未使用旧版或通用规则替代。') }
}

export class CharacterRulesLoader {
  readonly path: string
  private readonly customLoader:CustomCharacterLoader
  constructor(path = characterRulesPath,customLoader=new CustomCharacterLoader()) { this.path = path;this.customLoader=customLoader }

  /** Read on every request: never write, normalize line endings, trim or cache author prose. */
  async load(): Promise<CharacterRules> {
    try {
      const bytes = await readFile(this.path)
      const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
      const version = /^Version:\s*(\d+\.\d+(?:\.\d+)?)[ \t]*$/mi.exec(content)?.[1]
      if (!version) throw new RulesLoadError()
      const [major, minor] = version.split('.').map(Number)
      if (major === 0 && minor < 2) throw new RulesLoadError()
      const headings = [...content.matchAll(/^(?:#{1,6}[ \t]+)?(\d{2})\.[ \t]+([^\r\n]+)/gm)]
      const sections = new Map<number, string>()
      headings.forEach((heading, i) => {
        const id = Number(heading[1])
        if (sections.has(id)) throw new RulesLoadError()
        sections.set(id, content.slice(heading.index! + heading[0].length, headings[i + 1]?.index ?? content.length))
      })
      if (Array.from({ length: 10 }, (_, i) => i + 1).some(id => !sections.get(id)?.trim())) throw new RulesLoadError()
      if (!sections.get(8)?.includes('用户：') || !sections.get(8)?.includes('朱朱：')) throw new RulesLoadError()
      const customization=await this.customLoader.load()
      return { content, sections, custom:customization.custom, customizationStatus:customization.status, metadata: { characterId: characterIdentity.id, version, sha256: createHash('sha256').update(bytes).digest('hex') } }
    } catch { throw new RulesLoadError() }
  }
}
