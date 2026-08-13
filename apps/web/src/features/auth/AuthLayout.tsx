import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { APP_TAGLINE } from '@weft/shared';

/** Split auth layout: a woven brand panel beside the form. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-full">
      {/* Brand panel */}
      <div className="relative hidden w-[42%] max-w-[560px] flex-col justify-between overflow-hidden bg-thread p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 14px), repeating-linear-gradient(-45deg, #fff 0 1px, transparent 1px 14px)',
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <Logo size={34} badge={false} className="text-white" />
          <span className="font-display text-xl font-semibold tracking-tight">Weft</span>
        </div>
        <div className="relative">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">
            A woven web of
            <br />
            connected notes.
          </h1>
          <p className="mt-4 max-w-sm text-base text-white/70">
            Your local-first workspace. Nested pages, a real block editor, version history and
            live collaboration — all on your machine.
          </p>
        </div>
        <p className="relative text-xs text-white/50">{APP_TAGLINE} · Self-hosted · Open</p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Logo size={30} />
            <span className="font-display text-lg font-semibold">Weft</span>
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-sm text-ink-muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
