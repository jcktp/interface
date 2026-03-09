import {
  ChartBarIcon,
  UserGroupIcon,
  CpuChipIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'

const features = [
  {
    name: 'Real-time Analytics',
    description:
      'Get instant insights into your workforce with live dashboards that update in real-time as your data changes.',
    icon: ChartBarIcon,
    color: 'bg-primary-100 text-primary-600',
  },
  {
    name: 'Workforce Planning',
    description:
      'Plan headcount, track actual vs planned metrics, and model scenarios to optimize your workforce strategy.',
    icon: UserGroupIcon,
    color: 'bg-secondary-100 text-secondary-600',
  },
  {
    name: 'AI-Powered Predictions',
    description:
      'Predict attrition risk, forecast headcount trends, and get AI-generated recommendations for retention.',
    icon: CpuChipIcon,
    color: 'bg-purple-100 text-purple-600',
  },
  {
    name: 'Seamless Integrations',
    description:
      'Connect with Workday, BambooHR, Greenhouse, Lever, and more for automatic data synchronization.',
    icon: ArrowPathIcon,
    color: 'bg-green-100 text-green-600',
  },
  {
    name: 'Compensation Planning',
    description:
      'Plan salary budgets, model merit cycles, and track compensation spend with multi-currency support.',
    icon: CurrencyDollarIcon,
    color: 'bg-amber-100 text-amber-600',
  },
  {
    name: 'Slack Integration',
    description:
      'Query metrics and update plans directly from Slack. Get real-time notifications and alerts.',
    icon: ChatBubbleLeftRightIcon,
    color: 'bg-pink-100 text-pink-600',
  },
  {
    name: 'Custom Dashboards',
    description:
      'Build custom dashboards with drag-and-drop widgets. Share with stakeholders and schedule reports.',
    icon: CalendarDaysIcon,
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    name: 'Enterprise Security',
    description:
      'SOC 2 compliant with SSO, RBAC, and data encryption. Your employee data is always secure.',
    icon: ShieldCheckIcon,
    color: 'bg-red-100 text-red-600',
  },
]

export default function Features() {
  return (
    <div id="features" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">Everything you need</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Powerful Workforce Intelligence
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            From headcount tracking to AI-powered predictions, get all the tools you need to make data-driven workforce decisions.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-7xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.name}
                className="relative rounded-2xl border border-gray-200 p-8 hover:border-primary-300 hover:shadow-lg transition-all group"
              >
                <div className={`inline-flex rounded-lg p-3 ${feature.color} group-hover:scale-110 transition-transform`}>
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-6 text-lg font-semibold leading-8 text-gray-900">
                  {feature.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
