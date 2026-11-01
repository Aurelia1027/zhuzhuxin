/** Incremental SSE decoder shared by the browser and Node provider. */
export async function* readSse(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = '', event = 'message', data: string[] = []
  const abort = () => { void reader.cancel().catch(() => {}) }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    while (true) {
      signal?.throwIfAborted()
      const chunk = await reader.read()
      signal?.throwIfAborted()
      buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true })
      if (buffer.length > 131072) throw new Error('SSE frame too large')
      let newline: number
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, ''); buffer = buffer.slice(newline + 1)
        if (line === '') {
          if (data.length) yield { event, data: data.join('\n') }
          event = 'message'; data = []
        } else if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
        if (data.reduce((length, part) => length + part.length, 0) > 131072) throw new Error('SSE frame too large')
      }
      if (chunk.done) break
    }
    // A truncated frame is never mistaken for a completed reply.
    if (buffer.trim() || data.length) throw new Error('Incomplete SSE frame')
  } finally {
    signal?.removeEventListener('abort', abort)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
