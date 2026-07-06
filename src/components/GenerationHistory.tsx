/**
 * GenerationHistory Component
 * Paginated table of all AI image generation attempts.
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, CheckCircle, XCircle, Zap } from 'lucide-react';
import { useGenerationHistory } from '@/hooks/useCredits';
import type { GenerationStatus, CreditType } from '@/lib/credits.types';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: GenerationStatus }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">
        <CheckCircle size={10} /> Done
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700">
      <XCircle size={10} /> Failed
    </span>
  );
}

function CreditTypeBadge({ type }: { type: CreditType }) {
  if (type === 'free') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
        Free
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700">
      <Zap size={10} className="fill-violet-500" /> Paid
    </span>
  );
}

export function GenerationHistory() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading, isError } = useGenerationHistory(page, PAGE_SIZE);

  const generations = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasMore = data?.has_more ?? false;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-red-500">
        Failed to load generation history. Please refresh.
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className="text-center py-16">
        <ImageIcon size={40} className="mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500 font-medium">No generations yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Your AI image generation history will appear here.
        </p>
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
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Thumbnail</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Prompt</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Style</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Credit</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {generations.map((gen) => (
              <tr key={gen.id} className="hover:bg-gray-50/50 transition-colors">
                {/* Thumbnail */}
                <td className="px-4 py-3">
                  {gen.image_url ? (
                    <img
                      src={gen.image_url}
                      alt="Generated"
                      className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                      <ImageIcon size={16} className="text-gray-300" />
                    </div>
                  )}
                </td>

                {/* Prompt preview */}
                <td className="px-4 py-3">
                  <p className="text-gray-700 text-xs max-w-[200px] truncate" title={gen.prompt ?? ''}>
                    {gen.prompt ? `"${gen.prompt}"` : <span className="text-gray-400 italic">No prompt</span>}
                  </p>
                </td>

                {/* Style */}
                <td className="px-4 py-3">
                  {gen.styles ? (
                    <div>
                      <p className="font-medium text-gray-900 text-xs truncate max-w-[120px]">
                        {gen.styles.title}
                      </p>
                      <p className="text-gray-400 text-xs">{gen.styles.category}</p>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs italic">—</span>
                  )}
                </td>

                {/* Credit type */}
                <td className="px-4 py-3 text-center">
                  <CreditTypeBadge type={gen.credit_type} />
                </td>

                {/* Status */}
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={gen.status} />
                </td>

                {/* Date */}
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {formatDate(gen.created_at)}
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
