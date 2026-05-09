"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronUp, Plus, Trash2, Upload, X } from "lucide-react";

export type ProductFormMode = "create" | "edit";
export type DeliveryMode = "default" | "auto" | "manual";
export type CashbackType = "nominal" | "percent";

export interface CategoryOption {
  id: string;
  name: string;
}

export interface ExistingVariant {
  id: string;
  name: string;
  code: string;
  price: number;
  unsoldStocks: string[];
}

export interface ProductFormInitial {
  productId: string | null;
  categoryId: string;
  code: string;
  name: string;
  shortDescription: string;
  description: string;
  image: string;
  price: number;
  isActive: boolean;
  terms: string;
  defaultAutoDelivery: boolean;
  cashbackType: CashbackType;
  cashbackValue: number;
  profit: number;
  modeBulking: number;
  stockFormat: string;
  variants: ExistingVariant[];
}

interface VariantDraft {
  localId: string;
  existingId: string | null;
  name: string;
  code: string;
  price: number;
  mode: DeliveryMode;
  modeEditStock: boolean;
  bulkStock: string;
  unsoldPreview: string[];
  collapsed: boolean;
}

interface FormState {
  productId: string | null;
  categoryId: string;
  code: string;
  name: string;
  shortDescription: string;
  description: string;
  image: string;
  price: number;
  isActive: boolean;
  terms: string;
  defaultAutoDelivery: boolean;
  cashbackType: CashbackType;
  cashbackValue: number;
  profit: number;
  modeBulking: number;
  stockFormat: string;
  variants: VariantDraft[];
}

const STOCK_FORMATS: Array<{ value: string; label: string; hint: string }> = [
  { value: "email|password", label: "Default (email | password)", hint: "email | password" },
  {
    value: "email|password|info",
    label: "Email + password + info",
    hint: "email | password | info",
  },
  { value: "username|password", label: "Username + password", hint: "username | password" },
  { value: "key", label: "Key / token only", hint: "key" },
];

const DELIVERY_MODES: Array<{ value: DeliveryMode; label: string; hint: string }> = [
  { value: "default", label: "Default (ikut produk)", hint: "Pakai pengaturan auto-delivery di Info Produk." },
  { value: "auto", label: "Auto", hint: "Stok di-deliver otomatis saat pembayaran lunas." },
  { value: "manual", label: "Manual", hint: "Seller deliver manual (tidak ambil dari stock akun)." },
];

const MAX_IMAGE_BYTES = 350 * 1024;

let localIdCounter = 0;
function makeLocalId(): string {
  localIdCounter += 1;
  return `v_${Date.now()}_${localIdCounter}`;
}

function existingToDraft(v: ExistingVariant, fallbackMode: DeliveryMode): VariantDraft {
  return {
    localId: makeLocalId(),
    existingId: v.id,
    name: v.name,
    code: v.code,
    price: v.price,
    mode: fallbackMode,
    modeEditStock: false,
    bulkStock: "",
    unsoldPreview: v.unsoldStocks,
    collapsed: true,
  };
}

function emptyDraft(productCode: string, defaultPrice: number): VariantDraft {
  return {
    localId: makeLocalId(),
    existingId: null,
    name: "",
    code: productCode ? `${productCode}_${Math.random().toString(36).slice(2, 6).toUpperCase()}` : "",
    price: defaultPrice,
    mode: "default",
    modeEditStock: false,
    bulkStock: "",
    unsoldPreview: [],
    collapsed: false,
  };
}

function formatRupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

interface Props {
  mode: ProductFormMode;
  initial: ProductFormInitial;
  categories: CategoryOption[];
}

