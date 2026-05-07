"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  X,
  Package,
  Boxes,
  Layers,
  Search,
  EyeOff,
  Upload,
  Pencil,
} from "lucide-react";
import Spinner from "@/components/loading/Spinner";

interface VariationRow {
  id: string;
  name: string;
  code: string;
  price: number;
  _count: { stocks: number };
}

interface ProductData {
  id: string;
  name: string;
  slug: string;
  code: string;
  description: string | null;
  price: number;
  isActive: boolean;
  image: string | null;
  banner: string | null;
  config: string | null;
  category: { name: string };
  variations: VariationRow[];
  soldCount: number;
  stockCount: number;
}

interface CategoryOption {
  id: string;
  name: string;
}

type CashbackType = "nominal" | "percent";

interface ProductConfig {
  terms?: string;
  cashbackType?: CashbackType;
  cashbackValue?: number;
  profit?: number;
  modeBulking?: number;
  stockFormat?: string;
}

interface FormState {
  id: string | null;
  categoryId: string;
  code: string;
  name: string;
  description: string;
  image: string;
  price: number;
  isActive: boolean;

  useVariations: boolean;
  stockFormat: string;
  modeEditStock: boolean;
  bulkStock: string;

  terms: string;
  cashbackType: CashbackType;
  cashbackValue: number;
  profit: number;
  modeBulking: number;
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

const emptyForm: FormState = {
  id: null,
  categoryId: "",
  code: "",
  name: "",
  description: "",
  image: "",
  price: 0,
  isActive: true,
  useVariations: false,
  stockFormat: "email|password",
  modeEditStock: false,
  bulkStock: "",
  terms: "",
  cashbackType: "nominal",
  cashbackValue: 0,
  profit: 0,
  modeBulking: 0,
};

function parseConfig(raw: string | null): ProductConfig {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as ProductConfig;
  } catch {
    return {};
  }
}

