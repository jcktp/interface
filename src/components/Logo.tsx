import clsx from 'clsx'

interface LogoProps {
  collapsed?: boolean
  className?: string
  light?: boolean
}

export default function Logo({ collapsed = false, className, light = false }: LogoProps) {
  const primaryFill = light ? '#ffffff' : '#1e293b'
  const accentFill = '#7c6aad'

  if (collapsed) {
    return (
      <div className={clsx('flex items-center justify-center', className)}>
        <svg viewBox="0 0 40 40" className="w-9 h-9" fill="none">
          {/* Three stacked horizontal lines forming an abstract "I" / interface layers */}
          <rect x="4" y="6" width="32" height="3" rx="1.5" fill={primaryFill} className={!light ? "dark:fill-white" : ""} />
          <rect x="8" y="14" width="24" height="3" rx="1.5" fill={accentFill} />
          <rect x="4" y="22" width="32" height="3" rx="1.5" fill={primaryFill} className={!light ? "dark:fill-white" : ""} />
          {/* Dot accent - represents a data point / cursor */}
          <circle cx="32" cy="31" r="3" fill={accentFill} />
          {/* Bottom line */}
          <rect x="8" y="30" width="18" height="3" rx="1.5" fill={primaryFill} opacity="0.4" className={!light ? "dark:fill-white" : ""} />
        </svg>
      </div>
    )
  }

  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 40 40" className="w-8 h-8 flex-shrink-0" fill="none">
        <rect x="4" y="6" width="32" height="3" rx="1.5" fill={primaryFill} className={!light ? "dark:fill-white" : ""} />
        <rect x="8" y="14" width="24" height="3" rx="1.5" fill={accentFill} />
        <rect x="4" y="22" width="32" height="3" rx="1.5" fill={primaryFill} className={!light ? "dark:fill-white" : ""} />
        <circle cx="32" cy="31" r="3" fill={accentFill} />
        <rect x="8" y="30" width="18" height="3" rx="1.5" fill={primaryFill} opacity="0.4" className={!light ? "dark:fill-white" : ""} />
      </svg>
      <span className={clsx("font-semibold text-[15px] tracking-tight", light ? "text-white" : "text-gray-900 dark:text-white")}>
        interface
      </span>
    </div>
  )
}
