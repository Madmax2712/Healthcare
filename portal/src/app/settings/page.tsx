'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Cog6ToothIcon,
  UserCircleIcon,
  KeyIcon,
  BellIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import PortalLayout from '@/components/layout/PortalLayout';
import { authApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { NotificationPreferences } from '@/types';

// ── Validation Schema ───────────────────────────────────────

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z
      .string()
      .min(1, 'New password is required')
      .min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

// ── Settings Page ───────────────────────────────────────────

export default function SettingsPage() {
  const { admin } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'notifications'>('profile');

  // Password form state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    email_alerts: true,
    specialist_status_changes: true,
    emergency_alerts: true,
    feedback_notifications: true,
    daily_summary: false,
  });
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  // ── Change Password ────────────────────────────────────────

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setIsChangingPassword(true);
    setPasswordStatus('idle');

    try {
      await authApi.changePassword(data.current_password, data.new_password);
      setPasswordStatus('success');
      setPasswordMessage('Password changed successfully.');
      reset();
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err: unknown) {
      setPasswordStatus('error');
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to change password. Please check your current password.';
      setPasswordMessage(message);
    } finally {
      setIsChangingPassword(false);
      setTimeout(() => setPasswordStatus('idle'), 5000);
    }
  };

  // ── Notification Preferences ───────────────────────────────

  const handleToggleNotif = (key: keyof NotificationPreferences) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveNotifications = useCallback(async () => {
    setIsSavingNotifs(true);
    setNotifStatus('idle');

    try {
      // In a real app, this would call an API endpoint
      // await authApi.updateNotificationPreferences(notifPrefs);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call
      setNotifStatus('success');
    } catch {
      setNotifStatus('error');
    } finally {
      setIsSavingNotifs(false);
      setTimeout(() => setNotifStatus('idle'), 4000);
    }
  }, []);

  // ── Tab Content ────────────────────────────────────────────

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: UserCircleIcon },
    { id: 'password' as const, label: 'Password', icon: KeyIcon },
    { id: 'notifications' as const, label: 'Notifications', icon: BellIcon },
  ];

  // ── Toggle Switch Component ────────────────────────────────

  const ToggleSwitch = ({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: () => void;
  }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-hg-gray-900">{label}</p>
        {description && <p className="text-xs text-hg-gray-500">{description}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
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

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <Cog6ToothIcon className="h-7 w-7 text-hg-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-hg-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-hg-gray-500">
              Manage your account preferences and security settings.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-hg-gray-200">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-medium transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-hg-primary-600 text-hg-primary-700'
                      : 'border-transparent text-hg-gray-500 hover:border-hg-gray-300 hover:text-hg-gray-700'
                  }
                `}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="max-w-2xl">
          {/* ── Profile Tab ──────────────────────────────────── */}
          {activeTab === 'profile' && (
            <div className="rounded-xl border border-hg-gray-200 bg-white p-6 shadow-card">
              <h2 className="text-lg font-semibold text-hg-gray-900">Profile Information</h2>
              <p className="mt-1 text-sm text-hg-gray-500">
                Your account details and role information.
              </p>

              <div className="mt-6 space-y-5">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-hg-primary-100 text-xl font-bold text-hg-primary-700">
                    {admin?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-hg-gray-900">
                      {admin?.full_name || 'Admin User'}
                    </p>
                    <p className="text-sm text-hg-gray-500 capitalize">
                      {admin?.role?.replace('_', ' ') || 'Administrator'}
                    </p>
                  </div>
                </div>

                <div className="border-t border-hg-gray-100 pt-5">
                  {/* Info Grid */}
                  <dl className="space-y-4">
                    <div className="flex items-center justify-between">
                      <dt className="text-sm font-medium text-hg-gray-500">Full Name</dt>
                      <dd className="text-sm text-hg-gray-900">
                        {admin?.full_name || '-'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm font-medium text-hg-gray-500">Email Address</dt>
                      <dd className="text-sm text-hg-gray-900">{admin?.email || '-'}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm font-medium text-hg-gray-500">Role</dt>
                      <dd>
                        <span className="inline-flex items-center rounded-full bg-hg-primary-50 px-2.5 py-1 text-xs font-semibold capitalize text-hg-primary-700">
                          {admin?.role?.replace('_', ' ') || 'Administrator'}
                        </span>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm font-medium text-hg-gray-500">Hospital ID</dt>
                      <dd className="text-sm font-mono text-hg-gray-600">
                        {admin?.hospital_id || '-'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm font-medium text-hg-gray-500">Status</dt>
                      <dd>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            admin?.is_active
                              ? 'bg-hg-green-50 text-hg-green-700'
                              : 'bg-hg-red-50 text-hg-red-700'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              admin?.is_active ? 'bg-hg-green-500' : 'bg-hg-red-500'
                            }`}
                          />
                          {admin?.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm font-medium text-hg-gray-500">Last Login</dt>
                      <dd className="text-sm text-hg-gray-600">
                        {admin?.last_login
                          ? new Date(admin.last_login).toLocaleString()
                          : 'Never'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm font-medium text-hg-gray-500">Account Created</dt>
                      <dd className="text-sm text-hg-gray-600">
                        {admin?.created_at
                          ? new Date(admin.created_at).toLocaleDateString()
                          : '-'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {/* ── Password Tab ─────────────────────────────────── */}
          {activeTab === 'password' && (
            <div className="rounded-xl border border-hg-gray-200 bg-white p-6 shadow-card">
              <h2 className="text-lg font-semibold text-hg-gray-900">Change Password</h2>
              <p className="mt-1 text-sm text-hg-gray-500">
                Update your password to keep your account secure.
              </p>

              {/* Status Message */}
              {passwordStatus !== 'idle' && (
                <div
                  className={`mt-4 flex items-center gap-3 rounded-lg border px-4 py-3 animate-fade-in ${
                    passwordStatus === 'success'
                      ? 'border-hg-green-200 bg-hg-green-50 text-hg-green-800'
                      : 'border-hg-red-200 bg-hg-red-50 text-hg-red-800'
                  }`}
                >
                  {passwordStatus === 'success' ? (
                    <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                  ) : (
                    <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                  )}
                  <p className="text-sm font-medium">{passwordMessage}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onPasswordSubmit)} className="mt-6 space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-hg-gray-700">
                    Current Password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      className={`block w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                        errors.current_password
                          ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                          : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                      }`}
                      placeholder="Enter your current password"
                      {...register('current_password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-hg-gray-400 hover:text-hg-gray-600"
                    >
                      {showCurrentPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {errors.current_password && (
                    <p className="mt-1 text-xs text-hg-red-600">
                      {errors.current_password.message}
                    </p>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-hg-gray-700">
                    New Password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className={`block w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                        errors.new_password
                          ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                          : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                      }`}
                      placeholder="Enter a new password"
                      {...register('new_password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-hg-gray-400 hover:text-hg-gray-600"
                    >
                      {showNewPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {errors.new_password && (
                    <p className="mt-1 text-xs text-hg-red-600">
                      {errors.new_password.message}
                    </p>
                  )}
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-sm font-medium text-hg-gray-700">
                    Confirm New Password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`block w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                        errors.confirm_password
                          ? 'border-hg-red-300 focus:border-hg-red-500 focus:ring-hg-red-200'
                          : 'border-hg-gray-300 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                      }`}
                      placeholder="Re-enter your new password"
                      {...register('confirm_password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-hg-gray-400 hover:text-hg-gray-600"
                    >
                      {showConfirmPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {errors.confirm_password && (
                    <p className="mt-1 text-xs text-hg-red-600">
                      {errors.confirm_password.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <div className="border-t border-hg-gray-100 pt-4">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="inline-flex items-center gap-2 rounded-lg bg-hg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-hg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isChangingPassword ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Changing Password...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Notifications Tab ────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="rounded-xl border border-hg-gray-200 bg-white p-6 shadow-card">
              <h2 className="text-lg font-semibold text-hg-gray-900">Notification Preferences</h2>
              <p className="mt-1 text-sm text-hg-gray-500">
                Choose which notifications you want to receive.
              </p>

              {/* Status Message */}
              {notifStatus !== 'idle' && (
                <div
                  className={`mt-4 flex items-center gap-3 rounded-lg border px-4 py-3 animate-fade-in ${
                    notifStatus === 'success'
                      ? 'border-hg-green-200 bg-hg-green-50 text-hg-green-800'
                      : 'border-hg-red-200 bg-hg-red-50 text-hg-red-800'
                  }`}
                >
                  {notifStatus === 'success' ? (
                    <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                  ) : (
                    <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                  )}
                  <p className="text-sm font-medium">
                    {notifStatus === 'success'
                      ? 'Notification preferences saved successfully.'
                      : 'Failed to save notification preferences.'}
                  </p>
                </div>
              )}

              <div className="mt-6 divide-y divide-hg-gray-100">
                <ToggleSwitch
                  label="Email Alerts"
                  description="Receive important alerts via email"
                  checked={notifPrefs.email_alerts}
                  onChange={() => handleToggleNotif('email_alerts')}
                />
                <ToggleSwitch
                  label="Specialist Status Changes"
                  description="Get notified when specialists change their availability"
                  checked={notifPrefs.specialist_status_changes}
                  onChange={() => handleToggleNotif('specialist_status_changes')}
                />
                <ToggleSwitch
                  label="Emergency Alerts"
                  description="Receive critical emergency notifications"
                  checked={notifPrefs.emergency_alerts}
                  onChange={() => handleToggleNotif('emergency_alerts')}
                />
                <ToggleSwitch
                  label="Feedback Notifications"
                  description="Get notified when new patient feedback is submitted"
                  checked={notifPrefs.feedback_notifications}
                  onChange={() => handleToggleNotif('feedback_notifications')}
                />
                <ToggleSwitch
                  label="Daily Summary"
                  description="Receive a daily summary of hospital activity"
                  checked={notifPrefs.daily_summary}
                  onChange={() => handleToggleNotif('daily_summary')}
                />
              </div>

              <div className="mt-6 border-t border-hg-gray-100 pt-4">
                <button
                  onClick={handleSaveNotifications}
                  disabled={isSavingNotifs}
                  className="inline-flex items-center gap-2 rounded-lg bg-hg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-hg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingNotifs ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Saving...
                    </>
                  ) : (
                    'Save Preferences'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
