"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="max-w-lg rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-red-900">Erreur application</h2>
          <p className="mt-2 text-sm text-gray-600">{error.message}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
