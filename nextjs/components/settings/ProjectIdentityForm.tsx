'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import SettingsSection from './SettingsSection';

interface ProjectIdentityFormProps {
  projectId: string;
  initialName: string;
  initialSubtitle: string;
}

export default function ProjectIdentityForm({
  projectId,
  initialName,
  initialSubtitle,
}: ProjectIdentityFormProps) {
  const [name, setName] = useState(initialName);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = name !== initialName || subtitle !== initialSubtitle;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Project title is required');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), subtitle: subtitle.trim() || null }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update project');
      }

      toast.success('Project settings updated');
      // Refresh the page to update header/sidebar
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to update project settings');
    } finally {
      setIsLoading(false);
    }
  }, [name, subtitle, projectId]);

  return (
    <SettingsSection
      title="Project Identity"
      description="Update your project name and subtitle. These will be displayed throughout the application."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium text-slate-700 mb-1">
            Project Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7C6AF6] focus:border-[#7C6AF6]"
            placeholder="Enter project title"
          />
          <p className="mt-1 text-xs text-slate-500">{name.length}/100 characters</p>
        </div>

        <div>
          <label htmlFor="project-subtitle" className="block text-sm font-medium text-slate-700 mb-1">
            Project Subtitle
          </label>
          <input
            type="text"
            id="project-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={200}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7C6AF6] focus:border-[#7C6AF6]"
            placeholder="Enter project subtitle (optional)"
          />
          <p className="mt-1 text-xs text-slate-500">{subtitle.length}/200 characters</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading || !hasChanges}
            className="px-4 py-2 bg-[#7C6AF6] text-white rounded-md font-medium hover:bg-[#6C5CE7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </SettingsSection>
  );
}
