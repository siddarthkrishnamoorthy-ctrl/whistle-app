"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api-client";
import { Field, PrimaryButton, OutlineButton } from "@/components/ui";
import type { PricingTier } from "@/lib/types";

export default function SignupPage() {
  const { signUp, apiUnreachable } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [declaredStrength, setDeclaredStrength] = useState("50");

  useEffect(() => {
    // Public endpoint — no auth needed yet at this point in the flow.
    apiFetch("/pricing-tiers")
      .then((res) => res.json())
      .then(setTiers)
      .catch(() => undefined);
  }, []);

  const strengthNum = Number(declaredStrength) || 0;
  const matchedTier = tiers.find(
    (t) => strengthNum >= t.minStudents && (t.maxStudents === null || strengthNum <= t.maxStudents)
  );

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("Please agree to the Terms and Conditions to continue.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleFinish() {
    setError(null);
    setSubmitting(true);
    try {
      await signUp(fullName, email, password, strengthNum > 0 ? strengthNum : undefined);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign up. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8">
        <div className="mb-8 text-center">
          <div className="mb-1 text-2xl font-bold tracking-tight text-accent">Whistle</div>
          <div className="text-xs text-text-muted">By School of Sports</div>
        </div>

        {apiUnreachable && (
          <p className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            Can&apos;t reach the API. Make sure the backend is running (pnpm --filter backend dev).
          </p>
        )}

        {step === 1 && (
          <>
            <h1 className="mb-1 text-xl font-semibold">Create Your Account</h1>
            <p className="mb-6 text-sm text-text-secondary">Join us and start your journey to greatness</p>

            <form onSubmit={handleStep1} className="space-y-4">
              <Field
                label="Full Name"
                placeholder="Enter Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
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
                minLength={6}
                required
              />
              <label className="flex items-start gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 accent-accent"
                />
                <span>
                  I agree to the <span className="text-accent">Terms and Conditions</span> and{" "}
                  <span className="text-accent">policy</span>
                </span>
              </label>
              {error && <p className="text-sm text-danger">{error}</p>}
              <PrimaryButton type="submit">Continue</PrimaryButton>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="mb-1 text-xl font-semibold">Your Academy&apos;s Size</h1>
            <p className="mb-6 text-sm text-text-secondary">
              This sets your Whistle subscription plan — you can change it any time from Settings.
            </p>

            <div className="space-y-4">
              <Field
                label="Expected number of students"
                type="number"
                min={1}
                value={declaredStrength}
                onChange={(e) => setDeclaredStrength(e.target.value)}
              />

              {matchedTier && (
                <div className="rounded-md border border-accent/40 bg-accent/5 p-4">
                  <div className="text-sm font-semibold text-text-primary">{matchedTier.name} plan</div>
                  {matchedTier.pricePerStudentMonth ? (
                    <div className="mt-1 text-xs text-text-secondary">
                      ₹{matchedTier.pricePerStudentMonth} / student / month · billed monthly (annual saves 15%)
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-text-secondary">
                      Custom pricing — our team will reach out to set up your plan after signup.
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-danger">{error}</p>}

              <div className="flex gap-3">
                <OutlineButton className="w-auto px-6" onClick={() => setStep(1)} disabled={submitting}>
                  Back
                </OutlineButton>
                <PrimaryButton onClick={handleFinish} disabled={submitting}>
                  {submitting ? "Signing up…" : "SIGN UP"}
                </PrimaryButton>
              </div>
            </div>
          </>
        )}

        <p className="mt-6 text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="text-accent">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
