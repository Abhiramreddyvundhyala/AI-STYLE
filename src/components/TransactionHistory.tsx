/**
 * TransactionHistory Component
 * Paginated table of all credit purchase transactions.
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CreditCard, CheckCircle, XCircle, Clock, RotateCcw } from 'lucide-react';
import { useTransactionHistory } from '@/hooks/useCredits';
import type { TransactionStatus } from '@/lib/credits.types';

const STATUS_STYLES: Record<TransactionStatus, { label: string; icon: typeof CheckCircle; className: string }> = {
  created:  { label: 'Created',   icon: Clock,        className: 'bg-gray-100 text-gray-600' },
  pending:  { label: 'Pending',   icon: Clock,        className: 'bg-yellow-50 text-yellow-700' },
  captured: { label: 'Paid',      icon: CheckCircle,  className: 'bg-green-50 text-green-700' },
  failed:   { label: 'Failed',    icon: XCircle,      className: 'bg-red-50 text-red-700' },
  refunded: { label: 'Refunded',  icon: RotateCcw,    className: 'bg-orange-50 text-orange-700' },
};

function StatusBadge({ status }: { status: TransactionStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.created;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.className}`}>
      <Icon size={11} />
      {s.label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TransactionHistory() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading, isError } = useTransactionHistory(page, PAGE_SIZE);

  const transactions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasMore = data?.has_more ?? false;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-red-500">
        Failed to load transaction history. Please refresh.
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16">
        <CreditCard size={40} className="mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500 font-medium">No transactions yet</p>
        <p className="text-gray-400 text-sm mt-1">Your payment history will appear here.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Package</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Credits</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Payment ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {transactions.map((txn) => (
              <tr key={txn.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                  {formatDate(txn.created_at)}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {txn.package_name_snapshot}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-bold text-violet-700">+{txn.credits_added_snapshot}</span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  ₹{Number(txn.amount).toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-gray-400 ml-1">{txn.currency}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={txn.status} />
                </td>
                <td className="px-4 py-3">
                  {txn.payment_id ? (
                    <span className="font-mono text-xs text-gray-500 truncate max-w-[120px] block">
                      {txn.payment_id}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-600 px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
