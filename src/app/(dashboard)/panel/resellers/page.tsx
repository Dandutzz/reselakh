"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Spinner from "@/components/loading/Spinner";

interface ResellerData { id: string; name: string; phone: string | null; email: string | null; balance: number; status: string; _count: { orders: number }; }

export default function ResellersPage() {
  const [resellers, setResellers] = useState<ResellerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const fetchData = async () => { const res = await fetch("/api/user/dashboard"); const data = await res.json(); setResellers(data.resellers || []); setLoading(false); };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Reseller</h1><p className="text-sm text-gray-500">Kelola reseller yang menggunakan bot Anda</p></div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-sm"><Plus className="w-4 h-4" /> Tambah</button>
      </div>

      {loading ? <Spinner /> : (
        <div className="grid gap-4">
          {resellers.map((r) => (
            <div key={r.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center"><Users className="w-6 h-6 text-white" /></div>
                <div><h3 className="font-semibold">{r.name}</h3><p className="text-sm text-gray-500">{r.phone || r.email} | {r._count.orders} orders</p></div>
              </div>
              <p className="font-bold">{formatCurrency(r.balance)}</p>
            </div>
          ))}
          {resellers.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada reseller</p>}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">Tambah Reseller</h3><button onClick={() => setModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button></div>
              <div className="space-y-3">
                <input placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium">Simpan</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
