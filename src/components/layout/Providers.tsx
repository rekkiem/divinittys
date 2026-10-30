'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import OAuthSessionBridge from '@/components/auth/OAuthSessionBridge';

const BeautyChat = dynamic(() => import('@/components/ai/BeautyChat'), {
  ssr: false,
});

const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
};

/** Dark mode UI gate: false en prod hasta tokens/contraste (D1–D3). true en prep para QA. */
const DARK_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DARK_MODE === 'true';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient(queryClientConfig));

  return (
    <SessionProvider basePath="/api/nextauth">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="divinittys-theme"
          forcedTheme={DARK_ENABLED ? undefined : 'light'}
          disableTransitionOnChange
        >
          <OAuthSessionBridge />
          {children}
          <BeautyChat />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
