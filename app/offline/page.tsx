"use client"

import Link from "next/link"

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm space-y-4 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Offline
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          No internet connection
        </h1>
        <p className="text-sm text-muted-foreground">
          You are offline right now. Reconnect and refresh to continue creating your collage.
        </p>
        <Link
          href="/"
          className="inline-flex rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground"
        >
          Try again
        </Link>
      </div>
    </main>
  )
}
