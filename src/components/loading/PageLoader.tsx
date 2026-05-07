"use client";

import { motion } from "framer-motion";

export default function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full"
      />
      <motion.p
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-sm text-gray-500"
      >
        Memuat...
      </motion.p>
    </div>
  );
}
