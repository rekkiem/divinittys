'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
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

/** Dark mode UI gate: false en prod hasta QA. true en local/prep para probar tokens. */
const DARK_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DARK_MODE === 'true';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient(queryClientConfig));
  const pathname = usePathname() || '';
  const isAdmin = pathname.startsWith('/admin');

  // Admin siempre light; tienda solo dark si el flag está ON
  const forcedTheme = isAdmin ? 'light' : DARK_ENABLED ? undefined : 'light';

  return (
    <SessionProvider basePath="/api/nextauth">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="divinittys-theme"
          forcedTheme={forcedTheme}
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
