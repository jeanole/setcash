'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createComment } from '@/lib/api/bills';
import { getProjectMemberNames, ProjectMemberName } from '@/lib/api/members';
import { cn } from '@/lib/utils';

interface BillCommentInputProps {
  billId: string;
  projectId: string;
  onCommentAdded: () => void;
}

const MAX_CHARS = 2000;
const CHAR_WARN_THRESHOLD = 1500;
const MAX_DROPDOWN_ITEMS = 10;

function getMemberDisplayName(member: ProjectMemberName): string {
  const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ');
  return fullName ? `${fullName} (${member.email})` : member.email;
}

export default function BillCommentInput({
  billId,
  projectId,
  onCommentAdded,
}: BillCommentInputProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // @mention state
  const [members, setMembers] = useState<ProjectMemberName[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [filteredMembers, setFilteredMembers] = useState<ProjectMemberName[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch project members once on mount
  useEffect(() => {
    getProjectMemberNames(projectId)
      .then(setMembers)
      .catch(() => {
        // silently ignore — @mention just won't work
      });
  }, [projectId]);

  // Filter members when mention query changes
  useEffect(() => {
    if (mentionQuery === null) {
      setFilteredMembers([]);
      return;
    }
    const q = mentionQuery.toLowerCase();
    const filtered = members
      .filter((m) => {
        const name = [m.firstName, m.lastName, m.email, m.username]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return name.includes(q);
      })
      .slice(0, MAX_DROPDOWN_ITEMS);
    setFilteredMembers(filtered);
    setSelectedIndex(0);
  }, [mentionQuery, members]);

  const closeMentionDropdown = useCallback(() => {
    setMentionQuery(null);
    setMentionStart(-1);
    setFilteredMembers([]);
  }, []);

  const selectMember = useCallback(
    (member: ProjectMemberName) => {
      if (mentionStart < 0) return;
      const before = text.slice(0, mentionStart);
      const after = text.slice(textareaRef.current?.selectionStart ?? text.length);
      const replacement = `@${member.email} `;
      const newText = before + replacement + after;
      setText(newText);
      closeMentionDropdown();
      // Restore focus and move cursor after replacement
      setTimeout(() => {
        if (textareaRef.current) {
          const pos = (before + replacement).length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
    },
    [text, mentionStart, closeMentionDropdown]
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length > MAX_CHARS) return;
    setText(value);
    setSubmitError(null);

    // Detect @mention trigger
    const cursor = e.target.selectionStart;
    const textBefore = value.slice(0, cursor);
    const atIndex = textBefore.lastIndexOf('@');

    if (atIndex >= 0) {
      const partial = textBefore.slice(atIndex + 1);
      // Only show dropdown if no whitespace after @
      if (!partial.includes(' ') && !partial.includes('\n')) {
        setMentionQuery(partial);
        setMentionStart(atIndex);
        return;
      }
    }
    closeMentionDropdown();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (filteredMembers.length === 0 || mentionQuery === null) {
      if (e.key === 'Enter' && !e.shiftKey) {
        // allow default textarea newline
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredMembers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectMember(filteredMembers[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMentionDropdown();
    }
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createComment(billId, trimmed);
      setText('');
      closeMentionDropdown();
      onCommentAdded();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showCharCount = text.length > CHAR_WARN_THRESHOLD;
  const showDropdown = filteredMembers.length > 0 && mentionQuery !== null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Add Comment
      </p>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment... (use @ to mention someone)"
          rows={3}
          aria-label="Comment text"
          className={cn(
            'w-full px-3 py-2 border rounded-lg text-sm bg-white resize-none',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'border-slate-200 placeholder:text-slate-400',
            !!submitError && 'border-rose-300 ring-2 ring-rose-200'
          )}
        />

        {/* @mention dropdown */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="Mention suggestions"
            className="absolute left-0 right-0 top-full z-20 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-y-auto"
            style={{ maxHeight: '200px' }}
          >
            {filteredMembers.map((member, idx) => (
              <div
                key={member.email}
                role="option"
                aria-selected={idx === selectedIndex}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur on textarea
                  selectMember(member);
                }}
                className={cn(
                  'px-3 py-2 cursor-pointer text-sm',
                  idx === selectedIndex ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'
                )}
              >
                {getMemberDisplayName(member)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom row: char count + submit */}
      <div className="flex items-center justify-between mt-2 gap-2">
        <div className="flex-1">
          {showCharCount && (
            <span
              className={cn(
                'text-xs',
                text.length >= MAX_CHARS ? 'text-rose-500 font-medium' : 'text-slate-400'
              )}
            >
              {text.length} / {MAX_CHARS}
            </span>
          )}
          {submitError && (
            <p className="text-xs text-rose-600 mt-0.5">{submitError}</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!text.trim() || isSubmitting}
          aria-label="Post comment"
          className={cn(
            'bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5',
            'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center gap-1.5 shrink-0'
          )}
        >
          {isSubmitting ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Posting…
            </>
          ) : (
            'Post'
          )}
        </button>
      </div>
    </div>
  );
}
