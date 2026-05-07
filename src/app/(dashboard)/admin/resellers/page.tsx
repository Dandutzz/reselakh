"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Spinner from "@/components/loading/Spinner";

interface ResellerData { id: string; name: string; phone: string | null; email: string | null; balance: number; status: string; createdAt: string; user: { username: string }; _count: { orders: number }; }

export default function AdminResellersPage() {
  const [resellers, setResellers] = useState<ResellerData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => { const res = await fetch("/api/admin/resellers"); const data = await res.json(); setResellers(data.resellers || []); setLoading(false); };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Reseller</h1><p className="text-sm text-gray-500">Pantau semua reseller dari user</p></div>

      {loading ? <Spinner /> : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Nama</th>
                  <th className="text-left px-4 py-3 font-medium">Owner</th>
                  <th className="text-left px-4 py-3 font-medium">Kontak</th>
                  <th className="text-left px-4 py-3 font-medium">Saldo</th>
                  <th className="text-left px-4 py-3 font-medium">Orders</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {resellers.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50 dark:border-slate-800">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3">{r.user.username}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.phone || r.email || "-"}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(r.balance)}</td>
                    <td className="px-4 py-3">{r._count.orders}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.status}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resellers.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada reseller</p>}
        </div>
      )}
    </div>
  );
}
