import { useLayoutEffect, useState } from 'react'

const query = '(max-width: 760px)'

/** UI geometry only: never subscribes the Canvas/App to typing or viewport events. */
export function useMobileChatLayout(open: boolean) {
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches)
  useLayoutEffect(() => {
    const media = window.matchMedia(query)
    const change = () => setMobile(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useLayoutEffect(() => {
    if (!open || !mobile) return
    const body = document.body
    const viewport = window.visualViewport
    const properties = ['--lumi-visible-height', '--lumi-visual-top', '--lumi-scene-height', '--lumi-sheet-height']
    const previous = properties.map(name => body.style.getPropertyValue(name))
    const prior = body.getAttribute('data-mobile-chat-open')
    let frame = 0
    const measure = () => {
      // visualViewport handles keyboards that resize only the visual viewport.
      // innerHeight + CSS dvh cover browsers without that API / layout-resizing keyboards.
      const height = Math.max(180, Math.round(viewport?.height ?? window.innerHeight))
      const top = Math.max(0, Math.round(viewport?.offsetTop ?? 0))
      const sheet = Math.round(height * (height < 500 ? .60 : .48))
      for (const [name, value] of [[properties[0], height], [properties[1], top], [properties[2], height - sheet], [properties[3], sheet]] as const)
        body.style.setProperty(name, `${value}px`)
      body.setAttribute('data-mobile-chat-open', 'true')
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    measure()
    viewport?.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      viewport?.removeEventListener('resize', schedule)
      viewport?.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (prior === null) body.removeAttribute('data-mobile-chat-open')
      else body.setAttribute('data-mobile-chat-open', prior)
      properties.forEach((name, index) => previous[index] ? body.style.setProperty(name, previous[index]) : body.style.removeProperty(name))
    }
  }, [open, mobile])
  return mobile
}
