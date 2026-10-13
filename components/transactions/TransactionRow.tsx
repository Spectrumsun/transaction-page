import type { Transaction, TransactionStatus, TransactionType } from '@/types/api'
import { Badge } from '@/components/ui'
import { Icon, type IconName, Money } from '@/components/ui'
import { formatTime, TRANSACTION_TYPE_LABELS } from '@/lib/format'
import styles from './TransactionRow.module.css'

const TYPE_ICONS: Record<TransactionType, IconName> = {
  deposit: 'arrow-down-left',
  transfer_in: 'arrow-down-left',
  withdrawal: 'arrow-up-right',
  transfer_out: 'arrow-up-right',
  conversion: 'swap',
  card_payment: 'card',
  bill_payment: 'receipt',
}

const STATUS_BADGE_TONE: Record<TransactionStatus, 'success' | 'warning' | 'danger'> = {
  successful: 'success',
  pending: 'warning',
  failed: 'danger',
}

const STATUS_LABELS: Record<TransactionStatus, string> = {
  successful: 'Successful',
  pending: 'Pending',
  failed: 'Failed',
}

const CREDIT_TYPES: TransactionType[] = ['deposit', 'transfer_in', 'conversion']

function getInitials(name: string | null | undefined): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export interface TransactionRowProps {
  transaction: Transaction
  onSelect?: (transaction: Transaction) => void
}

export function TransactionRow({ transaction: tx, onSelect }: TransactionRowProps) {
  const isCredit = CREDIT_TYPES.includes(tx.type)

  return (
    <button type="button" className={styles.row} onClick={() => onSelect?.(tx)}>
      {tx.counterparty ? (
        <span className={styles.avatar} aria-hidden>
          {getInitials(tx.counterparty)}
        </span>
      ) : (
        <span className={styles.icon}>
          <Icon name={TYPE_ICONS[tx.type]} size={18} />
        </span>
      )}
      <span className={styles.main}>
        <span className={styles.title}>{TRANSACTION_TYPE_LABELS[tx.type]}</span>
        <span className={styles.narration}>{tx.narration}</span>
      </span>
      <Badge tone={STATUS_BADGE_TONE[tx.status]} dot className={styles.badge}>
        {STATUS_LABELS[tx.status]}
      </Badge>
      <span className={styles.end}>
        <Money
          amount={tx.amount}
          currency={tx.currency}
          sign={isCredit ? 'credit' : 'debit'}
          className={isCredit ? styles.credit : styles.amount}
        />
        <span className={styles.meta}>{formatTime(tx.createdAt)}</span>
      </span>
    </button>
  )
}
