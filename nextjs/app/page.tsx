import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import DemoLoginButton from "@/components/auth/DemoLoginButton";
import { ImpressumLink } from "@/components/ImpressumModal";

export const metadata = {
  title: "SetCash — Your receipts deserve better than a shoebox.",
};

// ---------------------------------------------------------------------------
// Root page — yellow editorial landing + login
// ---------------------------------------------------------------------------
export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="lp">
      <div className="lp-inner">
        {/* ── Top-left wordmark ── */}
        <header className="lp-header">
          <div className="lp-wordmark">
            <span className="lp-wordmark-name">SetCash</span>
            <span className="lp-wordmark-sub">
              Built for productions that run on vibes and crumpled receipts.
            </span>
          </div>
        </header>

        {/* ── Content split ── */}
        <div className="lp-content">
          {/* Left: hero copy */}
          <div className="lp-hero">
            <h1 className="lp-headline">
              You
              <br />
              deserve better
              <br />
              than a shoebox.
            </h1>

            <ul className="lp-bullets">
              <li>Snap a receipt, send it to Telegram.</li>
              <li>
                Budget matrix that shows who spent what and when it went wrong.
              </li>
              <li>Export to PDF, Excel, or Google Sheets.</li>
              <li>AI reads your bills so you don&rsquo;t have to.</li>
            </ul>

            <Suspense>
              <DemoLoginButton />
            </Suspense>
          </div>

          {/* Right: login card */}
          <div className="lp-card-wrapper">
            <div className="lp-card">
              <h2 className="lp-card-title">Sign in — come close</h2>
              <Suspense>
                <LoginForm
                  allowSignup={process.env.EXTERNAL_REGISTRATION !== "false"}
                />
              </Suspense>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="lp-footer">
          <p className="lp-footer-left">
            SetCash is what happens when a dismanteled dude looking for
            direction figures out what building with agents is like. For
            pleasure, out of curiosity, to distract from real painful life. It
            evolves though. Turns out accidental utility is still utility.
          </p>
          <p className="lp-footer-right">
            Free for 9.99 &middot; No commits required &middot;{" "}
            <a
              href="https://github.com/jeanole"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="inline-flex items-center hover:opacity-70"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
                aria-hidden="true"
              >
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>{" "}
            &middot; <ImpressumLink />
          </p>
        </footer>
      </div>
    </main>
  );
}
