import { useEffect, useRef } from 'react'

const COUNT = 20
const CONNECT_DIST = 55
const MAX_SPEED = 1.4

export default function NavAnimation({ isRunning }: { isRunning: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const isRunningRef = useRef(isRunning)
  const tickRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    isRunningRef.current = isRunning
    if (isRunning && tickRef.current && rafRef.current === undefined) {
      rafRef.current = requestAnimationFrame(tickRef.current)
    }
  }, [isRunning])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    interface P { x: number; y: number; vx: number; vy: number }
    let w = 0, h = 0
    const pts: P[] = []

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      w = rect.width || 256
      h = rect.height || 44
      canvas.width = w
      canvas.height = h
      pts.length = 0
      for (let i = 0; i < COUNT; i++) {
        pts.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
        })
      }
    }

    const tick = () => {
      if (!isRunningRef.current) {
        rafRef.current = undefined
        return
      }

      ctx.clearRect(0, 0, w, h)

      for (const p of pts) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0
        p.vx += (Math.random() - 0.5) * 0.04
        p.vy += (Math.random() - 0.5) * 0.04
        const spd = Math.hypot(p.vx, p.vy)
        if (spd > MAX_SPEED) { p.vx = (p.vx / spd) * MAX_SPEED; p.vy = (p.vy / spd) * MAX_SPEED }
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2)
      }

      ctx.lineWidth = 0.5
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const d = Math.hypot(dx, dy)
          if (d < CONNECT_DIST) {
            ctx.strokeStyle = `rgba(255,255,255,${(1 - d / CONNECT_DIST) * 0.35})`
            ctx.beginPath()
            ctx.moveTo(pts[i].x + 1, pts[i].y + 1)
            ctx.lineTo(pts[j].x + 1, pts[j].y + 1)
            ctx.stroke()
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    tickRef.current = tick
    window.addEventListener('resize', resize)
    resize()

    if (isRunningRef.current) {
      rafRef.current = requestAnimationFrame(tick)
    }

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = undefined
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
    />
  )
}
