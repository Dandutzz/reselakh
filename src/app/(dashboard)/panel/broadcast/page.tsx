"use client";

import { useEffect, useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import Spinner from "@/components/loading/Spinner";

interface BotData { id: string; type: string; name: string; isConnected: boolean; }

export default function BroadcastPage() {
  const [bots, setBots] = useState<BotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState("");
  const [message, setMessage] = useState("");
  const [targets, setTargets] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const fetchData = async () => { const res = await fetch("/api/user/bots"); const data = await res.json(); setBots((data.bots || []).filter((b: BotData) => b.isConnected)); setLoading(false); };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const handleSend = async () => {
    setSending(true); setResult(null);
    const targetList = targets.split("\n").map((t) => t.trim()).filter(Boolean);
    const res = await fetch("/api/bot/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botId: selectedBot, message, targets: targetList }) });
    const data = await res.json();
    if (res.ok) {
      const success = data.results?.filter((r: { success: boolean }) => r.success).length || 0;
      setResult(`Broadcast selesai! ${success}/${targetList.length} berhasil terkirim.`);
    } else {
      setResult(`Error: ${data.error}`);
    }
    setSending(false);
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Broadcast</h1><p className="text-sm text-gray-500">Kirim pesan broadcast ke banyak pengguna</p></div>

      {loading ? <Spinner /> : (
        <div className="max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Pilih Bot</label>
              <select value={selectedBot} onChange={(e) => setSelectedBot(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent">
                <option value="">Pilih bot...</option>
                {bots.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.type})</option>)}
              </select>
              {bots.length === 0 && <p className="text-xs text-amber-600 mt-1">Tidak ada bot yang terhubung. Start bot terlebih dahulu.</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Pesan</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Tulis pesan broadcast..." className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Target (satu per baris)</label>
              <textarea value={targets} onChange={(e) => setTargets(e.target.value)} rows={5} placeholder={"Telegram: Chat ID\nWhatsApp: 628xxxxxxxx"} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent resize-none font-mono text-sm" />
            </div>
            <button onClick={handleSend} disabled={sending || !selectedBot || !message || !targets} className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              <Send className="w-5 h-5" /> {sending ? "Mengirim..." : "Kirim Broadcast"}
            </button>
            {result && <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm flex items-center gap-2"><MessageSquare className="w-5 h-5" />{result}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
