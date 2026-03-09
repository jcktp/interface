import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface TrainingJob {
  id: string
  status: string
  progress: number
  current_step: string
  metrics: Record<string, number> | null
  feature_importance: Record<string, number> | null
  confusion_matrix: Record<string, number> | null
  training_logs: Array<{ epoch: number; train_loss: number; val_loss: number }> | null
  error_message: string | null
}

interface TrainingProgressProps {
  job: TrainingJob | null
  isLoading: boolean
}

const STEP_LABELS: Record<string, string> = {
  initializing: 'Initializing',
  loading_data: 'Loading Data',
  preprocessing: 'Preprocessing',
  training: 'Training Model',
  evaluation: 'Evaluating',
  completed: 'Completed',
}

const STEP_ORDER = ['initializing', 'loading_data', 'preprocessing', 'training', 'evaluation', 'completed']

export default function TrainingProgress({ job, isLoading }: TrainingProgressProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-100 rounded w-1/3" />
          <div className="h-2 bg-gray-100 rounded" />
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <ClockIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="font-medium text-gray-700">No Training in Progress</h3>
        <p className="text-sm text-gray-500 mt-1">
          Click "Train Model" to start training
        </p>
      </div>
    )
  }

  const currentStepIndex = STEP_ORDER.indexOf(job.current_step)

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Training Progress</h3>
          <StatusBadge status={job.status} />
        </div>
      </div>

      <div className="p-4">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">{STEP_LABELS[job.current_step]}</span>
            <span className="text-gray-900 font-medium">{Math.round(job.progress)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                job.status === 'failed' ? 'bg-danger-500' :
                job.status === 'completed' ? 'bg-success-500' : 'bg-primary-500'
              }`}
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {STEP_ORDER.slice(0, -1).map((step, index) => {
              const isComplete = index < currentStepIndex
              const isCurrent = index === currentStepIndex

              return (
                <div key={step} className="flex items-center gap-4 relative">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                      isComplete
                        ? 'bg-success-100 text-success-600'
                        : isCurrent
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircleIcon className="w-5 h-5" />
                    ) : isCurrent && job.status === 'running' ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <span className="text-sm">{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={`text-sm ${
                      isComplete
                        ? 'text-success-700'
                        : isCurrent
                        ? 'text-primary-700 font-medium'
                        : 'text-gray-400'
                    }`}
                  >
                    {STEP_LABELS[step]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Error message */}
        {job.error_message && (
          <div className="mt-4 p-3 bg-danger-50 border border-danger-200 rounded-lg">
            <div className="flex items-start gap-2">
              <XCircleIcon className="w-5 h-5 text-danger-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-danger-800">Training Failed</p>
                <p className="text-sm text-danger-700 mt-1">{job.error_message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Training logs (loss curve data) */}
        {job.training_logs && job.training_logs.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Training Progress</h4>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="space-y-1">
                {job.training_logs.slice(-5).map((log) => (
                  <div key={log.epoch} className="flex justify-between text-xs">
                    <span className="text-gray-500">Epoch {log.epoch}</span>
                    <span className="text-gray-700">
                      Loss: {log.train_loss.toFixed(4)} / Val: {log.val_loss.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: 'bg-gray-100 text-gray-700',
    running: 'bg-primary-100 text-primary-700',
    completed: 'bg-success-100 text-success-700',
    failed: 'bg-danger-100 text-danger-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }

  return (
    <span className={`text-xs px-2 py-1 rounded-full ${colors[status] || colors.queued}`}>
      {status}
    </span>
  )
}
