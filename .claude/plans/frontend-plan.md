# Frontend Implementation Plan — CR-21

## Feature
CR-21: In-App Setup Guides for Telegram & AI/OCR
Spec: `features/PROJ-12-integrations.md` → Change Requests section
Parent feature: PROJ-12 (Integrations)

## Context Summary
- Settings pages already exist: `/settings/telegram` and `/settings/ai-analysis`
- `TelegramSettings.tsx` — client component with admin bot config + user linking sections
- `OcrSettingsForm.tsx` — client component with provider select, API key, enable toggle
- Both use `SettingsSection` wrapper (white card with title + description)
- Project uses Tailwind CSS 4, Lucide React icons, no additional UI library
- No open bugs for PROJ-12

## User Decisions
- **Guide format:** Collapsible accordion — a "How to set up" section that expands/collapses, placed above the form fields
- **AI guide content:** Provider-specific — guide text updates dynamically when user selects OpenAI / Gemini / Claude / Custom, showing the correct URLs and key details
- **Telegram guide scope:** Both admin and user guides — admin sees BotFather setup steps, all users see linking instructions

## Open Bug Reports to Address
None

## Existing Components to Reuse
- `SettingsSection` — card wrapper with title/description
- `OcrSettingsForm` — will be modified to add accordion above form
- `TelegramSettings` — will be modified to add accordions in both admin and user sections
- Lucide React — `ChevronDown`, `ChevronRight`, `HelpCircle`, `ExternalLink` icons available

## New Components to Build

### 1. `SetupGuide` — Reusable collapsible accordion
- **Location:** `components/ui/SetupGuide.tsx`
- **Props:**
  ```typescript
  interface SetupGuideProps {
    title: string;           // e.g., "How to set up AI Analysis"
    children: ReactNode;     // The guide content (steps)
    defaultOpen?: boolean;   // Default collapsed (false)
  }
  ```
- **Behavior:**
  - Collapsed by default, shows `▶ {title}` with ChevronRight icon
  - Expanded shows `▼ {title}` with ChevronDown icon + children
  - Smooth height transition (CSS transition on grid-template-rows)
  - Styled as a subtle info box: `bg-indigo-50/60 border border-indigo-100 rounded-lg`
  - Accessible: `button` with `aria-expanded`, content region with `role="region"`
- **Responsive:** Full-width, text wraps normally on mobile

## Pages / Routes to Create or Modify

### 1. Modify `components/settings/OcrSettingsForm.tsx`
- Add `SetupGuide` accordion inside the `SettingsSection`, above the form
- Guide content is **dynamic based on `ocrProvider` state**:
  - **OpenAI:**
    1. Go to platform.openai.com → API Keys
    2. Click "Create new secret key"
    3. Copy the key (starts with `sk-`)
    4. Paste it in the API Key field below
    5. Model used: GPT-4o (vision-capable)
  - **Gemini:**
    1. Go to aistudio.google.com → Get API Key
    2. Create an API key for your project
    3. Copy the key
    4. Paste it in the API Key field below
    5. Model used: Gemini 1.5 Flash
  - **Claude:**
    1. Go to console.anthropic.com → API Keys
    2. Create a new API key
    3. Copy the key (starts with `sk-ant-`)
    4. Paste it in the API Key field below
    5. Model used: Claude 3.5 Haiku
  - **Custom:**
    1. Your provider must be OpenAI-compatible
    2. Enter the base URL (e.g., `https://your-provider.com/v1`)
    3. Enter the API key from your provider
- Each step is a numbered list item with concise text
- Provider-specific URLs rendered as plain text (not links, to avoid external navigation issues)

### 2. Modify `components/settings/TelegramSettings.tsx`
- **Admin section:** Add `SetupGuide` inside the "Bot Configuration" `SettingsSection`, above the status/toggle fields
  - Title: "How to set up the Telegram Bot"
  - Steps:
    1. Open Telegram and search for **@BotFather**
    2. Send `/newbot` and follow the prompts to name your bot
    3. BotFather will give you a token (format: `123456789:ABC-DEF...`)
    4. Paste the token in the "Bot Token" field below
    5. Enable the toggle and click "Save Changes"
    6. The bot will start polling — status should turn green
- **User section:** Add `SetupGuide` inside the "Link Your Account" `SettingsSection` (visible when bot is enabled but account not linked)
  - Title: "How to link your Telegram account"
  - Steps:
    1. Click "Link Telegram Account" below to get a 6-digit code
    2. Open the project's Telegram bot in the Telegram app
    3. Send the message `/link YOUR_CODE` (e.g., `/link 482910`)
    4. You'll see a confirmation here and in Telegram
    5. Once linked, you can send photos to the bot to create bill drafts

## Data Connection
- No new API calls needed — all guide content is static text
- AI guide reacts to existing `ocrProvider` state in `OcrSettingsForm`
- Telegram guide uses existing `enabled` and `linked` props in `TelegramSettings`

## Design Specifications
- **Accordion container:** `bg-indigo-50/60 border border-indigo-100 rounded-lg px-4 py-3`
- **Toggle button:** `text-sm font-medium text-indigo-700 flex items-center gap-2 w-full`
- **Chevron icon:** `w-4 h-4 text-indigo-500 transition-transform duration-200`
- **Expanded content:** `mt-3 text-sm text-slate-700 space-y-2`
- **Step numbers:** `font-medium text-indigo-600` for the number, rest in `text-slate-600`
- **Bold terms** (like @BotFather, key formats): `font-semibold text-slate-800`
- **Animation:** CSS grid-rows trick: `grid transition-[grid-template-rows] duration-200 ease-in-out` with `grid-rows-[0fr]` → `grid-rows-[1fr]`
- Matches existing settings page styling (indigo accent, slate text, white cards)

## Checklist
- [ ] `SetupGuide` component created with accessible expand/collapse
- [ ] AI Analysis guide added with provider-specific dynamic content
- [ ] Telegram admin guide added in Bot Configuration section
- [ ] Telegram user guide added in Link Your Account section (when not yet linked)
- [ ] Accordion defaults to collapsed
- [ ] Guide content is accurate and concise
- [ ] Responsive on mobile (375px+)
- [ ] No new npm dependencies
- [ ] TypeScript compiles without errors
