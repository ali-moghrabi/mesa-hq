import { SignJWT, jwtVerify } from "jose";
import { isRole, type Role } from "./roles";

export const SESSION_COOKIE = "hq_session";
export const SESSION_DAYS = 7;
export const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;

const ISSUER = "mesa-hq";
const AUDIENCE = "mesa-hq";

export type SessionClaims = { sub: string; role: Role; ver: number };

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET ?? "";
  if (value.length < 32)
    throw new Error("AUTH_SECRET must be at least 32 characters");
  return new TextEncoder().encode(value);
}

export function createToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, ver: claims.ver })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function readToken(
  token: string | undefined,
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.ver !== "number" ||
      !isRole(payload.role)
    )
      return null;
    return { sub: payload.sub, role: payload.role, ver: payload.ver };
  } catch {
    return null;
  }
}
