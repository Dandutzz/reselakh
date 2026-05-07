"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, Ticket } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Spinner from "@/components/loading/Spinner";

interface VoucherData { id: string; code: string; amount: number; type: string; maxUses: number; usedCount: number; isActive: boolean; expiresAt: string | null; createdAt: string; _count: { usages: number }; }

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<VoucherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ code: "", amount: 0, type: "fixed", maxUses: 1, expiresAt: "" });

  const fetchData = async () => { const res = await fetch("/api/admin/vouchers"); const data = await res.json(); setVouchers(data.vouchers || []); setLoading(false); };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    await fetch("/api/admin/vouchers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setModal(false); fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus voucher?")) return;
    await fetch("/api/admin/vouchers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchData();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch("/api/admin/vouchers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isActive: !isActive }) });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Voucher</h1><p className="text-sm text-gray-500">Kelola voucher untuk semua user</p></div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-sm"><Plus className="w-4 h-4" /> Buat Voucher</button>
      </div>

      {loading ? <Spinner /> : (
        <div className="grid gap-4">
          {vouchers.map((v) => (
            <motion.div key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center"><Ticket className="w-6 h-6 text-white" /></div>
                  <div>
                    <h3 className="font-bold text-lg font-mono">{v.code}</h3>
                    <p className="text-sm text-gray-500">{v.type === "fixed" ? formatCurrency(v.amount) : `${v.amount}%`} | Dipakai: {v.usedCount}/{v.maxUses} | {v.expiresAt ? `Exp: ${formatDate(v.expiresAt)}` : "No expiry"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(v.id, v.isActive)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${v.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{v.isActive ? "Aktif" : "Nonaktif"}</button>
                  <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </motion.div>
          ))}
          {vouchers.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada voucher</p>}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">Buat Voucher</h3><button onClick={() => setModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button></div>
              <div className="space-y-3">
                <input placeholder="Kode Voucher" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent"><option value="fixed">Fixed (Rp)</option><option value="percentage">Percentage (%)</option></select>
                  <input type="number" placeholder="Jumlah/Persen" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                </div>
                <input type="number" placeholder="Max penggunaan" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                <input type="datetime-local" placeholder="Expiry" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                <button onClick={handleAdd} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium">Buat Voucher</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
