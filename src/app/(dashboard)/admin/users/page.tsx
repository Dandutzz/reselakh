"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Ban, CheckCircle, Edit2, DollarSign, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Spinner from "@/components/loading/Spinner";

interface UserData {
  id: string;
  username: string;
  email: string;
  role: string;
  balance: number;
  status: string;
  phone: string | null;
  createdAt: string;
  _count: { orders: number; bots: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ type: string; user?: UserData } | null>(null);
  const [form, setForm] = useState({ username: "", email: "", password: "", phone: "", role: "user", amount: 0, description: "" });

  const fetchUsers = async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchUsers(); }, [search]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, ...extra }),
    });
    fetchUsers();
    setModal(null);
  };

  const handleAddUser = async () => {
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    fetchUsers();
    setModal(null);
    setForm({ username: "", email: "", password: "", phone: "", role: "user", amount: 0, description: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Kelola User</h1>
          <p className="text-sm text-gray-500">Manage semua user yang terdaftar</p>
        </div>
        <button onClick={() => setModal({ type: "add" })} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-sm shadow-lg shadow-indigo-500/25">
          <Plus className="w-4 h-4" /> Tambah User
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Cari username atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
        />
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Saldo</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Stats</th>
                  <th className="text-left px-4 py-3 font-medium">Joined</th>
                  <th className="text-left px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.username}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(u.balance)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${u.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{u._count.orders} orders, {u._count.bots} bots</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setForm({ ...form, amount: 0, description: "" }); setModal({ type: "balance", user: u }); }} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Atur Saldo">
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button onClick={() => setModal({ type: "edit", user: u })} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u.status === "active" ? (
                          <button onClick={() => handleAction(u.id, "ban")} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Ban">
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => handleAction(u.id, "unban")} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Unban">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">
                  {modal.type === "add" ? "Tambah User" : modal.type === "balance" ? "Atur Saldo" : "Edit User"}
                </h3>
                <button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>

              {modal.type === "add" && (
                <div className="space-y-3">
                  <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                  <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                  <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                  <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={handleAddUser} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium">Tambah</button>
                </div>
              )}

              {modal.type === "balance" && modal.user && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">User: <span className="font-medium text-gray-900 dark:text-white">{modal.user.username}</span></p>
                  <p className="text-sm text-gray-500">Saldo saat ini: <span className="font-medium">{formatCurrency(modal.user.balance)}</span></p>
                  <input type="number" placeholder="Jumlah" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                  <input placeholder="Keterangan" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleAction(modal.user!.id, "add_balance", { amount: form.amount, description: form.description })} className="py-2.5 rounded-xl bg-green-500 text-white font-medium text-sm">+ Tambah</button>
                    <button onClick={() => handleAction(modal.user!.id, "subtract_balance", { amount: form.amount, description: form.description })} className="py-2.5 rounded-xl bg-red-500 text-white font-medium text-sm">- Kurang</button>
                    <button onClick={() => handleAction(modal.user!.id, "set_balance", { amount: form.amount, description: form.description })} className="py-2.5 rounded-xl bg-blue-500 text-white font-medium text-sm">= Set</button>
                  </div>
                </div>
              )}

              {modal.type === "edit" && modal.user && (
                <div className="space-y-3">
                  <input placeholder="Username" defaultValue={modal.user.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                  <input placeholder="Email" defaultValue={modal.user.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                  <input placeholder="Password baru (kosongkan jika tidak diubah)" type="password" onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                  <select defaultValue={modal.user.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={() => handleAction(modal.user!.id, "edit", { username: form.username || undefined, email: form.email || undefined, password: form.password || undefined, role: form.role })} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium">Simpan</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
