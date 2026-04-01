export function PageLoader() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <span
        aria-label="Loading"
        className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"
        role="status"
      />
    </main>
  );
}
