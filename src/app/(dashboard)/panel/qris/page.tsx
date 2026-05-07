"use client";

import { useEffect, useState } from "react";
import { QrCode, Check } from "lucide-react";
import Spinner from "@/components/loading/Spinner";

interface QrisData { id: string; name: string; provider: string; isActive: boolean; }

export default function UserQrisPage() {
  const [servers, setServers] = useState<QrisData[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => { const res = await fetch("/api/user/qris"); const data = await res.json(); setServers(data.servers || []); setSelected(data.selection?.qrisId || null); setLoading(false); };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const handleSelect = async (qrisId: string) => {
    await fetch("/api/user/qris", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ qrisId }) });
    setSelected(qrisId);
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Pilih QRIS</h1><p className="text-sm text-gray-500">Pilih server pembayaran QRIS yang ingin digunakan</p></div>

      {loading ? <Spinner /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((s) => (
            <button key={s.id} onClick={() => handleSelect(s.id)} className={`p-5 rounded-2xl border-2 text-left transition ${selected === s.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center"><QrCode className="w-6 h-6 text-white" /></div>
                {selected === s.id && <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center"><Check className="w-5 h-5 text-white" /></div>}
              </div>
              <h3 className="font-bold text-lg">{s.name}</h3>
              <p className="text-sm text-gray-500 capitalize">{s.provider}</p>
            </button>
          ))}
          {servers.length === 0 && <p className="col-span-full text-center text-gray-400 py-8">Admin belum menambahkan server QRIS</p>}
        </div>
      )}
    </div>
  );
}
