"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldSeparator,
  FieldLabel,
  FieldContent,
} from "@/components/ui/field";

import { auth, db } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * RegisterForm
 *
 * - Matches the LoginForm visual style and layout.
 * - Provides registration via email/password and Google OAuth.
 * - Ensures a users/{uid} document exists (role: 'user').
 * - Respects a `next` query param for redirect after registration.
 *
 * Usage:
 * <RegisterForm className="..." />
 */
export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const next = searchParams?.get("next") ?? "/";

  // If the page prefilled an email via query param (e.g., forwarded from login),
  // initialize the email input.
  useEffect(() => {
    const pre = searchParams?.get("email");
    if (pre) setEmail(pre);
  }, [searchParams]);

  const safeUpsertUserDoc = async (uid: string, data: Partial<Record<string, any>>) => {
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      const base = {
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        photoURL: data.photoURL ?? null,
        lastSeen: serverTimestamp(),
      };

      if (!snap.exists()) {
        await setDoc(userRef, {
          ...base,
          role: "user",
          createdAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, base, { merge: true });
      }
    } catch (err) {
      console.error("safeUpsertUserDoc error:", err);
      // Do not surface Firestore internals to the user beyond a generic message.
      throw new Error("Failed to create user record");
    }
  };

  const handleEmailRegister = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      if (!user) throw new Error("Registration returned no user");
      await safeUpsertUserDoc(user.uid, {
        email: user.email,
        displayName: name.trim(),
        photoURL: user.photoURL ?? null,
      });
      // Redirect to next
      router.replace(next);
    } catch (err: any) {
      console.error("Email registration error:", err);
      setError(err?.message ?? "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;
      if (!user) throw new Error("No user returned from Google sign-in");
      // Ensure users/{uid} doc exists
      await safeUpsertUserDoc(user.uid, {
        email: user.email,
        displayName: user.displayName ?? name.trim() || null,
        photoURL: user.photoURL ?? null,
      });
      router.replace(next);
    } catch (err: any) {
      console.error("Google registration error:", err);
      setError(err?.message ?? "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleNotImplemented = (providerName: string) => {
    alert(`${providerName} registration is not implemented yet.`);
  };

  return (
    <form
      className={cn("flex flex-col gap-4 w-full max-w-md mx-auto", className)}
      onSubmit={handleEmailRegister}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center mb-1">
          <h1 className="text-2xl font-bold">Create account</h1>
          <p className="text-muted-foreground text-sm">
            Register with email & password or continue with Google
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="name">Full name</FieldLabel>
          <FieldContent>
            <input
              id="name"
              type="text"
              className="w-full rounded border px-3 py-1"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <FieldContent>
            <input
              id="email"
              type="email"
              className="w-full rounded border px-3 py-1"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <FieldContent>
            <input
              id="password"
              type="password"
              className="w-full rounded border px-3 py-1"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
          <FieldContent>
            <input
              id="confirm"
              type="password"
              className="w-full rounded border px-3 py-1"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading}
            />
          </FieldContent>
        </Field>

        <Field>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </Button>
        </Field>

        <FieldSeparator>Or continue with</FieldSeparator>

        <Field>
          <Button
            variant="outline"
            type="button"
            onClick={handleGoogleRegister}
            className="flex items-center justify-center gap-2 w-full"
            disabled={loading}
          >
            {/* Google SVG icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-5 h-5"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.72 1.21 9.23 3.58l6.93-6.93C34.96 2.26 29.77 0 24 0 14.84 0 6.96 5.39 3.04 13.2l7.99 6.2C12.86 13.06 18.98 9.5 24 9.5z"
              />
              <path
                fill="#34A853"
                d="M46.7 24.5c0-1.67-.17-3.28-.5-4.82H24v9.12h12.9c-.56 2.96-2.4 5.45-5.1 7.12l7.97 6.18C43.9 38.22 46.7 31.9 46.7 24.5z"
              />
              <path
                fill="#4A90E2"
                d="M10.03 28.12A14.99 14.99 0 0 1 9 24.5c0-1.48.23-2.91.64-4.26L1.65 13.98A23.98 23.98 0 0 0 0 24.5c0 3.97.94 7.71 2.64 11.06l7.39-7.44z"
              />
              <path
                fill="#FBBC05"
                d="M24 48c6.48 0 11.92-2.14 15.9-5.8l-7.97-6.18C29.65 35.78 27 36.5 24 36.5c-6.98 0-12.9-4.64-15-10.92l-7.99 6.2C6.96 42.61 14.84 48 24 48z"
              />
            </svg>
            {loading ? "Creating..." : "Continue with Google"}
          </Button>
        </Field>

        <Field>
          <div className="mt-2 text-center">
            <FieldDescription>
              Already have an account?{" "}
              <a href="/login" className="underline underline-offset-4">
                Sign in
              </a>
            </FieldDescription>
          </div>
        </Field>
      </FieldGroup>

      {error && <div className="text-sm text-destructive">{error}</div>}
    </form>
  );
}
