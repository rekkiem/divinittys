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
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/cuenta`;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      // Sincronizar image (Auth.js) → avatar (app) + role CUSTOMER
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
