"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Spinner from "@/components/loading/Spinner";

interface MutData { id: string; type: string; amount: number; balBefore: number; balAfter: number; description: string; source: string | null; createdAt: string; }

export default function UserMutationsPage() {
  const [mutations, setMutations] = useState<MutData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const fetchData = async () => { const params = new URLSearchParams(); if (filter) params.set("type", filter); const res = await fetch(`/api/user/mutations?${params}`); const data = await res.json(); setMutations(data.mutations || []); setLoading(false); };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [filter]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Mutasi Saldo</h1><p className="text-sm text-gray-500">Riwayat debit dan kredit saldo Anda</p></div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"><option value="">Semua</option><option value="credit">Credit</option><option value="debit">Debit</option></select>
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {mutations.map((m) => (
            <div key={m.id} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {m.type === "credit" ? <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"><ArrowUpRight className="w-5 h-5 text-green-600" /></div> : <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><ArrowDownRight className="w-5 h-5 text-red-600" /></div>}
                <div><p className="font-medium text-sm">{m.description}</p><p className="text-xs text-gray-500">{formatDate(m.createdAt)} | {m.source || "-"}</p></div>
              </div>
              <div className="text-right">
                <p className={`font-bold ${m.type === "credit" ? "text-green-600" : "text-red-600"}`}>{m.type === "credit" ? "+" : "-"}{formatCurrency(m.amount)}</p>
                <p className="text-xs text-gray-500">Saldo: {formatCurrency(m.balAfter)}</p>
              </div>
            </div>
          ))}
          {mutations.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada mutasi</p>}
        </div>
      )}
    </div>
  );
}
