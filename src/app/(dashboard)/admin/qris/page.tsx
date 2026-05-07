"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, QrCode, Copy, Check } from "lucide-react";
import Spinner from "@/components/loading/Spinner";

interface QrisData {
  id: string;
  name: string;
  provider: string;
  apiKey: string | null;
  merchantId: string | null;
  isActive: boolean;
  _count: { selections: number };
}

interface FormState {
  name: string;
  provider: string;
  apiKey: string;
  apiSecret: string;
  merchantId: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  provider: "eqris",
  apiKey: "",
  apiSecret: "",
  merchantId: "",
};

export default function AdminQrisPage() {
  const [servers, setServers] = useState<QrisData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
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
    setModal(true);
  };

  const handleAdd = async () => {
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
    const payload = {
      name: form.name.trim(),
      provider: form.provider,
      apiKey: form.apiKey.trim() || null,
      apiSecret: form.apiSecret.trim() || null,
      merchantId: form.merchantId.trim() || null,
    };
    setSaving(true);
    const res = await fetch("/api/admin/qris", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan QRIS server");
      return;
    }
    setModal(false);
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
          <p className="text-sm text-gray-500">Kelola server pembayaran QRIS (eQRIS, Pakasir, Midtrans)</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-sm">
          <Plus className="w-4 h-4" /> Tambah QRIS
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="grid gap-4">
          {servers.map((s) => (
            <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                    <QrCode className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="text-sm text-gray-500">
                      Provider: <span className="uppercase font-medium">{s.provider}</span>
                      {s.provider === "pakasir" && s.merchantId && (
                        <> · Slug: <span className="font-mono">{s.merchantId}</span></>
                      )}
                      {" "}| {s._count.selections} user memilih
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(s.id, s.isActive)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${s.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {s.isActive ? "Aktif" : "Nonaktif"}
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </motion.div>
          ))}
          {servers.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada QRIS server</p>}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Tambah QRIS Server</h3>
                <button onClick={() => setModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Nama Server</label>
                  <input placeholder="contoh: Pakasir Toko Utama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Provider</label>
                  <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-transparent">
                    <option value="eqris">eQRIS (eqris.com)</option>
                    <option value="pakasir">Pakasir (pakasir.com)</option>
                    <option value="midtrans">Midtrans</option>
                  </select>
                </div>

                {form.provider === "pakasir" ? (
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
                ) : (
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

                {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>}
                <button onClick={handleAdd} disabled={saving} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium disabled:opacity-60">{saving ? "Menyimpan…" : "Simpan"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
