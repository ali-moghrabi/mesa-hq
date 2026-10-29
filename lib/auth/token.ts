import { SignJWT, jwtVerify } from "jose";
import { isRole, type Role } from "./roles";

export const secureCookies = () => process.env.NODE_ENV === "production";

export const SESSION_COOKIE = secureCookies()
  ? "__Host-hq_session"
  : "hq_session";
export const SESSION_HOURS = 12;
export const SESSION_SECONDS = SESSION_HOURS * 60 * 60;

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
    .setExpirationTime(`${SESSION_HOURS}h`)
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
