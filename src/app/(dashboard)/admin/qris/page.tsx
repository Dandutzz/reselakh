"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, QrCode, Copy, Check, Pencil } from "lucide-react";
import Spinner from "@/components/loading/Spinner";

type EqrisMethod = "gomerch" | "orkut";

interface QrisData {
  id: string;
  name: string;
  provider: string;
  apiKey: string | null;
  apiSecret: string | null;
  merchantId: string | null;
  isActive: boolean;
  config: string | null;
  _count: { selections: number };
}

interface QrisFormState {
  name: string;
  provider: string;
  // EQRIS-only sub-method (ignored for other providers).
  eqrisMethod: EqrisMethod;
  // EQRIS Bearer token / generic API key (for Pakasir this is the Project API Key).
  apiKey: string;
  // EQRIS Orkut password / generic API secret (ignored for Pakasir).
  apiSecret: string;
  // Provider-specific identifier:
  //   - eqris/gomerch: GoPay Merchant ID
  //   - eqris/orkut:   Orkut username (used for /api/mutasi-orkut-v2)
  //   - pakasir:       Project Slug (used as `project` in transactioncreate/transactiondetail)
  merchantId: string;
  // EQRIS Orkut-only: merchant's QRIS string base used by /api/qr-orkut.
  qrisBase: string;
  // Per-server "biaya admin" applied on top of subtotal (flat IDR).
  fee: string;
  // Kode unik range (1-99). Max = 0 disables.
  kodeUnikMin: string;
  kodeUnikMax: string;
}

const EMPTY_FORM: QrisFormState = {
  name: "",
  provider: "eqris",
  eqrisMethod: "gomerch",
  apiKey: "",
  apiSecret: "",
  merchantId: "",
  qrisBase: "",
  fee: "0",
  kodeUnikMin: "1",
  kodeUnikMax: "99",
};

interface ParsedConfig {
  method?: EqrisMethod;
  qrisBase?: string;
  fee: number;
  kodeUnik: { min: number; max: number } | null;
}

function parseConfig(config: string | null): ParsedConfig {
  const empty: ParsedConfig = { fee: 0, kodeUnik: null };
  if (!config) return empty;
  let parsed: Record<string, unknown>;
  try {
    const v = JSON.parse(config);
    if (!v || typeof v !== "object" || Array.isArray(v)) return empty;
    parsed = v as Record<string, unknown>;
  } catch {
    return empty;
  }
  const out: ParsedConfig = { fee: 0, kodeUnik: null };
  if (parsed.method === "orkut" || parsed.method === "gomerch") out.method = parsed.method;
  if (typeof parsed.qrisBase === "string") out.qrisBase = parsed.qrisBase;
  const rawFee = Number(parsed.fee);
  out.fee = Number.isFinite(rawFee) && rawFee > 0 ? Math.round(rawFee) : 0;
  const rawMax = Number(parsed.kodeUnikMax);
  const max = Number.isFinite(rawMax) ? Math.max(0, Math.min(99, Math.round(rawMax))) : 0;
  if (max > 0) {
    const rawMin = Number(parsed.kodeUnikMin);
    const min = Number.isFinite(rawMin) ? Math.max(1, Math.min(99, Math.round(rawMin))) : 1;
    out.kodeUnik = { min: Math.min(min, max), max };
  }
  return out;
}

function formatRupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

type ModalState = { mode: "add" } | { mode: "edit"; id: string };

