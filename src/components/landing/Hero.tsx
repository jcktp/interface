import { Link } from 'react-router-dom'
import {
  UserGroupIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'

export default function Hero() {
  return (
    <div className="relative isolate overflow-hidden bg-gradient-to-b from-primary-50 to-white">
      {/* Background decorations */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary-200 to-secondary-200 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-24 pt-32 sm:pt-40 lg:px-8 lg:pt-44">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-2 lg:gap-x-16 lg:gap-y-6">
          <div className="max-w-xl lg:max-w-lg">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-4 py-1.5 text-sm font-medium text-primary-700 mb-6">
              <SparklesIcon className="h-4 w-4" />
              AI-Powered Workforce Intelligence
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Transform Your{' '}
              <span className="text-primary-600">Workforce Planning</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Make data-driven decisions with real-time workforce analytics. Track headcount, predict attrition, plan compensation, and optimize your workforce strategy with AI-powered insights.
            </p>
            <div className="mt-10 flex items-center gap-x-6">
              <Link
                to="/signup"
                className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-all hover:scale-105"
              >
                Start Free Trial
              </Link>
              <Link
                to="/login"
                className="text-sm font-semibold leading-6 text-gray-900 hover:text-primary-600 transition-colors"
              >
                Sign in <span aria-hidden="true">→</span>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-12 grid grid-cols-3 gap-8 border-t border-gray-200 pt-8">
              <div>
                <p className="text-3xl font-bold text-primary-600">500+</p>
                <p className="text-sm text-gray-600">Companies</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary-600">2M+</p>
                <p className="text-sm text-gray-600">Employees Tracked</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary-600">99.9%</p>
                <p className="text-sm text-gray-600">Uptime</p>
              </div>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="mt-16 lg:mt-0">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl opacity-20 blur-xl"></div>
              <div className="relative rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/10 overflow-hidden">
                {/* Mock Dashboard */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">Dashboard Overview</h3>
                    <span className="text-sm text-gray-500">Live</span>
                  </div>

                  {/* Metric Cards */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-primary-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <UserGroupIcon className="h-5 w-5 text-primary-600" />
                        <span className="text-sm text-gray-600">Headcount</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">1,247</p>
                      <p className="text-xs text-success-600">+3.2% vs last month</p>
                    </div>
                    <div className="bg-secondary-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowTrendingUpIcon className="h-5 w-5 text-secondary-600" />
                        <span className="text-sm text-gray-600">Retention</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">94.2%</p>
                      <p className="text-xs text-success-600">+1.8% vs last year</p>
                    </div>
                  </div>

                  {/* Chart Placeholder */}
                  <div className="bg-gray-50 rounded-lg p-4 h-40 flex items-end">
                    <div className="flex items-end gap-2 w-full h-full">
                      {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-primary-500 to-primary-300 rounded-t"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom decoration */}
      <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]" aria-hidden="true">
        <div
          className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-secondary-200 to-primary-200 opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
        />
      </div>
    </div>
  )
}
