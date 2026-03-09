import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

export function useNavAnimation(duration = 650) {
  const location = useLocation()
  const [isAnimating, setIsAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setIsAnimating(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setIsAnimating(false), duration)
    return () => clearTimeout(timerRef.current)
  }, [location.pathname, duration])

  return isAnimating
}
