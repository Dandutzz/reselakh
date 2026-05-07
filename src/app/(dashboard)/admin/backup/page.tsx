"use client";

import { useEffect, useState } from "react";
import { HardDrive, Cloud, ToggleLeft, ToggleRight, Play } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Spinner from "@/components/loading/Spinner";

interface BackupData { id: string; type: string; isEnabled: boolean; s3Bucket: string | null; localPath: string | null; schedule: string | null; lastBackup: string | null; user: { username: string }; }

export default function AdminBackupPage() {
  const [configs, setConfigs] = useState<BackupData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => { const res = await fetch("/api/admin/backup"); const data = await res.json(); setConfigs(data.configs || []); setLoading(false); };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const handleToggle = async (id: string) => {
    await fetch("/api/admin/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) });
    fetchData();
  };

  const handleBackup = async (id: string) => {
    await fetch("/api/admin/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "run_backup", id }) });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Backup</h1><p className="text-sm text-gray-500">Kelola backup Local VPS dan S3 Storage</p></div>

      {loading ? <Spinner /> : (
        <div className="grid gap-4">
          {configs.map((c) => (
            <div key={c.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.type === "s3" ? "bg-gradient-to-r from-orange-500 to-amber-500" : "bg-gradient-to-r from-blue-500 to-cyan-500"}`}>
                    {c.type === "s3" ? <Cloud className="w-6 h-6 text-white" /> : <HardDrive className="w-6 h-6 text-white" />}
                  </div>
                  <div>
                    <h3 className="font-semibold">{c.type === "s3" ? "S3 Storage" : "Local VPS"} - {c.user.username}</h3>
                    <p className="text-sm text-gray-500">
                      {c.type === "s3" ? `Bucket: ${c.s3Bucket || "-"}` : `Path: ${c.localPath || "-"}`}
                      {c.lastBackup && ` | Last: ${formatDate(c.lastBackup)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(c.id)} className="p-2 rounded-lg hover:bg-gray-100">
                    {c.isEnabled ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                  </button>
                  <button onClick={() => handleBackup(c.id)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600" title="Run backup"><Play className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
          ))}
          {configs.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada konfigurasi backup. Backup akan otomatis dibuat saat user mendaftar.</p>}
        </div>
      )}
    </div>
  );
}
