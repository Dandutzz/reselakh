"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Spinner from "@/components/loading/Spinner";

interface ProductData { id: string; name: string; slug: string; price: number; isActive: boolean; image: string | null; category: { name: string }; variations: Array<{ id: string; name: string; _count: { stocks: number } }>; }
interface CategoryOption { id: string; name: string; }

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ categoryId: "", name: "", description: "", price: 0, image: "", banner: "" });

  const fetchData = async () => {
    const [pRes, cRes] = await Promise.all([fetch("/api/user/products"), fetch("/api/user/categories")]);
    const [pData, cData] = await Promise.all([pRes.json(), cRes.json()]);
    setProducts(pData.products || []); setCategories(cData.categories || []);
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    await fetch("/api/user/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setModal(false); fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus produk?")) return;
    await fetch("/api/user/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Produk</h1><p className="text-sm text-gray-500">Kelola produk digital Anda</p></div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-sm"><Plus className="w-4 h-4" /> Tambah Produk</button>
      </div>

      {loading ? <Spinner /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
              <div className="h-32 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 flex items-center justify-center"><Package className="w-12 h-12 text-indigo-400" /></div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{p.category.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{p.isActive ? "Aktif" : "Nonaktif"}</span>
                </div>
                <h3 className="font-bold mb-1">{p.name}</h3>
                <p className="text-lg font-bold text-indigo-600">{formatCurrency(p.price)}</p>
                <div className="mt-2 text-xs text-gray-500">{p.variations.length} variasi | Stock: {p.variations.reduce((s, v) => s + v._count.stocks, 0)}</div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleDelete(p.id)} className="flex-1 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Hapus</button>
                </div>
              </div>
            </motion.div>
          ))}
          {products.length === 0 && <p className="col-span-full text-center text-gray-400 py-8">Belum ada produk. Buat kategori dulu, lalu tambah produk.</p>}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">Tambah Produk</h3><button onClick={() => setModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button></div>
              <div className="space-y-3">
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent"><option value="">Pilih Kategori</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <input placeholder="Nama Produk" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                <textarea placeholder="Deskripsi" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent resize-none" />
                <input type="number" placeholder="Harga" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                <input placeholder="URL Gambar (opsional)" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                <input placeholder="URL Banner (opsional)" value={form.banner} onChange={(e) => setForm({ ...form, banner: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                <button onClick={handleAdd} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium">Simpan</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
