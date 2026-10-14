import type { Currency } from '@/types/api'
import { cx } from '@/lib/cx'
import styles from './Money.module.css'

const SYMBOLS: Record<Currency, string> = { NGN: '₦', USD: '$', GHS: 'GH₵' }

export interface MoneyProps {
  /** Minor units. */
  amount: number
  currency: Currency
  /** Prefix with + or -. */
  sign?: 'credit' | 'debit'
  className?: string
}

export function Money({ amount, currency, sign, className }: MoneyProps) {
  const prefix = sign === 'credit' ? '+' : sign === 'debit' ? '-' : ''
  return (
    <span className={cx(styles.money, className)}>
      {prefix}
      {SYMBOLS[currency]}
      {(amount / 100).toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  )
}
