"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  X,
  Boxes,
  Layers,
  Upload,
  Search,
  Eye,
  Copy,
  Check,
  PackageX,
  CheckCircle2,
} from "lucide-react";
import Spinner from "@/components/loading/Spinner";

interface VariationRow {
  id: string;
  name: string;
  code: string;
  price: number;
  _count: { stocks: number };
  soldCount: number;
}

interface ProductData {
  id: string;
  name: string;
  code: string;
  price: number;
  variations: VariationRow[];
}

interface StockRow {
  id: string;
  data: string;
  isSold: boolean;
  createdAt: string;
}

interface FlatVariation extends VariationRow {
  productId: string;
  productName: string;
  productCode: string;
}

const STOCK_FORMAT_TEMPLATES: Array<{ value: string; label: string; hint: string }> = [
  { value: "email|password", label: "Default (email | password)", hint: "email | password" },
  {
    value: "email|password|info",
    label: "Email + password + info",
    hint: "email | password | info",
  },
  { value: "username|password", label: "Username + password", hint: "username | password" },
  { value: "key", label: "Key / token only", hint: "key" },
];

function formatRupiah(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export default function StocksPage() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "empty">("all");

  const [bulkModal, setBulkModal] = useState<FlatVariation | null>(null);
  const [bulkData, setBulkData] = useState("");
  const [bulkFormat, setBulkFormat] = useState("email|password");
  const [bulkReplace, setBulkReplace] = useState(false);

  const [varModal, setVarModal] = useState<{ productId: string; productName: string } | null>(null);
  const [varForm, setVarForm] = useState({ name: "", code: "", price: 0 });

  const [detail, setDetail] = useState<FlatVariation | null>(null);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stockFilter, setStockFilter] = useState<"all" | "sold" | "unsold">("unsold");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [copied, setCopied] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const res = await fetch("/api/user/products");
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const flatVariations = useMemo<FlatVariation[]>(() => {
    return products.flatMap((p) =>
      p.variations.map((v) => ({
        ...v,
        productId: p.id,
        productName: p.name,
        productCode: p.code,
      })),
    );
  }, [products]);

  const stats = useMemo(() => {
    const tersedia = flatVariations.reduce((s, v) => s + v._count.stocks, 0);
    const terjual = flatVariations.reduce((s, v) => s + v.soldCount, 0);
    return {
      totalStok: tersedia + terjual,
      tersedia,
      terjual,
      variasi: flatVariations.length,
    };
  }, [flatVariations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flatVariations.filter((v) => {
      if (q) {
        const hay = `${v.name} ${v.code} ${v.productName} ${v.productCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "available" && v._count.stocks === 0) return false;
      if (filter === "empty" && v._count.stocks > 0) return false;
      return true;
    });
  }, [flatVariations, search, filter]);

  const openBulk = (v: FlatVariation) => {
    setBulkModal(v);
    setBulkData("");
    setBulkFormat("email|password");
    setBulkReplace(false);
    setError(null);
  };

  const handleBulkSubmit = async () => {
    if (!bulkModal) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variationId: bulkModal.id,
          bulk: bulkData,
          replaceAll: bulkReplace,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah stock");
      setBulkModal(null);
      setSaving(false);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal";
      setError(msg);
      setSaving(false);
    }
  };

  const openVarModal = (productId: string, productName: string) => {
    setVarForm({ name: "", code: "", price: 0 });
    setVarModal({ productId, productName });
    setError(null);
  };

  const handleVarSubmit = async () => {
    if (!varModal) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: varModal.productId,
          name: varForm.name,
          code: varForm.code,
          price: varForm.price,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah variasi");
      setVarModal(null);
      setSaving(false);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal";
      setError(msg);
      setSaving(false);
    }
  };

  const handleDeleteVariation = async (v: FlatVariation) => {
    if (!confirm(`Hapus variasi "${v.name}" dan semua stock-nya?`)) return;
    await fetch("/api/user/variations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id }),
    });
    fetchData();
  };

  const handleDeleteAllStock = async (v: FlatVariation) => {
    if (!confirm(`Hapus semua stock TERSEDIA di variasi "${v.name}"? (Stock terjual tetap aman)`))
      return;
    await fetch("/api/user/stocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteAll: true, variationId: v.id }),
    });
    fetchData();
    if (detail && detail.id === v.id) await loadStocks(v);
  };

  const loadStocks = async (v: FlatVariation) => {
    setStocksLoading(true);
    const url = new URL("/api/user/stocks", window.location.origin);
    url.searchParams.set("variationId", v.id);
    if (stockFilter === "sold") url.searchParams.set("sold", "true");
    if (stockFilter === "unsold") url.searchParams.set("sold", "false");
    const res = await fetch(url.toString());
    const data = await res.json();
    setStocks(data.stocks || []);
    setStocksLoading(false);
  };

  const openDetail = (v: FlatVariation) => {
    setDetail(v);
    setStocks([]);
    setPage(1);
    setStockFilter("unsold");
  };

  useEffect(() => {
    if (!detail) return;
    loadStocks(detail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, stockFilter]);

  const handleDeleteStock = async (id: string) => {
    if (!confirm("Hapus baris akun ini?")) return;
    await fetch("/api/user/stocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (detail) {
      await loadStocks(detail);
      fetchData();
    }
  };

  const copyRow = async (data: string, id: string) => {
    try {
      await navigator.clipboard.writeText(data);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      // ignore
    }
  };

  const bulkLines = bulkData.split("\n").filter((l) => l.trim()).length;
  const bulkHint = STOCK_FORMAT_TEMPLATES.find((t) => t.value === bulkFormat)?.hint ?? bulkFormat;
  const pages = Math.max(1, Math.ceil(stocks.length / PAGE_SIZE));
  const visibleStocks = stocks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Variasi & Stock</h1>
          <p className="text-sm text-gray-500">Kelola stock akun per variasi produk</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Boxes className="w-5 h-5" />}
          label="Total Stok"
          value={stats.totalStok}
          accent="indigo"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Stok Tersedia"
          value={stats.tersedia}
          accent="emerald"
        />
        <StatCard
          icon={<PackageX className="w-5 h-5" />}
          label="Stok Terjual"
          value={stats.terjual}
          accent="amber"
        />
        <StatCard
          icon={<Layers className="w-5 h-5" />}
          label="Variasi"
          value={stats.variasi}
          accent="violet"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari variasi / produk..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | "available" | "empty")}
            className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
          >
            <option value="all">Semua</option>
            <option value="available">Stok ada</option>
            <option value="empty">Stok habis</option>
          </select>
        </div>
        <div className="flex gap-2">
          <select
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const p = products.find((x) => x.id === id);
              if (p) openVarModal(p.id, p.name);
              e.target.value = "";
            }}
            className="px-3 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 bg-transparent text-sm"
          >
            <option value="">+ Tambah Variasi…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Variasi</th>
                <th className="text-left px-4 py-3">Produk Induk</th>
                <th className="text-right px-4 py-3">Harga</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Tersedia</th>
                <th className="text-right px-4 py-3">Terjual</th>
                <th className="text-right px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const total = v._count.stocks + v.soldCount;
                const stokOK = v._count.stocks > 0;
                return (
                  <tr key={v.id} className="border-t border-gray-100 dark:border-slate-800">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{v.name}</div>
                      <div className="text-xs font-mono text-gray-500 mt-0.5">[{v.code}]</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm">{v.productName}</div>
                      <div className="text-xs font-mono text-gray-500 mt-0.5">{v.productCode}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums align-top">
                      {formatRupiah(v.price)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums align-top">{total}</td>
                    <td className="px-4 py-3 text-right tabular-nums align-top">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          stokOK
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                        }`}
                      >
                        {v._count.stocks}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums align-top">{v.soldCount}</td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openBulk(v)}
                          aria-label="Isi Stock"
                          title="Isi Stock"
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-xs font-medium"
                        >
                          <Upload className="w-3.5 h-3.5" /> Isi
                        </button>
                        <button
                          onClick={() => openDetail(v)}
                          aria-label="Lihat detail"
                          title="Lihat detail"
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAllStock(v)}
                          aria-label="Hapus semua stock"
                          title="Hapus semua stock tersedia"
                          className="p-1.5 rounded-lg border border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                        >
                          <PackageX className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVariation(v)}
                          aria-label="Hapus variasi"
                          title="Hapus variasi"
                          className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-sm text-gray-400 py-8">
                    {flatVariations.length === 0
                      ? "Belum ada variasi. Tambah produk + variasi dulu."
                      : "Tidak ada variasi yang cocok dengan filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Add Stock modal */}
      <AnimatePresence>
        {bulkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold">Isi Stock — {bulkModal.name}</h3>
                  <p className="text-xs text-gray-500">{bulkModal.productName} · [{bulkModal.code}]</p>
                </div>
                <button
                  onClick={() => setBulkModal(null)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Form Stock</label>
                  <select
                    value={bulkFormat}
                    onChange={(e) => setBulkFormat(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                  >
                    {STOCK_FORMAT_TEMPLATES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Format:{" "}
                    <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-xs">
                      {bulkHint}
                    </code>
                  </p>
                </div>
                <Toggle
                  checked={bulkReplace}
                  onChange={setBulkReplace}
                  label="Mode Edit Stock (ganti semua)"
                />
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Akun ({bulkLines} baris)
                  </label>
                  <textarea
                    value={bulkData}
                    onChange={(e) => setBulkData(e.target.value)}
                    rows={10}
                    placeholder={`Satu akun per baris.\nContoh: ${bulkHint}`}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-xs resize-none"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setBulkModal(null)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleBulkSubmit}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium disabled:opacity-60"
                  >
                    {saving ? "Menyimpan…" : `Upload ${bulkLines}`.trim()}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Variation modal */}
      <AnimatePresence>
        {varModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold">Tambah Variasi</h3>
                  <p className="text-xs text-gray-500">{varModal.productName}</p>
                </div>
                <button
                  onClick={() => setVarModal(null)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <input
                  placeholder="Nama Variasi (contoh: 1 Bulan)"
                  value={varForm.name}
                  onChange={(e) => setVarForm({ ...varForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                />
                <input
                  placeholder="Kode (contoh: NETFLIX1)"
                  value={varForm.code}
                  onChange={(e) =>
                    setVarForm({
                      ...varForm,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                    })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-sm"
                />
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Harga (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={varForm.price}
                    onChange={(e) =>
                      setVarForm({ ...varForm, price: Number(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setVarModal(null)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleVarSubmit}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium disabled:opacity-60"
                  >
                    {saving ? "Menyimpan…" : "Simpan"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail drawer */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setDetail(null)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold">{detail.name}</h3>
                  <p className="text-xs text-gray-500">
                    {detail.productName} · [{detail.code}] · {formatRupiah(detail.price)}
                  </p>
                </div>
                <button
                  onClick={() => setDetail(null)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">Filter:</span>
                  {(["unsold", "sold", "all"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setStockFilter(f);
                        setPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-lg border text-xs ${
                        stockFilter === f
                          ? "bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                          : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {f === "unsold" ? "Tersedia" : f === "sold" ? "Terjual" : "Semua"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openBulk(detail)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 text-xs font-medium"
                  >
                    <Upload className="w-3.5 h-3.5" /> Isi Stock
                  </button>
                  <button
                    onClick={() => handleDeleteAllStock(detail)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium"
                  >
                    <PackageX className="w-3.5 h-3.5" /> Hapus Semua Tersedia
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {stocksLoading ? (
                  <Spinner />
                ) : stocks.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    Belum ada akun pada filter ini.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {visibleStocks.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 p-2 rounded-xl border border-gray-100 dark:border-slate-800"
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            s.isSold ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          title={s.isSold ? "Terjual" : "Tersedia"}
                        />
                        <code className="flex-1 text-xs font-mono break-all">{s.data}</code>
                        <button
                          onClick={() => copyRow(s.data, s.id)}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500"
                          title="Salin"
                        >
                          {copied === s.id ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        {!s.isSold && (
                          <button
                            onClick={() => handleDeleteStock(s.id)}
                            className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/40 text-rose-500"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {pages > 1 && (
                <div className="border-t border-gray-100 dark:border-slate-800 p-3 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, stocks.length)} dari{" "}
                    {stocks.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      disabled={page === pages}
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      className="px-3 py-1 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {flatVariations.length === 0 && !loading && products.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-3">
          <Plus className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            Belum ada variasi. Pakai dropdown <span className="font-medium">+ Tambah Variasi…</span> di toolbar untuk mulai.
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: "indigo" | "emerald" | "violet" | "amber";
}) {
  const accentMap: Record<string, string> = {
    indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
    emerald:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentMap[accent]}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm">{label}</span>
      <span
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${
          checked ? "bg-indigo-500" : "bg-gray-300 dark:bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </label>
  );
}
