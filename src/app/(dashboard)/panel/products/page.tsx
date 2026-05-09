"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

type CashbackType = "nominal" | "percent";

interface ProductConfig {
  terms?: string;
  cashbackType?: CashbackType;
  cashbackValue?: number;
  profit?: number;
  modeBulking?: number;
  stockFormat?: string;
  defaultAutoDelivery?: boolean;
}

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
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "single" | "variation">("all");
  const [hideEmpty, setHideEmpty] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importTargetId, setImportTargetId] = useState<string>("");
  const [importBulk, setImportBulk] = useState<string>("");
  const [importReplace, setImportReplace] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSaving, setImportSaving] = useState(false);

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

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus produk?")) return;
    await fetch("/api/user/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  };

  const openImport = () => {
    const def = products[0];
    const targetId = def
      ? defaultVariationOf(def)?.id || def.variations[0]?.id || ""
      : "";
    setImportTargetId(targetId);
    setImportBulk("");
    setImportReplace(false);
    setImportError(null);
    setImportOpen(true);
  };

  const handleImportSubmit = async () => {
    setImportError(null);
    setImportSaving(true);
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
      setImportOpen(false);
      setImportSaving(false);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal import";
      setImportError(msg);
      setImportSaving(false);
    }
  };

  const importLines = importBulk.split("\n").filter((l) => l.trim()).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Quick Tools Product</p>
          <h1 className="text-2xl font-bold">Produk</h1>
          <p className="text-sm text-gray-500">Kelola produk digital + stok akun</p>
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
          <Link
            href="/panel/products/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> Tambah Produk
          </Link>
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
                    <td className="px-4 py-3 text-right align-top">
                      <div className="inline-flex gap-1">
                        <Link
                          href={`/panel/products/${p.id}/edit`}
                          aria-label="Edit"
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
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
                  <td colSpan={8} className="text-center text-sm text-gray-400 py-8">
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
        {importOpen && (
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
                  onClick={() => setImportOpen(false)}
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
                <ImportToggle
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
                {importError && (
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                    {importError}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setImportOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleImportSubmit}
                    disabled={importSaving}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium disabled:opacity-60"
                  >
                    {importSaving ? "Menyimpan…" : `Upload ${importLines || ""}`.trim()}
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

function ImportToggle({
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
