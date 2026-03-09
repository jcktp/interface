import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useStore } from '../store'
import { usePermissions } from '../hooks/usePermissions'
import { useNavAnimation } from '../hooks/useNavAnimation'
import clsx from 'clsx'
import Logo from './Logo'
import NavAnimation from './NavAnimation'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  SignalIcon,
  MapIcon,
  UsersIcon,
  BriefcaseIcon,
  UserGroupIcon,
  TrophyIcon,
  BuildingOffice2Icon,
  PresentationChartLineIcon,
  BanknotesIcon,
  AdjustmentsHorizontalIcon,
  Squares2X2Icon,
  BookmarkIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  DocumentChartBarIcon,
  ScaleIcon,
  SparklesIcon,
  BeakerIcon,
  CircleStackIcon,
  CodeBracketIcon,
  WrenchScrewdriverIcon,
  UserCircleIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import {
  SignalIcon as SignalSolid,
  MapIcon as MapSolid,
  UsersIcon as UsersSolid,
  BriefcaseIcon as BriefcaseSolid,
  UserGroupIcon as UserGroupSolid,
  TrophyIcon as TrophySolid,
  BuildingOffice2Icon as BuildingOffice2Solid,
  PresentationChartLineIcon as PresentationChartLineSolid,
  BanknotesIcon as BanknotesSolid,
  AdjustmentsHorizontalIcon as AdjustmentsHorizontalSolid,
  Squares2X2Icon as Squares2X2Solid,
  BookmarkIcon as BookmarkSolid,
  ArrowPathIcon as ArrowPathSolid,
  MagnifyingGlassIcon as MagnifyingGlassSolid,
  ClockIcon as ClockSolid,
  DocumentChartBarIcon as DocumentChartBarSolid,
  ScaleIcon as ScaleSolid,
  SparklesIcon as SparklesSolid,
  BeakerIcon as BeakerSolid,
  CircleStackIcon as CircleStackSolid,
  CodeBracketIcon as CodeBracketSolid,
  WrenchScrewdriverIcon as WrenchScrewdriverSolid,
  UserCircleIcon as UserCircleSolid,
  DocumentTextIcon as DocumentTextSolid,
  Cog6ToothIcon as Cog6ToothSolid,
} from '@heroicons/react/24/solid'

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>

interface NavItem {
  name: string
  href: string
  abbr: string
  permission?: string
  icon: IconComponent
  iconSolid: IconComponent
}

interface NavSection {
  label: string
  items: NavItem[]
}

const sections: NavSection[] = [
  {
    label: 'Strategy',
    items: [
      { name: 'Pulse', href: '/app/command-center', abbr: 'PL', permission: 'command_center:view', icon: SignalIcon, iconSolid: SignalSolid },
      { name: 'Strategic Planner', href: '/app/strategic-planner', abbr: 'SP', permission: 'planning:view', icon: MapIcon, iconSolid: MapSolid },
    ],
  },
  {
    label: 'People',
    items: [
      { name: 'Directory', href: '/app/employees', abbr: 'DR', permission: 'employees:view', icon: UsersIcon, iconSolid: UsersSolid },
      { name: 'Recruitment', href: '/app/recruitment', abbr: 'RC', permission: 'candidates:view', icon: BriefcaseIcon, iconSolid: BriefcaseSolid },
      { name: 'Diversity', href: '/app/diversity', abbr: 'DV', permission: 'analytics:view', icon: UserGroupIcon, iconSolid: UserGroupSolid },
      { name: 'KPIs & Targets', href: '/app/kpis', abbr: 'KT', permission: 'kpis:view', icon: TrophyIcon, iconSolid: TrophySolid },
    ],
  },
  {
    label: 'Planning',
    items: [
      { name: 'Workforce', href: '/app/workforce-planning', abbr: 'WF', permission: 'planning:view', icon: BuildingOffice2Icon, iconSolid: BuildingOffice2Solid },
      { name: 'Performance', href: '/app/performance', abbr: 'PF', permission: 'dashboard:view', icon: PresentationChartLineIcon, iconSolid: PresentationChartLineSolid },
      { name: 'Compensation', href: '/app/compensation', abbr: 'CP', permission: 'compensation:view', icon: BanknotesIcon, iconSolid: BanknotesSolid },
      { name: 'Scenario Modeling', href: '/app/scenarios', abbr: 'SM', permission: 'planning:view', icon: AdjustmentsHorizontalIcon, iconSolid: AdjustmentsHorizontalSolid },
    ],
  },
  {
    label: 'Insights',
    items: [
      { name: 'Dashboard', href: '/app/dashboard', abbr: 'DB', permission: 'analytics:view', icon: Squares2X2Icon, iconSolid: Squares2X2Solid },
      { name: 'My Dashboards', href: '/app/dashboards', abbr: 'MD', permission: 'analytics:view', icon: BookmarkIcon, iconSolid: BookmarkSolid },
      { name: 'Retention', href: '/app/retention', abbr: 'RT', permission: 'analytics:view', icon: ArrowPathIcon, iconSolid: ArrowPathSolid },
      { name: 'Deep Dive', href: '/app/deep-dive', abbr: 'DD', permission: 'deep_dive:view', icon: MagnifyingGlassIcon, iconSolid: MagnifyingGlassSolid },
      { name: 'Attendance', href: '/app/attendance', abbr: 'AT', permission: 'attendance:view', icon: ClockIcon, iconSolid: ClockSolid },
      { name: 'Reports', href: '/app/reports', abbr: 'RP', permission: 'analytics:view', icon: DocumentChartBarIcon, iconSolid: DocumentChartBarSolid },
      { name: 'Benchmarks', href: '/app/benchmarks', abbr: 'BM', permission: 'analytics:view', icon: ScaleIcon, iconSolid: ScaleSolid },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { name: 'AI Assistant', href: '/app/ai', abbr: 'AI', permission: 'ai_qa:use', icon: SparklesIcon, iconSolid: SparklesSolid },
      { name: 'ML Models', href: '/app/ml-models', abbr: 'ML', permission: 'ml:view', icon: BeakerIcon, iconSolid: BeakerSolid },
    ],
  },
  {
    label: 'Data',
    items: [
      { name: 'Management', href: '/app/data', abbr: 'MG', permission: 'uploads:view', icon: CircleStackIcon, iconSolid: CircleStackSolid },
      { name: 'SQL Editor', href: '/app/query-editor', abbr: 'SQ', permission: 'queries:execute', icon: CodeBracketIcon, iconSolid: CodeBracketSolid },
      { name: 'Metric Config', href: '/app/metrics', abbr: 'MC', permission: 'kpis:view', icon: WrenchScrewdriverIcon, iconSolid: WrenchScrewdriverSolid },
    ],
  },
  {
    label: 'Admin',
    items: [
      { name: 'Users', href: '/app/admin/users', abbr: 'US', permission: 'users:manage_roles', icon: UserCircleIcon, iconSolid: UserCircleSolid },
      { name: 'API Docs', href: '/app/api-docs', abbr: 'AP', permission: 'analytics:view', icon: DocumentTextIcon, iconSolid: DocumentTextSolid },
      { name: 'Settings', href: '/app/settings', abbr: 'ST', icon: Cog6ToothIcon, iconSolid: Cog6ToothSolid },
    ],
  },
]

