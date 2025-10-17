"use client";

import React from "react";

interface AuthPageLayoutProps {
  heroImage: string;
  heroTitle: string;
  heroDescription: string;
  heroAlt?: string;
  children: React.ReactNode;
}

/**
 * AuthPageLayout
 *
 * Reusable layout for all auth pages (login/register for all roles).
 * Provides a two-column design:
 * - Left: Form area with backdrop card
 * - Right: Full-bleed hero image with overlay and caption
 *
 * Usage:
 * <AuthPageLayout
 *   heroImage="/images/placeholder-login.jpg"
 *   heroTitle="Welcome back"
 *   heroDescription="Sign in to manage your bookings"
 * >
 *   <LoginForm />
 * </AuthPageLayout>
 */
export default function AuthPageLayout({
  heroImage,
  heroTitle,
  heroDescription,
  heroAlt = "Hero illustration",
  children,
}: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left: Form area - centered and using full height */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700">
            {children}
          </div>
        </div>
      </div>

      {/* Right: Hero image column - hidden on mobile, visible on lg+ screens */}
      <div className="hidden lg:flex lg:flex-1 relative h-screen">
        <img
          src={heroImage}
          alt={heroAlt}
          className="w-full h-screen object-cover"
        />

        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Hero caption */}
        <div className="absolute bottom-12 left-12 right-12 text-white z-10">
          <h2 className="text-3xl font-bold mb-3">{heroTitle}</h2>
          <p className="text-lg text-white/90">{heroDescription}</p>
        </div>
      </div>
    </div>
  );
}
