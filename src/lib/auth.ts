import { compare } from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentials_schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

function normalize_email(value: string): string {
  return value.trim().toLowerCase();
}

function is_local_or_ngrok_host(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".ngrok-free.app")
  );
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = credentials_schema.safeParse(credentials);

      if (!parsed.success) {
        return null;
      }

      const email = normalize_email(parsed.data.email);
      const password = parsed.data.password;

      const invite = await prisma.allowedEmail.findUnique({
        where: { email },
        select: { is_active: true },
      });

      if (!invite?.is_active) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          password_hash: true,
        },
      });

      if (!user?.password_hash) {
        return null;
      }

      const password_matches = await compare(password, user.password_hash);

      if (!password_matches) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const auth_options: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) {
        return false;
      }

      const invite = await prisma.allowedEmail.findUnique({
        where: { email: normalize_email(user.email) },
        select: { is_active: true },
      });

      return Boolean(invite?.is_active);
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        const target_url = new URL(url);
        const base_url = new URL(baseUrl);

        if (target_url.origin === base_url.origin) {
          return target_url.toString();
        }

        if (is_local_or_ngrok_host(target_url.hostname)) {
          return target_url.toString();
        }
      } catch {
        return `${baseUrl}/dashboard`;
      }

      return `${baseUrl}/dashboard`;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }

      return session;
    },
  },
};

export function get_server_session() {
  return getServerSession(auth_options);
}
