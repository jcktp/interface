import { useEffect, useRef } from 'react'

export default function BackgroundAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width: number
    let height: number

    const particles: Particle[] = []
    const particleCount = 120
    // Using a primary accent color (indigo-ish)
    const color = '#6366f1'

    class Particle {
      x: number
      y: number
      vx: number
      vy: number
      size: number

      constructor() {
        this.x = Math.random() * width
        this.y = Math.random() * height
        this.vx = (Math.random() - 0.5) * 1.5
        this.vy = (Math.random() - 0.5) * 1.5
        this.size = 3 // Pixel size
      }

      update() {
        // Flock-like movement (simplified)
        this.x += this.vx
        this.y += this.vy

        if (this.x < 0) this.x = width
        if (this.x > width) this.x = 0
        if (this.y < 0) this.y = height
        if (this.y > height) this.y = 0

        // Subtle random steering
        this.vx += (Math.random() - 0.5) * 0.05
        this.vy += (Math.random() - 0.5) * 0.05

        // Speed limit
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
        if (speed > 2) {
          this.vx = (this.vx / speed) * 2
          this.vy = (this.vy / speed) * 2
        }
      }

      draw() {
        if (!ctx) return
        ctx.fillStyle = color
        ctx.globalAlpha = 0.6
        // Pixel-style square
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.size, this.size)
      }
    }

    const init = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height

      particles.length = 0
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle())
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      
      particles.forEach(p => {
        p.update()
        p.draw()
      })

      // Draw subtle connecting lines for flock effect
      ctx.strokeStyle = color
      ctx.lineWidth = 0.5
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 80) {
            ctx.globalAlpha = 1 - dist / 80
            ctx.beginPath()
            ctx.moveTo(particles[i].x + 1.5, particles[i].y + 1.5)
            ctx.lineTo(particles[j].x + 1.5, particles[j].y + 1.5)
            ctx.stroke()
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    window.addEventListener('resize', init)
    init()
    animate()

    return () => {
      window.removeEventListener('resize', init)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 bg-[#f8fafc]"
    />
  )
}
