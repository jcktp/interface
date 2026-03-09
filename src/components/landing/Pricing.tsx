import { Link } from 'react-router-dom'
import { CheckIcon } from '@heroicons/react/24/solid'

const tiers = [
  {
    name: 'Starter',
    id: 'tier-starter',
    href: '/signup?plan=starter',
    price: { monthly: '$99', annually: '$79' },
    description: 'Perfect for small teams getting started with workforce analytics.',
    features: [
      'Up to 100 employees',
      'Basic dashboards',
      'CSV imports',
      'Email support',
      '1 admin user',
      '30-day data retention',
    ],
    mostPopular: false,
  },
  {
    name: 'Professional',
    id: 'tier-professional',
    href: '/signup?plan=professional',
    price: { monthly: '$299', annually: '$249' },
    description: 'For growing companies that need advanced analytics.',
    features: [
      'Up to 500 employees',
      'Custom dashboards',
      'API integrations (BambooHR, Workday)',
      'AI attrition predictions',
      'Slack integration',
      '5 admin users',
      '1-year data retention',
      'Priority support',
    ],
    mostPopular: true,
  },
  {
    name: 'Enterprise',
    id: 'tier-enterprise',
    href: '/signup?plan=enterprise',
    price: { monthly: 'Custom', annually: 'Custom' },
    description: 'For large organizations with advanced requirements.',
    features: [
      'Unlimited employees',
      'Custom integrations',
      'SSO (Okta, Azure AD)',
      'Workforce planning module',
      'Compensation planning',
      'SQL query editor',
      'ML model fine-tuning',
      'Dedicated support',
      'Custom data retention',
      'On-premise option',
    ],
    mostPopular: false,
  },
]

export default function Pricing() {
  return (
    <div id="pricing" className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">Pricing</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Simple, transparent pricing
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Choose the plan that fits your organization. All plans include a 14-day free trial.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 items-center gap-y-6 sm:mt-20 sm:gap-y-0 lg:max-w-5xl lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`
                relative rounded-3xl p-8 ring-1
                ${tier.mostPopular
                  ? 'bg-white shadow-2xl ring-primary-500 scale-105 z-10'
                  : 'bg-white/60 ring-gray-200 sm:mx-4'
                }
              `}
            >
              {tier.mostPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-primary-600 px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className="text-lg font-semibold leading-8 text-gray-900">
                {tier.name}
              </h3>
              <p className="mt-4 text-sm leading-6 text-gray-600">
                {tier.description}
              </p>
              <p className="mt-6 flex items-baseline gap-x-1">
                <span className="text-4xl font-bold tracking-tight text-gray-900">
                  {tier.price.monthly}
                </span>
                {tier.price.monthly !== 'Custom' && (
                  <span className="text-sm font-semibold leading-6 text-gray-600">/month</span>
                )}
              </p>

              <Link
                to={tier.href}
                className={`
                  mt-6 block rounded-lg px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors
                  ${tier.mostPopular
                    ? 'bg-primary-600 text-white hover:bg-primary-500 focus-visible:outline-primary-600'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }
                `}
              >
                {tier.price.monthly === 'Custom' ? 'Contact Sales' : 'Start Free Trial'}
              </Link>

              <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <CheckIcon
                      className={`h-6 w-5 flex-none ${tier.mostPopular ? 'text-primary-600' : 'text-gray-400'}`}
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
