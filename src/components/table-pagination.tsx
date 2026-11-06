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
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index)

  const visible: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [0]
  const lastPage = pageCount - 1
  let firstMiddlePage = Math.max(1, pageIndex - 1)
  let lastMiddlePage = Math.min(lastPage - 1, pageIndex + 1)

  if (pageIndex <= 1) {
    firstMiddlePage = 1
    lastMiddlePage = Math.min(2, lastPage - 1)
  } else if (pageIndex >= lastPage - 1) {
    firstMiddlePage = Math.max(1, lastPage - 2)
    lastMiddlePage = lastPage - 1
  }

  if (firstMiddlePage > 1) visible.push('ellipsis-start')
  for (let page = firstMiddlePage; page <= lastMiddlePage; page += 1) visible.push(page)
  if (lastMiddlePage < lastPage - 1) visible.push('ellipsis-end')
  visible.push(lastPage)
  return visible
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
