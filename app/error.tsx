"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="h-[80vh] w-full flex flex-col items-center justify-center space-y-6 text-center px-4">
      <div className="space-y-2">
        <div className="flex justify-center">
          <div className="h-24 w-24 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">
          Something went wrong!
        </h1>
        <p className="text-muted-foreground text-lg max-w-[500px]">
          We apologize for the inconvenience. An unexpected error has occurred.
        </p>
      </div>
      <div className="flex gap-4">
        <Button onClick={() => reset()} variant="default" size="lg">
          Try again
        </Button>
        <Button
          onClick={() => (window.location.href = "/")}
          variant="outline"
          size="lg"
        >
          Go home
        </Button>
      </div>
    </div>
  );
}