export default function ProductForm({ mode, initial, categories }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({
    productId: initial.productId,
    categoryId: initial.categoryId || categories[0]?.id || "",
    code: initial.code,
    name: initial.name,
    shortDescription: initial.shortDescription,
    description: initial.description,
    image: initial.image,
    price: initial.price,
    isActive: initial.isActive,
    terms: initial.terms,
    defaultAutoDelivery: initial.defaultAutoDelivery,
    cashbackType: initial.cashbackType,
    cashbackValue: initial.cashbackValue,
    profit: initial.profit,
    modeBulking: initial.modeBulking,
    stockFormat: initial.stockFormat,
    variants:
      initial.variants.length > 0
        ? initial.variants.map((v) => existingToDraft(v, "default"))
        : [emptyDraft(initial.code, initial.price)],
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatHint = useMemo(
    () => STOCK_FORMATS.find((f) => f.value === form.stockFormat)?.hint ?? form.stockFormat,
    [form.stockFormat],
  );

  const handleProductCodeChange = (rawValue: string) => {
    const cleaned = rawValue.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    setForm((prev) => {
      const variants = prev.variants;
      if (mode !== "create" || prev.productId || variants.length === 0) {
        return { ...prev, code: cleaned };
      }
      const v0 = variants[0];
      if (v0.existingId || v0.code) {
        return { ...prev, code: cleaned };
      }
      const suggested = cleaned
        ? `${cleaned}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`
        : "";
      return {
        ...prev,
        code: cleaned,
        variants: [{ ...v0, code: suggested }, ...variants.slice(1)],
      };
    });
  };

  const handleImageFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Ukuran gambar maks ${Math.round(MAX_IMAGE_BYTES / 1024)} KB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) {
        setForm((p) => ({ ...p, image: result }));
        setError(null);
      }
    };
    reader.onerror = () => setError("Gagal membaca file");
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    handleImageFile(file ?? null);
  };

  const updateVariant = (localId: string, patch: Partial<VariantDraft>) => {
    setForm((p) => ({
      ...p,
      variants: p.variants.map((v) => (v.localId === localId ? { ...v, ...patch } : v)),
    }));
  };

  const addVariant = () => {
    setForm((p) => ({
      ...p,
      variants: [
        ...p.variants.map((v) => ({ ...v, collapsed: true })),
        emptyDraft(p.code, p.price),
      ],
    }));
  };

  const removeVariant = async (draft: VariantDraft) => {
    if (draft.existingId) {
      const ok = confirm(
        `Hapus variasi "${draft.name}"? Stok yang sudah terjual akan tetap, tapi variasi akan ter-non-aktif/dihapus.`,
      );
      if (!ok) return;
      try {
        const res = await fetch("/api/user/variations", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: draft.existingId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal hapus variasi");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal hapus variasi");
        return;
      }
    }
    setForm((p) => ({
      ...p,
      variants: p.variants.filter((v) => v.localId !== draft.localId),
    }));
  };

  const buildConfigPayload = () => {
    const cfg: Record<string, unknown> = {};
    if (form.terms.trim()) cfg.terms = form.terms.trim();
    if (form.shortDescription.trim()) cfg.shortDescription = form.shortDescription.trim();
    if (form.cashbackValue > 0) {
      cfg.cashbackType = form.cashbackType;
      cfg.cashbackValue = form.cashbackValue;
    }
    if (form.profit > 0) cfg.profit = form.profit;
    if (form.modeBulking > 0) cfg.modeBulking = form.modeBulking;
    if (form.stockFormat) cfg.stockFormat = form.stockFormat;
    cfg.defaultAutoDelivery = form.defaultAutoDelivery;
    return cfg;
  };

  const validate = (): string | null => {
    if (!form.categoryId) return "Pilih kategori dulu";
    if (!form.code.trim()) return "Kode Produk wajib diisi";
    if (!form.name.trim()) return "Nama Produk wajib diisi";
    if (form.price < 0) return "Harga tidak valid";
    if (form.variants.length === 0) return "Minimal 1 varian";
    for (const v of form.variants) {
      if (!v.name.trim()) return `Nama paket variasi wajib diisi`;
      if (!v.code.trim()) return `Kode variasi wajib diisi`;
      if (v.price < 0) return `Harga variasi tidak valid`;
    }
    return null;
  };

  type Action = "save" | "saveAndAnother";
  const submit = async (action: Action) => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const config = buildConfigPayload();
      const baseProductPayload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        image: form.image || null,
        price: form.price,
        config,
      };

      let productId = form.productId;
      if (!productId) {
        const res = await fetch("/api/user/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...baseProductPayload,
            categoryId: form.categoryId,
            code: form.code.toUpperCase(),
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
            ...baseProductPayload,
            id: productId,
            isActive: form.isActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal menyimpan produk");
      }

      for (const variant of form.variants) {
        let variationId: string;
        if (variant.existingId) {
          variationId = variant.existingId;
          const res = await fetch("/api/user/variations", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: variationId,
              name: variant.name.trim(),
              code: variant.code.trim().toUpperCase(),
              price: variant.price,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Gagal update variasi ${variant.name}`);
        } else {
          const res = await fetch("/api/user/variations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId,
              name: variant.name.trim(),
              code: variant.code.trim().toUpperCase(),
              price: variant.price,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Gagal membuat variasi ${variant.name}`);
          variationId = data.variation.id as string;
        }

        if (variant.bulkStock.trim()) {
          const res = await fetch("/api/user/stocks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              variationId,
              bulk: variant.bulkStock,
              replaceAll: variant.modeEditStock,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Gagal upload stok ${variant.name}`);
        }
      }

      if (action === "saveAndAnother") {
        router.push("/panel/products/new");
        return;
      }
      router.push("/panel/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <nav className="flex items-center gap-1 text-xs text-gray-500">
            <Link
              href="/panel/products"
              className="hover:text-indigo-500 inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-3 h-3" />
              Quick Tools Product
            </Link>
            <span>/</span>
            <span className="text-gray-700 dark:text-gray-300">
              {mode === "create" ? "Create" : "Edit"}
            </span>
          </nav>
          <h1 className="text-2xl font-bold">
            {mode === "create" ? "Create Quick Tools Product" : "Edit Quick Tools Product"}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* INFO PRODUK */}
        <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold">Info Produk</h2>

          <FieldLabel label="Foto">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-xs cursor-pointer transition overflow-hidden ${
                dragActive
                  ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-gray-200 dark:border-slate-700 hover:border-indigo-300"
              }`}
            >
              {form.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.image}
                    alt={form.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setForm((p) => ({ ...p, image: "" }));
                    }}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white"
                    aria-label="Hapus foto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 mb-2 text-gray-400" />
                  <p className="font-medium text-gray-600 dark:text-gray-300">
                    Drag &amp; Drop your files or{" "}
                    <span className="text-indigo-500 underline">Browse</span>
                  </p>
                  <p className="mt-1 text-gray-400">
                    Maks {Math.round(MAX_IMAGE_BYTES / 1024)} KB · JPG/PNG/WEBP
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <input
              placeholder="Atau tempel URL gambar (https://…)"
              value={form.image && form.image.startsWith("data:") ? "" : form.image}
              onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))}
              className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-xs"
            />
          </FieldLabel>

          <div className="grid sm:grid-cols-2 gap-3">
            <FieldLabel label="Nama Produk" required>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="cth. Netflix Premium"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
              />
            </FieldLabel>
            <FieldLabel label="Kategori" required>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                disabled={mode === "edit"}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm disabled:opacity-60"
              >
                <option value="">Select an option</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>

          <FieldLabel label="Kode Produk" required>
            <input
              value={form.code}
              disabled={mode === "edit"}
              onChange={(e) => handleProductCodeChange(e.target.value)}
              placeholder="NETFLIX_PREMIUM"
              maxLength={50}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-sm disabled:opacity-60"
            />
          </FieldLabel>

          <FieldLabel label="Deskripsi Singkat">
            <input
              value={form.shortDescription}
              onChange={(e) => setForm((p) => ({ ...p, shortDescription: e.target.value }))}
              placeholder="cth. Akun Netflix Premium 1 user"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
            />
          </FieldLabel>

          <FieldLabel label="Deskripsi Lengkap">
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm resize-none"
            />
          </FieldLabel>

          <FieldLabel label="Syarat & Ketentuan (S&K)">
            <textarea
              value={form.terms}
              onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm resize-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Boleh teks polos atau HTML sederhana. Tampil di halaman detail produk.
            </p>
          </FieldLabel>

          <div className="rounded-xl border border-gray-100 dark:border-slate-800 p-3 flex items-start gap-3">
            <Toggle
              checked={form.defaultAutoDelivery}
              onChange={(v) => setForm((p) => ({ ...p, defaultAutoDelivery: v }))}
            />
            <div className="flex-1">
              <p className="text-sm font-medium">Default Auto-Delivery</p>
              <p className="text-xs text-gray-500">
                Kalau di varian Mode Kirim = Default, ikut sini. Aktif: stok otomatis di-deliver
                saat pembayaran masuk.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 dark:border-slate-800 p-3 space-y-3">
            <p className="text-sm font-medium">Harga, Cashback &amp; Profit</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <FieldLabel label="Harga Default (Rp)">
                <input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, price: Number(e.target.value) || 0 }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                />
              </FieldLabel>
              <FieldLabel label="Profit / Margin (Rp)">
                <input
                  type="number"
                  min={0}
                  value={form.profit}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, profit: Number(e.target.value) || 0 }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                />
              </FieldLabel>
              <FieldLabel label="Tipe Cashback">
                <select
                  value={form.cashbackType}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, cashbackType: e.target.value as CashbackType }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                >
                  <option value="nominal">Potongan Nominal (Rp)</option>
                  <option value="percent">Persen (%)</option>
                </select>
              </FieldLabel>
              <FieldLabel
                label={`Cashback ${form.cashbackType === "percent" ? "(%)" : "(Rp)"}`}
              >
                <input
                  type="number"
                  min={0}
                  value={form.cashbackValue}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, cashbackValue: Number(e.target.value) || 0 }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                />
              </FieldLabel>
              <FieldLabel label="Mode Bulking">
                <input
                  type="number"
                  min={0}
                  value={form.modeBulking}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, modeBulking: Number(e.target.value) || 0 }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">0 = non-bulk</p>
              </FieldLabel>
              <FieldLabel label="Format Stock Default">
                <select
                  value={form.stockFormat}
                  onChange={(e) => setForm((p) => ({ ...p, stockFormat: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
                >
                  {STOCK_FORMATS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>
          </div>

          {mode === "edit" && (
            <div className="rounded-xl border border-gray-100 dark:border-slate-800 p-3 flex items-start gap-3">
              <Toggle
                checked={form.isActive}
                onChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Tampilkan Produk</p>
                <p className="text-xs text-gray-500">Non-aktifkan untuk menyembunyikan dari etalase / bot.</p>
              </div>
            </div>
          )}
        </section>

        {/* VARIANTS */}
        <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Varian / Paket + Stok Akun</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Tiap varian: harga, mode kirim (Default/auto/manual), &amp; stok akun. Untuk
              auto-delivery isi stok di kolom &quot;Tambah Stok Akun&quot; — format per baris:{" "}
              <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-[11px]">
                {formatHint}
              </code>
              .
            </p>
          </div>

          <div className="space-y-3">
            {form.variants.map((v, idx) => (
              <VariantCard
                key={v.localId}
                index={idx}
                variant={v}
                onUpdate={(patch) => updateVariant(v.localId, patch)}
                onRemove={() => removeVariant(v)}
                formatHint={formatHint}
                canRemove={form.variants.length > 1 || !!v.existingId}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addVariant}
            className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-500 inline-flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> Tambah Varian
          </button>
        </section>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-sm p-3 rounded-xl">
          {error}
        </div>
      )}

      <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 dark:from-slate-950 via-gray-50/95 dark:via-slate-950/95 to-transparent pt-4 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex flex-wrap gap-2 justify-end">
          <Link
            href="/panel/products"
            className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          {mode === "create" && (
            <button
              type="button"
              disabled={saving}
              onClick={() => submit("saveAndAnother")}
              className="px-5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-60"
            >
              Create &amp; create another
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => submit("save")}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition mt-0.5 ${
        checked ? "bg-indigo-500" : "bg-gray-300 dark:bg-slate-700"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 left-0.5 inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function VariantCard({
  index,
  variant,
  onUpdate,
  onRemove,
  formatHint,
  canRemove,
}: {
  index: number;
  variant: VariantDraft;
  onUpdate: (patch: Partial<VariantDraft>) => void;
  onRemove: () => void;
  formatHint: string;
  canRemove: boolean;
}) {
  const bulkLines = variant.bulkStock.split("\n").filter((l) => l.trim()).length;
  const title = variant.name.trim() || (variant.existingId ? "Variasi" : "Variasi Baru");
  return (
    <div className="rounded-xl border border-gray-100 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onUpdate({ collapsed: !variant.collapsed })}
          className="flex-1 text-left flex items-center gap-2 font-medium text-sm"
        >
          <span className="text-gray-400 text-xs tabular-nums">#{index + 1}</span>
          <span>{title}</span>
          {variant.existingId && (
            <span className="text-[10px] uppercase tracking-wide text-gray-400">
              · Existing
            </span>
          )}
          <ChevronUp
            className={`w-4 h-4 text-gray-400 transition-transform ${
              variant.collapsed ? "rotate-180" : ""
            }`}
          />
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Hapus variasi"
            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {!variant.collapsed && (
        <div className="p-3 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <FieldLabel label="Nama Paket" required>
              <input
                value={variant.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="cth. 1 Bulan"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
              />
            </FieldLabel>
            <FieldLabel label="Harga (Rp)" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  Rp
                </span>
                <input
                  type="number"
                  min={0}
                  value={variant.price}
                  onChange={(e) => onUpdate({ price: Number(e.target.value) || 0 })}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm tabular-nums"
                />
              </div>
            </FieldLabel>
            <FieldLabel label="Mode Kirim">
              <select
                value={variant.mode}
                onChange={(e) => onUpdate({ mode: e.target.value as DeliveryMode })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent text-sm"
              >
                {DELIVERY_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>

          <FieldLabel label="Kode Variasi (unik)" required>
            <input
              value={variant.code}
              onChange={(e) =>
                onUpdate({
                  code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                })
              }
              maxLength={50}
              placeholder="NETFLIX_1B"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-xs"
            />
          </FieldLabel>

          {variant.unsoldPreview.length > 0 && (
            <FieldLabel
              label={`Preview Stok Tersimpan (${variant.unsoldPreview.length} unsold)`}
            >
              <textarea
                value={variant.unsoldPreview.join("\n")}
                readOnly
                rows={4}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40 font-mono text-[11px] resize-none"
              />
            </FieldLabel>
          )}

          <div className="rounded-xl border border-gray-100 dark:border-slate-800 p-3 flex items-start gap-3">
            <Toggle
              checked={variant.modeEditStock}
              onChange={(v) => onUpdate({ modeEditStock: v })}
            />
            <div className="flex-1">
              <p className="text-sm font-medium">Mode Edit Stok</p>
              <p className="text-xs text-gray-500">
                Aktif: data di textarea bawah akan{" "}
                <span className="font-semibold">menggantikan</span> stok unsold.
                Stok TERJUAL tetap aman.
              </p>
            </div>
          </div>

          <FieldLabel
            label={`${variant.modeEditStock ? "Edit Stok Akun" : "Tambah Stok Akun"} ${
              bulkLines > 0 ? `(${bulkLines} akun)` : ""
            }`}
          >
            <textarea
              value={variant.bulkStock}
              onChange={(e) => onUpdate({ bulkStock: e.target.value })}
              rows={5}
              placeholder={`Format per baris:\n${formatHint}\n${formatHint}|info opsional`}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-[11px] resize-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              {variant.modeEditStock ? "EDIT MODE" : "TAMBAH MODE"} ·
              {variant.modeEditStock
                ? " Baris di bawah akan mengganti stok unsold yang ada."
                : " Baris akan ditambahkan ke stok yang sudah ada."}
            </p>
          </FieldLabel>

          <p className="text-[11px] text-gray-400 text-right tabular-nums">
            Harga: {formatRupiah(variant.price)}
          </p>
        </div>
      )}
    </div>
  );
}