export default function AdminQrisPage() {
  const [servers, setServers] = useState<QrisData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [form, setForm] = useState<QrisFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Pakasir webhook URL — admin pastes this into the Webhook URL field of
  // their Pakasir project (per https://pakasir.com/p/docs §D).
  const pakasirCallbackUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/api/webhooks/pakasir`;
  }, []);

  const fetchData = async () => {
    const res = await fetch("/api/admin/qris");
    const data = await res.json();
    setServers(data.servers || []);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setCopied(false);
    setModal({ mode: "add" });
  };

  const openEdit = (s: QrisData) => {
    const cfg = parseConfig(s.config);
    setForm({
      name: s.name,
      provider: s.provider,
      eqrisMethod: cfg.method ?? "gomerch",
      apiKey: s.apiKey ?? "",
      apiSecret: s.apiSecret ?? "",
      merchantId: s.merchantId ?? "",
      qrisBase: cfg.qrisBase ?? "",
      fee: String(cfg.fee || 0),
      kodeUnikMin: cfg.kodeUnik ? String(cfg.kodeUnik.min) : "1",
      kodeUnikMax: cfg.kodeUnik ? String(cfg.kodeUnik.max) : "0",
    });
    setError(null);
    setCopied(false);
    setModal({ mode: "edit", id: s.id });
  };

  const handleSubmit = async () => {
    if (!modal) return;
    setError(null);
    if (!form.name.trim()) {
      setError("Nama server wajib diisi");
      return;
    }
    if (form.provider === "pakasir") {
      if (!form.merchantId.trim()) {
        setError("Slug Proyek wajib diisi");
        return;
      }
      if (!form.apiKey.trim()) {
        setError("API Key wajib diisi");
        return;
      }
    }
    if (form.provider === "eqris") {
      if (!form.apiKey.trim()) {
        setError("EQRIS API Token wajib diisi");
        return;
      }
      if (form.eqrisMethod === "orkut" && !form.qrisBase.trim()) {
        setError("QRIS String Base wajib diisi untuk metode Orkut");
        return;
      }
      if (form.eqrisMethod === "gomerch" && !form.merchantId.trim()) {
        setError("Merchant ID wajib diisi untuk metode GoPay Merchant");
        return;
      }
    }

    const feeNum = Math.max(0, Math.round(Number(form.fee) || 0));
    const minNum = Math.max(0, Math.min(99, Math.round(Number(form.kodeUnikMin) || 0)));
    const maxNum = Math.max(0, Math.min(99, Math.round(Number(form.kodeUnikMax) || 0)));
    if (maxNum > 0 && minNum > maxNum) {
      setError("Kode Unik minimum tidak boleh lebih besar dari maksimum");
      return;
    }

    // Build config JSON for the gateway adapter.
    const config: Record<string, unknown> = {};
    if (form.provider === "eqris") {
      config.method = form.eqrisMethod;
      if (form.eqrisMethod === "orkut" && form.qrisBase.trim()) {
        config.qrisBase = form.qrisBase.trim();
      }
    }
    if (feeNum > 0) config.fee = feeNum;
    if (maxNum > 0) {
      config.kodeUnikMin = Math.max(1, minNum || 1);
      config.kodeUnikMax = maxNum;
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      provider: form.provider,
      apiKey: form.apiKey.trim() || null,
      apiSecret: form.apiSecret.trim() || null,
      merchantId: form.merchantId.trim() || null,
      config: Object.keys(config).length > 0 ? JSON.stringify(config) : null,
    };
    setSaving(true);
    const res =
      modal.mode === "add"
        ? await fetch("/api/admin/qris", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/qris", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: modal.id, ...payload }),
          });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan QRIS server");
      return;
    }
    setModal(null);
    setForm(EMPTY_FORM);
    fetchData();
  };

  const copyCallback = async () => {
    if (!pakasirCallbackUrl) return;
    try {
      await navigator.clipboard.writeText(pakasirCallbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus QRIS server ini?")) return;
    await fetch("/api/admin/qris", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch("/api/admin/qris", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">QRIS Server</h1>
          <p className="text-sm text-gray-500">Kelola server pembayaran QRIS, biaya admin, dan kode unik (1-99)</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-sm">
          <Plus className="w-4 h-4" /> Tambah QRIS
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Server</th>
                <th className="px-5 py-3">Provider</th>
                <th className="px-5 py-3">Fee</th>
                <th className="px-5 py-3">Kode Unik</th>
                <th className="px-5 py-3">Dipilih</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {servers.map((s) => {
                const cfg = parseConfig(s.config);
                const eqrisLabel = s.provider === "eqris" ? (cfg.method === "orkut" ? "Orkut" : "GoPay Merchant") : null;
                return (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                          <QrCode className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold">{s.name}</p>
                          {s.provider === "pakasir" && s.merchantId && (
                            <p className="text-xs text-gray-500 font-mono">Slug: {s.merchantId}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="uppercase font-medium">{s.provider}</span>
                      {eqrisLabel && <span className="block text-xs text-gray-500">Metode: {eqrisLabel}</span>}
                    </td>
                    <td className="px-5 py-3 font-mono">
                      {cfg.fee > 0 ? formatRupiah(cfg.fee) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-5 py-3 font-mono">
                      {cfg.kodeUnik
                        ? <span>{cfg.kodeUnik.min} - {cfg.kodeUnik.max}</span>
                        : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-5 py-3">{s._count.selections} user</td>
                    <td className="px-5 py-3">
                      <button onClick={() => handleToggle(s.id, s.isActive)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${s.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {s.isActive ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Hapus">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
              {servers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                    Belum ada QRIS server
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">{modal.mode === "add" ? "Tambah QRIS Server" : "Edit QRIS Server"}</h3>
                <button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Nama Server</label>
                  <input placeholder="contoh: EQRIS Toko A / Pakasir Toko B" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Provider</label>
                  <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent">
                    <option value="eqris">eQRIS (eqris.com)</option>
                    <option value="pakasir">Pakasir (pakasir.com)</option>
                    <option value="midtrans">Midtrans</option>
                  </select>
                </div>

                {form.provider === "eqris" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Metode EQRIS</label>
                      <select
                        value={form.eqrisMethod}
                        onChange={(e) => setForm({ ...form, eqrisMethod: e.target.value as EqrisMethod })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent"
                      >
                        <option value="gomerch">GoPay Merchant (dynamic, /api/gomerch-transaksi/qris)</option>
                        <option value="orkut">Orkut (static QRIS, /api/qr-orkut)</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        {form.eqrisMethod === "orkut"
                          ? "Generate QR dari QRIS String Base + nominal. Cek mutasi via /api/mutasi-orkut-v2."
                          : "Dynamic QRIS resmi GoPay Merchant. Pakai apiKey (Bearer) + Merchant ID."}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">EQRIS API Token (Bearer)</label>
                      <input placeholder="Token akun EQRIS Anda" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-sm" />
                    </div>

                    {form.eqrisMethod === "orkut" ? (
                      <>
                        <div>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">QRIS String Base</label>
                          <textarea
                            placeholder="00020101021226..."
                            value={form.qrisBase}
                            onChange={(e) => setForm({ ...form, qrisBase: e.target.value })}
                            rows={4}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-xs resize-none"
                          />
                          <p className="mt-1 text-xs text-gray-500">String QRIS statis dari merchant Anda — EQRIS akan menyisipkan nominal dan menghasilkan QR dinamis.</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Username Orkut</label>
                          <input placeholder="username Orkut (untuk cek mutasi)" value={form.merchantId} onChange={(e) => setForm({ ...form, merchantId: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Password Orkut</label>
                          <input type="password" placeholder="password Orkut" value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                          <p className="mt-1 text-xs text-gray-500">Dipakai untuk <code>POST /api/mutasi-orkut-v2</code>. Boleh kosong jika cek status pakai webhook eksternal.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Merchant ID (GoPay Merchant)</label>
                          <input placeholder="merchant_id" value={form.merchantId} onChange={(e) => setForm({ ...form, merchantId: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Callback Token (opsional)</label>
                          <input placeholder="signature untuk x-callback-token" value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-sm" />
                          <p className="mt-1 text-xs text-gray-500">Kalau diisi, webhook EQRIS wajib mengirim header <code>x-callback-token</code> yang sama.</p>
                        </div>
                      </>
                    )}
                  </>
                )}

                {form.provider === "pakasir" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Slug Proyek</label>
                      <input placeholder="contoh: depodomain" value={form.merchantId} onChange={(e) => setForm({ ...form, merchantId: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-sm" />
                      <p className="mt-1 text-xs text-gray-500">Slug dari halaman detail Proyek di dashboard Pakasir.</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">API Key</label>
                      <input placeholder="API Key dari halaman detail Proyek" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-sm" />
                      <p className="mt-1 text-xs text-gray-500">Dipakai untuk <code>POST /api/transactioncreate/qris</code> dan <code>GET /api/transactiondetail</code>.</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Callback URL (Webhook)</label>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={pakasirCallbackUrl}
                          className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={copyCallback}
                          className="shrink-0 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1 text-xs font-medium"
                        >
                          {copied ? (<><Check className="w-3.5 h-3.5" /> Disalin</>) : (<><Copy className="w-3.5 h-3.5" /> Salin</>)}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Tempel URL ini ke kolom <span className="font-medium">Webhook URL</span> di form Edit Proyek Pakasir Anda.</p>
                    </div>
                  </>
                )}

                {form.provider !== "eqris" && form.provider !== "pakasir" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">API Key</label>
                      <input placeholder="API Key" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">API Secret</label>
                      <input placeholder="API Secret" value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Merchant ID</label>
                      <input placeholder="Merchant ID" value={form.merchantId} onChange={(e) => setForm({ ...form, merchantId: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                    </div>
                  </>
                )}

                <div className="pt-3 border-t border-gray-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Biaya & Kode Unik</p>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Biaya Admin (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="0"
                      value={form.fee}
                      onChange={(e) => setForm({ ...form, fee: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">Ditambahkan ke nominal user setiap transaksi. Isi 0 untuk menonaktifkan.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Kode Unik Min (1-99)</label>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        step={1}
                        placeholder="1"
                        value={form.kodeUnikMin}
                        onChange={(e) => setForm({ ...form, kodeUnikMin: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Kode Unik Max (1-99)</label>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        step={1}
                        placeholder="99"
                        value={form.kodeUnikMax}
                        onChange={(e) => setForm({ ...form, kodeUnikMax: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent font-mono text-sm"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Random angka di antara min-max (inklusif) ditambahkan ke nominal supaya transaksi paralel dengan nominal sama tetap unik. Set Max = 0 untuk menonaktifkan.</p>
                </div>

                {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>}
                <button onClick={handleSubmit} disabled={saving} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium disabled:opacity-60">{saving ? "Menyimpan…" : "Simpan"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
