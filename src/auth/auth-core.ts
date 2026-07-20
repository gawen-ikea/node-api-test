import NextAuth, { DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/service/db-service';
import { DtoUser } from '@/schema/db-schema';
import { CredentialAuthorizeRequestSchema } from '@/schema/api-schema';
import { authorizeUserByEmailAndPassword, findDtoUserByEmail } from '@/utils/db-auth-utils';

export type ExtendedSessionUser = DefaultSession['user'] & {
  email: string;
  role: string;
};

declare module 'next-auth' {
  interface Session {
    user: ExtendedSessionUser;
  }
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
    async jwt({ token }) {
      const email = token.sub;
      if (!email) {
        return token;
      }

      // If this is the initial sign-in, add user info to the token
      const dtoUser = await findDtoUserByEmail(email);
      if (!dtoUser) {
        console.warn(`User not found for email: ${email}`);
        return token;
      }

      token.role = dtoUser.role;
      token.email = email;
      return token;
    },

    //
    // Add custom fields to the session object
    //
    async session({ session, token }) {
      if (token && session.user) {
        session.user.email = token.email as string;
        session.user.role = token.role as string;
      }
      return session;
    },

    //
    // Check if the user is allowed to sign in
    //
    async signIn({ user, account }) {
      if (account?.provider !== 'credentials') {
        // Allow sign-in for users authenticated via credentials
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

      // check email verification status
      return true;
    },
  },
});
