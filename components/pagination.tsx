"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export default function Pagination({
  currentPage,
  totalPages,
}: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", page.toString());
    }
    router.push(`/?${params.toString()}`);
  };

  if (totalPages <= 1) {
    return null;
  }

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-3 mt-12">
      <button
        type="button"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-1.5 mr-3 cursor-pointer rounded-lg bg-ctp-mantle text-ctp-text border-2 border-ctp-crust hover:ring-2 ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:ring-0"
        aria-label="Previous page"
      >
        <ChevronLeft size={20} />
      </button>

      {getPageNumbers().map((page, index) => {
        if (page === "ellipsis") {
          return (
            <span
              /* biome-ignore lint/suspicious/noArrayIndexKey: well... */
              key={`ellipsis-${index}`}
              className="px-3 py-2 text-ctp-surface1 font-bold"
            >
              -
            </span>
          );
        }

        const isCurrentPage = page === currentPage;
        return (
          <button
            key={page}
            type="button"
            onClick={() => handlePageChange(page)}
            className={`min-w-[40px] cursor-pointer px-4 py-2.5 w-12 rounded-lg font-semibold transition border-2 hover:ring-2 ring-offset-2 ring-offset-ctp-base ${
              isCurrentPage
                ? "bg-ctp-text text-ctp-base border-ctp-subtext0 ring-ctp-surface1"
                : "bg-ctp-mantle text-ctp-text border-ctp-crust hover:ring-ctp-surface0"
            }`}
          >
            {page}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-1.5 ml-3 cursor-pointer rounded-lg bg-ctp-mantle text-ctp-text border-2 border-ctp-crust hover:ring-2 ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:ring-0"
        aria-label="Next page"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
