"use client";

import { motion } from "framer-motion";

export function VoicePoweredOrb({ active, level }: { active: boolean; level: number }) {
  return <div className={`voice-orb-frame${active ? " orb-active" : ""}`} aria-hidden="true">
    <span className="orb-halo" />
    <motion.div className="voice-orb" animate={{ scale: active ? 1 + Math.min(level * 2, .22) : 1 }} transition={{ duration: .18 }}>
      <span className="orb-cloud cloud-one" /><span className="orb-cloud cloud-two" /><span className="orb-cloud cloud-three" /><span className="orb-shine" />
    </motion.div>
  </div>;
}
