"use client";
import { motion } from "framer-motion";

type Props = { score: number | null; animating?: boolean };

function getRiskLabel(score: number): { label: string; color: string } {
  if (score < 30) return { label: "Low Risk", color: "#22c55e" };
  if (score < 60) return { label: "Moderate", color: "#f59e0b" };
  if (score < 80) return { label: "High Risk", color: "#f97316" };
  return { label: "Critical", color: "#ef4444" };
}

export default function BurnoutGauge({ score, animating }: Props) {
  const displayScore = score ?? 0;
  const { label, color } = getRiskLabel(displayScore);

  // Semicircle gauge: 180 deg arc, 0 = left, 100 = right
  const radius = 80;
  const cx = 100;
  const cy = 100;
  const startAngle = 180;
  const endAngle = 0;
  const range = startAngle - endAngle; // 180

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (fromDeg: number, toDeg: number) => {
    const x1 = cx + radius * Math.cos(toRad(fromDeg));
    const y1 = cy - radius * Math.sin(toRad(fromDeg));
    const x2 = cx + radius * Math.cos(toRad(toDeg));
    const y2 = cy - radius * Math.sin(toRad(toDeg));
    const large = Math.abs(fromDeg - toDeg) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 0 ${x2} ${y2}`;
  };

  // Needle angle: 180 (left) to 0 (right)
  const needleAngle = startAngle - (displayScore / 100) * range;
  const needleX = cx + (radius - 10) * Math.cos(toRad(needleAngle));
  const needleY = cy - (radius - 10) * Math.sin(toRad(needleAngle));

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 200 110" className="w-64 h-36">
        {/* Background track */}
        <path
          d={arcPath(180, 0)}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Colored fill arc */}
        <motion.path
          d={arcPath(180, needleAngle)}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((v) => {
          const ang = startAngle - (v / 100) * range;
          const ix = cx + (radius + 2) * Math.cos(toRad(ang));
          const iy = cy - (radius + 2) * Math.sin(toRad(ang));
          const ox = cx + (radius + 12) * Math.cos(toRad(ang));
          const oy = cy - (radius + 12) * Math.sin(toRad(ang));
          return <line key={v} x1={ix} y1={iy} x2={ox} y2={oy} stroke="#444" strokeWidth="1.5" />;
        })}
        {/* Needle */}
        <motion.line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="#e8e8e8"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
        />
        <circle cx={cx} cy={cy} r="4" fill="#e8e8e8" />
        {/* Score text */}
        {score !== null && (
          <motion.text
            x={cx}
            y={cy + 24}
            textAnchor="middle"
            fill={color}
            fontSize="22"
            fontWeight="700"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
          >
            {Math.round(displayScore)}
          </motion.text>
        )}
        {animating && score === null && (
          <text x={cx} y={cy + 24} textAnchor="middle" fill="#444" fontSize="13">
            scanning...
          </text>
        )}
      </svg>

      {score !== null && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="flex items-center gap-2"
        >
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: color + "22", color, border: `1px solid ${color}55` }}
          >
            {label}
          </span>
          <span className="text-xs text-gray-500">out of 100</span>
        </motion.div>
      )}
    </div>
  );
}
