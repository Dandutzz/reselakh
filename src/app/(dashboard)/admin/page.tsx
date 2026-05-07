"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, ShoppingCart, DollarSign, AlertCircle, TrendingUp, Clock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import PageLoader from "@/components/loading/PageLoader";

interface DashboardData {
  stats: {
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
    totalOrders: number;
    totalRevenue: number;
    pendingWithdrawals: number;
  };
  recentOrders: Array<{
    id: string;
    totalPrice: number;
    status: string;
    source: string;
    createdAt: string;
    user: { username: string };
    product: { name: string };
  }>;
  recentUsers: Array<{
    id: string;
    username: string;
    email: string;
    balance: number;
    status: string;
    createdAt: string;
  }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (!data) return <div className="text-center text-gray-500">Gagal memuat data</div>;

  const statCards = [
    { label: "Total User", value: data.stats.totalUsers, icon: Users, color: "from-blue-500 to-blue-600" },
    { label: "User Aktif", value: data.stats.activeUsers, icon: TrendingUp, color: "from-green-500 to-green-600" },
    { label: "Total Order", value: data.stats.totalOrders, icon: ShoppingCart, color: "from-purple-500 to-purple-600" },
    { label: "Total Revenue", value: formatCurrency(data.stats.totalRevenue), icon: DollarSign, color: "from-amber-500 to-amber-600" },
    { label: "User Banned", value: data.stats.bannedUsers, icon: AlertCircle, color: "from-red-500 to-red-600" },
    { label: "Pending WD", value: data.stats.pendingWithdrawals, icon: Clock, color: "from-orange-500 to-orange-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview platform Reselakh</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5">
          <h3 className="text-lg font-semibold mb-4">Order Terbaru</h3>
          <div className="space-y-3">
            {data.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-medium">{order.product.name}</p>
                  <p className="text-xs text-gray-500">
                    {order.user.username} &middot; {order.source} &middot; {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(order.totalPrice)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
            {data.recentOrders.length === 0 && <p className="text-sm text-gray-400">Belum ada order</p>}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5">
          <h3 className="text-lg font-semibold mb-4">User Terbaru</h3>
          <div className="space-y-3">
            {data.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-medium">{u.username}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(u.balance)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {u.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
