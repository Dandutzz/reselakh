"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Bot, Zap, Shield, Globe } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Bot Auto Order",
    desc: "Otomatis proses pesanan via Telegram & WhatsApp 24/7",
  },
  {
    icon: Zap,
    title: "Instan & Cepat",
    desc: "Pengiriman akun digital secara otomatis dalam hitungan detik",
  },
  {
    icon: Shield,
    title: "Aman & Terpercaya",
    desc: "Sistem keamanan berlapis dengan enkripsi data",
  },
  {
    icon: Globe,
    title: "Multi Platform",
    desc: "Kelola bisnis dari web, Telegram, dan WhatsApp",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-xl font-bold">Reselakh</span>
        </div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition shadow-lg shadow-indigo-500/25"
          >
            Daftar
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm mb-6">
            <Zap className="w-4 h-4" />
            Platform Bot Auto Order #1 Indonesia
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight mb-6">
            Sewa Bot{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Auto Order
            </span>
            <br />
            Telegram & WhatsApp
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
            Platform all-in-one untuk reseller produk digital. Kelola bot, produk, stok,
            dan transaksi dalam satu dashboard canggih.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-3.5 rounded-xl text-base font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition shadow-xl shadow-indigo-500/30"
            >
              Mulai Sekarang
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 rounded-xl text-base font-semibold border border-white/20 hover:bg-white/10 transition"
            >
              Login
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 pb-32">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Reselakh. All rights reserved.</p>
      </footer>
    </div>
  );
}
