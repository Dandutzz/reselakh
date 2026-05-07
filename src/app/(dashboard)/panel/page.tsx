"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Package, ShoppingCart, Users, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import PageLoader from "@/components/loading/PageLoader";

interface DashData {
  user: { id: string; username: string; email: string; balance: number };
  stats: { totalProducts: number; totalOrders: number; totalResellers: number };
  recentOrders: Array<{ id: string; totalPrice: number; status: string; source: string; createdAt: string; product: { name: string } }>;
  recentMutations: Array<{ id: string; type: string; amount: number; description: string; createdAt: string }>;
}

export default function UserDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch("/api/user/dashboard").then((r) => r.json()).then(setData).finally(() => setLoading(false)); }, []);

  if (loading) return <PageLoader />;
  if (!data) return <div className="text-center text-gray-500">Gagal memuat data</div>;

  const stats = [
    { label: "Saldo", value: formatCurrency(data.user.balance), icon: Wallet, color: "from-green-500 to-emerald-500" },
    { label: "Total Produk", value: data.stats.totalProducts, icon: Package, color: "from-blue-500 to-cyan-500" },
    { label: "Total Order", value: data.stats.totalOrders, icon: ShoppingCart, color: "from-purple-500 to-violet-500" },
    { label: "Reseller", value: data.stats.totalResellers, icon: Users, color: "from-amber-500 to-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-500">Selamat datang, {data.user.username}!</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">{s.label}</p><p className="text-2xl font-bold mt-1">{s.value}</p></div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${s.color} flex items-center justify-center`}><s.icon className="w-6 h-6 text-white" /></div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5">
          <h3 className="text-lg font-semibold mb-4">Order Terbaru</h3>
          <div className="space-y-3">
            {data.recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-slate-800 last:border-0">
                <div><p className="text-sm font-medium">{o.product.name}</p><p className="text-xs text-gray-500">{o.source} &middot; {formatDate(o.createdAt)}</p></div>
                <div className="text-right"><p className="text-sm font-semibold">{formatCurrency(o.totalPrice)}</p><span className={`text-xs px-2 py-0.5 rounded-full ${o.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{o.status}</span></div>
              </div>
            ))}
            {data.recentOrders.length === 0 && <p className="text-sm text-gray-400">Belum ada order</p>}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5">
          <h3 className="text-lg font-semibold mb-4">Mutasi Saldo Terbaru</h3>
          <div className="space-y-3">
            {data.recentMutations.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-slate-800 last:border-0">
                <div className="flex items-center gap-3">
                  {m.type === "credit" ? <ArrowUpRight className="w-5 h-5 text-green-500" /> : <ArrowDownRight className="w-5 h-5 text-red-500" />}
                  <div><p className="text-sm font-medium">{m.description}</p><p className="text-xs text-gray-500">{formatDate(m.createdAt)}</p></div>
                </div>
                <p className={`text-sm font-bold ${m.type === "credit" ? "text-green-600" : "text-red-600"}`}>{m.type === "credit" ? "+" : "-"}{formatCurrency(m.amount)}</p>
              </div>
            ))}
            {data.recentMutations.length === 0 && <p className="text-sm text-gray-400">Belum ada mutasi</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
