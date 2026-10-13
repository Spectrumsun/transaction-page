'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Transaction, TransactionStatus, TransactionType, Currency } from '@/types/api'
import { CURRENCIES } from '@/types/api'
import { Button, CardHeader, Drawer, Icon, Input, Money, Select, Badge } from '@/components/ui'
import { TransactionRow } from '@/components/transactions'
import { getTransaction, getTransactions } from '@/lib/api/endpoints'
import { formatDate, formatDateTime, TRANSACTION_STATUS_LABELS, TRANSACTION_TYPE_LABELS, formatMoney } from '@/lib/format'
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

const CREDIT_TYPES: TransactionType[] = ['deposit', 'transfer_in', 'conversion']

function getInitials(name: string | null | undefined): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function groupLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return formatDate(iso).toUpperCase()
}

function groupTransactions(list: Transaction[]): { label: string; items: Transaction[] }[] {
  const groups = new Map<string, { label: string; items: Transaction[] }>()
  for (const tx of list) {
    const key = dayKey(tx.createdAt)
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(tx)
    } else {
      groups.set(key, { label: groupLabel(tx.createdAt), items: [tx] })
    }
  }
  return [...groups.values()]
}

type PageItem = number | '…'

function pageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  if (page <= 3) return [1, 2, 3, '…', totalPages]
  if (page >= totalPages - 2) return [1, '…', totalPages - 2, totalPages - 1, totalPages]
  return [1, '…', page, '…', totalPages]
}

function ListSkeleton() {
  return (
    <div className={styles.table} aria-label="Loading transactions" role="status">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <span className={`${styles.skeleton} ${styles.skeletonCircle}`} />
          <span className={styles.skeletonMain}>
            <span className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: '40%' }} />
            <span className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: '70%' }} />
          </span>
          <span className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: 64 }} />
        </div>
      ))}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading transaction details">
      <div className={styles.summary}>
        <span className={`${styles.skeleton} ${styles.skeletonCircle} ${styles.skeletonLg}`} />
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: 160 }} />
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: 120, height: 24 }} />
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: 90 }} />
      </div>
      <div className={styles.skeletonDetails}>
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className={`${styles.skeleton} ${styles.skeletonLine}`} />
        ))}
      </div>
    </div>
  )
}