function CollapsibleItems({
  isExpanded,
  children,
}: {
  isExpanded: boolean
  children: React.ReactNode
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [children, isExpanded])

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{ height: isExpanded ? (height !== undefined ? `${height}px` : 'auto') : '0px' }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  )
}

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useStore()
  const { hasPermission } = usePermissions()
  const isAnimating = useNavAnimation()
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Strategy': true,
    'People': true,
    'Planning': true,
    'Insights': true,
    'Intelligence': false,
    'Data': false,
    'Admin': false,
  })

  const toggleSection = (label: string) => {
    setExpandedSections(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const filteredSections = sections
    .map(s => ({
      ...s,
      items: s.items.filter(i => !i.permission || hasPermission(i.permission))
    }))
    .filter(s => s.items.length > 0)

  return (
    <aside className={clsx('sidebar-container', sidebarCollapsed ? 'w-20' : 'w-64')}>
      {/* Logo Area */}
      <div className="h-11 flex items-center px-5 bg-slate-900 border-b border-slate-800 shrink-0 relative overflow-hidden">
        <NavAnimation isRunning={isAnimating} />
        <span className="relative z-10">
          <Logo collapsed={sidebarCollapsed} light={true} />
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto no-scrollbar">
        {filteredSections.map((section, idx) => (
          <div key={section.label} className={clsx(idx > 0 && 'mt-4')}>
            {!sidebarCollapsed ? (
              <button
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between px-3 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                {section.label}
                <ChevronDownIcon className={clsx('w-3 h-3 transition-transform', !expandedSections[section.label] && '-rotate-90')} />
              </button>
            ) : null}

            {sidebarCollapsed && idx > 0 && <div className="my-2 border-t border-slate-100 dark:border-gray-800" />}

            <CollapsibleItems isExpanded={sidebarCollapsed || expandedSections[section.label]}>
              <div className="space-y-0.5">
                {section.items.map(item => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) => clsx(
                      'nav-item group',
                      isActive ? 'nav-item-active' : 'nav-item-inactive',
                      sidebarCollapsed && 'justify-center px-0'
                    )}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive ? (
                          <item.iconSolid className="w-4 h-4 flex-shrink-0 text-primary-500" />
                        ) : (
                          <item.icon className="w-4 h-4 flex-shrink-0 text-slate-400 dark:text-gray-500 group-hover:text-slate-600 dark:group-hover:text-gray-300 transition-colors" />
                        )}
                        {!sidebarCollapsed && <span className="truncate text-sm">{item.name}</span>}
                        {sidebarCollapsed && (
                          <span className="sr-only">{item.name}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </CollapsibleItems>
          </div>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-100 dark:border-gray-800 shrink-0">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-50"
        >
          {sidebarCollapsed ? <ChevronRightIcon className="w-5 h-5 mx-auto" /> : (
            <>
              <ChevronLeftIcon className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
