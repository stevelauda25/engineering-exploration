import { useEffect, useId, useRef, useState } from 'react'
import { SPHERE_STATES, STATE_LABELS, type SphereState } from './states'

type StateDropdownProps = {
  value: SphereState
  onChange: (next: SphereState) => void
}

const PILL_OUTER_SHADOW =
  'shadow-[0px_2px_4px_-2px_rgba(0,0,0,0.25),0px_4px_6px_-4px_rgba(0,0,0,0.2),0px_8px_8px_-8px_rgba(0,0,0,0.15),0px_12px_16px_-12px_rgba(0,0,0,0.1)]'

const PILL_INNER_SHADOW =
  'shadow-[inset_0px_0.5px_0.5px_0px_rgba(255,255,255,0.25),inset_0px_-0.5px_0.5px_0px_rgba(0,0,0,0.2),inset_0px_0px_0px_0.5px_rgba(0,0,0,0.1)]'

export function StateDropdown({ value, onChange }: StateDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative font-sans">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={`
          relative inline-flex items-center justify-center
          gap-[8px] pl-[8px] pr-[6px] py-[8px]
          rounded-[6px] overflow-clip
          ${PILL_OUTER_SHADOW}
          focus:outline-none focus-visible:ring-1 focus-visible:ring-black/20
        `}
      >
        {/* Background fill — sits behind content */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[6px] bg-white"
        />

        {/* Label */}
        <span className="relative shrink-0 whitespace-nowrap font-medium text-[16px] leading-none capitalize text-black">
          {STATE_LABELS[value]}
        </span>

        {/* Chevron icon — 16x16 */}
        <span className="relative shrink-0 size-[16px]">
          <ChevronDown open={open} />
        </span>

        {/* Inset bevel + hairline border — sits above content */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 rounded-[inherit] ${PILL_INNER_SHADOW}`}
        />
      </button>

      {/* Dropdown menu — positioned below the pill, visually consistent */}
      <ul
        id={listId}
        role="listbox"
        aria-label="State"
        className={`
          absolute left-1/2 top-full z-10 mt-[8px] -translate-x-1/2
          min-w-full whitespace-nowrap
          rounded-[6px] bg-white
          py-[4px]
          ${PILL_OUTER_SHADOW}
          transition-[opacity,transform] duration-150 ease-out
          ${
            open
              ? 'pointer-events-auto translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-1 opacity-0'
          }
        `}
      >
        {SPHERE_STATES.map((s) => {
          const selected = s === value
          return (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(s)
                  setOpen(false)
                }}
                className={`
                  block w-full px-[12px] py-[6px] text-left
                  font-medium text-[14px] leading-none capitalize
                  transition-colors duration-100
                  ${
                    selected
                      ? 'bg-black/[0.05] text-black'
                      : 'text-black/70 hover:bg-black/[0.04] hover:text-black'
                  }
                `}
              >
                {STATE_LABELS[s]}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-black transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  )
}
