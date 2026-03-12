import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';
import { bugReportLimiter } from '@/lib/ratelimit';
import { parseForm, getUploadedFile, UPLOADS_DIR } from '@/lib/upload';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const bugReportSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  stepsToReproduce: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    return NextResponse.json(
      { error: 'Bug reporting is not configured' },
      { status: 503 }
    );
  }

  // Rate limit
  const { success } = await bugReportLimiter.limit(session.user.id);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many bug reports. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const { fields, files } = await parseForm(req);

    // Extract field values (formidable returns arrays)
    const title = Array.isArray(fields.title) ? fields.title[0] : fields.title;
    const description = Array.isArray(fields.description) ? fields.description[0] : fields.description;
    const stepsToReproduce = Array.isArray(fields.stepsToReproduce)
      ? fields.stepsToReproduce[0]
      : fields.stepsToReproduce;

    const parsed = bugReportSchema.safeParse({ title, description, stepsToReproduce });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Handle screenshot
    let screenshotUrl = '';
    const screenshotFile = getUploadedFile(files, 'screenshot');
    if (screenshotFile) {
      const bugReportsDir = path.join(UPLOADS_DIR, 'bug-reports');
      if (!fs.existsSync(bugReportsDir)) {
        fs.mkdirSync(bugReportsDir, { recursive: true });
      }

      const ext = path.extname(screenshotFile.originalFilename || '.png').toLowerCase();
      const sanitizedExt = /^\.\w+$/.test(ext) ? ext : '.png';
      const filename = `${crypto.randomUUID()}${sanitizedExt}`;
      const destPath = path.join(bugReportsDir, filename);

      fs.renameSync(screenshotFile.filepath, destPath);

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      screenshotUrl = `${appUrl}/api/bug-reports/screenshots/${filename}`;
    }

    // Build GitHub issue body
    const bodyParts: string[] = [
      `## Description\n\n${parsed.data.description}`,
    ];

    if (parsed.data.stepsToReproduce) {
      bodyParts.push(`## Steps to Reproduce\n\n${parsed.data.stepsToReproduce}`);
    }

    bodyParts.push(`## Reporter\n\n- **User:** ${session.user.email}`);

    if (screenshotUrl) {
      bodyParts.push(`## Screenshot\n\n![Screenshot](${screenshotUrl})`);
    }

    bodyParts.push(`---\n\n@claude Investigate this bug report. Analyze the relevant code, identify the root cause, and open a PR with a fix if possible.`);

    const body = bodyParts.join('\n\n');

    // Create GitHub issue
    const ghRepo = process.env.GITHUB_REPO || 'jeanole/vbudget';
    const ghRes = await fetch(`https://api.github.com/repos/${ghRepo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: `[Bug Report] ${parsed.data.title}`,
        body,
        labels: ['bug', 'user-reported'],
      }),
    });

    if (!ghRes.ok) {
      const ghError = await ghRes.text();
      console.error('GitHub API error:', ghRes.status, ghError);
      return NextResponse.json(
        { error: 'Failed to create bug report on GitHub' },
        { status: 502 }
      );
    }

    const issue = await ghRes.json();

    return NextResponse.json(
      { ok: true, issueUrl: issue.html_url },
      { status: 201 }
    );
  } catch (error) {
    console.error('Bug report error:', error);
    return NextResponse.json(
      { error: 'Failed to process bug report' },
      { status: 500 }
    );
  }
}
