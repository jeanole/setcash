'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface QuotaData {
  uploadLimit: number | null;
  billCount: number;
}

export default function QuotaBanner() {
  const { data: session } = useSession();
  const [quota, setQuota] = useState<QuotaData | null>(null);

  const projectId = session?.user?.currentProjectId;

  useEffect(() => {
    if (!projectId) return;

    fetch(`/api/projects/${projectId}/quota`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<QuotaData>;
      })
      .then((data) => {
        if (data) setQuota(data);
      })
      .catch(() => {
        // silently ignore quota fetch errors — non-critical UI
      });
  }, [projectId]);

  if (!quota || quota.uploadLimit === null) return null;

  const { billCount, uploadLimit } = quota;
  const ratio = billCount / uploadLimit;
  const atLimit = billCount >= uploadLimit;

  let colorClasses = 'bg-green-50 border-green-200 text-green-700';
  if (atLimit || ratio >= 0.9) {
    colorClasses = 'bg-rose-50 border-rose-200 text-rose-700';
  } else if (ratio >= 0.7) {
    colorClasses = 'bg-amber-50 border-amber-200 text-amber-700';
  }

  return (
    <div
      className={`border rounded-lg px-4 py-3 text-sm ${colorClasses}`}
      role="status"
      aria-label="Upload quota status"
    >
      {atLimit ? (
        <span>
          <strong>Upload limit reached</strong> ({billCount}/{uploadLimit} bills used) &mdash; contact your admin to increase it.
        </span>
      ) : (
        <span>
          {billCount}/{uploadLimit} bills used
        </span>
      )}
    </div>
  );
}
