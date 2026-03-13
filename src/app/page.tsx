"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ==========================================
// 型定義
// ==========================================
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  charts?: ChartData[];
  timestamp: Date;
}

interface ChartData {
  type: "bar" | "line" | "area" | "pie";
  title: string;
  labels: string[];
  datasets: { label: string; data: number[]; color?: string }[];
  unit?: string;
}

interface Session {
  authenticated: boolean;
  company_name?: string;
  company_id?: number;
}

interface ConfirmOp {
  tool: string;
  label: string;
  input: any;
}

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

const QUICK_PROMPTS = [
  "今月の損益状況をグラフで教えて",
  "販管費の内訳を役員報酬除いてグラフにして",
  "キャッシュフローから資金ショートまでをシミュレーション",
  "今月の仕訳で二重計上の疑いがあるものをチェック",
  "消費税区分が間違っていそうな仕訳をリストアップ",
];

// ==========================================
// チャートレンダラー
// ==========================================
function ChartRenderer({ chart }: { chart: ChartData }) {
  const data = chart.labels.map((label, i) => {
    const point: any = { name: label };
    chart.datasets.forEach((ds) => { point[ds.label] = ds.data[i] ?? 0; });
    return point;
  });
  const fmtYen = (v: number) => `¥${(v / 10000).toFixed(0)}万`;
  const fmtTooltip = (v: any) => `¥${Number(v).toLocaleString()}`;
  const tooltipStyle = { background: "#0f172a", border: "1px solid #334155", borderRadius: 8 };

  const common = { data, margin: { top: 5, right: 20, left: 10, bottom: 5 } };

  return (
    <div className="mt-3 bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
      <p className="text-slate-300 text-xs font-medium mb-3">{chart.title}</p>
      <ResponsiveContainer width="100%" height={240}>
        {chart.type === "bar" ? (
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tickFormatter={fmtYen} tick={{ fill: "#94a3b8", fontSize: 10 }} width={60} />
            <Tooltip formatter={fmtTooltip} contentStyle={tooltipStyle} />
            <Legend />
            {chart.datasets.map((ds, i) => (
              <Bar key={ds.label} dataKey={ds.label} fill={ds.color || CHART_COLORS[i]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : chart.type === "line" ? (
          <LineChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tickFormatter={fmtYen} tick={{ fill: "#94a3b8", fontSize: 10 }} width={60} />
            <Tooltip formatter={fmtTooltip} contentStyle={tooltipStyle} />
            <Legend />
            {chart.datasets.map((ds, i) => (
              <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={ds.color || CHART_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        ) : (
          <AreaChart {...common}>
            <defs>
              {chart.datasets.map((ds, i) => (
                <linearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ds.color || CHART_COLORS[i]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ds.color || CHART_COLORS[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tickFormatter={fmtYen} tick={{ fill: "#94a3b8", fontSize: 10 }} width={60} />
            <Tooltip formatter={fmtTooltip} contentStyle={tooltipStyle} />
            <Legend />
            {chart.datasets.map((ds, i) => (
              <Area key={ds.label} type="monotone" dataKey={ds.label} stroke={ds.color || CHART_COLORS[i]} fill={`url(#g${i})`} strokeWidth={2} />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ==========================================
// ログイン画面
// ==========================================
function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    // /api/freee/auth/login にリダイレクト → freee OAuth画面へ
    window.location.href = "/api/freee/auth/login";
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white">
      <div className="text-center max-w-sm px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl font-bold mx-auto mb-6">
          CFO
        </div>
        <h1 className="text-2xl font-bold mb-2">AI CFO</h1>
        <p className="text-slate-400 text-sm mb-8">
          freeeと連携して財務分析・自動記帳・請求書作成・異常検知をチャットで行います
        </p>

        <div className="space-y-3 text-left bg-slate-900 rounded-xl p-4 mb-8 border border-slate-800">
          {[
            { icon: "📊", text: "損益・キャッシュフロー分析" },
            { icon: "📝", text: "自然言語で仕訳登録" },
            { icon: "📄", text: "請求書・見積書の自動作成" },
            { icon: "🔍", text: "二重計上・税区分ミス検知" },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-3 text-sm text-slate-300">
              <span>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#007BFF] hover:bg-[#0069d9] disabled:opacity-60 text-white font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
              freeeでログイン
            </>
          )}
        </button>
        <p className="text-xs text-slate-600 mt-4">freeeアカウントのOAuth2認証を使用します</p>
      </div>
    </div>
  );
}

// ==========================================
// メインチャット画面
// ==========================================
export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmOps, setConfirmOps] = useState<ConfirmOp[] | null>(null);
  const [pendingText, setPendingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // セッション確認
  useEffect(() => {
    fetch("/api/freee/session")
      .then((r) => r.json())
      .then((data: Session) => {
        setSession(data);
        if (data.authenticated) {
          setMessages([{
            id: "welcome",
            role: "assistant",
            content: `こんにちは！AI CFOです 📊\n\n**${data.company_name}** のfreeeと連携しました。\n\n財務分析・記帳・請求書作成・異常検知をチャットでサポートします。何でも聞いてください。`,
            timestamp: new Date(),
          }]);
        }
      })
      .catch(() => setSession({ authenticated: false }))
      .finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (content?: string, confirmed = false) => {
    const text = content || input.trim();
    if (!text || isLoading) return;

    if (!confirmed) {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: new Date(),
      }]);
      setInput("");
      setPendingText(text);
    }

    setIsLoading(true);

    // API用メッセージ履歴（直近20件）
    const apiMessages = messages
      .filter((m) => m.role !== "assistant" || !m.content.startsWith("こんにちは！AI CFO"))
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    if (!confirmed) {
      apiMessages.push({ role: "user", content: text });
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, confirmed }),
      });

      if (res.status === 401) {
        setSession({ authenticated: false });
        return;
      }

      const data = await res.json();

      if (data.type === "confirmation_required") {
        setConfirmOps(data.operations);
        setIsLoading(false);
        return;
      }

      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message || "処理が完了しました。",
        charts: data.charts || [],
        timestamp: new Date(),
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "⚠️ エラーが発生しました。しばらくしてから再試行してください。",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleLogout = async () => {
    await fetch("/api/freee/session", { method: "DELETE" });
    setSession({ authenticated: false });
  };

  // ロード中
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // 未認証
  if (!session?.authenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-xs">
            CFO
          </div>
          <div>
            <h1 className="font-semibold text-sm text-white">AI CFO</h1>
            <p className="text-xs text-slate-400">{session.company_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            freee 接続中
          </span>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-2xl mx-auto space-y-5">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
                ${msg.role === "user" ? "bg-indigo-600" : "bg-gradient-to-br from-emerald-500 to-teal-600"}`}>
                {msg.role === "user" ? "U" : "AI"}
              </div>
              <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                  ${msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : "bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-sm"}`}>
                  {msg.content}
                </div>
                {msg.charts?.map((c, i) => <ChartRenderer key={i} chart={c} />)}
                <span className="text-xs text-slate-600">
                  {msg.timestamp.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">AI</div>
              <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                <span className="text-xs text-slate-500 ml-1">freeeからデータ取得中...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* クイックプロンプト（初回のみ） */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex-shrink-0">
          <div className="max-w-2xl mx-auto flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => sendMessage(p)}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition-colors">
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 入力エリア */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-800 bg-slate-900/30 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex gap-2 items-end bg-slate-800 rounded-2xl border border-slate-700 px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="質問や指示を入力... (Shift+Enterで改行)"
            className="flex-1 bg-transparent resize-none text-sm text-white placeholder-slate-500 outline-none max-h-28 min-h-[36px] py-1 leading-relaxed"
            rows={1}
            disabled={isLoading}
          />
          <button onClick={() => sendMessage()} disabled={isLoading || !input.trim()}
            className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 flex items-center justify-center transition-colors flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-slate-700 mt-1.5">
          重要な判断は必ず専門家にご確認ください
        </p>
      </div>

      {/* 書き込み確認ダイアログ */}
      {confirmOps && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">操作の確認</h3>
                <p className="text-xs text-slate-400">以下をfreeeに登録します</p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              {confirmOps.map((op, i) => (
                <div key={i} className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300 border border-slate-700">
                  {op.label}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmOps(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors">
                キャンセル
              </button>
              <button onClick={() => { setConfirmOps(null); sendMessage(pendingText, true); }}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                実行する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
