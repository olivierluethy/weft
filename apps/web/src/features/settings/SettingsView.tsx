import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, KeyRound, ShieldCheck, Palette, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfilePanel } from './ProfilePanel';
import { AccountPanel } from './AccountPanel';
import { SessionsPanel } from './SessionsPanel';
import { AppearancePanel } from './AppearancePanel';

type TabId = 'profile' | 'account' | 'sessions' | 'appearance';

interface Tab {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account', icon: KeyRound },
  { id: 'sessions', label: 'Sessions & security', icon: ShieldCheck },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

export default function SettingsView() {
  const navigate = useNavigate();
  const [active, setActive] = useState<TabId>('profile');

  return (
    <div className="min-h-full bg-paper">
      <div className="mx-auto w-full max-w-[820px] px-4 py-8 sm:px-6 sm:py-12">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
        >
          <ArrowLeft size={16} />
          Back to workspace
        </button>

        <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight text-ink">
          Settings
        </h1>

        <div className="flex flex-col gap-8 md:flex-row md:gap-10">
          {/* Tab nav */}
          <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-52 md:flex-col md:overflow-visible">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActive(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded px-3 py-2 text-sm transition',
                    isActive
                      ? 'bg-thread-soft font-medium text-thread'
                      : 'text-ink-muted hover:bg-sunk hover:text-ink',
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Panel */}
          <div className="min-w-0 flex-1">
            {active === 'profile' && <ProfilePanel />}
            {active === 'account' && <AccountPanel />}
            {active === 'sessions' && <SessionsPanel />}
            {active === 'appearance' && <AppearancePanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
