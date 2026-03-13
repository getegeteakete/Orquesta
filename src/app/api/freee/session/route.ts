import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

// GET /api/freee/session → 認証状態と事業所情報を返す
export async function GET(req: NextRequest) {
  const tokenCookie = req.cookies.get("freee_token")?.value;

  if (!tokenCookie) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const token = JSON.parse(tokenCookie);

    // トークン期限チェック（5分前にリフレッシュ）
    if (token.expires_at < Date.now() + 5 * 60 * 1000) {
      const refreshRes = await axios.post(
        "https://accounts.secure.freee.co.jp/oauth/token",
        {
          grant_type: "refresh_token",
          client_id: process.env.FREEE_CLIENT_ID,
          client_secret: process.env.FREEE_CLIENT_SECRET,
          refresh_token: token.refresh_token,
        }
      );
      token.access_token = refreshRes.data.access_token;
      token.refresh_token = refreshRes.data.refresh_token;
      token.expires_at = Date.now() + refreshRes.data.expires_in * 1000;

      // Cookieを更新
      const response = NextResponse.json({ authenticated: true, company_id: token.company_id });
      response.cookies.set("freee_token", JSON.stringify(token), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
      return response;
    }

    // 事業所名を取得
    const companyRes = await axios.get(
      `https://api.freee.co.jp/api/1/companies/${token.company_id}`,
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    );
    const companyName = companyRes.data.company?.display_name ?? "事業所";

    return NextResponse.json({
      authenticated: true,
      company_id: token.company_id,
      company_name: companyName,
    });
  } catch {
    // トークンが無効ならCookieを削除
    const response = NextResponse.json({ authenticated: false });
    response.cookies.delete("freee_token");
    return response;
  }
}

// DELETE /api/freee/session → ログアウト
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("freee_token");
  return response;
}
