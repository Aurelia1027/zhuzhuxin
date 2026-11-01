import type { ReactNode } from 'react'

export type IconName = 'sun' | 'moon' | 'lamp' | 'reset' | 'rotate' | 'leaf' | 'mouse' | 'arrow'

const paths: Record<IconName, ReactNode> = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  moon: <path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z" />,
  lamp: <><path d="m8 3-4 9h16l-4-9ZM12 12v8m-5 1h10" /><path d="M17 12v4" /></>,
  reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>,
  rotate: <><path d="M3 9c1-3 4-5 9-5s9 3 9 7-4 7-9 7H9m-6-9V4m0 5h5m1 9 4-4m-4 4 4 4" /></>,
  leaf: <><path d="M20 3C8 2 3 7 5 14c6 6 15 1 15-11ZM5 21l10-12" /></>,
  mouse: <><rect x="6" y="2" width="12" height="20" rx="6" /><path d="M12 6v4" /></>,
  arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
