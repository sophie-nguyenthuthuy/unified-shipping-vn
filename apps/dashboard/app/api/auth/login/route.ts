import { getDb } from "@usv/db";
import * as argon2 from "argon2";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "");
const SESSION_COOKIE = "usv_session";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return NextResponse.json({ error: "missing fields" }, { status: 422 });

  const db = getDb();
  const user = await db.user.findFirst({ where: { email } });
  if (!user) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });

  const jwt = await new SignJWT({ merchantId: user.merchantId, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("usv")
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());

  const res = NextResponse.redirect(new URL("/shipments", req.url), 303);
  res.cookies.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  void db.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch(() => undefined);
  return res;
}
