"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Field, PrimaryButton } from "@/components/ui";

export default function LoginPage() {
  const { signIn, apiUnreachable } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password, rememberMe);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/whistle-logo.png" alt="Whistle" className="mx-auto mb-3 h-16 w-auto" />
          <div className="mb-1 text-2xl font-bold tracking-tight text-accent">Whistle</div>
          <div className="text-xs text-text-muted">By School of Sports</div>
        </div>

        <h1 className="mb-1 text-xl font-semibold">Welcome Back</h1>
        <p className="mb-6 text-sm text-text-secondary">Login to continue your journey</p>

        {apiUnreachable && (
          <p className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            Can&apos;t reach the API. Make sure the backend is running (pnpm --filter backend dev).
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Email"
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Field
            label="Password"
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="accent-accent"
            />
            Remember me
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "Logging in…" : "LOGIN"}
          </PrimaryButton>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-accent">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
