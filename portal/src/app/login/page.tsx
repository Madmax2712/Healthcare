'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import { EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';

// ── Validation Schema ───────────────────────────────────────

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ── Login Page ──────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading, error: authError, clearError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  // Clear auth errors when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    const success = await login(data.email, data.password);
    if (success) {
      router.push('/dashboard');
    }
    setIsSubmitting(false);
  };

  // Show nothing while checking auth state
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-hg-primary-200 border-t-hg-primary-600" />
      </div>
    );
  }

  // Don't render login form if authenticated (redirect will happen)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden flex-1 flex-col justify-center bg-gradient-to-br from-hg-primary-600 via-hg-primary-700 to-hg-primary-900 px-12 lg:flex">
        <div className="max-w-md">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="h-12 w-12 text-white" />
            <h1 className="text-3xl font-bold text-white">HealthGuard</h1>
          </div>
          <p className="mt-6 text-lg leading-relaxed text-hg-primary-100">
            Manage your hospital operations, specialist availability, schedules,
            and patient feedback all in one centralized portal.
          </p>
          <div className="mt-10 space-y-4">
            <div className="flex items-center gap-3 text-hg-primary-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <span className="text-sm font-bold text-white">1</span>
              </div>
              <span>Real-time specialist status tracking</span>
            </div>
            <div className="flex items-center gap-3 text-hg-primary-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <span className="text-sm font-bold text-white">2</span>
              </div>
              <span>Schedule management and analytics</span>
            </div>
            <div className="flex items-center gap-3 text-hg-primary-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <span className="text-sm font-bold text-white">3</span>
              </div>
              <span>Patient feedback and rating insights</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <ShieldCheckIcon className="h-10 w-10 text-hg-primary-600" />
            <h1 className="text-2xl font-bold text-hg-gray-900">HealthGuard</h1>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-hg-gray-900">Welcome back</h2>
            <p className="mt-2 text-sm text-hg-gray-500">
              Sign in to your hospital portal account
            </p>
          </div>

          {/* Error Display */}
          {authError && (
            <div className="mt-6 rounded-lg border border-hg-red-200 bg-hg-red-50 px-4 py-3">
              <p className="text-sm text-hg-red-700">{authError}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-hg-gray-700"
              >
                Email Address
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <EnvelopeIcon className="h-5 w-5 text-hg-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@hospital.com"
                  className={`
                    block w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm
                    placeholder:text-hg-gray-400
                    focus:outline-none focus:ring-2 focus:ring-offset-0
                    ${
                      errors.email
                        ? 'border-hg-red-300 text-hg-red-900 focus:border-hg-red-500 focus:ring-hg-red-200'
                        : 'border-hg-gray-300 text-hg-gray-900 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                    }
                  `}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-hg-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-hg-gray-700"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <LockClosedIcon className="h-5 w-5 text-hg-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={`
                    block w-full rounded-lg border py-2.5 pl-10 pr-10 text-sm
                    placeholder:text-hg-gray-400
                    focus:outline-none focus:ring-2 focus:ring-offset-0
                    ${
                      errors.password
                        ? 'border-hg-red-300 text-hg-red-900 focus:border-hg-red-500 focus:ring-hg-red-200'
                        : 'border-hg-gray-300 text-hg-gray-900 focus:border-hg-primary-500 focus:ring-hg-primary-200'
                    }
                  `}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-hg-gray-400 hover:text-hg-gray-600"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-hg-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="
                flex w-full items-center justify-center gap-2 rounded-lg
                bg-hg-primary-600 px-4 py-2.5 text-sm font-semibold text-white
                shadow-sm transition-all
                hover:bg-hg-primary-700 focus:outline-none focus:ring-2
                focus:ring-hg-primary-500 focus:ring-offset-2
                disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-hg-gray-400">
            HealthGuard Hospital Portal &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
