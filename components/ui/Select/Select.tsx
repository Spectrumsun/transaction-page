'use client'
import { useEffect, useRef, useState } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'
import { Field } from '../Field'
import { Icon } from '../Icon'
import styles from './Select.module.css'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label: string
  hideLabel?: boolean
  options: readonly SelectOption[]
  fieldClassName?: string
}

export function Select({
  label,
  hideLabel,
  options,
  fieldClassName,
  className,
  value,
  defaultValue,
  disabled,
  name,
  onChange,
  ...rest
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [internal, setInternal] = useState<string>(() => {
    if (value !== undefined) return String(value)
    if (defaultValue !== undefined) return String(defaultValue)
    return options[0]?.value ?? ''
  })
  const rootRef = useRef<HTMLDivElement>(null)

  const current = value !== undefined ? String(value) : internal
  const selected = options.find((o) => o.value === current) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open ])

  const pick = (next: string) => {
    if (value === undefined) setInternal(next)
    // Keep the old native onChange signature working for existing callers.
    onChange?.({ target: { value: next, name } } as React.ChangeEvent<HTMLSelectElement>)
    setOpen(false)
  }

  return (
    <Field label={label} hideLabel={hideLabel} className={fieldClassName}>
      <div ref={rootRef} className={cx(styles.control, open && styles.open)}>
        <button
          type="button"
          className={cx(styles.select, styles.button, className)}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => !disabled && setOpen((v) => !v)}
          {...(rest as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          <span className={styles.value}>{selected?.label}</span>
        </button>
        <Icon name="chevron-down" size={16} className={styles.chevron} />
        {open && !disabled && (
          <ul role="listbox" aria-label={label} className={styles.menu}>
            {options.map((option) => {
              const isAll = option.value === ''
              const isSelected = option.value === current
              return (
                <li key={option.value || '__all'} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={cx(styles.option, isAll && styles.allOption, isSelected && !isAll && styles.selected)}
                    onClick={() => pick(option.value)}
                  >
                    {option.label}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Field>
  )
}
