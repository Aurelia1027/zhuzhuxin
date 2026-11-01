import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

/** Original lettering is drawn locally, without external fonts or images. */
function makeTypographyTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 2048
  const context = canvas.getContext('2d')!
  context.fillStyle = '#101112'
  context.fillRect(0, 0, 1024, 2048)
  const words = ['AFTER', 'HOURS', 'STAY', 'LOUD', 'NIGHT', 'CITY', 'ROOM', 'CREATE', 'NO SIGNAL', 'DREAM', 'OFFLINE', 'FEEL']
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const index = row * 4 + col
      const inverse = index % 9 === 3
      context.save()
      context.translate(col * 256, row * 256)
      context.fillStyle = inverse ? '#e7e4d9' : '#101112'
      context.fillRect(7, 7, 242, 242)
      context.fillStyle = inverse ? '#141516' : '#e6e2d6'
      context.strokeStyle = context.fillStyle
      context.lineWidth = 2
      context.strokeRect(12, 12, 232, 232)
      if (index % 4 === 0) {
        context.save()
        context.translate(38, 225)
        context.rotate(-Math.PI / 2)
        context.font = '900 51px Arial, sans-serif'
        context.fillText(words[index % words.length], 0, 0, 206)
        context.restore()
        context.font = '900 69px Arial, sans-serif'
        context.fillText('N°', 70, 88)
        context.font = '900 96px Arial, sans-serif'
        context.fillText(String(index + 1).padStart(2, '0'), 68, 183)
      } else if (index % 4 === 1) {
        context.font = '900 57px Arial, sans-serif'
        context.fillText(words[index % words.length], 24, 74, 207)
        context.font = '900 35px Georgia, serif'
        context.fillText('MIDNIGHT', 24, 116, 207)
        context.font = '900 54px Arial, sans-serif'
        context.fillText(words[(index + 5) % words.length], 24, 177, 207)
        context.fillRect(24, 190, 207, 9)
        context.font = '12px monospace'
        context.fillText('YOUR SPACE / YOUR RULES', 24, 222, 207)
      } else if (index % 4 === 2) {
        context.save()
        context.translate(128, 116)
        context.rotate(index % 3 === 0 ? -0.12 : 0.1)
        context.lineWidth = 4
        context.beginPath()
        context.arc(0, 0, 83, 0, Math.PI * 2)
        context.stroke()
        context.beginPath()
        context.arc(0, 0, 72, 0, Math.PI * 2)
        context.stroke()
        context.textAlign = 'center'
        context.font = '900 45px Arial, sans-serif'
        context.fillText('STAY', 0, -6)
        context.fillText('REAL', 0, 39)
        context.restore()
        context.font = 'bold 17px monospace'
        context.fillText('INDEPENDENT CULTURE', 28, 224, 200)
      } else {
        context.font = '900 61px Arial, sans-serif'
        context.fillText('OUT OF', 23, 73, 210)
        context.font = '900 48px Georgia, serif'
        context.fillText('OFFICE', 23, 127, 210)
        context.font = '11px monospace'
        for (let line = 0; line < 5; line += 1) {
          context.fillText(line % 2 ? 'MAKE SOMETHING THAT MATTERS' : 'DREAM IN BLACK AND WHITE', 24, 151 + line * 16, 207)
        }
      }
      context.restore()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

export function TypographyWall() {
  const texture = useMemo(makeTypographyTexture, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh name="typography-wall" position={[-3.22, 1.625, -2.984]} receiveShadow>
      <planeGeometry args={[1.54, 3.25]} />
      <meshStandardMaterial map={texture} roughness={0.96} metalness={0} />
    </mesh>
  )
}
