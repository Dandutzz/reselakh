"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import Spinner from "@/components/loading/Spinner";

interface WdData { id: string; amount: number; bankName: string | null; bankAccount: string | null; status: string; createdAt: string; }

export default function WithdrawPage() {
  const { user, refresh } = useAuth();
  const [withdrawals, setWithdrawals] = useState<WdData[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ amount: 0, bankName: "", bankAccount: "", bankHolder: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => { const res = await fetch("/api/user/withdraw"); const data = await res.json(); setWithdrawals(data.withdrawals || []); setLoading(false); };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    await fetch("/api/user/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ amount: 0, bankName: "", bankAccount: "", bankHolder: "" });
    setSubmitting(false); fetchData(); refresh();
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Withdraw</h1><p className="text-sm text-gray-500">Saldo: {formatCurrency(user?.balance || 0)}</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-4"><Wallet className="w-6 h-6 text-indigo-500" /><h3 className="font-bold text-lg">Request Withdraw</h3></div>
          <div className="space-y-3">
            <input type="number" placeholder="Jumlah" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
            <input placeholder="Nama Bank (BCA, BRI, dll)" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
            <input placeholder="Nomor Rekening" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
            <input placeholder="Nama Pemilik Rekening" value={form.bankHolder} onChange={(e) => setForm({ ...form, bankHolder: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
            <button onClick={handleSubmit} disabled={submitting || !form.amount} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium disabled:opacity-50">Request Withdraw</button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6">
          <h3 className="font-bold text-lg mb-4">Riwayat Withdraw</h3>
          {loading ? <Spinner size="sm" /> : (
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-slate-800 last:border-0">
                  <div><p className="font-medium text-sm">{w.bankName} - {w.bankAccount}</p><p className="text-xs text-gray-500">{formatDate(w.createdAt)}</p></div>
                  <div className="text-right"><p className="font-bold">{formatCurrency(w.amount)}</p><span className={`text-xs px-2 py-0.5 rounded-full ${w.status === "approved" ? "bg-green-100 text-green-700" : w.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{w.status}</span></div>
                </div>
              ))}
              {withdrawals.length === 0 && <p className="text-sm text-gray-400">Belum ada request withdraw</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
