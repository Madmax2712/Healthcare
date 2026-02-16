'use client';

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
  BellIcon,
  ChevronDownIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

// ── Header Component ────────────────────────────────────────

export default function Header() {
  const { admin, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="fixed left-64 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-hg-gray-200 bg-white px-6">
      {/* Portal Title */}
      <div>
        <h2 className="text-lg font-semibold text-hg-gray-900">
          HealthGuard Hospital Portal
        </h2>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications Bell */}
        <button
          type="button"
          className="relative rounded-lg p-2 text-hg-gray-400 transition-colors hover:bg-hg-gray-50 hover:text-hg-gray-600"
        >
          <BellIcon className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-hg-red-500" />
          </span>
        </button>

        {/* Admin User Dropdown */}
        <Menu as="div" className="relative">
          <Menu.Button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-hg-gray-50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-hg-primary-100 text-hg-primary-700">
              <span className="text-sm font-semibold">
                {admin?.full_name?.charAt(0)?.toUpperCase() || 'A'}
              </span>
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium text-hg-gray-900">
                {admin?.full_name || 'Admin User'}
              </p>
              <p className="text-xs text-hg-gray-500 capitalize">
                {admin?.role?.replace('_', ' ') || 'Administrator'}
              </p>
            </div>
            <ChevronDownIcon className="h-4 w-4 text-hg-gray-400" />
          </Menu.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg border border-hg-gray-200 bg-white py-1 shadow-lg focus:outline-none">
              <div className="border-b border-hg-gray-100 px-4 py-3">
                <p className="text-sm font-medium text-hg-gray-900">
                  {admin?.full_name || 'Admin User'}
                </p>
                <p className="text-xs text-hg-gray-500">{admin?.email}</p>
              </div>

              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => router.push('/settings')}
                    className={`${
                      active ? 'bg-hg-gray-50' : ''
                    } flex w-full items-center gap-3 px-4 py-2.5 text-sm text-hg-gray-700`}
                  >
                    <UserCircleIcon className="h-4 w-4" />
                    My Profile
                  </button>
                )}
              </Menu.Item>

              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => router.push('/settings')}
                    className={`${
                      active ? 'bg-hg-gray-50' : ''
                    } flex w-full items-center gap-3 px-4 py-2.5 text-sm text-hg-gray-700`}
                  >
                    <Cog6ToothIcon className="h-4 w-4" />
                    Settings
                  </button>
                )}
              </Menu.Item>

              <div className="border-t border-hg-gray-100">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className={`${
                        active ? 'bg-hg-red-50' : ''
                      } flex w-full items-center gap-3 px-4 py-2.5 text-sm text-hg-red-600`}
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4" />
                      Sign Out
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </header>
  );
}
