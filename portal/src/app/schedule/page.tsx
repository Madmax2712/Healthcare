'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ClockIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import PortalLayout from '@/components/layout/PortalLayout';
import Modal from '@/components/ui/Modal';
import { scheduleApi, specialistApi } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';
import type { HospitalSpecialist, SpecialistSchedule, ScheduleSlot, ApiResponse } from '@/types';

// ── Constants ───────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

// ── Toast ───────────────────────────────────────────────────

interface ToastMessage {
  id: number;
  type: 'success' | 'error';
  message: string;
}

// ── Schedule Page ───────────────────────────────────────────

export default function SchedulePage() {
  const hospitalId = useAuthStore((state) => state.hospitalId);

  const [specialists, setSpecialists] = useState<HospitalSpecialist[]>([]);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string>('');
  const [schedules, setSchedules] = useState<SpecialistSchedule[]>([]);
  const [isLoadingSpecialists, setIsLoadingSpecialists] = useState(true);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);
  const [slotForm, setSlotForm] = useState<ScheduleSlot>({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
    is_active: true,
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // ── Toast Helpers ──────────────────────────────────────────

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Fetch Specialists ──────────────────────────────────────

  useEffect(() => {
    if (!hospitalId) return;

    const fetchSpecialists = async () => {
      setIsLoadingSpecialists(true);
      try {
        const response = await specialistApi.getAll(hospitalId, { limit: 100 });
        const data = response.data as ApiResponse<HospitalSpecialist[]>;
        if (data.success && data.data) {
          setSpecialists(data.data);
          if (data.data.length > 0) {
            setSelectedSpecialistId(data.data[0].specialist_id);
          }
        }
      } catch {
        showToast('error', 'Failed to load specialists.');
      } finally {
        setIsLoadingSpecialists(false);
      }
    };

    fetchSpecialists();
  }, [hospitalId, showToast]);

  // ── Fetch Schedules ────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    if (!hospitalId || !selectedSpecialistId) return;

    setIsLoadingSchedules(true);
    try {
      const response = await scheduleApi.getBySpecialist(hospitalId, selectedSpecialistId);
      const data = response.data as ApiResponse<SpecialistSchedule[]>;
      if (data.success && data.data) {
        setSchedules(data.data);
      }
    } catch {
      showToast('error', 'Failed to load schedules.');
    } finally {
      setIsLoadingSchedules(false);
    }
  }, [hospitalId, selectedSpecialistId, showToast]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // ── Schedule Grouped by Day ────────────────────────────────

  const schedulesByDay = DAYS_OF_WEEK.map((day) => ({
    ...day,
    slots: schedules.filter((s) => s.day_of_week === day.value),
  }));

  // ── Add Slot ───────────────────────────────────────────────

  const openAddSlotModal = (dayOfWeek: number) => {
    setEditingSlot(null);
    setSlotForm({
      day_of_week: dayOfWeek,
      start_time: '09:00',
      end_time: '17:00',
      is_active: true,
    });
    setIsSlotModalOpen(true);
  };

  const openEditSlotModal = (schedule: SpecialistSchedule) => {
    setEditingSlot({
      schedule_id: schedule.schedule_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      is_active: schedule.is_active,
    });
    setSlotForm({
      schedule_id: schedule.schedule_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      is_active: schedule.is_active,
    });
    setIsSlotModalOpen(true);
  };

  const closeSlotModal = () => {
    setIsSlotModalOpen(false);
    setEditingSlot(null);
  };

  // ── Save Slot ──────────────────────────────────────────────

  const handleSaveSlot = async () => {
    if (!hospitalId || !selectedSpecialistId) return;

    if (slotForm.start_time >= slotForm.end_time) {
      showToast('error', 'End time must be after start time.');
      return;
    }

    setIsSaving(true);

    try {
      let updatedSchedules: Partial<SpecialistSchedule>[];

      if (editingSlot?.schedule_id) {
        // Update existing
        updatedSchedules = schedules.map((s) =>
          s.schedule_id === editingSlot.schedule_id
            ? {
                ...s,
                start_time: slotForm.start_time,
                end_time: slotForm.end_time,
                is_active: slotForm.is_active,
              }
            : s
        );
      } else {
        // Add new
        updatedSchedules = [
          ...schedules,
          {
            specialist_id: selectedSpecialistId,
            day_of_week: slotForm.day_of_week,
            start_time: slotForm.start_time,
            end_time: slotForm.end_time,
            is_active: slotForm.is_active,
          },
        ];
      }

      const response = await scheduleApi.update(
        hospitalId,
        selectedSpecialistId,
        updatedSchedules
      );
      const data = response.data as ApiResponse<SpecialistSchedule[]>;

      if (data.success && data.data) {
        setSchedules(data.data);
        showToast('success', editingSlot ? 'Schedule slot updated.' : 'Schedule slot added.');
        closeSlotModal();
      } else {
        showToast('error', 'Failed to save schedule.');
      }
    } catch {
      showToast('error', 'Failed to save schedule.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete Slot ────────────────────────────────────────────

  const handleDeleteSlot = async (scheduleId: string) => {
    if (!hospitalId || !selectedSpecialistId) return;

    setIsSaving(true);

    try {
      const updatedSchedules = schedules.filter((s) => s.schedule_id !== scheduleId);
      const response = await scheduleApi.update(
        hospitalId,
        selectedSpecialistId,
        updatedSchedules
      );
      const data = response.data as ApiResponse<SpecialistSchedule[]>;

      if (data.success && data.data) {
        setSchedules(data.data);
        showToast('success', 'Schedule slot removed.');
      } else {
        showToast('error', 'Failed to remove schedule slot.');
      }
    } catch {
      showToast('error', 'Failed to remove schedule slot.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Toggle Active ──────────────────────────────────────────

  const handleToggleActive = async (scheduleId: string, isActive: boolean) => {
    if (!hospitalId) return;

    try {
      await scheduleApi.toggleActive(hospitalId, scheduleId, isActive);
      setSchedules((prev) =>
        prev.map((s) => (s.schedule_id === scheduleId ? { ...s, is_active: isActive } : s))
      );
      showToast('success', `Slot ${isActive ? 'activated' : 'deactivated'}.`);
    } catch {
      showToast('error', 'Failed to toggle slot status.');
    }
  };

  // ── Format Time ────────────────────────────────────────────

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-hg-gray-900">Schedule Management</h1>
          <p className="mt-1 text-sm text-hg-gray-500">
            Manage weekly schedules for your hospital specialists.
          </p>
        </div>

        {/* Specialist Selector */}
        <div className="max-w-md">
          <label className="block text-sm font-medium text-hg-gray-700">
            Select Specialist
          </label>
          <select
            value={selectedSpecialistId}
            onChange={(e) => setSelectedSpecialistId(e.target.value)}
            disabled={isLoadingSpecialists}
            className="mt-1.5 block w-full rounded-lg border border-hg-gray-300 bg-white px-3 py-2.5 text-sm text-hg-gray-900 focus:border-hg-primary-500 focus:outline-none focus:ring-2 focus:ring-hg-primary-200 disabled:cursor-not-allowed disabled:bg-hg-gray-100"
          >
            {isLoadingSpecialists ? (
              <option>Loading specialists...</option>
            ) : specialists.length === 0 ? (
              <option>No specialists available</option>
            ) : (
              specialists.map((s) => (
                <option key={s.specialist_id} value={s.specialist_id}>
                  {s.doctor_name} - {s.specialty?.specialty_name || 'General'}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Weekly Schedule Grid */}
        {isLoadingSchedules ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-xl border border-hg-gray-200 bg-white"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {schedulesByDay.map((day) => (
              <div
                key={day.value}
                className="rounded-xl border border-hg-gray-200 bg-white shadow-card"
              >
                {/* Day Header */}
                <div className="flex items-center justify-between border-b border-hg-gray-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-hg-gray-900">{day.label}</h3>
                  <button
                    onClick={() => openAddSlotModal(day.value)}
                    disabled={!selectedSpecialistId}
                    className="rounded-lg p-1 text-hg-primary-600 transition-colors hover:bg-hg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Add time slot"
                  >
                    <PlusIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Time Slots */}
                <div className="p-4">
                  {day.slots.length === 0 ? (
                    <p className="py-4 text-center text-xs text-hg-gray-400">
                      No scheduled slots
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {day.slots.map((slot) => (
                        <div
                          key={slot.schedule_id}
                          className={`
                            flex items-center gap-3 rounded-lg border px-3 py-2
                            ${
                              slot.is_active
                                ? 'border-hg-green-200 bg-hg-green-50'
                                : 'border-hg-gray-200 bg-hg-gray-50'
                            }
                          `}
                        >
                          <ClockIcon
                            className={`h-4 w-4 flex-shrink-0 ${
                              slot.is_active ? 'text-hg-green-600' : 'text-hg-gray-400'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium ${
                                slot.is_active ? 'text-hg-gray-900' : 'text-hg-gray-500 line-through'
                              }`}
                            >
                              {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                            </p>
                          </div>

                          {/* Toggle Active */}
                          <button
                            onClick={() =>
                              handleToggleActive(slot.schedule_id, !slot.is_active)
                            }
                            className={`
                              relative h-5 w-9 flex-shrink-0 rounded-full transition-colors
                              ${slot.is_active ? 'bg-hg-green-500' : 'bg-hg-gray-300'}
                            `}
                            title={slot.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <span
                              className={`
                                absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform
                                ${slot.is_active ? 'translate-x-4' : 'translate-x-0.5'}
                              `}
                            />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openEditSlotModal(slot)}
                            className="rounded p-1 text-hg-gray-400 hover:bg-white hover:text-hg-primary-600"
                            title="Edit slot"
                          >
                            <ClockIcon className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteSlot(slot.schedule_id)}
                            disabled={isSaving}
                            className="rounded p-1 text-hg-gray-400 hover:bg-white hover:text-hg-red-600 disabled:opacity-50"
                            title="Remove slot"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Slot Modal */}
        <Modal
          isOpen={isSlotModalOpen}
          onClose={closeSlotModal}
          title={editingSlot ? 'Edit Time Slot' : 'Add Time Slot'}
          size="sm"
        >
          <div className="space-y-4">
            {/* Day of Week */}
            <div>
              <label className="block text-sm font-medium text-hg-gray-700">Day</label>
              <select
                value={slotForm.day_of_week}
                onChange={(e) =>
                  setSlotForm({ ...slotForm, day_of_week: parseInt(e.target.value, 10) })
                }
                disabled={!!editingSlot}
                className="mt-1.5 block w-full rounded-lg border border-hg-gray-300 bg-white px-3 py-2.5 text-sm focus:border-hg-primary-500 focus:outline-none focus:ring-2 focus:ring-hg-primary-200 disabled:bg-hg-gray-100"
              >
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-hg-gray-700">Start Time</label>
              <input
                type="time"
                value={slotForm.start_time}
                onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                className="mt-1.5 block w-full rounded-lg border border-hg-gray-300 px-3 py-2.5 text-sm focus:border-hg-primary-500 focus:outline-none focus:ring-2 focus:ring-hg-primary-200"
              />
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-hg-gray-700">End Time</label>
              <input
                type="time"
                value={slotForm.end_time}
                onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                className="mt-1.5 block w-full rounded-lg border border-hg-gray-300 px-3 py-2.5 text-sm focus:border-hg-primary-500 focus:outline-none focus:ring-2 focus:ring-hg-primary-200"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-hg-gray-700">Active</label>
              <button
                type="button"
                onClick={() => setSlotForm({ ...slotForm, is_active: !slotForm.is_active })}
                className={`
                  relative h-6 w-11 rounded-full transition-colors
                  ${slotForm.is_active ? 'bg-hg-green-500' : 'bg-hg-gray-300'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform
                    ${slotForm.is_active ? 'translate-x-5' : 'translate-x-0.5'}
                  `}
                />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-hg-gray-100 pt-4">
              <button
                onClick={closeSlotModal}
                className="rounded-lg border border-hg-gray-300 px-4 py-2 text-sm font-medium text-hg-gray-700 hover:bg-hg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSlot}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-hg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-hg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving...
                  </>
                ) : editingSlot ? (
                  'Update Slot'
                ) : (
                  'Add Slot'
                )}
              </button>
            </div>
          </div>
        </Modal>

        {/* Toast Notifications */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`
                flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg animate-fade-in
                ${
                  toast.type === 'success'
                    ? 'border-hg-green-200 bg-hg-green-50 text-hg-green-800'
                    : 'border-hg-red-200 bg-hg-red-50 text-hg-red-800'
                }
              `}
            >
              {toast.type === 'success' ? (
                <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
              )}
              <p className="text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => dismissToast(toast.id)}
                className="ml-auto flex-shrink-0 rounded p-0.5 hover:bg-black/5"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
