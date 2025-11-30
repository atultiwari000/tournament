"use client";

export default function TesterPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Developer Tester Tools Removed</h1>
      <p className="mt-4 text-muted-foreground">
        The in-app tester page that performed direct Firestore writes has been
        removed to avoid accidental modifications in staging/production.
      </p>
      <p className="mt-4">
        To run local seed or quick actions, use a dedicated script under
        `scripts/` or recreate a gated page behind an environment flag like
        `NEXT_PUBLIC_ENABLE_TESTER=true`.
      </p>
    </div>
  );
}
