import { createServer } from 'node:http'
import { createDialogueHandler } from './http.ts'
import { CustomCharacterLoader } from './character/CustomCharacterLoader.ts'

const port = Number(process.env.PORT ?? 8787)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port')
const server = createServer(createDialogueHandler())
server.requestTimeout = 190_000
server.headersTimeout = 10_000
server.keepAliveTimeout = 5_000
server.maxConnections = 64
const customization=await new CustomCharacterLoader().load()
console.log(`Character customization: ${customization.status}${customization.reason?' / '+customization.reason:''}`)
server.listen(port, '127.0.0.1', () => console.log(`Lumi dialogue API: http://127.0.0.1:${port} (Demo / Qwen; Mini-SGLang not connected)`))
