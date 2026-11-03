import { SITE } from '@/lib/site';

export function Mark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0F2A33" />
      <path d="M3 17h7l3-8 5 15 3-9 2 2h6" fill="none" stroke="#E5484D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark />
      <span className={`display-md text-[1.6rem] leading-none ${light ? 'text-paper' : 'text-ink'}`}>{SITE.name}</span>
    </span>
  );
}
