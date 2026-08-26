/**
 * auth.ts — Auth.js (NextAuth v5) configuration
 *
 * Solo se usa para el flujo OAuth de Google.
 * Al completar el login de Google emitimos las mismas cookies JWT
 * (access_token / refresh_token) que usa el resto de la app,
 * de modo que useAuthStore y las APIs existentes siguen funcionando sin cambios.
 */
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import {
  signAccessToken,
  signRefreshToken,
} from '@/lib/auth';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true, // permite vincular si el email ya existe
    }),
  ],
  session: {
    strategy: 'jwt', // no usamos sessions de NextAuth; emitimos las nuestras
  },
  pages: {
    signIn: '/cuenta/login',
    error: '/cuenta/login',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Solo permitimos Google por ahora
      if (account?.provider !== 'google') return false;
      if (!user.email) return false;
      return true;
    },

    async jwt({ token, user, account, profile }) {
      // En el primer login de Google, enriquecemos el token con datos de nuestra DB
      if (account?.provider === 'google' && user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, email: true, name: true, role: true, avatar: true },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.email = dbUser.email;
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.avatar = dbUser.avatar;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user = {
          ...session.user,
          id: token.userId as string,
          role: token.role as string,
          avatar: token.avatar as string | null,
        };
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Tras login exitoso de Google, redirigimos a /cuenta o a la URL relativa segura
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/cuenta`;
    },
  },
  events: {
    /**
     * Después de crear/vincular la cuenta de Google, aseguramos que el User
     * de nuestra tabla tenga los campos mínimos y emitimos las cookies JWT.
     * Nota: la emisión real de cookies se hace en la página de callback
     * (ver /cuenta/login/google-callback) porque events no puede setear cookies de respuesta.
     */
    async createUser({ user }) {
      // El adapter ya creó el User. Aseguramos role y emailVerified.
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            role: 'CUSTOMER',
            emailVerified: new Date(),
            // passwordHash queda null (opcional)
          },
        });
      }
    },
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
});
