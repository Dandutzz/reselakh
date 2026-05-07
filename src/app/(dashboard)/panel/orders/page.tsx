"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Spinner from "@/components/loading/Spinner";

interface OrderData { id: string; totalPrice: number; quantity: number; status: string; source: string; accountData: string | null; createdAt: string; product: { name: string }; variation: { name: string; code: string } | null; }

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch("/api/user/dashboard").then((r) => r.json()).then((d) => { setOrders(d.recentOrders || []); setLoading(false); }); }, []);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Rekapan Order</h1><p className="text-sm text-gray-500">Riwayat transaksi order produk</p></div>

      {loading ? <Spinner /> : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800"><tr><th className="text-left px-4 py-3 font-medium">Produk</th><th className="text-left px-4 py-3 font-medium">Qty</th><th className="text-left px-4 py-3 font-medium">Total</th><th className="text-left px-4 py-3 font-medium">Sumber</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="text-left px-4 py-3 font-medium">Waktu</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-50 dark:border-slate-800">
                    <td className="px-4 py-3 font-medium">{o.product.name}</td>
                    <td className="px-4 py-3">{o.quantity}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(o.totalPrice)}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${o.source === "telegram" ? "bg-blue-100 text-blue-700" : o.source === "whatsapp" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{o.source}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${o.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{o.status}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orders.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada order</p>}
        </div>
      )}
    </div>
  );
}
