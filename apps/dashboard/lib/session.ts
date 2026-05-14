import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "usv_session";

export interface Session {
  merchantId: string;
  userId: string;
  email: string;
}

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET missing");
  return new TextEncoder().encode(s);
};

export const requireSession = async (): Promise<Session> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "usv" });
    return {
      merchantId: payload.merchantId as string,
      userId: payload.sub as string,
      email: payload.email as string,
    };
  } catch {
    redirect("/login");
  }
};
