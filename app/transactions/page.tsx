'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Transaction, TransactionStatus, TransactionType, Currency } from '@/types/api'
import { CURRENCIES } from '@/types/api'
import { Button, CardHeader, Drawer, Input, Money, Select, Badge } from '@/components/ui'
import { TransactionRow } from '@/components/transactions'
import { getTransactions } from '@/lib/api/endpoints'
import { formatDateTime, TRANSACTION_STATUS_LABELS, TRANSACTION_TYPE_LABELS, formatMoney } from '@/lib/format'
import styles from './page.module.css'

const TRANSACTION_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  ...Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

const TRANSACTION_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...Object.entries(TRANSACTION_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

const CURRENCY_OPTIONS = [
  { value: '', label: 'All currencies' },
  ...CURRENCIES.map((c) => ({ value: c, label: c })),
]

type Pagination = { page: number; limit: number; total: number; totalPages: number }

const STATUS_BADGE_TONE: Record<TransactionStatus, 'success' | 'warning' | 'danger'> = {
  successful: 'success',
  pending: 'warning',
  failed: 'danger',
}

export default function TransactionsPage() {
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [type, setType] = useState<TransactionType | ''>('')
  const [status, setStatus] = useState<TransactionStatus | ''>('')
  const [currency, setCurrency] = useState<Currency | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const searchParams = useMemo(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (type) params.set('type', type)
    if (status) params.set('status', status)
    if (currency) params.set('currency', currency)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (page !== 1) params.set('page', String(page))
    return params
  }, [q, type, status, currency, from, to, page])

  const fetchTransactions = useCallback(
    async ({
      page: pageArg,
      type: typeArg,
      status: statusArg,
      currency: currencyArg,
      q: qArg,
      from: fromArg,
      to: toArg,
    }: {
      page: number
      type: TransactionType | ''
      status: TransactionStatus | ''
      currency: Currency | ''
      q: string
      from: string
      to: string
    }) => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await getTransactions({
          page: pageArg,
          limit: 20,
          type: typeArg || undefined,
          status: statusArg || undefined,
          currency: currencyArg || undefined,
          q: qArg || undefined,
          from: fromArg || undefined,
          to: toArg || undefined,
        })
        setTransactions(res.data)
        if (res.meta) {
          setPagination(res.meta)
        } else {
          setPagination(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
        setTransactions([])
        setPagination(null)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTransactions({ page, type, status, currency, q, from, to })
  }, [initialized, fetchTransactions, page, type, status, currency, q, from, to])

  useEffect(() => {
    const url = new URL(window.location.href)
    const pageParam = url.searchParams.get('page')
    const typeParam = url.searchParams.get('type')
    const statusParam = url.searchParams.get('status')
    const currencyParam = url.searchParams.get('currency')
    const qParam = url.searchParams.get('q')
    const fromParam = url.searchParams.get('from')
    const toParam = url.searchParams.get('to')

    if (pageParam && /^\d+$/.test(pageParam)) {
      const pv = Number(pageParam)
      if (pv >= 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPage(pv)
      }
    }
    if (typeParam && Object.keys(TRANSACTION_TYPE_LABELS).includes(typeParam)) {
      setType(typeParam as TransactionType)
    }
    if (statusParam && Object.keys(TRANSACTION_STATUS_LABELS).includes(statusParam)) {
      setStatus(statusParam as TransactionStatus)
    }
    if (currencyParam && CURRENCIES.includes(currencyParam as Currency)) {
      setCurrency(currencyParam as Currency)
    }
    if (qParam !== null) {
      setQ(qParam)
    }
    if (fromParam) {
      setFrom(fromParam)
    }
    if (toParam) {
      setTo(toParam)
    }
    setInitialized(true)
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    searchParams.forEach((value, key) => url.searchParams.set(key, value))
    if (!searchParams.has('page') && url.searchParams.has('page')) url.searchParams.delete('page')
    window.history.replaceState(
      {},
      '',
      url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '')
    )
  }, [searchParams])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQ(e.target.value)
    setPage(1)
  }

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value)
    setPage(1)
  }

  const handleDateChange =
    (key: 'from' | 'to', setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value)
      setPage(1)
    }

  const clearFilters = () => {
    setQ('')
    setType('')
    setStatus('')
    setCurrency('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const retry = () => {
    fetchTransactions({ page, type, status, currency, q, from, to })
  }

  const hasFilters = q || type || status || currency || from || to

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Transactions</h1>
        <p className={styles.subtitle}>View and manage your recent activity.</p>
      </header>

      {error && (
        <div className={styles.errorBanner}>
          <p>{error}</p>
        </div>
      )}

      <CardHeader title="" />
      <div className={styles.filters}>
        <Input
          label="Search transactions"
          hideLabel
          placeholder="Search by reference, narration, or counterparty..."
          value={q}
          onChange={handleSearchChange}
          leadingIcon="search"
          fieldClassName={styles.search}
        />
        <Select
          label="Type"
          hideLabel
          options={TRANSACTION_TYPE_OPTIONS}
          value={type}
          onChange={handleFilterChange((v) => setType(v as TransactionType | ''))}
          fieldClassName={styles.select}
        />
        <Select
          label="Status"
          hideLabel
          options={TRANSACTION_STATUS_OPTIONS}
          value={status}
          onChange={handleFilterChange((v) => setStatus(v as TransactionStatus | ''))}
          fieldClassName={styles.select}
        />
        <Select
          label="Currency"
          hideLabel
          options={CURRENCY_OPTIONS}
          value={currency}
          onChange={handleFilterChange((v) => setCurrency(v as Currency | ''))}
          fieldClassName={styles.select}
        />
        <Input
          label="From"
          type="date"
          hideLabel
          value={from}
          onChange={handleDateChange('from', setFrom)}
          fieldClassName={styles.date}
        />
        <Input
          label="To"
          type="date"
          hideLabel
          value={to}
          onChange={handleDateChange('to', setTo)}
          fieldClassName={styles.date}
        />
        <div className={styles.actions}>
          {(hasFilters || page !== 1) && (
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          )}
          {error && (
            <Button variant="ghost" size="sm" iconLeft="refresh" onClick={retry}>
              Retry
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className={styles.message}>Loading transactions…</div>
      ) : !transactions.length ? (
        <div className={styles.message}>
          {hasFilters ? 'No transactions match your filters.' : 'No transactions yet.'}
        </div>
      ) : (
        <>
          <div className={styles.table}>
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} onSelect={setSelected} />
            ))}
          </div>
          {pagination && (
            <div className={styles.pagination}>
              <div className={styles.pageInfo}>
                Showing {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
                transactions
              </div>
              <div className={styles.pageActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft="chevron-left"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  iconRight="chevron-right"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Drawer open={selected !== null} title="Transaction details" onClose={() => setSelected(null)}>
        {selected && (
          <dl className={styles.details}>
            <dt>ID</dt>
            <dd>{selected.id}</dd>
            <dt>Reference</dt>
            <dd>{selected.reference}</dd>
            <dt>Type</dt>
            <dd>{TRANSACTION_TYPE_LABELS[selected.type]}</dd>
            <dt>Status</dt>
            <dd>
              <Badge tone={STATUS_BADGE_TONE[selected.status]}>
                {TRANSACTION_STATUS_LABELS[selected.status]}
              </Badge>
            </dd>
            <dt>Currency</dt>
            <dd>{selected.currency}</dd>
            <dt>Amount</dt>
            <dd>
              <Money amount={selected.amount} currency={selected.currency} />
            </dd>
            <dt>Fee</dt>
            <dd>{selected.fee > 0 ? formatMoney(selected.fee, selected.currency) : '—'}</dd>
            <dt>Narration</dt>
            <dd>{selected.narration}</dd>
            <dt>Counterparty</dt>
            <dd>{selected.counterparty ?? '—'}</dd>
            <dt>Date</dt>
            <dd>{formatDateTime(selected.createdAt)}</dd>
          </dl>
        )}
      </Drawer>
    </div>
  )
}
