'use client'

export function GridSkeleton() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="h-10 w-full animate-pulse border-b border-zinc-200 bg-zinc-100" />
      <div className="h-8 w-full animate-pulse border-b border-zinc-200 bg-zinc-50" />
      <div className="flex-1 w-full animate-pulse bg-white">
        <div className="grid h-full grid-cols-12 opacity-20">
          {Array.from({ length: 120 }).map((_, index) => (
            <div key={index} className="border border-zinc-200 bg-zinc-50" />
          ))}
        </div>
      </div>
    </div>
  )
}
