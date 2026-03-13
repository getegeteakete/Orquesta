"use client";

import { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ==========================================
// 型定義
// ==========================================
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
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

interface ConfirmationDialog {
  operations: { tool: string; label: string; input: any }[];
  pendingMessages: any[];
}

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

const QUICK_PROMPTS = [
  "今月の販管費の内訳を役員報酬を除いてグラフにして",
  "現在のキャッシュフロー状況から資金ショートまでの期間をシミュレーション",
  "今月の仕訳で二重計上の疑いがあるものをチェックして",
  "直近12ヶ月の売上推移をグラフにして",
  "消費税区分が間違っていそうな仕訳をリストアップして",
];

// ==========================================
// チャートレンダラー
// ==========================================
function ChartRenderer({ chart }: { chart: ChartData }) {
  const data = chart.labels.map((label, i) => {
    const point: any = { name: label };
    chart.datasets.forEach((ds) => {
      point[ds.label] = ds.data[i] ?? 0;
    });
    return point;
  });

  const formatValue = (v: number) => `¥${v.toLocaleString()}`;

  const commonProps = {
    data,
    margin: { top: 5, right: 30, left: 20, bottom: 5 },
  };

  const renderChart = () => {
    switch (chart.type) {
      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip formatter={(v: any) => formatValue(v)} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
            <Legend />
            {chart.datasets.map((ds, i) => (
              <Bar key={ds.label} dataKey={ds.label} fill={ds.color || CHART_COLORS[i]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        );

      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip formatter={(v: any) => formatValue(v)} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
            <Legend />
            {chart.datasets.map((ds, i) => (
              <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={ds.color || CHART_COLORS[i]} strokeWidth={2} dot={{ fill: ds.color || CHART_COLORS[i], r: 4 }} />
            ))}
          </LineChart>
        );

      case "area":
        return (
          <AreaChart {...commonProps}>
            <defs>
              {chart.datasets.map((ds, i) => (
                <linearGradient key={i} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ds.color || CHART_COLORS[i]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ds.color || CHART_COLORS[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip formatter={(v: any) => formatValue(v)} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
            <Legend />
            {chart.datasets.map((ds, i) => (
              <Area key={ds.label} type="monotone" dataKey={ds.label} stroke={ds.color || CHART_COLORS[i]} fill={`url(#gradient-${i})`} strokeWidth={2} />
            ))}
          </AreaChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mt-4 bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
      <h4 className="text-slate-300 text-sm font-medium mb-3">{chart.title}</h4>
      <ResponsiveContainer width="100%" height={260}>
        {renderChart() || <div />}
      </ResponsiveContainer>
    </div>
  );
}

// ==========================================
// メッセージコンポーネント
// ==========================================
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-6`}>
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold
        ${isUser ? "bg-indigo-600 text-white" : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"}`}>
        {isUser ? "U" : "AI"}
      </div>
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? "bg-indigo-600 text-white rounded-tr-sm"
            : "bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-sm"
          }`}>
          {message.content}
        </div>
        {message.charts?.map((chart, i) => (
          <div key={i} className="w-full">
            <ChartRenderer chart={chart} />
          </div>
        ))}
        <span className="text-xs text-slate-500">
          {message.timestamp.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

// ==========================================
// メインページ
// ==========================================
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "こんにちは！AI CFOです 📊\n\nfreeeと連携して財務分析・記帳・請求書作成・異常検知をサポートします。\n\n何でも気軽に質問してください。例えば：\n• 「今月の損益状況を教えて」\n• 「タクシー代5,000円を旅費交通費で登録して」\n• 「A社向け請求書を作成して」",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated] = useState(true); // TODO: 実際の認証状態
  const [confirmation, setConfirmation] = useState<ConfirmationDialog | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // デモ用トークン（実際はCookieから取得）
  const mockToken = {
    access_token: process.env.NEXT_PUBLIC_FREEE_ACCESS_TOKEN || "demo",
    refresh_token: "demo_refresh",
    expires_at: Date.now() + 3600000,
    company_id: parseInt(process.env.NEXT_PUBLIC_FREEE_COMPANY_ID || "0"),
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content?: string, confirmed = false) => {
    const userText = content || input.trim();
    if (!userText || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // API用メッセージ履歴
    const apiMessages = [
      ...messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userText },
    ];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          token: mockToken,
          confirmed,
        }),
      });

      const data = await res.json();

      if (data.type === "confirmation_required") {
        setConfirmation({
          operations: data.operations,
          pendingMessages: data.pendingMessages,
        });
        setIsLoading(false);
        return;
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message || "処理が完了しました。",
        charts: data.charts || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "⚠️ エラーが発生しました。しばらく待ってから再試行してください。",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-sm">
            CFO
          </div>
          <div>
            <h1 className="font-semibold text-white text-sm">AI CFO</h1>
            <p className="text-xs text-slate-400">freee 連携 / 財務分析AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full
            ${isAuthenticated ? "bg-emerald-900/50 text-emerald-400 border border-emerald-800" : "bg-red-900/50 text-red-400 border border-red-800"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isAuthenticated ? "bg-emerald-400" : "bg-red-400"}`} />
            {isAuthenticated ? "freee 接続中" : "未接続"}
          </span>
        </div>
      </header>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
        <div className="max-w-3xl mx-auto">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* ローディング */}
          {isLoading && (
            <div className="flex gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex-shrink-0 flex items-center justify-center text-sm font-bold">AI</div>
              <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                  <span className="text-xs text-slate-400 ml-1">freee からデータ取得中...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* クイックプロンプト */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs text-slate-500 mb-2 pl-1">クイック質問</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 入力エリア */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-800 bg-slate-900/30">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end bg-slate-800 rounded-2xl border border-slate-700 p-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="質問や指示を入力... (Shift+Enter で改行)"
              className="flex-1 bg-transparent resize-none text-sm text-white placeholder-slate-500 outline-none max-h-32 min-h-[40px] px-2 py-2 leading-relaxed"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-center text-xs text-slate-600 mt-2">
            AI CFO は freee APIと連携して動作します。重要な判断は必ず専門家にご確認ください。
          </p>
        </div>
      </div>

      {/* 確認ダイアログ */}
      {confirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white">操作の確認</h3>
                <p className="text-xs text-slate-400">以下の操作を実行します</p>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {confirmation.operations.map((op, i) => (
                <div key={i} className="bg-slate-800 rounded-xl p-3 text-sm text-slate-300 border border-slate-700">
                  {op.label}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmation(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  setConfirmation(null);
                  sendMessage(undefined, true);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
