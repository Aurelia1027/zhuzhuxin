import type { Plugin } from 'vite'
import { createDialogueHandler } from './http.ts'

export function dialoguePlugin(): Plugin {
  const handle = createDialogueHandler()
  return {
    name: 'lumi-server-dialogue',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.startsWith('/api/')) void handle(request, response)
        else next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.startsWith('/api/')) void handle(request, response)
        else next()
      })
    },
  }
}
