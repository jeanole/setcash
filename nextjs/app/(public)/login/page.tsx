import LoginForm from '@/components/auth/LoginForm';

// ---------------------------------------------------------------------------
// Login page — full-screen dark cinematic background, centered frosted card
// ---------------------------------------------------------------------------

export const metadata = {
  title: 'Sign in — vBudget',
};

export default function LoginPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: '#020617', // slate-950
        backgroundImage: [
          'radial-gradient(900px 600px at 10% -10%, rgba(99, 102, 241, 0.18), transparent 60%)',
          'radial-gradient(700px 500px at 110% 110%, rgba(16, 185, 129, 0.12), transparent 55%)',
        ].join(', '),
        backgroundAttachment: 'fixed',
        animation: 'vb-rise 400ms ease-out both',
      }}
      aria-label="Sign in"
    >
      {/* Card */}
      <div
        className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 max-w-sm w-full"
        style={{
          boxShadow: 'var(--vb-shadow-xl)',
          animation: 'vb-rise 500ms ease-out both',
          animationDelay: '200ms',
        }}
      >
        {/* LoginForm handles all animated children */}
        <LoginForm />
      </div>
    </main>
  );
}
