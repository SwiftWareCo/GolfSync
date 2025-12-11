"use client";

import { useState } from "react";
import { UserPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { LoadingSpinner } from "~/components/ui/loading-spinner";
import { SearchBar } from "~/components/ui/search-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";

interface Entity {
  id: number | undefined;
  firstName: string;
  lastName: string;
  [key: string]: any; // For additional properties
}

interface SelectOption {
  id: number;
  label: string;
  value: string;
}

interface EntitySearchCardProps<T extends Entity> {
  title: string;
  searchQuery: string;
  onSearch: (query: string) => void;
  searchResults: T[];
  isLoading: boolean;
  onAddEntity: (entityId: number) => Promise<void> | void;
  isEntityLimitReached?: boolean;
  showSelectFilter?: boolean;
  selectOptions?: SelectOption[];
  selectedFilterId?: number | null;
  onFilterSelect?: (id: number) => void;
  renderEntityCard: (entity: T) => React.ReactNode;
  searchPlaceholder?: string;
  noResultsMessage?: string;
  limitReachedMessage?: string;
  itemsPerPage?: number;
  showCreateButton?: boolean;
  createButtonText?: string;
  onCreateNew?: () => void;
  autoFocus?: boolean;
}

export function EntitySearchCard<T extends Entity>({
  title,
  searchQuery,
  onSearch,
  searchResults,
  isLoading,
  onAddEntity,
  isEntityLimitReached = false,
  showSelectFilter = false,
  selectOptions = [],
  selectedFilterId = null,
  onFilterSelect,
  renderEntityCard,
  searchPlaceholder = "Search...",
  noResultsMessage = "No results found matching your search",
  limitReachedMessage = "The limit has been reached. Remove an item before adding more.",
  itemsPerPage = 5,
  showCreateButton = false,
  createButtonText = "Create New",
  onCreateNew,
  autoFocus = false,
}: EntitySearchCardProps<T>) {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate pagination details
  const totalResults = searchResults.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalResults);
  const paginatedResults = searchResults.slice(startIndex, endIndex);

  // Handle page navigation
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // Reset page when search query changes
  const handleSearchChange = (value: string) => {
    setLocalQuery(value);
    setCurrentPage(1);
    onSearch(value);
  };

  return (
    <Card>
      <CardHeader
        className={
          showCreateButton && onCreateNew
            ? "flex flex-row items-center justify-between"
            : undefined
        }
      >
        <CardTitle className="flex items-center space-x-2">
          <UserPlus className="h-5 w-5" />
          <span>{title}</span>
        </CardTitle>
        {showCreateButton && onCreateNew && (
          <Button
            onClick={onCreateNew}
            variant="outline"
            className="border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {createButtonText}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div
            className={`grid grid-cols-1 gap-4 ${showSelectFilter ? "md:grid-cols-2" : ""}`}
          >
            <SearchBar
              value={localQuery}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              autoFocus={autoFocus}
            />

            {showSelectFilter && onFilterSelect && (
              <Select
                value={selectedFilterId?.toString() || ""}
                onValueChange={(value) => onFilterSelect(parseInt(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  {selectOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {isEntityLimitReached && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-yellow-800">
              {limitReachedMessage}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-3">
              {paginatedResults.map((entity) => renderEntityCard(entity))}

              {/* Pagination Controls */}
              {totalResults > itemsPerPage && (
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <div className="text-sm text-gray-500">
                    Showing {startIndex + 1}-{endIndex} of {totalResults}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : localQuery ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-gray-500">
              {noResultsMessage}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
