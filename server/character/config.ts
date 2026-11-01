import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
// This is the author's actual file, not a renamed or rewritten copy.
export const characterRulesPath = resolve(projectRoot, 'docs/character/zhuzhuxin.md')
