import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connectDb } from "../db";
import { Admin } from "../models/admin";
import type { Role } from "./roles";
import {
  createToken,
  readToken,
  secureCookies,
  SESSION_COOKIE,
  SESSION_SECONDS,
} from "./token";

export type Session = { id: string; email: string; name: string; role: Role };

export const getSession = cache(async (): Promise<Session | null> => {
  const claims = await readToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  await connectDb();
  const admin = await Admin.findById(claims.sub, {
    email: 1,
    name: 1,
    role: 1,
    active: 1,
    tokenVersion: 1,
    mfaEnabled: 1,
  })
    .lean()
    .catch(() => null);
  if (
    !admin ||
    !admin.active ||
    !admin.mfaEnabled ||
    admin.tokenVersion !== claims.ver ||
    admin.role !== claims.role
  )
    return null;

  return {
    id: String(admin._id),
    email: admin.email,
    name: admin.name ?? "",
    role: admin.role as Role,
  };
});

export async function requireAdmin(roles?: readonly Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (roles && !roles.includes(session.role))
    throw new Error("You don't have access to this.");
  return session;
}

export async function startSession(admin: {
  id: string;
  role: Role;
  tokenVersion: number;
}) {
  const token = await createToken({
    sub: admin.id,
    role: admin.role,
    ver: admin.tokenVersion,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete({
    name: SESSION_COOKIE,
    path: "/",
    secure: secureCookies(),
  });
}
