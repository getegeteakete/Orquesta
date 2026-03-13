import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const FREEE_AUTH_BASE = "https://accounts.secure.freee.co.jp";

// GET /api/freee/auth/callback?code=XXX&state=YYY
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = req.cookies.get("oauth_state")?.value;

  // CSRF チェック
  if (!state || state !== cookieState) {
    return NextResponse.redirect(new URL("/?error=invalid_state", req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", req.url));
  }

  try {
    // アクセストークン取得
    const tokenRes = await axios.post(`${FREEE_AUTH_BASE}/oauth/token`, {
      grant_type: "authorization_code",
      client_id: process.env.FREEE_CLIENT_ID,
      client_secret: process.env.FREEE_CLIENT_SECRET,
      code,
      redirect_uri: process.env.FREEE_REDIRECT_URI,
    });

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // 事業所IDを取得
    const companyRes = await axios.get("https://api.freee.co.jp/api/1/companies", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const company_id = companyRes.data.companies?.[0]?.id ?? 0;

    const token = {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
      company_id,
    };

    // httpOnly Cookie に保存（本番はDBを推奨）
    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.set("freee_token", JSON.stringify(token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30日
    });
    response.cookies.delete("oauth_state");

    return response;
  } catch (err: any) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    return NextResponse.redirect(new URL("/?error=auth_failed", req.url));
  }
}
