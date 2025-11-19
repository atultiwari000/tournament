import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="h-[80vh] w-full flex flex-col items-center justify-center space-y-6 text-center px-4">
      <div className="space-y-2">
        <div className="flex justify-center">
          <div className="h-24 w-24 bg-muted rounded-full flex items-center justify-center">
            <FileQuestion className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">
          Page Not Found
        </h1>
        <p className="text-muted-foreground text-lg max-w-[500px]">
          Sorry, we couldn't find the page you're looking for. It might have been
          moved or doesn't exist.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/">Go back home</Link>
      </Button>
    </div>
  );
}
