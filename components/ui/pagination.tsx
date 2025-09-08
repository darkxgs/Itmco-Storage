"use client"

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
  showInfo?: boolean
  totalItems?: number
  itemsPerPage?: number
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  showInfo = false,
  totalItems = 0,
  itemsPerPage = 10,
}: PaginationProps) {
  const pages = []
  const showEllipsis = totalPages > 7

  if (showEllipsis) {
    // Always show first page
    pages.push(1)

    if (currentPage > 4) {
      pages.push("ellipsis-start")
    }

    // Show pages around current page
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (currentPage < totalPages - 3) {
      pages.push("ellipsis-end")
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages)
    }
  } else {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className={cn("flex flex-col items-center gap-2 sm:gap-4", className)}>
      {showInfo && totalItems > 0 && (
        <div className="text-xs sm:text-sm text-slate-400 text-center">
          عرض {startItem} إلى {endItem} من أصل {totalItems} عنصر
        </div>
      )}

      <div className="flex items-center justify-center space-x-1 sm:space-x-2 space-x-reverse">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600 disabled:opacity-50 h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm"
        >
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">السابق</span>
        </Button>

        {pages.map((page, index) => {
          if (page === "ellipsis-start" || page === "ellipsis-end") {
            return (
              <Button key={index} variant="ghost" size="sm" disabled className="text-slate-400 h-7 sm:h-8 w-7 sm:w-8 p-0">
                <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            )
          }

          return (
            <Button
              key={index}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page as number)}
              className={cn(
                "min-w-[28px] sm:min-w-[40px] h-7 sm:h-8 text-xs sm:text-sm",
                currentPage === page
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-slate-700 border-slate-600 text-white hover:bg-slate-600",
              )}
            >
              {page}
            </Button>
          )
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600 disabled:opacity-50 h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm"
        >
          <span className="hidden sm:inline">التالي</span>
          <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  )
}
