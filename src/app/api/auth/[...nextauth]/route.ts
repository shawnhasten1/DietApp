import NextAuth from "next-auth";
import { auth_options } from "@/lib/auth";

const auth_handler = NextAuth(auth_options);

export { auth_handler as GET, auth_handler as POST };
