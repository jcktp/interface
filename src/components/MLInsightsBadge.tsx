import { SparklesIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

interface MLInsightsBadgeProps {
  modelName: string
  confidence?: number
}

export default function MLInsightsBadge({ modelName, confidence }: MLInsightsBadgeProps) {
  const confidenceLabel = confidence != null
    ? `${(confidence * 100).toFixed(0)}% accuracy`
    : null

  return (
    <Link
      to="/app/ml-models"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-50 border border-accent-200 text-accent-700 hover:bg-accent-100 transition-colors"
      title={
        confidenceLabel
          ? `Powered by ML model "${modelName}" with ${confidenceLabel}`
          : `Powered by ML model "${modelName}"`
      }
    >
      <SparklesIcon className="w-3.5 h-3.5" />
      <span>
        ML: {modelName}
        {confidenceLabel && (
          <span className="ml-1 text-accent-500">({confidenceLabel})</span>
        )}
      </span>
    </Link>
  )
}
