import { NavLink } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { usePermissions } from '../hooks/usePermissions'
import clsx from 'clsx'
import {
  ChartBarIcon,
  BriefcaseIcon,
  HeartIcon,
  SparklesIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  PresentationChartLineIcon,
  CpuChipIcon,
  CommandLineIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  FlagIcon,
  MagnifyingGlassCircleIcon,
  BuildingOfficeIcon,
  UsersIcon,
  DocumentTextIcon,
  DocumentChartBarIcon,
  Squares2X2Icon,
  CalculatorIcon,
  ScaleIcon,
  ChartBarSquareIcon,
} from '@heroicons/react/24/outline'

interface NavItem {
  name: string
  href: string
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>
  permission?: string
}

interface NavSection {
  label: string
  items: NavItem[]
}

const sections: NavSection[] = [
  {
    label: 'Strategy',
    items: [
      { name: 'Pulse', href: '/app/command-center', icon: HeartIcon, permission: 'command_center:view' },
      { name: 'Full-Cycle Planner', href: '/app/strategic-planner', icon: PresentationChartLineIcon, permission: 'planning:view' },
    ],
  },
  {
    label: 'People',
    items: [
      { name: 'Employees', href: '/app/employees', icon: UsersIcon, permission: 'employees:view' },
      { name: 'Recruitment', href: '/app/recruitment', icon: BriefcaseIcon, permission: 'candidates:view' },
      { name: 'Diversity & Inclusion', href: '/app/diversity', icon: SparklesIcon, permission: 'analytics:view' },
    ],
  },
  {
    label: 'Planning',
    items: [
      { name: 'Workforce Planning', href: '/app/workforce-planning', icon: CalendarDaysIcon, permission: 'planning:view' },
      { name: 'Compensation', href: '/app/compensation', icon: CurrencyDollarIcon, permission: 'compensation:view' },
      { name: 'Scenario Planning', href: '/app/scenarios', icon: PresentationChartLineIcon, permission: 'planning:view' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { name: 'Dashboard', href: '/app/dashboard', icon: ChartBarIcon, permission: 'analytics:view' },
      { name: 'Performance', href: '/app/performance', icon: ChartBarSquareIcon, permission: 'dashboard:view' },
      { name: 'My Dashboards', href: '/app/dashboards', icon: Squares2X2Icon, permission: 'analytics:view' },
      { name: 'Retention', href: '/app/retention', icon: HeartIcon, permission: 'analytics:view' },
      { name: 'Deep Dive', href: '/app/deep-dive', icon: MagnifyingGlassCircleIcon, permission: 'deep_dive:view' },
      { name: 'Attendance', href: '/app/attendance', icon: BuildingOfficeIcon, permission: 'attendance:view' },
      { name: 'Reports', href: '/app/reports', icon: DocumentChartBarIcon, permission: 'analytics:view' },
      { name: 'Benchmarks', href: '/app/benchmarks', icon: ScaleIcon, permission: 'analytics:view' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { name: 'AI Assistant', href: '/app/ai', icon: ChatBubbleLeftRightIcon, permission: 'ai_qa:use' },
      { name: 'ML Models', href: '/app/ml-models', icon: CpuChipIcon, permission: 'ml:view' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { name: 'KPIs & Targets', href: '/app/kpis', icon: FlagIcon, permission: 'kpis:view' },
      { name: 'Metric Definitions', href: '/app/metrics', icon: CalculatorIcon, permission: 'kpis:view' },
      { name: 'Data & Integrations', href: '/app/data', icon: CircleStackIcon, permission: 'uploads:view' },
      { name: 'SQL Editor', href: '/app/query-editor', icon: CommandLineIcon, permission: 'queries:execute' },
      { name: 'User Management', href: '/app/admin/users', icon: UsersIcon, permission: 'users:manage_roles' },
      { name: 'API Docs', href: '/app/api-docs', icon: DocumentTextIcon, permission: 'analytics:view' },
      { name: 'Settings', href: '/app/settings', icon: Cog6ToothIcon },
    ],
  },
]

export default function TopNavigation() {
  const { hasPermission } = usePermissions()

  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.permission || hasPermission(item.permission)
      ),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <nav className="hidden lg:flex items-center gap-1 ml-8">
      {filteredSections.map((section) => {
        if (section.label === 'Strategy') {
          return (
            <div key={section.label} className="flex gap-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    clsx(
                      'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'text-primary-700 dark:text-primary-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    )
                  }
                >
                  {item.name}
                </NavLink>
              ))}
            </div>
          )
        }

        return (
          <Menu as="div" key={section.label} className="relative inline-block text-left">
            <div>
              <MenuButton className="inline-flex items-center justify-center gap-x-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                {section.label}
                <ChevronDownIcon aria-hidden="true" className="-mr-1 h-4 w-4 text-gray-400" />
              </MenuButton>
            </div>

            <MenuItems
              transition
              className="absolute left-0 z-50 mt-2 w-56 origin-top-left rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 transition focus:outline-none data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in"
            >
              <div className="py-1">
                {section.items.map((item) => (
                  <MenuItem key={item.name}>
                    <NavLink
                      to={item.href}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </NavLink>
                  </MenuItem>
                ))}
              </div>
            </MenuItems>
          </Menu>
        )
      })}
    </nav>
  )
}
