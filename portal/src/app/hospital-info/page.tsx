'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import PortalLayout from '@/components/layout/PortalLayout';
import { hospitalApi } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';
import type { Hospital, HospitalFormData, ApiResponse } from '@/types';

// ── Validation Schema ───────────────────────────────────────

const hospitalSchema = z.object({
  hospital_name: z.string().min(1, 'Hospital name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip_code: z.string().min(1, 'ZIP code is required'),
  phone_number: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Invalid email address').or(z.literal('')),
  website_url: z.string().url('Invalid URL').or(z.literal('')),
  emergency_services: z.boolean(),
  has_icu: z.boolean(),
  has_trauma_center: z.boolean(),
  trauma_level: z.string(),
  total_beds: z.coerce.number().int().min(0, 'Must be a positive number'),
});

type HospitalFormValues = z.infer<typeof hospitalSchema>;

// ── Trauma Level Options ────────────────────────────────────

const TRAUMA_LEVELS = [
  { value: '', label: 'None' },
  { value: 'Level I', label: 'Level I - Comprehensive Regional Resource' },
  { value: 'Level II', label: 'Level II - Comprehensive' },
  { value: 'Level III', label: 'Level III - General' },
  { value: 'Level IV', label: 'Level IV - Basic' },
  { value: 'Level V', label: 'Level V - Initial Evaluation' },
];

// ── Hospital Info Page ──────────────────────────────────────

export default function HospitalInfoPage() {
  const hospitalId = useAuthStore((state) => state.hospitalId);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<HospitalFormValues>({
    resolver: zodResolver(hospitalSchema),
    defaultValues: {
      hospital_name: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      phone_number: '',
      email: '',
      website_url: '',
      emergency_services: false,
      has_icu: false,
      has_trauma_center: false,
      trauma_level: '',
      total_beds: 0,
    },
  });

  const emergencyServices = watch('emergency_services');
  const hasIcu = watch('has_icu');
  const hasTraumaCenter = watch('has_trauma_center');

  // ── Fetch Hospital Data ────────────────────────────────────

  const fetchHospital = useCallback(async () => {
    if (!hospitalId) return;

    setIsLoading(true);
    try {
      const response = await hospitalApi.getHospital(hospitalId);
      const data = response.data as ApiResponse<Hospital>;

      if (data.success && data.data) {
        const hospital = data.data;
        reset({
          hospital_name: hospital.hospital_name || '',
          address: hospital.address || '',
          city: hospital.city || '',
          state: hospital.state || '',
          zip_code: hospital.zip_code || '',
          phone_number: hospital.phone_number || '',
          email: hospital.email || '',
          website_url: hospital.website_url || '',
          emergency_services: hospital.emergency_services ?? false,
          has_icu: hospital.has_icu ?? false,
          has_trauma_center: hospital.has_trauma_center ?? false,
          trauma_level: hospital.trauma_level || '',
          total_beds: hospital.total_beds || 0,
        });
      }
    } catch {
      setSaveStatus('error');
      setSaveMessage('Failed to load hospital information.');
    } finally {
      setIsLoading(false);
    }
  }, [hospitalId, reset]);

  useEffect(() => {
    fetchHospital();
  }, [fetchHospital]);

  // ── Save Hospital Data ─────────────────────────────────────

  const onSubmit = async (formData: HospitalFormValues) => {
    if (!hospitalId) return;

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const response = await hospitalApi.updateHospital(hospitalId, formData as HospitalFormData);
      const data = response.data as ApiResponse<Hospital>;

      if (data.success) {
        setSaveStatus('success');
        setSaveMessage('Hospital information saved successfully.');
        // Reset form with new values to clear isDirty
        if (data.data) {
          reset({
            hospital_name: data.data.hospital_name || '',
            address: data.data.address || '',
            city: data.data.city || '',
            state: data.data.state || '',
            zip_code: data.data.zip_code || '',
            phone_number: data.data.phone_number || '',
            email: data.data.email || '',
            website_url: data.data.website_url || '',
            emergency_services: data.data.emergency_services ?? false,
            has_icu: data.data.has_icu ?? false,
            has_trauma_center: data.data.has_trauma_center ?? false,
            trauma_level: data.data.trauma_level || '',
            total_beds: data.data.total_beds || 0,
          });
        }
      } else {
        setSaveStatus('error');
        setSaveMessage('Failed to save hospital information.');
      }
    } catch (err: unknown) {
      setSaveStatus('error');
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to save hospital information. Please try again.';
      setSaveMessage(message);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  };

  // ── Toggle Component ───────────────────────────────────────

  const ToggleSwitch = ({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <div className="flex items-center justify-between rounded-lg border border-hg-gray-200 bg-white px-4 py-3">
      <div>
        <p className="text-sm font-medium text-hg-gray-900">{label}</p>
        {description && (
          <p className="text-xs text-hg-gray-500">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`
          relative h-6 w-11 flex-shrink-0 rounded-full transition-colors
          ${checked ? 'bg-hg-primary-600' : 'bg-hg-gray-300'}
        `}
      >
        <span
          className={`
            absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform
            ${checked ? 'translate-x-5' : 'translate-x-0.5'}
          `}
        />
      </button>
    </div>
  );

  // ── Loading State ──────────────────────────────────────────

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-hg-gray-900">Hospital Information</h1>
            <p className="mt-1 text-sm text-hg-gray-500">Loading hospital details...</p>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-12 rounded-lg bg-hg-gray-200" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-12 rounded-lg bg-hg-gray-200" />
              <div className="h-12 rounded-lg bg-hg-gray-200" />
            </div>
            <div className="h-12 rounded-lg bg-hg-gray-200" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-12 rounded-lg bg-hg-gray-200" />
              <div className="h-12 rounded-lg bg-hg-gray-200" />
              <div className="h-12 rounded-lg bg-hg-gray-200" />
            </div>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <BuildingOffice2Icon className="h-7 w-7 text-hg-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-hg-gray-900">Hospital Information</h1>
            <p className="mt-1 text-sm text-hg-gray-500">
              Manage your hospital profile and facility details.
            </p>
          </div>
        </div>

        {/* Save Status Message */}
        {saveStatus !== 'idle' && (
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 animate-fade-in ${
              saveStatus === 'success'
                ? 'border-hg-green-200 bg-hg-green-50 text-hg-green-800'
                : 'border-hg-red-200 bg-hg-red-50 text-hg-red-800'
            }`}
          >
            {saveStatus === 'success' ? (
              <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{saveMessage}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Information */}
          <div className="rounded-xl border border-hg-gray-200 bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold text-hg-gray-900">Basic Information</h2>
            <p className="mt-1 text-sm text-hg-gray-500">Core details about your hospital.</p>

            <div className="mt-6 space-y-4">
              {/* Hospital Name */}
              <div>
                <label className="block text-sm font-medium text-hg-gray-700">
                  Hospital Name
                </label>
                <input
                  type="text"
                  className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                    errors.hospital_name
                      ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                      : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                  }`}
                  {...register('hospital_name')}
                />
                {errors.hospital_name && (
                  <p className="mt-1 text-xs text-hg-red-600">{errors.hospital_name.message}</p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-hg-gray-700">Address</label>
                <input
                  type="text"
                  className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                    errors.address
                      ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                      : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                  }`}
                  {...register('address')}
                />
                {errors.address && (
                  <p className="mt-1 text-xs text-hg-red-600">{errors.address.message}</p>
                )}
              </div>

              {/* City, State, ZIP */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-hg-gray-700">City</label>
                  <input
                    type="text"
                    className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                      errors.city
                        ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                        : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                    }`}
                    {...register('city')}
                  />
                  {errors.city && (
                    <p className="mt-1 text-xs text-hg-red-600">{errors.city.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-hg-gray-700">State</label>
                  <input
                    type="text"
                    className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                      errors.state
                        ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                        : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                    }`}
                    {...register('state')}
                  />
                  {errors.state && (
                    <p className="mt-1 text-xs text-hg-red-600">{errors.state.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-hg-gray-700">ZIP Code</label>
                  <input
                    type="text"
                    className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                      errors.zip_code
                        ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                        : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                    }`}
                    {...register('zip_code')}
                  />
                  {errors.zip_code && (
                    <p className="mt-1 text-xs text-hg-red-600">{errors.zip_code.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="rounded-xl border border-hg-gray-200 bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold text-hg-gray-900">Contact Information</h2>
            <p className="mt-1 text-sm text-hg-gray-500">How patients can reach your hospital.</p>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-hg-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                      errors.phone_number
                        ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                        : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                    }`}
                    {...register('phone_number')}
                  />
                  {errors.phone_number && (
                    <p className="mt-1 text-xs text-hg-red-600">{errors.phone_number.message}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-hg-gray-700">Email</label>
                  <input
                    type="email"
                    placeholder="info@hospital.com"
                    className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                      errors.email
                        ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                        : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                    }`}
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-hg-red-600">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-hg-gray-700">Website URL</label>
                <input
                  type="url"
                  placeholder="https://www.hospital.com"
                  className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                    errors.website_url
                      ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                      : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                  }`}
                  {...register('website_url')}
                />
                {errors.website_url && (
                  <p className="mt-1 text-xs text-hg-red-600">{errors.website_url.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Facility Details */}
          <div className="rounded-xl border border-hg-gray-200 bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold text-hg-gray-900">Facility Details</h2>
            <p className="mt-1 text-sm text-hg-gray-500">
              Capabilities and services offered by your facility.
            </p>

            <div className="mt-6 space-y-4">
              {/* Toggle Switches */}
              <ToggleSwitch
                label="Emergency Services"
                description="Hospital provides emergency medical services"
                checked={emergencyServices}
                onChange={(val) => setValue('emergency_services', val, { shouldDirty: true })}
              />

              <ToggleSwitch
                label="ICU Available"
                description="Intensive Care Unit is available"
                checked={hasIcu}
                onChange={(val) => setValue('has_icu', val, { shouldDirty: true })}
              />

              <ToggleSwitch
                label="Trauma Center"
                description="Hospital operates as a designated trauma center"
                checked={hasTraumaCenter}
                onChange={(val) => setValue('has_trauma_center', val, { shouldDirty: true })}
              />

              {/* Trauma Level & Total Beds */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-hg-gray-700">
                    Trauma Level
                  </label>
                  <select
                    className="mt-1.5 block w-full rounded-lg border border-hg-gray-300 bg-white px-3 py-2.5 text-sm focus:border-hg-primary-500 focus:outline-none focus:ring-2 focus:ring-hg-primary-200"
                    {...register('trauma_level')}
                  >
                    {TRAUMA_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-hg-gray-700">
                    Total Beds
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                      errors.total_beds
                        ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                        : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                    }`}
                    {...register('total_beds')}
                  />
                  {errors.total_beds && (
                    <p className="mt-1 text-xs text-hg-red-600">{errors.total_beds.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-4">
            {isDirty && (
              <p className="text-sm text-hg-yellow-600">You have unsaved changes.</p>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-hg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-hg-primary-700 focus:outline-none focus:ring-2 focus:ring-hg-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </PortalLayout>
  );
}
