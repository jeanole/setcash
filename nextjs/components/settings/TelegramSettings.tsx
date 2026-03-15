'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import SettingsSection from './SettingsSection';
import SetupGuide from '@/components/ui/SetupGuide';
import LinkAccountModal from './LinkAccountModal';
import LinkedAccountsTable from './LinkedAccountsTable';

interface TelegramSettingsProps {
  isAdmin: boolean;
  initialEnabled: boolean;
  initialMaskedToken: string | null;
  initialLinked: boolean;
  initialLinkedAt: string | null;
}

type BotStatus = 'offline' | 'starting' | 'online' | 'error';

export default function TelegramSettings({
  isAdmin,
  initialEnabled,
  initialMaskedToken,
  initialLinked,
  initialLinkedAt,
}: TelegramSettingsProps) {
  // Admin bot config state
  const [enabled, setEnabled] = useState(initialEnabled);
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [maskedToken, setMaskedToken] = useState(initialMaskedToken);
  const [savingSettings, setSavingSettings] = useState(false);
  const [botStatus, setBotStatus] = useState<BotStatus>(initialEnabled ? 'starting' : 'offline');
  const [restarting, setRestarting] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // User linking state
  const [linked, setLinked] = useState(initialLinked);
  const [linkedAt, setLinkedAt] = useState<string | null>(initialLinkedAt);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [unlinkingMe, setUnlinkingMe] = useState(false);

  // Poll bot status every 5s when on page
  const refreshBotStatus = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/admin/telegram/bot-status');
      if (res.ok) {
        const data = await res.json();
        setBotStatus(data.running ? 'online' : enabled ? 'offline' : 'offline');
        setLastChecked(new Date());
      }
    } catch {
      // ignore
    }
  }, [isAdmin, enabled]);

  useEffect(() => {
    if (!isAdmin) return;
    refreshBotStatus();
    const id = setInterval(refreshBotStatus, 5000);
    return () => clearInterval(id);
  }, [isAdmin, refreshBotStatus]);

  // ── Admin: save bot settings ──────────────────────────────────────────────

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const body: Record<string, unknown> = { telegramEnabled: enabled };
      if (tokenInput.trim()) {
        body.telegramBotToken = tokenInput.trim();
      }
      const res = await fetch('/api/admin/telegram/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      const data = await res.json();
      setMaskedToken(data.telegramBotToken);
      setTokenInput('');
      toast.success('Telegram settings saved');
      setBotStatus(data.telegramEnabled ? 'starting' : 'offline');
      setTimeout(refreshBotStatus, 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    setBotStatus('starting');
    try {
      const res = await fetch('/api/admin/telegram/restart', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to restart');
      toast.success('Bot restart triggered');
      setTimeout(refreshBotStatus, 2000);
    } catch {
      toast.error('Failed to restart bot');
    } finally {
      setRestarting(false);
    }
  };

  // ── User: unlink self ─────────────────────────────────────────────────────

  const handleUnlinkMe = async () => {
    if (!confirm('Unlink your Telegram account?')) return;
    setUnlinkingMe(true);
    try {
      const res = await fetch('/api/telegram/links/me', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to unlink');
      setLinked(false);
      setLinkedAt(null);
      toast.success('Telegram account unlinked');
    } catch {
      toast.error('Failed to unlink account');
    } finally {
      setUnlinkingMe(false);
    }
  };

  const handleLinked = () => {
    setLinked(true);
    setLinkedAt(new Date().toISOString());
    setShowLinkModal(false);
    toast.success('Telegram account linked!');
  };

  // ── Status badge ──────────────────────────────────────────────────────────

  const statusBadge = () => {
    const configs = {
      offline: { dot: 'bg-rose-500', label: 'Offline' },
      starting: { dot: 'bg-amber-400', label: 'Starting…' },
      online: { dot: 'bg-emerald-500', label: 'Online' },
      error: { dot: 'bg-rose-500', label: 'Error' },
    };
    const c = configs[botStatus];
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <span className={`inline-block w-2 h-2 rounded-full ${c.dot}`} />
        <span className="text-slate-700">{c.label}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Bot Configuration (Admin only) ──────────────────────────────── */}
      {isAdmin && (
        <SettingsSection
          title="Bot Configuration"
          description="Configure the Telegram bot for this project. Only admins can manage bot settings."
        >
          <div className="space-y-5">
            {/* Setup guide */}
            <SetupGuide title="How to set up the Telegram Bot">
              <ol className="space-y-2 list-none pl-0">
                <li className="flex gap-2">
                  <span className="font-medium text-indigo-600 shrink-0">1.</span>
                  <span className="text-slate-600">
                    Open Telegram and search for{' '}
                    <span className="font-semibold text-slate-800">@BotFather</span>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-indigo-600 shrink-0">2.</span>
                  <span className="text-slate-600">
                    Send <span className="font-semibold text-slate-800">/newbot</span> and follow the
                    prompts to name your bot
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-indigo-600 shrink-0">3.</span>
                  <span className="text-slate-600">
                    BotFather will give you a token (format:{' '}
                    <span className="font-semibold text-slate-800">123456789:ABC-DEF...</span>)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-indigo-600 shrink-0">4.</span>
                  <span className="text-slate-600">
                    Paste the token in the{' '}
                    <span className="font-semibold text-slate-800">Bot Token</span> field below
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-indigo-600 shrink-0">5.</span>
                  <span className="text-slate-600">Enable the toggle and click "Save Changes"</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-indigo-600 shrink-0">6.</span>
                  <span className="text-slate-600">
                    The bot will start polling — status should turn green
                  </span>
                </li>
              </ol>
            </SetupGuide>

            {/* Status + restart */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Bot Status</p>
                {statusBadge()}
                {lastChecked && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Last checked: {lastChecked.toLocaleTimeString()}
                  </p>
                )}
              </div>
              <button
                onClick={handleRestart}
                disabled={restarting || !enabled}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {restarting ? 'Restarting…' : 'Restart Bot'}
              </button>
            </div>

            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="tg-enabled" className="text-sm font-medium text-slate-700">
                  Enable Telegram Bot
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Requires a valid bot token to be configured.
                </p>
              </div>
              <button
                type="button"
                id="tg-enabled"
                role="switch"
                aria-checked={enabled}
                disabled={!maskedToken && !tokenInput}
                onClick={() => setEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  enabled ? 'bg-[var(--accent)]' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
                <span className="sr-only">Enable Telegram Bot</span>
              </button>
            </div>

            {/* Bot token input */}
            <div>
              <label htmlFor="tg-token" className="block text-sm font-medium text-slate-700 mb-1">
                Bot Token
              </label>
              <div className="flex gap-2">
                <input
                  id="tg-token"
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={maskedToken ?? 'Enter bot token from @BotFather'}
                  autoComplete="new-password"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {maskedToken
                  ? `Current token ends in ${maskedToken.slice(-4)}. Leave blank to keep existing token.`
                  : 'Get your token from @BotFather on Telegram. Format: 123456789:ABC...'}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-2 bg-[var(--accent)] text-zinc-900 rounded-md font-medium text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingSettings ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </SettingsSection>
      )}

      {/* ── User Linking ────────────────────────────────────────────────── */}
      <SettingsSection
        title="Link Your Account"
        description="Link your Telegram account to receive notifications and submit bills via the bot."
      >
        {!enabled && (
          <p className="text-sm text-slate-500">
            Telegram is not enabled for this project. Contact your admin to enable it.
          </p>
        )}

        {enabled && !linked && (
          <div className="space-y-4">
            <SetupGuide title="How to link your Telegram account">
              <ol className="space-y-2 list-none pl-0">
                <li className="flex gap-2">
                  <span className="font-medium text-indigo-600 shrink-0">1.</span>
                  <span className="text-slate-600">
                    Click{' '}
                    <span className="font-semibold text-slate-800">Link Telegram Account</span>{' '}
                    below to get a 6-character code
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-indigo-600 shrink-0">2.</span>
                  <span className="text-slate-600">
                    Open the project&apos;s Telegram bot in the Telegram app
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-indigo-600 shrink-0">3.</span>
                  <span className="text-slate-600">
                    Send the message{' '}
                    <span className="font-semibold text-slate-800">/link YOUR_CODE</span> (e.g.,{' '}
                    <span className="font-semibold text-slate-800">/link A1B2C3</span>)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-indigo-600 shrink-0">4.</span>
                  <span className="text-slate-600">
                    You&apos;ll see a confirmation here and in Telegram
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-indigo-600 shrink-0">5.</span>
                  <span className="text-slate-600">
                    Once linked, you can send photos to the bot to create bill drafts
                  </span>
                </li>
              </ol>
            </SetupGuide>

            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Your account is not linked.</p>
              <button
                onClick={() => setShowLinkModal(true)}
                className="px-4 py-2 bg-[var(--accent)] text-zinc-900 rounded-md font-medium text-sm hover:bg-[var(--accent-hover)] transition-colors"
              >
                Link Telegram Account
              </button>
            </div>
          </div>
        )}

        {enabled && linked && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <div>
                <p className="text-sm font-medium text-slate-700">Account linked</p>
                {linkedAt && (
                  <p className="text-xs text-slate-500">
                    Linked on {new Date(linkedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleUnlinkMe}
              disabled={unlinkingMe}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
            >
              {unlinkingMe ? 'Unlinking…' : 'Unlink Account'}
            </button>
          </div>
        )}
      </SettingsSection>

      {/* ── Linked Accounts Table (Admin only) ──────────────────────────── */}
      {isAdmin && (
        <SettingsSection
          title="Linked Accounts"
          description="All team members who have linked their Telegram accounts to this project."
        >
          <LinkedAccountsTable />
        </SettingsSection>
      )}

      {/* Link modal */}
      {showLinkModal && (
        <LinkAccountModal
          onClose={() => setShowLinkModal(false)}
          onLinked={handleLinked}
        />
      )}
    </div>
  );
}
