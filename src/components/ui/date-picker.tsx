import * as React from 'react';
import { format, isValid, parse } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Calendar } from './calendar';
import { Input } from './input';
import { Popover, PopoverAnchor, PopoverContent } from './popover';
const DISPLAY_FORMAT = 'MMM d, yyyy';
const PARSE_FORMATS = ['MMM d, yyyy','MMMM d, yyyy','M/d/yyyy','M/d/yy','yyyy-MM-dd'];
function parseDateText(text: string, reference: Date): Date | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  for (const f of PARSE_FORMATS) { const p = parse(trimmed, f, reference); if (isValid(p)) return p; }
  return undefined;
}
interface DatePickerProps { value?: Date; onChange?: (date: Date | undefined) => void; placeholder?: string; disabled?: boolean; className?: string; }
function DatePicker({ value, onChange, placeholder = 'Pick a date', disabled, className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(() => value ? format(value, DISPLAY_FORMAT) : '');
  const [month, setMonth] = React.useState(() => value ?? new Date());
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const valueRef = React.useRef(value);
  React.useEffect(() => {
    if (value?.getTime() === valueRef.current?.getTime()) return;
    valueRef.current = value; setText(value ? format(value, DISPLAY_FORMAT) : ''); if (value) setMonth(value);
  }, [value]);
  const commit = (date: Date | undefined) => { setText(date ? format(date, DISPLAY_FORMAT) : ''); if (date) setMonth(date); if (date?.getTime() !== valueRef.current?.getTime()) { valueRef.current = date; onChange?.(date); } };
  const commitTyped = () => { const parsed = parseDateText(text, value ?? new Date()); if (parsed || !text.trim()) commit(parsed); else setText(value ? format(value, DISPLAY_FORMAT) : ''); };
  const close = () => { commitTyped(); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={isOpen => (isOpen ? setOpen(true) : close())}>
      <PopoverAnchor asChild>
        <div ref={wrapperRef} className={cn('flex h-9 w-full items-center rounded-md border border-input bg-transparent shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring', disabled && 'cursor-not-allowed opacity-50', className)}>
          <input ref={inputRef} value={text} placeholder={placeholder} disabled={disabled} role="combobox" aria-expanded={open} aria-haspopup="dialog" aria-label={placeholder} className="h-full w-full min-w-0 flex-1 bg-transparent px-3 py-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
            onFocus={() => { if (!open) setOpen(true); }}
            onChange={e => { setText(e.target.value); const p = parseDateText(e.target.value, value ?? new Date()); if (p) setMonth(p); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); close(); } else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setText(value ? format(value, DISPLAY_FORMAT) : ''); setOpen(false); } }}
          />
          {text && !disabled ? (
            <button type="button" aria-label="Clear date" className="flex h-full shrink-0 items-center px-3 text-muted-foreground hover:text-foreground" onClick={() => commit(undefined)}><X className="size-4" /></button>
          ) : (
            <button type="button" tabIndex={-1} aria-label="Open calendar" disabled={disabled} className="flex h-full shrink-0 items-center px-3 text-muted-foreground disabled:cursor-not-allowed" onMouseDown={e => { e.preventDefault(); setOpen(true); inputRef.current?.focus(); }}><CalendarIcon className="size-4" /></button>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()} onInteractOutside={e => { if (wrapperRef.current?.contains(e.target as Node)) e.preventDefault(); }} onFocusOutside={e => { if (wrapperRef.current?.contains(e.target as Node)) e.preventDefault(); }}>
        <Calendar mode="single" selected={value} month={month} onMonthChange={setMonth} onSelect={date => { commit(date ?? undefined); setOpen(false); }} />
      </PopoverContent>
    </Popover>
  );
}
export { DatePicker };
export type { DatePickerProps };
