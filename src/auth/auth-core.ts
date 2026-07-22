import NextAuth, { DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/service/db-service';
import { DtoUser } from '@/schema/db-schema';
import { CredentialAuthorizeRequestSchema } from '@/schema/api-schema';
import { authorizeUserByEmailAndPassword, findDtoUserByEmail, findDtoUserById } from '@/data/db-auth';

export type ExtendedSessionUser = DefaultSession['user'] & {
  id: string;
  email: string;
  role: string;
};

declare module 'next-auth' {
  interface Session {
    user: ExtendedSessionUser;
  }
}

const authSecret = process.env.NAT_AUTH_SECRET;
if (!authSecret) {
  throw new Error('NAT_AUTH_SECRET is not defined in environment variables');
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 60 * 60 * 24, // 24 hours
  },
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/error', // Error code passed in query string as ?error=
  },
  adapter: PrismaAdapter(prisma),
  secret: authSecret,

  providers: [
    Credentials({
      async authorize(credentials): Promise<DtoUser> {
        const parsedRequest = CredentialAuthorizeRequestSchema.safeParse(credentials);
        if (!parsedRequest.success) {
          console.warn(`Invalid credential authorization request, reason: ${parsedRequest.error}`);
          throw new Error('Invalid credentials format');
        }

        // Find the user by email
        const { email, password } = parsedRequest.data;
        const reqUser = await authorizeUserByEmailAndPassword(email, password);
        if (!reqUser) {
          console.warn(`User not found for email: ${email}`);
          throw new Error('Invalid email or password');
        }

        return reqUser;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, Credentials() returns a DtoUser which already contains role/email.
      if (user) {
        const dtoUser = user as unknown as DtoUser;
        token.role = dtoUser.role;
        token.email = dtoUser.email;
        return token;
      }

      // Avoid a DB round-trip on every request once the token is populated.
      if (token.role && token.email) {
        return token;
      }

      const uid = token.sub;
      if (!uid) {
        return token;
      }

      const dtoUser = await findDtoUserById(uid);
      if (!dtoUser) {
        console.warn(`User not found for id: ${uid}`);
        return token;
      }

      token.role = dtoUser.role;
      token.email = dtoUser.email;
      return token;
    },

    // Add custom fields to the session object
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string;
        session.user.email = token.email as string;
        session.user.role = token.role as string;
      }
      return session;
    },

    // Check if the user is allowed to sign in
    async signIn({ user, account }) {
      if (account?.provider !== 'credentials') {
        // Allow sign-in for non-credentials providers (e.g., OAuth).
        return true;
      }

      const email = user.email;
      if (!email) {
        console.warn('User email is missing during sign-in');
        return false;
      }

      // Find the user in the database
      const dtoUser = await findDtoUserByEmail(email);
      if (!dtoUser) {
        console.warn(`User not found for email: ${email}`);
        return false;
      }

      return true;
    },
  },
});
