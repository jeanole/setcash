# Frontend Development Rules

## Component Libraries
- Before creating a custom UI component, check if your project's component library already has it
- Prefer reusing existing components over creating new ones
- Custom components should be business-specific compositions built on top of base primitives

## Component Standards
- Use your project's CSS approach consistently (no mixing inline styles with utility classes)
- All components must be responsive (mobile 375px, tablet 768px, desktop 1440px)
- Implement loading states, error states, and empty states
- Use semantic HTML and ARIA labels for accessibility
- Keep components small and focused
- Use TypeScript interfaces for all props

## Auth Best Practices
- Always verify a session exists before redirecting post-login
- Always reset loading state in all code paths (success, error, finally)
