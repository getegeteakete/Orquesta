import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/freee/client";

// GET /api/freee/auth/callback?code=XXX&state=YYY
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const companyId = searchParams.get("company_id");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=auth_failed", req.url));
  }

  try {
    const token = await exchangeCodeForToken(
      code,
      companyId ? parseInt(companyId) : 0
    );

    // NOTE: 本番ではDBにトークンを保存し、セッションIDのみをCookieに保持する
    // ここでは簡易的にトークン全体をhttpOnly Cookieに保存（デモ用）
    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.set("freee_token", JSON.stringify(token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30日
    });

    return response;
  } catch (err) {
    console.error("OAuth token exchange failed:", err);
    return NextResponse.redirect(new URL("/?error=token_exchange_failed", req.url));
  }
}

// GET /api/freee/auth/login - OAuth認証開始
export async function POST(req: NextRequest) {
  const { getOAuthUrl } = await import("@/lib/freee/client");
  const state = crypto.randomUUID();

  const response = NextResponse.json({ url: getOAuthUrl(state) });
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    maxAge: 60 * 10, // 10分
  });

  return response;
}
