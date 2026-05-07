"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Spinner from "@/components/loading/Spinner";

interface MutationData {
  id: string;
  type: string;
  amount: number;
  balBefore: number;
  balAfter: number;
  description: string;
  source: string | null;
  createdAt: string;
  user: { username: string; email: string };
}

export default function AdminMutationsPage() {
  const [mutations, setMutations] = useState<MutationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const fetchData = async () => {
    const params = new URLSearchParams();
    if (filter) params.set("type", filter);
    const res = await fetch(`/api/admin/mutations?${params}`);
    const data = await res.json();
    setMutations(data.mutations || []);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [filter]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mutasi Saldo</h1>
          <p className="text-sm text-gray-500">Riwayat mutasi debit kredit semua user</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
          <option value="">Semua</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Tipe</th>
                  <th className="text-left px-4 py-3 font-medium">Jumlah</th>
                  <th className="text-left px-4 py-3 font-medium">Sebelum</th>
                  <th className="text-left px-4 py-3 font-medium">Sesudah</th>
                  <th className="text-left px-4 py-3 font-medium">Keterangan</th>
                  <th className="text-left px-4 py-3 font-medium">Sumber</th>
                  <th className="text-left px-4 py-3 font-medium">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {mutations.map((m) => (
                  <tr key={m.id} className="border-t border-gray-50 dark:border-slate-800">
                    <td className="px-4 py-3 font-medium">{m.user.username}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.type === "credit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {m.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(m.amount)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatCurrency(m.balBefore)}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(m.balAfter)}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{m.description}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{m.source || "-"}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(m.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mutations.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada mutasi</p>}
        </div>
      )}
    </div>
  );
}
