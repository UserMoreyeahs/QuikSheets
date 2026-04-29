'use client'

import { X } from 'lucide-react'
import { AnomalySection } from '@/features/column-dna/components/AnomalySection'
import { DistributionChart } from '@/features/column-dna/components/DistributionChart'
import { HealthMetrics } from '@/features/column-dna/components/HealthMetrics'
import type { ColumnAnalysis } from '@/features/column-dna/utils/columnAnalyzer'
import type { ReactNode } from 'react'

interface ColumnDNAPanelProps {
  analysis: ColumnAnalysis | null
  columnLabel: string
  isLoading: boolean
  isOpen: boolean
  onClose: () => void
  onHighlightOutliers?: (indexes: number[]) => void
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-[120px] animate-pulse rounded-md bg-zinc-100" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-md bg-zinc-100" />
        ))}
      </div>
      <div className="h-20 animate-pulse rounded-md bg-zinc-100" />
      <div className="h-24 animate-pulse rounded-md bg-zinc-100" />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase text-zinc-500">{title}</h3>
      {children}
    </section>
  )
}

export function ColumnDNAPanel({
  analysis,
  columnLabel,
  isLoading,
  isOpen,
  onClose,
  onHighlightOutliers,
}: ColumnDNAPanelProps) {
  return (
    <aside
      className={[
        'fixed right-0 top-0 z-[95] flex h-screen w-[320px] flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-200',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
      aria-hidden={!isOpen}
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
        <h2 className="min-w-0 truncate text-sm font-semibold text-zinc-900">
          Column {columnLabel} — DNA Analysis
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          aria-label="Close column DNA"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading || !analysis ? (
          <LoadingSkeleton />
        ) : (
          <div className="space-y-5 p-4">
            <Section title="Distribution chart">
              <DistributionChart analysis={analysis} />
            </Section>

            <Section title="Health metrics">
              <HealthMetrics analysis={analysis} />
            </Section>

            <Section title="Data type analysis">
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <div className="text-lg font-semibold capitalize text-zinc-900">
                  {analysis.detectedType}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Dominant type: {analysis.dominantType}
                  {analysis.mixedTypeCount > 0 ? `, ${analysis.mixedTypeCount} mixed value(s)` : ''}
                </div>
              </div>
            </Section>

            <Section title="Anomaly detection">
              <AnomalySection
                analysis={analysis}
                columnLabel={`Column ${columnLabel}`}
                {...(onHighlightOutliers ? { onHighlightOutliers } : {})}
              />
            </Section>

            {analysis.topValues.length > 0 && (
              <Section title="Top values">
                <div className="space-y-1.5">
                  {analysis.topValues.map((item) => (
                    <div
                      key={item.value}
                      className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-zinc-700">{item.value}</span>
                      <span className="ml-3 font-mono text-xs font-semibold text-zinc-500">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
