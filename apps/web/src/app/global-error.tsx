'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="bg-[#0A0A0A] text-white flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Algo sali&oacute; mal</h1>
          <p className="text-[#888] mb-6">El error ha sido reportado autom&aacute;ticamente.</p>
          <button
            onClick={reset}
            className="px-6 py-3 bg-[#7c3aed] rounded-lg hover:bg-[#6d28d9] transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
