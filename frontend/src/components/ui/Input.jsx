import { forwardRef } from 'react'
import clsx from 'clsx'

const Input = forwardRef(function Input({ label, error, className, ...props }, ref) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm text-white/70 font-medium">{label}</label>
      )}
      <input
        ref={ref}
        className={clsx(
          'w-full px-4 py-2.5 rounded-[14px] text-sm text-white',
          'bg-white/[0.08] border border-white/[0.18]',
          'backdrop-blur-[20px]',
          'placeholder-white/30',
          'focus:outline-none focus:border-[#22d3ee] focus:ring-1 focus:ring-[#22d3ee]',
          'transition-colors',
          error && 'border-[#f87171]',
          className
        )}
        {...props}
      />
      {error && <p className="text-[#f87171] text-xs font-medium">{error}</p>}
    </div>
  )
})

export default Input
