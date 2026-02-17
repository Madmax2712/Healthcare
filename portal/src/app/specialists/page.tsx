'use client';

import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import PortalLayout from '@/components/layout/PortalLayout';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import { useSpecialists } from '@/hooks/useSpecialists';
import type {
  HospitalSpecialist,
  AvailabilityStatus,
  SpecialistFormData,
  TableColumn,
} from '@/types';

// ── Validation Schema ───────────────────────────────────────

const specialistSchema = z.object({
  doctor_name: z.string().min(1, 'Name is required').min(2, 'Name must be at least 2 characters'),
  specialty_id: z.string().min(1, 'Specialty is required'),
  license_number: z.string().min(1, 'License number is required'),
  consultation_fee: z.coerce
    .number()
    .min(0, 'Fee must be a positive number'),
  years_of_experience: z.coerce
    .number()
    .int('Must be a whole number')
    .min(0, 'Experience must be a positive number'),
});

type SpecialistFormValues = z.infer<typeof specialistSchema>;

// ── Common Specialties (for dropdown) ───────────────────────

const SPECIALTIES = [
  { id: 'cardiology', name: 'Cardiology' },
  { id: 'dermatology', name: 'Dermatology' },
  { id: 'emergency_medicine', name: 'Emergency Medicine' },
  { id: 'endocrinology', name: 'Endocrinology' },
  { id: 'gastroenterology', name: 'Gastroenterology' },
  { id: 'general_surgery', name: 'General Surgery' },
  { id: 'internal_medicine', name: 'Internal Medicine' },
  { id: 'neurology', name: 'Neurology' },
  { id: 'obstetrics_gynecology', name: 'Obstetrics & Gynecology' },
  { id: 'oncology', name: 'Oncology' },
  { id: 'ophthalmology', name: 'Ophthalmology' },
  { id: 'orthopedics', name: 'Orthopedics' },
  { id: 'pediatrics', name: 'Pediatrics' },
  { id: 'psychiatry', name: 'Psychiatry' },
  { id: 'pulmonology', name: 'Pulmonology' },
  { id: 'radiology', name: 'Radiology' },
  { id: 'urology', name: 'Urology' },
];

const STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'busy', label: 'Busy' },
  { value: 'off_duty', label: 'Off Duty' },
];

// ── Toast Component ─────────────────────────────────────────

interface ToastMessage {
  id: number;
  type: 'success' | 'error';
  message: string;
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  return (
    <div
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
        onClick={() => onDismiss(toast.id)}
        className="ml-auto flex-shrink-0 rounded p-0.5 hover:bg-black/5"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Specialists Page ────────────────────────────────────────

export default function SpecialistsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingSpecialist, setEditingSpecialist] = useState<HospitalSpecialist | null>(null);
  const [deletingSpecialist, setDeletingSpecialist] = useState<HospitalSpecialist | null>(null);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const {
    specialists,
    isLoading,
    createSpecialist,
    updateSpecialist,
    deleteSpecialist,
    updateStatus,
  } = useSpecialists({ autoFetch: true, search: searchQuery || undefined });

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

