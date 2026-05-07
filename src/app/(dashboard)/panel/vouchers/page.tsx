"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Ticket, Gift } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function UserVouchersPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ success?: boolean; amount?: number; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    setLoading(true); setResult(null);
    const res = await fetch("/api/user/vouchers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await res.json();
    if (res.ok) setResult({ success: true, amount: data.amount });
    else setResult({ error: data.error });
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Voucher</h1><p className="text-sm text-gray-500">Redeem voucher untuk menambah saldo</p></div>

      <div className="max-w-md mx-auto">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-4"><Gift className="w-8 h-8 text-white" /></div>
          <h3 className="text-lg font-bold text-center mb-4">Redeem Voucher</h3>
          <div className="space-y-4">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Masukkan kode voucher" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-center font-mono text-lg tracking-widest" />
            <button onClick={handleRedeem} disabled={loading || !code} className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <><Ticket className="w-5 h-5" /> Redeem</>}
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 p-4 rounded-xl ${result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              {result.success ? <p className="text-green-700 font-medium text-center">Voucher berhasil! Saldo bertambah {formatCurrency(result.amount || 0)}</p> : <p className="text-red-700 text-center">{result.error}</p>}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