function formatRupiah(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function formatCashback(cfg: ProductConfig): string {
  const t = cfg.cashbackType;
  const v = cfg.cashbackValue ?? 0;
  if (!t || !v) return "—";
  if (t === "percent") return `${v}%`;
  return formatRupiah(v);
}

function defaultVariationOf(p: ProductData): VariationRow | null {
  if (p.variations.length === 0) return null;
  const expected = `${p.code}_MAIN`;
  return (
    p.variations.find((v) => v.code === expected) ||
    p.variations.find((v) => v.name.toLowerCase() === "default") ||
    (p.variations.length === 1 ? p.variations[0] : null)
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "single" | "variation">("all");
  const [hideEmpty, setHideEmpty] = useState(false);

  const [modal, setModal] = useState<"none" | "form" | "import">("none");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [stocksPreview, setStocksPreview] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [importTargetId, setImportTargetId] = useState<string>("");
  const [importBulk, setImportBulk] = useState<string>("");
  const [importReplace, setImportReplace] = useState(false);

  const fetchData = async () => {
    const [pRes, cRes] = await Promise.all([
      fetch("/api/user/products"),
      fetch("/api/user/categories"),
    ]);
    const [pData, cData] = await Promise.all([pRes.json(), cRes.json()]);
    setProducts(pData.products || []);
    setCategories(cData.categories || []);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const totalProduk = products.length;
    const totalStok = products.reduce((s, p) => s + p.stockCount, 0);
    const produkVariasi = products.filter(
      (p) => p.variations.filter((v) => v.code !== `${p.code}_MAIN`).length > 0,
    ).length;
    return { totalProduk, totalStok, produkVariasi };
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q))
        return false;
      const hasExtraVariations =
        p.variations.filter((v) => v.code !== `${p.code}_MAIN`).length > 0;
      if (typeFilter === "single" && hasExtraVariations) return false;
      if (typeFilter === "variation" && !hasExtraVariations) return false;
      if (hideEmpty && p.stockCount === 0) return false;
      return true;
    });
  }, [products, search, typeFilter, hideEmpty]);

  const openAdd = () => {
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? "" });
    setStocksPreview([]);
    setError(null);
    setModal("form");
  };

  const openEdit = async (p: ProductData) => {
    const cfg = parseConfig(p.config);
    const def = defaultVariationOf(p);
    const hasMulti =
      p.variations.filter((v) => v.code !== `${p.code}_MAIN`).length > 0;
    setForm({
      id: p.id,
      categoryId: "",
      code: p.code,
      name: p.name,
      description: p.description ?? "",
      image: p.image ?? "",
      price: p.price,
      isActive: p.isActive,
      useVariations: hasMulti,
      stockFormat: cfg.stockFormat ?? "email|password",
      modeEditStock: false,
      bulkStock: "",
      terms: cfg.terms ?? "",
      cashbackType: cfg.cashbackType ?? "nominal",
      cashbackValue: cfg.cashbackValue ?? 0,
      profit: cfg.profit ?? 0,
      modeBulking: cfg.modeBulking ?? 0,
    });
    setStocksPreview([]);
    setError(null);
    setModal("form");
    if (def) {
      try {
        const res = await fetch(`/api/user/stocks?variationId=${def.id}&sold=false`);
        const data = await res.json();
        const arr: string[] = (data.stocks || []).map((s: { data: string }) => s.data);
        setStocksPreview(arr);
      } catch {
        // ignore
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus produk?")) return;
    await fetch("/api/user/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  };

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      const config: ProductConfig = {};
      if (form.terms.trim()) config.terms = form.terms.trim();
      if (form.cashbackValue > 0) {
        config.cashbackType = form.cashbackType;
        config.cashbackValue = form.cashbackValue;
      }
      if (form.profit > 0) config.profit = form.profit;
      if (form.modeBulking > 0) config.modeBulking = form.modeBulking;
      if (form.stockFormat) config.stockFormat = form.stockFormat;

      let productId = form.id;
      if (!productId) {
        if (!form.categoryId) throw new Error("Pilih kategori dulu");
        if (!form.code.trim()) throw new Error("Kode Produk wajib diisi");
        const res = await fetch("/api/user/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: form.categoryId,
            name: form.name,
            code: form.code,
            description: form.description || null,
            image: form.image || null,
            price: form.price,
            config,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal menyimpan produk");
        productId = data.product.id as string;
      } else {
        const res = await fetch("/api/user/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: productId,
            name: form.name || undefined,
            description: form.description || null,
            image: form.image || null,
            price: form.price,
            isActive: form.isActive,
            config,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal menyimpan produk");
      }

      if (!form.useVariations && form.bulkStock.trim()) {
        const varRes = await fetch(`/api/user/variations?productId=${productId}`);
        const varData = await varRes.json();
        const list: VariationRow[] = varData.variations || [];
        const wanted = `${form.code.toUpperCase()}_MAIN`;
        let defVar =
          list.find((v) => v.code === wanted) ||
          list.find((v) => v.name === "Default");
        if (!defVar) {
          const created = await fetch("/api/user/variations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId,
              name: "Default",
              code: wanted,
              price: form.price,
            }),
          });
          const createdData = await created.json();
          if (!created.ok)
            throw new Error(createdData.error || "Gagal membuat variasi default");
          defVar = createdData.variation;
        }
        if (!defVar) throw new Error("Variasi default tidak tersedia");
        const stockRes = await fetch("/api/user/stocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variationId: defVar.id,
            bulk: form.bulkStock,
            replaceAll: form.modeEditStock,
          }),
        });
        const stockData = await stockRes.json();
        if (!stockRes.ok) throw new Error(stockData.error || "Gagal menambah stock");
      }

      setModal("none");
      setSaving(false);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      setError(msg);
      setSaving(false);
    }
  };

  const openImport = () => {
    const def = products[0];
    const targetId = def
      ? defaultVariationOf(def)?.id || def.variations[0]?.id || ""
      : "";
    setImportTargetId(targetId);
    setImportBulk("");
    setImportReplace(false);
    setError(null);
    setModal("import");
  };

  const handleImportSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      if (!importTargetId) throw new Error("Pilih variasi tujuan");
      if (!importBulk.trim()) throw new Error("Tempel akun yang akan di-import");
      const res = await fetch("/api/user/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variationId: importTargetId,
          bulk: importBulk,
          replaceAll: importReplace,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal import akun");
      setModal("none");
      setSaving(false);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal import";
      setError(msg);
      setSaving(false);
    }
  };

  const formatHint =
    STOCK_FORMAT_TEMPLATES.find((t) => t.value === form.stockFormat)?.hint ?? form.stockFormat;
  const importLines = importBulk.split("\n").filter((l) => l.trim()).length;
  const bulkLines = form.bulkStock.split("\n").filter((l) => l.trim()).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produk</h1>
          <p className="text-sm text-gray-500">Kelola produk digital + stock akun</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<Package className="w-5 h-5" />}
          label="Total Produk"
          value={stats.totalProduk}
          accent="indigo"
        />
        <StatCard
          icon={<Boxes className="w-5 h-5" />}
          label="Total Stok"
          value={stats.totalStok}
          accent="emerald"
        />
        <StatCard
          icon={<Layers className="w-5 h-5" />}
          label="Produk Variasi"
          value={stats.produkVariasi}
          accent="violet"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as "all" | "single" | "variation")
            }
            className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
          >
            <option value="all">Tipe Produk: Semua</option>
            <option value="single">Tanpa Variasi</option>
            <option value="variation">Ada Variasi</option>
          </select>
          <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={hideEmpty}
              onChange={(e) => setHideEmpty(e.target.checked)}
              className="accent-indigo-500"
            />
            <EyeOff className="w-4 h-4" /> Sembunyikan kosong
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openImport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 font-medium text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
          >
            <Upload className="w-4 h-4" /> Import Akun
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> Tambah Produk
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Kode</th>
                <th className="text-left px-4 py-3">Nama Produk</th>
                <th className="text-right px-4 py-3">Terjual</th>
                <th className="text-right px-4 py-3">Cashback</th>
                <th className="text-right px-4 py-3">Bulk</th>
                <th className="text-center px-4 py-3">Stok</th>
                <th className="text-center px-4 py-3">Variasi</th>
                <th className="text-center px-4 py-3">Sumber</th>
                <th className="text-right px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const cfg = parseConfig(p.config);
                const hasMulti =
                  p.variations.filter((v) => v.code !== `${p.code}_MAIN`).length > 0;
                const stokOK = p.stockCount > 0;
                return (
                  <tr key={p.id} className="border-t border-gray-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 align-top">
                      {p.code}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{p.name}</div>
                      {hasMulti ? (
                        <div className="text-xs text-indigo-500 mt-0.5">Ada variasi</div>
                      ) : (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {formatRupiah(p.price)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">
                      {p.soldCount}
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">
                      {formatCashback(cfg)}
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">
                      {cfg.modeBulking ? cfg.modeBulking : "—"}
                    </td>
                    <td className="px-4 py-3 text-center align-top">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          stokOK
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                        }`}
                      >
                        {p.stockCount} pcs
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center align-top">
                      {hasMulti ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                          Ya
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center align-top">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300">
                        Sendiri
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          aria-label="Edit"
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          aria-label="Hapus"
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
                  <td colSpan={9} className="text-center text-sm text-gray-400 py-8">
                    {products.length === 0
                      ? "Belum ada produk. Buat kategori dulu, lalu tambah produk."
                      : "Tidak ada produk yang cocok dengan filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {modal === "form" && (
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
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800">
                <h3 className="text-lg font-bold">
                  {form.id ? "Edit Produk" : "Tambah Produk"}
                </h3>
                <button
                  onClick={() => setModal("none")}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-5 space-y-4">
                <div className="grid sm:grid-cols-[140px_1fr] gap-3">
                  <div className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center text-gray-400 text-xs px-2 text-center overflow-hidden">
                    {form.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.image}
                        alt={form.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 mb-1" />
                        URL gambar di bawah
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    {!form.id && (
                      <select
                        value={form.categoryId}
                        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                      >
                        <option value="">Pilih Kategori</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      placeholder="Kode Produk (huruf/angka/-_)"
                      value={form.code}
                      disabled={!!form.id}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                        })
                      }
                      maxLength={50}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-sm disabled:opacity-60"
                    />
                    <input
                      placeholder="Nama Produk"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                    />
                    <input
                      placeholder="URL Gambar (opsional)"
                      value={form.image}
                      onChange={(e) => setForm({ ...form, image: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-xs"
                    />
                  </div>
                </div>

                <Toggle
                  checked={form.useVariations}
                  onChange={(v) => setForm({ ...form, useVariations: v })}
                  label="Gunakan variasi produk"
                />

                {form.useVariations ? (
                  <div className="text-sm text-gray-500 bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3">
                    Mode variasi aktif. Simpan produk dulu, lalu kelola variasi & stock di
                    halaman <span className="font-medium">Variasi & Stock</span>.
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border border-gray-100 dark:border-slate-800 p-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Form Stock</label>
                      <select
                        value={form.stockFormat}
                        onChange={(e) =>
                          setForm({ ...form, stockFormat: e.target.value })
                        }
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
                          {formatHint}
                        </code>
                      </p>
                    </div>

                    {form.id && stocksPreview.length > 0 && (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          Preview Akun Tersimpan ({stocksPreview.length})
                        </label>
                        <textarea
                          value={stocksPreview.join("\n")}
                          readOnly
                          rows={6}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40 font-mono text-xs resize-none"
                        />
                      </div>
                    )}

                    <Toggle
                      checked={form.modeEditStock}
                      onChange={(v) => setForm({ ...form, modeEditStock: v })}
                      label="Mode Edit Stock (ganti semua)"
                    />

                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        {form.modeEditStock ? "Edit Stock Akun" : "Tambah Stock Akun"}
                        {bulkLines > 0 && ` (${bulkLines} akun)`}
                      </label>
                      <textarea
                        value={form.bulkStock}
                        onChange={(e) => setForm({ ...form, bulkStock: e.target.value })}
                        rows={6}
                        placeholder={`Satu akun per baris.\nContoh: ${formatHint}`}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-xs resize-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Deskripsi</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Syarat & Ketentuan
                  </label>
                  <textarea
                    value={form.terms}
                    onChange={(e) => setForm({ ...form, terms: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm resize-none"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Tipe Cashback</label>
                    <select
                      value={form.cashbackType}
                      onChange={(e) =>
                        setForm({ ...form, cashbackType: e.target.value as CashbackType })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                    >
                      <option value="nominal">Potongan Nominal</option>
                      <option value="percent">Persen</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Cashback {form.cashbackType === "percent" ? "(%)" : "(Rp)"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.cashbackValue}
                      onChange={(e) =>
                        setForm({ ...form, cashbackValue: Number(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Harga Jual (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.price}
                      onChange={(e) =>
                        setForm({ ...form, price: Number(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Profit (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.profit}
                      onChange={(e) =>
                        setForm({ ...form, profit: Number(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Mode Bulking</label>
                    <input
                      type="number"
                      min={0}
                      value={form.modeBulking}
                      onChange={(e) =>
                        setForm({ ...form, modeBulking: Number(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Default 0 = non-bulk</p>
                  </div>
                </div>

                {form.id && (
                  <Toggle
                    checked={form.isActive}
                    onChange={(v) => setForm({ ...form, isActive: v })}
                    label="Tampilkan Produk"
                  />
                )}

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex gap-2 p-5 border-t border-gray-100 dark:border-slate-800">
                <button
                  onClick={() => setModal("none")}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium disabled:opacity-60"
                >
                  {saving ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal === "import" && (
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
                <h3 className="text-lg font-bold">Import Akun</h3>
                <button
                  onClick={() => setModal("none")}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Pilih Variasi Tujuan
                  </label>
                  <select
                    value={importTargetId}
                    onChange={(e) => setImportTargetId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                  >
                    <option value="">— pilih variasi —</option>
                    {products.flatMap((p) =>
                      p.variations.map((v) => (
                        <option key={v.id} value={v.id}>
                          {p.name} · {v.name} [{v.code}]
                        </option>
                      )),
                    )}
                  </select>
                </div>
                <Toggle
                  checked={importReplace}
                  onChange={setImportReplace}
                  label="Mode Edit Stock (ganti semua)"
                />
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Akun ({importLines} baris)
                  </label>
                  <textarea
                    value={importBulk}
                    onChange={(e) => setImportBulk(e.target.value)}
                    rows={10}
                    placeholder="email|password|info_tambahan"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-xs resize-none"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                    {error}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setModal("none")}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleImportSubmit}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium disabled:opacity-60"
                  >
                    {saving ? "Menyimpan…" : `Upload ${importLines || ""}`.trim()}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
  accent: "indigo" | "emerald" | "violet";
}) {
  const accentMap: Record<string, string> = {
    indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
    emerald:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
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
