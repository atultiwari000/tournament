"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

import { RegisterForm } from "@/components/register-form";

/**
 * RegisterPage (refactored)
 *
 * - Uses full viewport height for the page.
 * - Left column: centered form area (max width increased for better UX).
 * - Right column: illustration / placeholder with subtle overlay and caption.
 * - Removes unnecessary vertical gaps and fixes overflow by constraining widths.
 */
export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const safeUpsertUserDoc = async (
    user: FirebaseUser,
    displayName?: string,
  ) => {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const base = {
      email: user.email ?? null,
      displayName: displayName ?? user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      lastSeen: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(userRef, {
        ...base,
        role: "user",
        createdAt: serverTimestamp(),
      });
    } else {
      // merge lastSeen and any updated fields
      await setDoc(userRef, base, { merge: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      alert("Please enter your email.");
      return;
    }
    if (!password) {
      alert("Please enter a password.");
      return;
    }
    if (password !== confirm) {
      alert("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      // create users/{uid} doc
      await safeUpsertUserDoc(user, name.trim());
      // redirect to home or profile
      router.replace("/");
    } catch (err: any) {
      console.error("Registration failed", err);
      alert(err?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;
      // If users/{uid} doesn't exist, create it so the app has a user doc
      await safeUpsertUserDoc(user);
      router.replace("/");
    } catch (err: any) {
      console.error("Google sign-in failed", err);
      alert(err?.message ?? "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: Form area - centered and using full height */}
      <div className="flex flex-col justify-center p-6 md:p-12">
        {/* Form container - allow wider form and prevent overflow */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            <RegisterForm />
          </div>
        </div>
      </div>

      {/* Right: Illustration / placeholder - show only on large screens */}
      <div className="relative hidden lg:flex items-center justify-center bg-gray-50 overflow-hidden">
        <img
          src="/images/placeholder-register.jpg"
          alt="Illustration: onboarding and account creation"
          className="w-full h-full object-cover"
        />
        {/* subtle overlay for better contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent pointer-events-none" />
        <div className="absolute left-12 bottom-12 text-white max-w-sm pointer-events-none">
          <h2 className="text-2xl font-bold">Welcome to Futsal</h2>
          <p className="mt-2 text-sm">
            Create an account to book courts, manage bookings and track your
            history.
          </p>
        </div>
      </div>
    </div>
  );
}
