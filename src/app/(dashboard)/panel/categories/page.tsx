"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, X, FolderTree } from "lucide-react";
import Spinner from "@/components/loading/Spinner";

interface CategoryData { id: string; name: string; slug: string; icon: string | null; sortOrder: number; isActive: boolean; _count: { products: number }; }

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", icon: "", sortOrder: 0 });

  const fetchData = async () => { const res = await fetch("/api/user/categories"); const data = await res.json(); setCategories(data.categories || []); setLoading(false); };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    const method = editId ? "PATCH" : "POST";
    const body = editId ? { id: editId, ...form } : form;
    await fetch("/api/user/categories", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setModal(null); setEditId(null); setForm({ name: "", icon: "", sortOrder: 0 }); fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus kategori?")) return;
    await fetch("/api/user/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Kategori</h1><p className="text-sm text-gray-500">Kelola kategori produk</p></div>
        <button onClick={() => { setEditId(null); setForm({ name: "", icon: "", sortOrder: 0 }); setModal("add"); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-sm"><Plus className="w-4 h-4" /> Tambah</button>
      </div>

      {loading ? <Spinner /> : (
        <div className="grid gap-3">
          {categories.map((c) => (
            <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center"><FolderTree className="w-5 h-5 text-white" /></div>
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-xs text-gray-500">{c._count.products} produk | Sort: {c.sortOrder}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditId(c.id); setForm({ name: c.name, icon: c.icon || "", sortOrder: c.sortOrder }); setModal("edit"); }} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </motion.div>
          ))}
          {categories.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada kategori</p>}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">{editId ? "Edit" : "Tambah"} Kategori</h3><button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button></div>
              <div className="space-y-3">
                <input placeholder="Nama Kategori" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                <input placeholder="Icon (emoji/class)" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                <input type="number" placeholder="Sort Order" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                <button onClick={handleSave} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium">Simpan</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
