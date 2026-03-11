import { redirect } from 'next/navigation';

// The root page (/) now handles login — redirect legacy /login links there.
export default function LoginPage() {
  redirect('/');
}
