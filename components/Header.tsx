"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import Auth from "@/components/Auth";
import { useAuth } from "@/contexts/AuthContext";

const Header = () => {
  const { user, loading, role } = useAuth();
  const pathname = usePathname();

  // Hide header on auth pages (login/register for all user types)
  const isAuthPage =
    pathname?.startsWith("/auth/login") ||
    pathname?.startsWith("/auth/register");

  if (isAuthPage) {
    return null;
  }

  const getLinkClass = (path: string) => {
    // For manager pages, check if pathname starts with /manager
    // For others, check exact match
    const isActive = path === "/manager" 
      ? pathname?.startsWith("/manager")
      : pathname === path;
      
    return isActive
      ? "text-green-600 font-medium border-b-2 border-green-600 pb-1"
      : "text-gray-600 hover:text-green-600 pb-1 transition-colors";
  };

  return (
    <header className="flex items-center justify-between p-4 bg-white shadow-md sticky top-0 z-50">
      <Link href="/" className="text-2xl font-bold text-green-600">
        Futsal Booking
      </Link>
      <nav className="flex items-center gap-6">
        <Link href="/" className={getLinkClass("/")}>
          Home
        </Link>
        {role === "manager" ? (
          <Link
            href="/manager/dashboard"
            className={getLinkClass("/manager")}
          >
            Manager Dashboard
          </Link>
        ) : (
          <>
            <Link href="/venues" className={getLinkClass("/venues")}>
              Venues
            </Link>
            {user && (
              <Link
                href="/user/bookings"
                className={getLinkClass("/user/bookings")}
              >
                My Bookings
              </Link>
            )}
          </>
        )}
      </nav>
      <div>
        <Auth />
      </div>
    </header>
  );
};

export default Header;
