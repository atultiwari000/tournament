"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="h-screen w-full flex flex-col items-center justify-center space-y-6 text-center px-4">
          <h2 className="text-4xl font-bold">Critical Error</h2>
          <p className="text-muted-foreground">
            Something went wrong with the application layout.
          </p>
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </body>
    </html>
  );
}
