"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Spinner from "@/components/loading/Spinner";

interface WithdrawalData {
  id: string;
  amount: number;
  bankName: string | null;
  bankAccount: string | null;
  bankHolder: string | null;
  status: string;
  note: string | null;
  createdAt: string;
  user: { username: string; email: string };
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const fetchData = async () => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    const res = await fetch(`/api/admin/withdrawals?${params}`);
    const data = await res.json();
    setWithdrawals(data.withdrawals || []);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [filter]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (id: string, status: string) => {
    await fetch("/api/admin/withdrawals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Withdrawal</h1>
          <p className="text-sm text-gray-500">Kelola permintaan penarikan saldo</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
          <option value="">Semua</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Jumlah</th>
                  <th className="text-left px-4 py-3 font-medium">Bank</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Waktu</th>
                  <th className="text-left px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-t border-gray-50 dark:border-slate-800">
                    <td className="px-4 py-3 font-medium">{w.user.username}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(w.amount)}</td>
                    <td className="px-4 py-3 text-sm">
                      <p>{w.bankName} - {w.bankAccount}</p>
                      <p className="text-xs text-gray-500">{w.bankHolder}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${w.status === "approved" ? "bg-green-100 text-green-700" : w.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(w.createdAt)}</td>
                    <td className="px-4 py-3">
                      {w.status === "pending" && (
                        <div className="flex gap-1">
                          <button onClick={() => handleAction(w.id, "approved")} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium">Approve</button>
                          <button onClick={() => handleAction(w.id, "rejected")} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium">Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {withdrawals.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada withdrawal</p>}
        </div>
      )}
    </div>
  );
}
