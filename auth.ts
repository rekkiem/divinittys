/**
 * auth.ts — Auth.js (NextAuth v5) configuration
 *
 * Solo se usa para el flujo OAuth de Google.
 * Tras el login, /api/auth/google-callback emite las cookies JWT de la app.
 */
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

/** URL pública de la app (nunca 0.0.0.0 ni localhost en prod/prep). */
function publicBaseUrl(fallback?: string): string {
  const fromEnv =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && !fromEnv.includes('0.0.0.0') && !fromEnv.includes('localhost')) {
    return fromEnv.replace(/\/$/, '');
  }
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (fallback && !fallback.includes('0.0.0.0')) return fallback.replace(/\/$/, '');
  return 'https://prep.divinittys.cl';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/cuenta/login',
    error: '/cuenta/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return false;
      if (!user.email) return false;
      return true;
    },

    async jwt({ token, user, account }) {
      if (account?.provider === 'google' && user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, email: true, name: true, role: true, avatar: true, image: true },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.email = dbUser.email;
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.avatar = dbUser.avatar ?? dbUser.image ?? null;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
        session.user.role = (token.role as string) ?? 'CUSTOMER';
        session.user.avatar = (token.avatar as string | null) ?? null;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      const root = publicBaseUrl(baseUrl);
      // Rutas relativas → URL pública
      if (url.startsWith('/')) return `${root}${url}`;
      // Misma origin o baseUrl interno (0.0.0.0) → reescribir a pública
      try {
        const u = new URL(url);
        if (u.hostname === '0.0.0.0' || u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          return `${root}${u.pathname}${u.search}`;
        }
        if (url.startsWith(root) || url.startsWith(baseUrl)) return url.startsWith(root) ? url : `${root}${u.pathname}${u.search}`;
      } catch {
        // ignore
      }
      return `${root}/cuenta`;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'CUSTOMER',
          emailVerified: new Date(),
          avatar: user.image ?? undefined,
        },
      });
    },
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
});