  // ── Form Setup ─────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SpecialistFormValues>({
    resolver: zodResolver(specialistSchema),
  });

  // ── Modal Handlers ─────────────────────────────────────────

  const openAddModal = () => {
    setEditingSpecialist(null);
    reset({
      doctor_name: '',
      specialty_id: '',
      license_number: '',
      consultation_fee: 0,
      years_of_experience: 0,
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (specialist: HospitalSpecialist) => {
    setEditingSpecialist(specialist);
    reset({
      doctor_name: specialist.doctor_name,
      specialty_id: specialist.specialty_id,
      license_number: specialist.license_number || '',
      consultation_fee: specialist.consultation_fee || 0,
      years_of_experience: specialist.years_of_experience || 0,
    });
    setIsFormModalOpen(true);
  };

  const openDeleteModal = (specialist: HospitalSpecialist) => {
    setDeletingSpecialist(specialist);
    setIsDeleteModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setEditingSpecialist(null);
    reset();
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeletingSpecialist(null);
  };

  // ── Form Submit ────────────────────────────────────────────

  const onFormSubmit = async (data: SpecialistFormValues) => {
    setIsFormSubmitting(true);

    try {
      if (editingSpecialist) {
        const result = await updateSpecialist(editingSpecialist.specialist_id, data as SpecialistFormData);
        if (result) {
          showToast('success', `Specialist "${data.doctor_name}" updated successfully.`);
          closeFormModal();
        } else {
          showToast('error', 'Failed to update specialist. Please try again.');
        }
      } else {
        const result = await createSpecialist(data as SpecialistFormData);
        if (result) {
          showToast('success', `Specialist "${data.doctor_name}" added successfully.`);
          closeFormModal();
        } else {
          showToast('error', 'Failed to create specialist. Please try again.');
        }
      }
    } catch {
      showToast('error', 'An unexpected error occurred.');
    } finally {
      setIsFormSubmitting(false);
    }
  };

  // ── Delete Handler ─────────────────────────────────────────

  const handleDelete = async () => {
    if (!deletingSpecialist) return;

    setIsDeleting(true);
    const success = await deleteSpecialist(deletingSpecialist.specialist_id);

    if (success) {
      showToast('success', `Specialist "${deletingSpecialist.doctor_name}" deleted successfully.`);
      closeDeleteModal();
    } else {
      showToast('error', 'Failed to delete specialist. Please try again.');
    }
    setIsDeleting(false);
  };

  // ── Status Change Handler ──────────────────────────────────

  const handleStatusChange = async (specialistId: string, status: AvailabilityStatus) => {
    const success = await updateStatus(specialistId, status);
    if (success) {
      showToast('success', 'Status updated successfully.');
    } else {
      showToast('error', 'Failed to update status.');
    }
  };

  // ── Filtered Data ──────────────────────────────────────────

  const filteredSpecialists = useMemo(() => {
    if (!searchQuery.trim()) return specialists;
    const query = searchQuery.toLowerCase();
    return specialists.filter(
      (s) =>
        s.doctor_name.toLowerCase().includes(query) ||
        s.specialty?.specialty_name?.toLowerCase().includes(query) ||
        s.license_number?.toLowerCase().includes(query)
    );
  }, [specialists, searchQuery]);

  // ── Table Columns ──────────────────────────────────────────

  const columns: TableColumn<HospitalSpecialist>[] = useMemo(
    () => [
      {
        key: 'doctor_name',
        header: 'Name',
        sortable: true,
        render: (item: HospitalSpecialist) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-hg-primary-100 text-xs font-semibold text-hg-primary-700">
              {item.doctor_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-hg-gray-900">{item.doctor_name}</p>
              {item.license_number && (
                <p className="text-xs text-hg-gray-400">Lic: {item.license_number}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'specialty_id',
        header: 'Specialty',
        sortable: true,
        render: (item: HospitalSpecialist) => (
          <span className="text-hg-gray-700">
            {item.specialty?.specialty_name || 'General'}
          </span>
        ),
      },
      {
        key: 'availability_status',
        header: 'Status',
        sortable: true,
        render: (item: HospitalSpecialist) => (
          <StatusBadge status={item.availability_status} />
        ),
      },
      {
        key: 'years_of_experience',
        header: 'Experience',
        sortable: true,
        render: (item: HospitalSpecialist) => (
          <span className="text-hg-gray-600">
            {item.years_of_experience != null ? `${item.years_of_experience} yrs` : '-'}
          </span>
        ),
      },
      {
        key: 'consultation_fee',
        header: 'Fee',
        sortable: true,
        render: (item: HospitalSpecialist) => (
          <span className="font-medium text-hg-gray-800">
            {item.consultation_fee != null ? `$${item.consultation_fee.toFixed(2)}` : '-'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'text-right',
        render: (item: HospitalSpecialist) => (
          <div className="flex items-center justify-end gap-2">
            {/* Status Dropdown */}
            <select
              value={item.availability_status}
              onChange={(e) =>
                handleStatusChange(item.specialist_id, e.target.value as AvailabilityStatus)
              }
              className="rounded-md border border-hg-gray-200 bg-white px-2 py-1 text-xs text-hg-gray-600 focus:border-hg-primary-500 focus:outline-none focus:ring-1 focus:ring-hg-primary-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Edit Button */}
            <button
              onClick={() => openEditModal(item)}
              className="rounded-lg p-1.5 text-hg-gray-400 transition-colors hover:bg-hg-primary-50 hover:text-hg-primary-600"
              title="Edit specialist"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>

            {/* Delete Button */}
            <button
              onClick={() => openDeleteModal(item)}
              className="rounded-lg p-1.5 text-hg-gray-400 transition-colors hover:bg-hg-red-50 hover:text-hg-red-600"
              title="Delete specialist"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-hg-gray-900">Specialists</h1>
            <p className="mt-1 text-sm text-hg-gray-500">
              Manage your hospital specialists and their availability.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-lg bg-hg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-hg-primary-700 focus:outline-none focus:ring-2 focus:ring-hg-primary-500 focus:ring-offset-2"
          >
            <PlusIcon className="h-5 w-5" />
            Add Specialist
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="h-5 w-5 text-hg-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by name, specialty, or license..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-lg border border-hg-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-hg-gray-900 placeholder:text-hg-gray-400 focus:border-hg-primary-500 focus:outline-none focus:ring-2 focus:ring-hg-primary-200"
          />
        </div>

        {/* Data Table */}
        <DataTable<HospitalSpecialist & Record<string, unknown>>
          columns={columns as TableColumn<HospitalSpecialist & Record<string, unknown>>[]}
          data={filteredSpecialists as (HospitalSpecialist & Record<string, unknown>)[]}
          keyField="specialist_id"
          isLoading={isLoading}
          emptyMessage="No specialists found. Add your first specialist to get started."
          pageSize={10}
        />

        {/* Add/Edit Modal */}
        <Modal
          isOpen={isFormModalOpen}
          onClose={closeFormModal}
          title={editingSpecialist ? 'Edit Specialist' : 'Add New Specialist'}
          description={
            editingSpecialist
              ? 'Update the specialist information below.'
              : 'Fill in the details to add a new specialist to your hospital.'
          }
          size="lg"
        >
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            {/* Doctor Name */}
            <div>
              <label className="block text-sm font-medium text-hg-gray-700">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Dr. John Smith"
                className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  errors.doctor_name
                    ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                    : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                }`}
                {...register('doctor_name')}
              />
              {errors.doctor_name && (
                <p className="mt-1 text-xs text-hg-red-600">{errors.doctor_name.message}</p>
              )}
            </div>

            {/* Specialty */}
            <div>
              <label className="block text-sm font-medium text-hg-gray-700">
                Specialty
              </label>
              <select
                className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  errors.specialty_id
                    ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                    : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                }`}
                {...register('specialty_id')}
              >
                <option value="">Select a specialty</option>
                {SPECIALTIES.map((spec) => (
                  <option key={spec.id} value={spec.id}>
                    {spec.name}
                  </option>
                ))}
              </select>
              {errors.specialty_id && (
                <p className="mt-1 text-xs text-hg-red-600">{errors.specialty_id.message}</p>
              )}
            </div>

            {/* License Number */}
            <div>
              <label className="block text-sm font-medium text-hg-gray-700">
                License Number
              </label>
              <input
                type="text"
                placeholder="MD-123456"
                className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  errors.license_number
                    ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                    : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                }`}
                {...register('license_number')}
              />
              {errors.license_number && (
                <p className="mt-1 text-xs text-hg-red-600">{errors.license_number.message}</p>
              )}
            </div>

            {/* Two-column row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Consultation Fee */}
              <div>
                <label className="block text-sm font-medium text-hg-gray-700">
                  Consultation Fee ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="150.00"
                  className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                    errors.consultation_fee
                      ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                      : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                  }`}
                  {...register('consultation_fee')}
                />
                {errors.consultation_fee && (
                  <p className="mt-1 text-xs text-hg-red-600">{errors.consultation_fee.message}</p>
                )}
              </div>

              {/* Years of Experience */}
              <div>
                <label className="block text-sm font-medium text-hg-gray-700">
                  Years of Experience
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="10"
                  className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                    errors.years_of_experience
                      ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                      : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                  }`}
                  {...register('years_of_experience')}
                />
                {errors.years_of_experience && (
                  <p className="mt-1 text-xs text-hg-red-600">{errors.years_of_experience.message}</p>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-hg-gray-100 pt-4">
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-lg border border-hg-gray-300 px-4 py-2 text-sm font-medium text-hg-gray-700 transition-colors hover:bg-hg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isFormSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-hg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-hg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFormSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {editingSpecialist ? 'Updating...' : 'Creating...'}
                  </>
                ) : editingSpecialist ? (
                  'Update Specialist'
                ) : (
                  'Add Specialist'
                )}
              </button>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteModal}
          title="Delete Specialist"
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-hg-red-100">
                <ExclamationTriangleIcon className="h-5 w-5 text-hg-red-600" />
              </div>
              <div>
                <p className="text-sm text-hg-gray-700">
                  Are you sure you want to delete{' '}
                  <span className="font-semibold">{deletingSpecialist?.doctor_name}</span>?
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-hg-gray-100 pt-4">
              <button
                onClick={closeDeleteModal}
                className="rounded-lg border border-hg-gray-300 px-4 py-2 text-sm font-medium text-hg-gray-700 transition-colors hover:bg-hg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-lg bg-hg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-hg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </Modal>

        {/* Toast Notifications */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
