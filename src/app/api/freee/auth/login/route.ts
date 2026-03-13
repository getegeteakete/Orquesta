import { NextRequest, NextResponse } from "next/server";
import { getOAuthUrl } from "@/lib/freee/client";

// GET /api/freee/auth/login → freee認証画面にリダイレクト
export async function GET(req: NextRequest) {
  const state = crypto.randomUUID();
  const url = getOAuthUrl(state);

  const response = NextResponse.redirect(url);
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10分
  });

  return response;
}
