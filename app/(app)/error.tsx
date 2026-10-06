"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card space-y-2">
      <h2 className="font-semibold text-red-700">Something went wrong</h2>
      <p className="text-sm text-gray-700">{error.message}</p>
      <button onClick={reset} className="btn-secondary">Try again</button>
    </div>
  );
}
