import { loadEnvFile } from 'node:process'
import { resolve } from 'node:path'
import { projectRoot } from '../character/config.ts'

try { loadEnvFile(resolve(projectRoot, '.env')) } catch (error) {
  if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw new Error('Unable to load server environment')
}
export interface QwenConfig { apiKey: string; baseUrl: string; model: string; enabled: boolean; timeoutMs: number; historyMessages: number; historyChars: number; historyPolicy: 'none' | 'window' }
function integer(value: string | undefined, fallback: number, min: number, max: number) {
  const number = Number(value ?? fallback)
  if (!Number.isInteger(number) || number < min || number > max) throw new Error('Invalid server limit configuration')
  return number
}
export function getQwenConfig(env: NodeJS.ProcessEnv = process.env): QwenConfig {
  const url = new URL(env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1')
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.username || url.password || url.search || url.hash) throw new Error('Invalid Qwen base URL')
  return {
    apiKey: env.DASHSCOPE_API_KEY?.trim() ?? '', baseUrl: url.href.replace(/\/$/, ''), model: env.QWEN_MODEL || 'qwen-plus',
    enabled: env.QWEN_ENABLE_PAID_REQUESTS === 'true', timeoutMs: integer(env.QWEN_TIMEOUT_MS, 60000, 1000, 180000),
    historyMessages: integer(env.QWEN_HISTORY_MESSAGES, 20, 0, 20), historyChars: integer(env.QWEN_HISTORY_CHARS, 12000, 1000, 60000),
    historyPolicy: env.QWEN_HISTORY_POLICY === 'none' ? 'none' : 'window',
  }
}
