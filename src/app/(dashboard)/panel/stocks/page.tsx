"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, Database, Upload } from "lucide-react";
import Spinner from "@/components/loading/Spinner";

interface ProductData { id: string; name: string; variations: Array<{ id: string; name: string; code: string; price: number; _count: { stocks: number } }>; }

export default function StocksPage() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: string; variationId?: string; variationName?: string } | null>(null);
  const [bulkData, setBulkData] = useState("");
  const [varForm, setVarForm] = useState({ productId: "", name: "", code: "", price: 0 });

  const fetchData = async () => { const res = await fetch("/api/user/products"); const data = await res.json(); setProducts(data.products || []); setLoading(false); };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const handleAddVariation = async () => {
    await fetch("/api/user/variations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(varForm) });
    setModal(null); fetchData();
  };

  const handleBulkStock = async () => {
    if (!modal?.variationId) return;
    await fetch("/api/user/stocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variationId: modal.variationId, bulk: bulkData }) });
    setModal(null); setBulkData(""); fetchData();
  };

  const handleDeleteVariation = async (id: string) => {
    if (!confirm("Hapus variasi dan semua stock?")) return;
    await fetch("/api/user/variations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Variasi & Stock</h1><p className="text-sm text-gray-500">Kelola variasi produk dan stock akun</p></div>

      {loading ? <Spinner /> : (
        <div className="space-y-6">
          {products.map((p) => (
            <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">{p.name}</h3>
                <button onClick={() => { setVarForm({ productId: p.id, name: "", code: "", price: 0 }); setModal({ type: "add_var" }); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-sm font-medium"><Plus className="w-3.5 h-3.5" /> Variasi</button>
              </div>
              <div className="space-y-2">
                {p.variations.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-indigo-500" />
                      <div>
                        <p className="font-medium">{v.name} <span className="text-xs font-mono text-gray-500">[{v.code}]</span></p>
                        <p className="text-xs text-gray-500">Harga: Rp {v.price.toLocaleString("id-ID")} | Stock tersedia: <span className="font-bold text-green-600">{v._count.stocks}</span></p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setModal({ type: "bulk", variationId: v.id, variationName: v.name })} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 text-green-600 text-xs font-medium"><Upload className="w-3.5 h-3.5" /> Isi Stock</button>
                      <button onClick={() => handleDeleteVariation(v.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                {p.variations.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Belum ada variasi</p>}
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada produk. Buat produk terlebih dahulu.</p>}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">{modal.type === "add_var" ? "Tambah Variasi" : `Isi Stock - ${modal.variationName}`}</h3><button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button></div>

              {modal.type === "add_var" ? (
                <div className="space-y-3">
                  <input placeholder="Nama Variasi (contoh: 1 Bulan)" value={varForm.name} onChange={(e) => setVarForm({ ...varForm, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                  <input placeholder="Kode (contoh: NETFLIX1)" value={varForm.code} onChange={(e) => setVarForm({ ...varForm, code: e.target.value.toUpperCase() })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono" />
                  <input type="number" placeholder="Harga" value={varForm.price} onChange={(e) => setVarForm({ ...varForm, price: Number(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                  <button onClick={handleAddVariation} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium">Simpan</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">Format: <code className="bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">email|password|info_tambahan</code></p>
                  <p className="text-xs text-gray-400">Satu akun per baris</p>
                  <textarea value={bulkData} onChange={(e) => setBulkData(e.target.value)} rows={10} placeholder={"user1@mail.com|password1|premium 1 bulan\nuser2@mail.com|password2|premium 3 bulan"} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-sm resize-none" />
                  <button onClick={handleBulkStock} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium">Upload Stock ({bulkData.split("\n").filter((l) => l.trim()).length} akun)</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
