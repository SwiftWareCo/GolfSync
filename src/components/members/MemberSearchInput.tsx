"use client";

import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useQuery } from "@tanstack/react-query";
import { memberQueryOptions } from "~/services/member/member-query-options";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "~/components/ui/command";
import { Loader2, X } from "lucide-react";
import { Button } from "~/components/ui/button";

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  memberNumber: string;
}

interface MemberSearchInputProps {
  onSelect: (member: Member | null) => void;
  selectedMember?: Member | null;
  placeholder?: string;
  className?: string;
}

export function MemberSearchInput({
  onSelect,
  selectedMember,
  placeholder = "Search members...",
  className = "",
}: MemberSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the search query
  const handleSearchChange = useDebouncedCallback((query: string) => {
    setDebouncedQuery(query);
  }, 300);

  // Query member search results with deduplication and caching
  const { data: results = [], isLoading } = useQuery(
    memberQueryOptions.search(debouncedQuery),
  );

  const handleInputChange = (query: string) => {
    setSearchQuery(query);
    handleSearchChange(query);
  };

  if (selectedMember) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-2">
        <div className="flex-1">
          <div className="font-medium">
            {selectedMember.firstName} {selectedMember.lastName}
          </div>
          <div className="text-muted-foreground text-sm">
            #{selectedMember.memberNumber}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            onSelect(null);
            setSearchQuery("");
            setIsOpen(false);
          }}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Command
      className={`rounded-lg border shadow-sm ${className}`}
      shouldFilter={false}
    >
      <CommandInput
        placeholder={placeholder}
        value={searchQuery}
        onValueChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && (
        <>
          {isLoading ? (
            <div className="p-4 text-center">
              <Loader2 className="text-muted-foreground mx-auto h-4 w-4 animate-spin" />
            </div>
          ) : (
            <>
              <CommandEmpty>No members found.</CommandEmpty>
              <CommandGroup className="max-h-48 overflow-y-auto">
                {results.map((member) => (
                  <CommandItem
                    key={member.id}
                    value={`${member.firstName} ${member.lastName} ${member.memberNumber}`}
                    onSelect={() => {
                      onSelect(member);
                      setSearchQuery("");
                      setIsOpen(false);
                    }}
                  >
                    <div>
                      <div className="font-medium">
                        {member.firstName} {member.lastName}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        #{member.memberNumber}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </>
      )}
    </Command>
  );
}