export default function TransactionsPage() {
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailNotFound, setDetailNotFound] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const [q, setQ] = useState('')
  const [type, setType] = useState<TransactionType | ''>('')
  const [status, setStatus] = useState<TransactionStatus | ''>('')
  const [currency, setCurrency] = useState<Currency | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const requestId = useRef(0)

  const searchParams = useMemo(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (type) params.set('type', type)
    if (status) params.set('status', status)
    if (currency) params.set('currency', currency)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (page !== 1) params.set('page', String(page))
    if (selectedId) params.set('transaction', selectedId)
    return params
  }, [q, type, status, currency, from, to, page, selectedId])

  const fetchTransactions = useCallback(
    async ({
      page: pageArg,
      type: typeArg,
      status: statusArg,
      currency: currencyArg,
      q: qArg,
      from: fromArg,
      to: toArg,
      isFirst,
    }: {
      page: number
      type: TransactionType | ''
      status: TransactionStatus | ''
      currency: Currency | ''
      q: string
      from: string
      to: string
      isFirst: boolean
    }) => {
      const id = ++requestId.current
      if (isFirst) {
        setIsInitialLoading(true)
      } else {
        setIsRefreshing(true)
      }
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
        if (requestId.current !== id) return
        const body = res as unknown as { data?: Transaction[]; meta?: Pagination; error?: { message: string } }
        if (!body.data || body.error) {
          throw new Error(body.error?.message ?? 'Something went wrong. Please try again.')
        }
        setTransactions(body.data)
        setPagination(body.meta ?? null)
        setHasLoaded(true)
      } catch (err) {
        if (requestId.current !== id) return
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
        if (isFirst) {
          setTransactions([])
          setPagination(null)
        }
      } finally {
        if (requestId.current === id) {
          setIsInitialLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    []
  )

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setDetailNotFound(false)
    setSelected(null)
    try {
      const res = await getTransaction(id)
      const body = res as unknown as { data?: Transaction; error?: { code?: string } }
      if (!body.data || body.error) {
        setDetailNotFound(true)
      } else {
        setSelected(body.data)
      }
    } catch {
      setDetailNotFound(true)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const openDetail = useCallback(
    (tx: Transaction) => {
      setSelected(tx)
      setSelectedId(tx.id)
      setDetailNotFound(false)
    },
    []
  )

  const closeDetail = useCallback(() => {
    setSelected(null)
    setSelectedId(null)
    setDetailNotFound(false)
    setDetailLoading(false)
  }, [])

  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTransactions({ page, type, status, currency, q, from, to, isFirst: !hasLoaded })
  }, [initialized, fetchTransactions, page, type, status, currency, q, from, to, hasLoaded])

  useEffect(() => {
    const url = new URL(window.location.href)
    const pageParam = url.searchParams.get('page')
    const typeParam = url.searchParams.get('type')
    const statusParam = url.searchParams.get('status')
    const currencyParam = url.searchParams.get('currency')
    const qParam = url.searchParams.get('q')
    const fromParam = url.searchParams.get('from')
    const toParam = url.searchParams.get('to')
    const txParam = url.searchParams.get('transaction')

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
    if (txParam) {
      setSelectedId(txParam)
      fetchDetail(txParam)
    }
    setInitialized(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    for (const key of ['q', 'type', 'status', 'currency', 'from', 'to', 'page', 'transaction']) {
      url.searchParams.delete(key)
    }
    searchParams.forEach((value, key) => url.searchParams.set(key, value))
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
    fetchTransactions({ page, type, status, currency, q, from, to, isFirst: !hasLoaded })
  }

  const hasFilters = Boolean(q || type || status || currency || from || to)
  const showFilteredEmpty =
    !isInitialLoading && !error && hasLoaded && transactions.length === 0 && hasFilters
  const showTrueEmpty = !isInitialLoading && !error && hasLoaded && transactions.length === 0 && !hasFilters
  const showErrorPanel = !isInitialLoading && error && transactions.length === 0
  const subtitle = showFilteredEmpty
    ? '0 results'
    : pagination
      ? `${pagination.total} transaction${pagination.total === 1 ? '' : 's'}`
      : isInitialLoading
        ? 'Loading…'
        : 'View and manage your recent activity.'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Transactions</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </header>

      {error && transactions.length > 0 && (
        <div className={styles.errorBanner}>
          <p>{error}</p>
        </div>
      )}

      <CardHeader title="" />
      <div className={styles.filters}>
        <Input
          label="Search"
          placeholder="Search by reference, name or narration"
          value={q}
          onChange={handleSearchChange}
          leadingIcon="search"
          fieldClassName={styles.search}
        />
        <Select
          label="Type"
          options={TRANSACTION_TYPE_OPTIONS}
          value={type}
          onChange={handleFilterChange((v) => setType(v as TransactionType | ''))}
          fieldClassName={styles.select}
        />
        <Select
          label="Status"
          options={TRANSACTION_STATUS_OPTIONS}
          value={status}
          onChange={handleFilterChange((v) => setStatus(v as TransactionStatus | ''))}
          fieldClassName={styles.select}
        />
        <Select
          label="Currency"
          options={CURRENCY_OPTIONS}
          value={currency}
          onChange={handleFilterChange((v) => setCurrency(v as Currency | ''))}
          fieldClassName={styles.select}
        />
        <Input
          label="From"
          type="date"
          value={from}
          onChange={handleDateChange('from', setFrom)}
          fieldClassName={styles.date}
        />
        <Input
          label="To"
          type="date"
          value={to}
          onChange={handleDateChange('to', setTo)}
          fieldClassName={styles.date}
        />
        <div className={styles.actions}>
          {(hasFilters || page !== 1) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          {error && transactions.length > 0 && (
            <Button variant="ghost" size="sm" iconLeft="refresh" onClick={retry}>
              Retry
            </Button>
          )}
        </div>
      </div>

      {isInitialLoading ? (
        <ListSkeleton />
      ) : showErrorPanel ? (
        <div className={styles.state} role="alert">
          <span className={`${styles.stateIcon} ${styles.stateIconDanger}`}>
            <Icon name="alert" size={20} />
          </span>
          <p className={styles.stateTitle}>We couldn&apos;t load your transactions</p>
          <p className={styles.stateText}>Check your connection and try again.</p>
          <Button variant="primary" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : showFilteredEmpty ? (
        <div className={styles.state}>
          <span className={styles.stateIcon}>
            <Icon name="search" size={20} />
          </span>
          <p className={styles.stateTitle}>No transactions match your filters</p>
          <p className={styles.stateText}>Try a different search term or remove some filters.</p>
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : showTrueEmpty ? (
        <div className={styles.state}>
          <span className={styles.stateIcon}>
            <Icon name="inbox" size={20} />
          </span>
          <p className={styles.stateTitle}>No transactions yet</p>
          <p className={styles.stateText}>
            When you add money, send a transfer or pay with your card, it will show up here.
          </p>
        </div>
      ) : (
        <>
          <div className={`${styles.table} ${isRefreshing ? styles.refreshing : ''}`} aria-busy={isRefreshing}>
            {groupTransactions(transactions).map((group) => (
              <div key={group.items[0]?.id ?? group.label} className={styles.group}>
                <h3 className={styles.groupTitle}>{group.label}</h3>
                {group.items.map((tx) => (
                  <TransactionRow key={tx.id} transaction={tx} onSelect={openDetail} />
                ))}
              </div>
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
                  disabled={pagination.page <= 1 || isRefreshing}
                  onClick={() => setPage(pagination.page - 1)}
                >
                  Previous
                </Button>
                <span className={styles.pageNumbers}>
                  {pageItems(pagination.page, pagination.totalPages).map((item, i) =>
                    item === '…' ? (
                      <span key={`gap-${i}`} className={styles.ellipsis}>
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        disabled={isRefreshing}
                        aria-current={item === pagination.page ? 'page' : undefined}
                        className={`${styles.pageButton} ${item === pagination.page ? styles.pageButtonActive : ''}`}
                        onClick={() => setPage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  iconRight="chevron-right"
                  disabled={pagination.page >= pagination.totalPages || isRefreshing}
                  onClick={() => setPage(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Drawer open={selectedId !== null} title="Transaction details" onClose={closeDetail}>
        {detailLoading ? (
          <DetailSkeleton />
        ) : detailNotFound || (selectedId && !selected) ? (
          <div className={styles.state}>
            <span className={styles.stateIcon}>
              <Icon name="search" size={20} />
            </span>
            <p className={styles.stateTitle}>Transaction not found</p>
            <p className={styles.stateText}>It may have been removed, or the link is wrong.</p>
            <Button variant="secondary" size="sm" onClick={closeDetail}>
              Back to transactions
            </Button>
          </div>
        ) : selected ? (
          <>
            <div className={styles.summary}>
              <span className={styles.summaryAvatar} aria-hidden>
                {getInitials(selected.counterparty)}
              </span>
              <p className={styles.summarySubtitle}>
                {TRANSACTION_TYPE_LABELS[selected.type]}
                {selected.counterparty
                  ? ` ${CREDIT_TYPES.includes(selected.type) ? 'from' : 'to'} ${selected.counterparty}`
                  : ''}
              </p>
              <p className={styles.summaryAmount}>
                {CREDIT_TYPES.includes(selected.type) ? '+' : '-'}
                {formatMoney(selected.amount, selected.currency)}
              </p>
              <Badge tone={STATUS_BADGE_TONE[selected.status]} dot>
                {TRANSACTION_STATUS_LABELS[selected.status]}
              </Badge>
            </div>
            <h3 className={styles.sectionLabel}>Details</h3>
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
          </>
        ) : null}
      </Drawer>
    </div>
  )
}
