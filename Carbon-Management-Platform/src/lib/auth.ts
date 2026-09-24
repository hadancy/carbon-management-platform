import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";
import { db } from "@/server/db/prisma";

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (!secret || secret.length < 32 || !baseURL) {
  throw new Error(
    "BETTER_AUTH_SECRET (32+ chars) and BETTER_AUTH_URL are required",
  );
}

const ac = createAccessControl(defaultStatements);
const adminRole = ac.newRole({
  user: ["create", "ban", "set-password"],
  session: ["revoke"],
});
const userRole = ac.newRole({});

export const auth = betterAuth({
  secret,
  baseURL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  user: {
    fields: { name: "displayName" },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
  },
  advanced: {
    database: { generateId: () => crypto.randomUUID() },
  },
  plugins: [
    admin({ ac, roles: { admin: adminRole, user: userRole } }),
    nextCookies(),
  ],
});
