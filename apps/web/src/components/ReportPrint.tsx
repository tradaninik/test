'use client';

export default function ReportPrint() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
    >
      🖨 Print / Save as PDF
    </button>
  );
}
