import { motion } from 'framer-motion'
import clsx from 'clsx'

export default function GlassCard({ children, className, hover = false, ...props }) {
  return (
    <motion.div
      className={clsx(
        'rounded-[20px] border p-6',
        'backdrop-blur-[20px]',
        'bg-white/[0.08] border-white/[0.18]',
        hover && 'hover:bg-white/[0.12] transition-colors cursor-pointer',
        className
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
