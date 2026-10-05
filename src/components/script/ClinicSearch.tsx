"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { TREATMENT_LABELS, TREATMENT_KEYS, type Clinic } from "@/core/schema";
import { fold } from "@/lib/text";
import { cn } from "@/lib/utils";

interface Props {
  clinics: Clinic[];
  selected: Clinic | null;
  onSelect: (clinic: Clinic) => void;
  autoFocus?: boolean;
  size?: "md" | "lg";
}

const treatmentsOf = (clinic: Clinic) =>
  TREATMENT_KEYS.filter((key) => clinic.treatments[key])
    .map((key) => TREATMENT_LABELS[key])
    .join(" · ");

/** Buscador de clínicas con teclado: «/» o Ctrl+K para enfocar, flechas y Enter para elegir. */
export function ClinicSearch({ clinics, selected, onSelect, autoFocus, size = "md" }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) return clinics;
    return clinics.filter((clinic) => {
      const haystack = fold(`${clinic.name} ${clinic.address}`);
      return words.every((word) => haystack.includes(word));
    });
  }, [clinics, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if ((event.key === "/" && !typing) || (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (clinic: Clinic | undefined) => {
    if (!clinic) return;
    onSelect(clinic);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (results.length ? (i + step + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Buscar clínica
      </label>
      <Search
        aria-hidden
        className={cn("pointer-events-none absolute left-3 text-slate-400", size === "lg" ? "top-4 size-5" : "top-2.5 size-5")}
      />
      <input
        id={`${listId}-input`}
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${results[active].id}` : undefined}
        autoFocus={autoFocus}
        autoComplete="off"
        value={query}
        placeholder={selected && !open ? selected.name : "Buscar clínica…"}
        onChange={(event) => {
          // «/» es el atajo para enfocar: si el buscador ya tenía el foco, no se escribe.
          setQuery(event.target.value.replace(/^\//, ""));
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={cn(
          "w-full rounded-lg border border-line bg-white pl-10 pr-14 text-slate-900 shadow-sm outline-none transition-colors",
          "placeholder:text-slate-500 hover:border-slate-300 focus:border-omni focus:ring-2 focus:ring-cyan-100",
          selected && !open && "placeholder:font-medium placeholder:text-slate-900",
          size === "lg" ? "h-13 text-base" : "h-10 text-sm",
        )}
      />
      <kbd
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-3 rounded border border-line bg-slate-50 px-1.5 text-[11px] font-medium text-slate-500",
          size === "lg" ? "top-4" : "top-2.5",
        )}
      >
        /
      </kbd>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Clínicas"
          className="absolute z-20 mt-1 max-h-[min(24rem,60vh)] w-full overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-lg"
        >
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-500">
              Ninguna clínica coincide con «{query}».
            </li>
          )}
          {results.map((clinic, i) => (
            <li
              key={clinic.id}
              id={`${listId}-${clinic.id}`}
              role="option"
              aria-selected={i === active}
              // onMouseDown: el clic debe llegar antes de que el input pierda el foco.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(clinic);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer rounded-lg px-3 py-2", i === active && "bg-cyan-50")}
            >
              <p className="text-sm font-medium text-slate-900">{clinic.name}</p>
              <p className="truncate text-xs text-slate-500">{treatmentsOf(clinic)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
