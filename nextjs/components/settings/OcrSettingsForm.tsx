'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import SettingsSection from './SettingsSection';
import SetupGuide from '@/components/ui/SetupGuide';
import { updateProjectOcrSettings } from '@/lib/api/settings';
import type { ProjectOcrSettings } from '@/lib/api/settings';

interface OcrSettingsFormProps {
  initialSettings: ProjectOcrSettings;
}

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI (GPT-4o)' },
  { value: 'gemini', label: 'Google Gemini 1.5 Flash' },
  { value: 'claude', label: 'Anthropic Claude 3.5 Haiku' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
] as const;

export default function OcrSettingsForm({ initialSettings }: OcrSettingsFormProps) {
  const [ocrEnabled, setOcrEnabled] = useState(initialSettings.ocrEnabled);
  const [ocrProvider, setOcrProvider] = useState(initialSettings.ocrProvider || 'openai');
  const [ocrApiKey, setOcrApiKey] = useState('');
  const [ocrBaseUrl, setOcrBaseUrl] = useState(initialSettings.ocrBaseUrl || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (ocrEnabled && ocrProvider === 'custom' && !ocrBaseUrl.trim()) {
        setError('Base URL is required for Custom provider');
        return;
      }

      setIsLoading(true);

      try {
        const payload: {
          ocrEnabled: boolean;
          ocrProvider: 'openai' | 'gemini' | 'claude' | 'custom';
          ocrBaseUrl: string | null;
          ocrApiKey?: string;
        } = {
          ocrEnabled,
          ocrProvider: ocrProvider as 'openai' | 'gemini' | 'claude' | 'custom',
          ocrBaseUrl: ocrProvider === 'custom' ? ocrBaseUrl.trim() || null : null,
        };

        // Only include API key if the user typed something
        if (ocrApiKey.trim()) {
          payload.ocrApiKey = ocrApiKey.trim();
        }

        await updateProjectOcrSettings(payload);
        toast.success('AI Analysis settings saved');
        // Clear the key field after successful save
        setOcrApiKey('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        toast.error('Failed to save AI Analysis settings');
      } finally {
        setIsLoading(false);
      }
    },
    [ocrEnabled, ocrProvider, ocrApiKey, ocrBaseUrl]
  );

  const maskedKeyHint =
    initialSettings.ocrApiKey
      ? `...${initialSettings.ocrApiKey.slice(-4)}`
      : undefined;

  const guideSteps: Record<string, { step: string; detail?: string }[]> = {
    openai: [
      { step: 'Go to platform.openai.com → API Keys' },
      { step: 'Click "Create new secret key"' },
      { step: 'Copy the key', detail: 'starts with sk-' },
      { step: 'Paste it in the API Key field below' },
      { step: 'Model used: GPT-4o (vision-capable)' },
    ],
    gemini: [
      { step: 'Go to aistudio.google.com → Get API Key' },
      { step: 'Create an API key for your project' },
      { step: 'Copy the key' },
      { step: 'Paste it in the API Key field below' },
      { step: 'Model used: Gemini 1.5 Flash' },
    ],
    claude: [
      { step: 'Go to console.anthropic.com → API Keys' },
      { step: 'Create a new API key' },
      { step: 'Copy the key', detail: 'starts with sk-ant-' },
      { step: 'Paste it in the API Key field below' },
      { step: 'Model used: Claude 3.5 Haiku' },
    ],
    custom: [
      { step: 'Your provider must be OpenAI-compatible' },
      { step: 'Enter the base URL', detail: 'e.g., https://your-provider.com/v1' },
      { step: 'Enter the API key from your provider' },
    ],
  };

  const currentGuideSteps = guideSteps[ocrProvider] ?? guideSteps.openai;

  return (
    <SettingsSection
      title="AI Bill Analysis"
      description="Configure AI-powered OCR to automatically extract fields from uploaded bill images."
    >
      <div className="mb-6">
        <SetupGuide title="How to set up AI Analysis">
          <ol className="space-y-2 list-none pl-0">
            {currentGuideSteps.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span className="font-medium text-indigo-600 shrink-0">{index + 1}.</span>
                <span className="text-slate-600">
                  {item.step}
                  {item.detail && (
                    <> (<span className="font-semibold text-slate-800">{item.detail}</span>)</>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </SetupGuide>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label
              htmlFor="ocr-enabled"
              className="text-sm font-medium text-slate-700"
            >
              Enable AI Bill Analysis
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              When enabled, admins can trigger AI analysis on uploaded bill images.
            </p>
          </div>
          <button
            type="button"
            id="ocr-enabled"
            role="switch"
            aria-checked={ocrEnabled}
            onClick={() => setOcrEnabled((v: boolean) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2 ${
              ocrEnabled ? 'bg-[#6366f1]' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                ocrEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
            <span className="sr-only">Enable AI Bill Analysis</span>
          </button>
        </div>

        {/* Provider */}
        <div>
          <label
            htmlFor="ocr-provider"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Provider
          </label>
          <select
            id="ocr-provider"
            value={ocrProvider}
            onChange={(e) => setOcrProvider(e.target.value)}
            disabled={!ocrEnabled}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-[#6366f1] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* API Key */}
        <div>
          <label
            htmlFor="ocr-api-key"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            API Key
          </label>
          <input
            type="password"
            id="ocr-api-key"
            value={ocrApiKey}
            onChange={(e) => setOcrApiKey(e.target.value)}
            disabled={!ocrEnabled}
            placeholder={maskedKeyHint ?? 'Enter API key'}
            autoComplete="new-password"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-[#6366f1] disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-slate-500">
            {maskedKeyHint
              ? `Current key ends in ${maskedKeyHint}. Leave blank to keep the existing key.`
              : 'Enter the API key for the selected provider.'}
          </p>
        </div>

        {/* Base URL — only for custom provider */}
        {ocrProvider === 'custom' && (
          <div>
            <label
              htmlFor="ocr-base-url"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Base URL
            </label>
            <input
              type="url"
              id="ocr-base-url"
              value={ocrBaseUrl}
              onChange={(e) => setOcrBaseUrl(e.target.value)}
              disabled={!ocrEnabled}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-[#6366f1] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-slate-500">
              Base URL for the OpenAI-compatible API endpoint.
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-[#6366f1] text-white rounded-md font-medium text-sm hover:bg-[#4f46e5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </SettingsSection>
  );
}
