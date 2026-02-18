"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export function TagInput({
  value,
  onChange,
  suggestions,
  disabled = false,
  placeholder = "Add tags...",
  id,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions.filter((s) => s.toLowerCase().includes(inputValue.toLowerCase()) && !value.includes(s));

  function addTag(tag: string) {
    const normalized = tag.trim().toLowerCase();
    if (normalized && !value.includes(normalized)) {
      onChange([...value, normalized]);
    }
    setInputValue("");
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen && filtered.length > 0) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else if (isOpen) {
        setHighlightedIndex((i) => (i + 1) % filtered.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        addTag(filtered[highlightedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputValue(val);
    if (val.trim()) {
      const matches = suggestions.filter((s) => s.toLowerCase().includes(val.toLowerCase()) && !value.includes(s));
      setIsOpen(matches.length > 0);
      setHighlightedIndex(-1);
    } else {
      setIsOpen(false);
    }
  }

  return (
    <div className="relative">
      <div
        className="border-input flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] md:text-sm"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              disabled={disabled}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls="tag-suggestions"
          className="placeholder:text-muted-foreground min-w-20 flex-1 bg-transparent outline-none disabled:pointer-events-none disabled:opacity-50"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.trim() && filtered.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            setIsOpen(false);
            setHighlightedIndex(-1);
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={disabled}
        />
      </div>
      {isOpen && filtered.length > 0 && (
        <ul
          id="tag-suggestions"
          role="listbox"
          className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border p-1 shadow-md"
        >
          {filtered.map((suggestion, index) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`cursor-pointer rounded-sm px-2 py-1.5 text-sm ${
                index === highlightedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(suggestion);
              }}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
