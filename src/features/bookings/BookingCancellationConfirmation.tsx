import type { RefObject } from 'react'
import type { BookingCancellationQuote } from '@/types/booking'

export function BookingCancellationConfirmation({
  quote,
  applyPenaltyRef,
}: {
  quote: BookingCancellationQuote
  applyPenaltyRef: RefObject<HTMLInputElement | null>
}) {
  const hasCreditPenalty = quote.isLate && quote.penaltyCredits > 0
  const hasMoneyPenalty = quote.isLate && quote.penaltyAmount > 0
  const hasPenalty = hasCreditPenalty || hasMoneyPenalty

  return (
    <div className="grid gap-3 text-sm">
      <p>
        {quote.isWaitlisted
          ? 'Remove this client from the class waitlist?'
          : 'Cancel this client’s class booking?'}
      </p>
      {hasCreditPenalty && quote.canApplyPenalty ? (
        <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3">
          <input ref={applyPenaltyRef} type="checkbox" className="mt-0.5" />
          <span>
            Apply the late-cancellation penalty of {quote.penaltyCredits} credit{quote.penaltyCredits === 1 ? '' : 's'}.
            Unchecked, all {quote.classCreditCost} booking credit{quote.classCreditCost === 1 ? '' : 's'} will be returned.
          </span>
        </label>
      ) : null}
      {hasMoneyPenalty ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900">
          The policy also specifies a {quote.penaltyAmount.toFixed(2)} {quote.currency} fee. This form cannot collect a monetary fee, so it will not be charged here.
        </p>
      ) : null}
      {!hasPenalty ? <p>No cancellation penalty applies under the current location policy.</p> : null}
    </div>
  )
}
