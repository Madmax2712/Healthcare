'use client';

import { useState, useMemo } from 'react';
import {
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import type { TableColumn, SortConfig, SortDirection } from '@/types';

// ── Data Table Component ────────────────────────────────────

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyField: keyof T;
  pageSize?: number;
  totalItems?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  pageSize = 10,
  totalItems,
  currentPage = 1,
  onPageChange,
  isLoading = false,
  emptyMessage = 'No data available.',
  className = '',
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // ── Sorting ─────────────────────────────────────────────

  const handleSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [data, sortConfig]);

  // ── Pagination ──────────────────────────────────────────

  const total = totalItems ?? data.length;
  const totalPages = Math.ceil(total / pageSize);

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) {
      return <ChevronUpDownIcon className="h-4 w-4 text-hg-gray-300" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUpIcon className="h-4 w-4 text-hg-primary-600" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-hg-primary-600" />
    );
  };

  // ── Render ──────────────────────────────────────────────

  return (
    <div className={`overflow-hidden rounded-lg border border-hg-gray-200 bg-white ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-hg-gray-200">
          {/* Table Head */}
          <thead className="bg-hg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-hg-gray-500 ${
                    col.className || ''
                  }`}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(String(col.key))}
                      className="flex items-center gap-1 transition-colors hover:text-hg-gray-700"
                    >
                      {col.header}
                      {getSortIcon(String(col.key))}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-hg-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-hg-gray-500"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-hg-primary-200 border-t-hg-primary-600" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-hg-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((item) => (
                <tr
                  key={String(item[keyField as string])}
                  className="transition-colors hover:bg-hg-gray-50"
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={`whitespace-nowrap px-4 py-3 text-sm text-hg-gray-700 ${
                        col.className || ''
                      }`}
                    >
                      {col.render
                        ? col.render(item)
                        : String(item[col.key as string] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-hg-gray-200 bg-white px-4 py-3">
          <div className="text-sm text-hg-gray-500">
            Showing{' '}
            <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-medium">
              {Math.min(currentPage * pageSize, total)}
            </span>{' '}
            of <span className="font-medium">{total}</span> results
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage <= 1}
              className="rounded-lg border border-hg-gray-200 p-1.5 text-hg-gray-500 transition-colors hover:bg-hg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange?.(pageNum)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    currentPage === pageNum
                      ? 'bg-hg-primary-600 text-white'
                      : 'text-hg-gray-600 hover:bg-hg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-hg-gray-200 p-1.5 text-hg-gray-500 transition-colors hover:bg-hg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
