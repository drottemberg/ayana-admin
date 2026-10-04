import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

type TablePaginationProps = {
  pageIndex: number
  pageCount: number
  canPreviousPage: boolean
  canNextPage: boolean
  onPreviousPage: () => void
  onNextPage: () => void
  onPageChange: (pageIndex: number) => void
  className?: string
}

function getVisiblePageIndexes(pageIndex: number, pageCount: number) {
  if (pageCount <= 4) return Array.from({ length: pageCount }, (_, index) => index)

  const firstPages = [0, 1, 2]
  const lastPage = pageCount - 1

  if (pageIndex <= 2) return [...firstPages, 'ellipsis' as const, lastPage]
  if (pageIndex >= pageCount - 3) return [0, 'ellipsis' as const, pageCount - 3, pageCount - 2, lastPage]

  return [0, 'ellipsis-start' as const, pageIndex, 'ellipsis-end' as const, lastPage]
}

function TablePagination({
  pageIndex,
  pageCount,
  canPreviousPage,
  canNextPage,
  onPreviousPage,
  onNextPage,
  onPageChange,
  className,
}: TablePaginationProps) {
  if (pageCount <= 1) return null

  return (
    <Pagination className={cn('', className)}>
      <PaginationContent className="gap-1">
        <PaginationItem>
          <PaginationPrevious
            text=""
            disabled={!canPreviousPage}
            onClick={onPreviousPage}
            className="text-muted-foreground hover:bg-transparent disabled:opacity-35"
          />
        </PaginationItem>
        {getVisiblePageIndexes(pageIndex, pageCount).map((page) =>
          typeof page === 'string' ? (
            <PaginationItem key={page}>
              <span className="flex items-center justify-center text-sm font-medium text-foreground">...</span>
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink
                isActive={page === pageIndex}
                onClick={() => onPageChange(page)}
                aria-label={`Page ${page + 1}`}
                className={cn(
                  'rounded-xl border-0 text-base font-medium text-foreground shadow-none hover:bg-muted',
                  page === pageIndex && 'bg-foreground text-background hover:bg-foreground hover:text-background',
                )}
              >
                {page + 1}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            text=""
            disabled={!canNextPage}
            onClick={onNextPage}
            className="text-foreground hover:bg-transparent disabled:opacity-35"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

export { TablePagination }
