'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  BuildingOffice2Icon as BuildingOffice2IconSolid,
  ChartBarIcon as ChartBarIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
} from '@heroicons/react/24/solid';

// ── Navigation Items ────────────────────────────────────────

const navItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    activeIcon: HomeIconSolid,
  },
  {
    name: 'Specialists',
    href: '/specialists',
    icon: UserGroupIcon,
    activeIcon: UserGroupIconSolid,
  },
  {
    name: 'Schedule',
    href: '/schedule',
    icon: CalendarDaysIcon,
    activeIcon: CalendarDaysIconSolid,
  },
  {
    name: 'Hospital Info',
    href: '/hospital-info',
    icon: BuildingOffice2Icon,
    activeIcon: BuildingOffice2IconSolid,
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: ChartBarIcon,
    activeIcon: ChartBarIconSolid,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Cog6ToothIcon,
    activeIcon: Cog6ToothIconSolid,
  },
];

// ── Sidebar Component ───────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-hg-gray-200 bg-white shadow-sidebar">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-hg-gray-200 px-6">
        <ShieldCheckIcon className="h-8 w-8 text-hg-primary-600" />
        <div>
          <h1 className="text-lg font-bold text-hg-gray-900">HealthGuard</h1>
          <p className="text-xs text-hg-gray-500">Hospital Portal</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = isActive ? item.activeIcon : item.icon;

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`
                    group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                    transition-all duration-150
                    ${
                      isActive
                        ? 'bg-hg-primary-50 text-hg-primary-700'
                        : 'text-hg-gray-600 hover:bg-hg-gray-50 hover:text-hg-gray-900'
                    }
                  `}
                >
                  <Icon
                    className={`h-5 w-5 flex-shrink-0 ${
                      isActive
                        ? 'text-hg-primary-600'
                        : 'text-hg-gray-400 group-hover:text-hg-gray-600'
                    }`}
                  />
                  <span>{item.name}</span>

                  {/* Active indicator */}
                  {isActive && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-hg-primary-500" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-hg-gray-200 px-4 py-3">
        <p className="text-xs text-hg-gray-400">
          HealthGuard Platform v1.0
        </p>
      </div>
    </aside>
  );
}
