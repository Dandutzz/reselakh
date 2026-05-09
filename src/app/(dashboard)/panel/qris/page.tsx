"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { QrCode, Check, Coins, Hash, ShieldCheck, Receipt } from "lucide-react";
import Spinner from "@/components/loading/Spinner";

interface QrisData {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  fee: number;
  kodeUnik: { min: number; max: number } | null;
}

interface SelectionPayload {
  qrisId: string;
  qrisServer?: QrisData | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  eqris: "eQRIS",
  pakasir: "Pakasir",
  midtrans: "Midtrans",
};

function formatRupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export default function UserQrisPage() {
  const [servers, setServers] = useState<QrisData[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = async () => {
    const res = await fetch("/api/user/qris");
    const data = await res.json();
    setServers(data.servers || []);
    const sel = data.selection as SelectionPayload | null;
    setSelected(sel?.qrisId || null);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const handleSelect = async (qrisId: string) => {
    setSavingId(qrisId);
    await fetch("/api/user/qris", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrisId }),
    });
    setSelected(qrisId);
    setSavingId(null);
  };

  const stats = useMemo(() => {
    const total = servers.length;
    const withFee = servers.filter((s) => s.fee > 0).length;
    const withKode = servers.filter((s) => s.kodeUnik !== null).length;
    return { total, withFee, withKode };
  }, [servers]);

  const activeServer = useMemo(
    () => servers.find((s) => s.id === selected) || null,
    [servers, selected],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pilih QRIS</h1>
        <p className="text-sm text-gray-500">
          Pilih server pembayaran QRIS yang ingin digunakan untuk transaksi bot Anda
        </p>
      </div>

      {!loading && servers.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Server tersedia</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Dengan biaya admin</p>
                <p className="text-lg font-bold">{stats.withFee}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Hash className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Kode unik aktif</p>
                <p className="text-lg font-bold">{stats.withKode}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeServer && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 p-5"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-indigo-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                Aktif sekarang
              </p>
              <p className="font-bold text-lg">{activeServer.name}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  Provider: <span className="font-semibold">{PROVIDER_LABEL[activeServer.provider] || activeServer.provider.toUpperCase()}</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  Biaya admin: <span className="font-semibold">{activeServer.fee > 0 ? formatRupiah(activeServer.fee) : "Tidak ada"}</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  Kode unik: <span className="font-semibold">{activeServer.kodeUnik ? `${activeServer.kodeUnik.min}-${activeServer.kodeUnik.max}` : "Nonaktif"}</span>
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {loading ? <Spinner /> : (
        servers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 p-12 text-center">
            <QrCode className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Admin belum menambahkan server QRIS</p>
            <p className="text-xs text-gray-400 mt-1">Hubungi admin untuk mengaktifkan pembayaran QRIS</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((s) => {
              const isSelected = selected === s.id;
              const providerLabel = PROVIDER_LABEL[s.provider] || s.provider.toUpperCase();
              return (
                <motion.button
                  key={s.id}
                  onClick={() => handleSelect(s.id)}
                  disabled={savingId !== null && savingId !== s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  className={`relative p-5 rounded-2xl border-2 text-left transition disabled:opacity-60 ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg shadow-indigo-500/10"
                      : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                      <QrCode className="w-6 h-6 text-white" />
                    </div>
                    {isSelected && (
                      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-lg leading-tight">{s.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{providerLabel}</p>

                  <div className="mt-4 space-y-2 border-t border-gray-100 dark:border-slate-800 pt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Receipt className="w-3.5 h-3.5" /> Biaya admin
                      </span>
                      <span className={`font-semibold ${s.fee > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}`}>
                        {s.fee > 0 ? formatRupiah(s.fee) : "Tidak ada"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Hash className="w-3.5 h-3.5" /> Kode unik
                      </span>
                      <span className={`font-semibold font-mono ${s.kodeUnik ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
                        {s.kodeUnik ? `+${s.kodeUnik.min} - +${s.kodeUnik.max}` : "Nonaktif"}
                      </span>
                    </div>
                  </div>

                  {savingId === s.id && (
                    <p className="absolute top-3 right-3 text-[10px] uppercase tracking-wide text-indigo-500 font-semibold">
                      Menyimpan...
                    </p>
                  )}
                </motion.button>
              );
            })}
          </div>
        )
      )}

      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          <span className="font-semibold">Catatan:</span> Biaya admin dan kode unik (1-99) ditambahkan
          otomatis ke nominal pembayaran setiap transaksi <code>/buynow</code> dan <code>/topup</code>.
          Kode unik mencegah collision saat dua transaksi dengan nominal sama berjalan paralel.
          Setting ini dikelola admin di halaman <code>QRIS Server</code>.
        </p>
      </div>
    </div>
  );
}
