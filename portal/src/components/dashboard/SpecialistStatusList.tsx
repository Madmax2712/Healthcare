'use client';

import { useState } from 'react';
import { Menu } from '@headlessui/react';
import { ChevronDownIcon, ClockIcon } from '@heroicons/react/24/outline';
import StatusBadge from '@/components/ui/StatusBadge';
import type { HospitalSpecialist, AvailabilityStatus } from '@/types';

// ── Specialist Status List ──────────────────────────────────

interface SpecialistStatusListProps {
  specialists: HospitalSpecialist[];
  onStatusUpdate: (specialistId: string, status: AvailabilityStatus) => void;
  isLoading?: boolean;
}

const statusOptions: { value: AvailabilityStatus; label: string; color: string }[] = [
  { value: 'available', label: 'Available', color: 'text-hg-green-600' },
  { value: 'busy', label: 'Busy', color: 'text-hg-yellow-600' },
  { value: 'off_duty', label: 'Off Duty', color: 'text-hg-red-600' },
];

export default function SpecialistStatusList({
  specialists,
  onStatusUpdate,
  isLoading,
}: SpecialistStatusListProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusChange = async (specialistId: string, status: AvailabilityStatus) => {
    setUpdatingId(specialistId);
    await onStatusUpdate(specialistId, status);
    setUpdatingId(null);
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-hg-gray-200 bg-white">
        <div className="border-b border-hg-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-hg-gray-900">Specialist Status</h3>
        </div>
        <div className="divide-y divide-hg-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
              <div className="h-10 w-10 rounded-full bg-hg-gray-200" />
              <div className="flex-1">
                <div className="h-4 w-32 rounded bg-hg-gray-200" />
                <div className="mt-1 h-3 w-24 rounded bg-hg-gray-100" />
              </div>
              <div className="h-6 w-20 rounded-full bg-hg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hg-gray-200 bg-white shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hg-gray-200 px-5 py-4">
        <h3 className="text-base font-semibold text-hg-gray-900">
          Specialist Status
        </h3>
        <span className="text-sm text-hg-gray-500">
          {specialists.length} specialist{specialists.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      <div className="max-h-[480px] divide-y divide-hg-gray-100 overflow-y-auto">
        {specialists.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-hg-gray-500">
            No specialists found.
          </div>
        ) : (
          specialists.map((specialist) => (
            <div
              key={specialist.specialist_id}
              className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-hg-gray-50"
            >
              {/* Avatar */}
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-hg-primary-100 text-sm font-semibold text-hg-primary-700">
                {specialist.doctor_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-hg-gray-900">
                  {specialist.doctor_name}
                </p>
                <p className="truncate text-xs text-hg-gray-500">
                  {specialist.specialty?.specialty_name || 'General'}
                </p>
              </div>

              {/* Next Available */}
              {specialist.next_available_slot && (
                <div className="hidden items-center gap-1 text-xs text-hg-gray-400 lg:flex">
                  <ClockIcon className="h-3.5 w-3.5" />
                  <span>
                    {new Date(specialist.next_available_slot).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}

              {/* Status Badge */}
              <StatusBadge status={specialist.availability_status} size="sm" />

              {/* Status Update Dropdown */}
              <Menu as="div" className="relative">
                <Menu.Button
                  disabled={updatingId === specialist.specialist_id}
                  className="rounded-lg border border-hg-gray-200 px-2 py-1.5 text-xs text-hg-gray-500 transition-colors hover:bg-hg-gray-50 disabled:opacity-50"
                >
                  {updatingId === specialist.specialist_id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-hg-primary-200 border-t-hg-primary-600" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </Menu.Button>

                <Menu.Items className="absolute right-0 z-10 mt-1 w-36 origin-top-right rounded-lg border border-hg-gray-200 bg-white py-1 shadow-lg focus:outline-none">
                  {statusOptions.map((option) => (
                    <Menu.Item key={option.value}>
                      {({ active }) => (
                        <button
                          onClick={() =>
                            handleStatusChange(specialist.specialist_id, option.value)
                          }
                          className={`${
                            active ? 'bg-hg-gray-50' : ''
                          } flex w-full items-center px-3 py-2 text-sm ${option.color}`}
                        >
                          {option.label}
                          {specialist.availability_status === option.value && (
                            <span className="ml-auto text-hg-primary-500">&#10003;</span>
                          )}
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                </Menu.Items>
              </Menu>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
