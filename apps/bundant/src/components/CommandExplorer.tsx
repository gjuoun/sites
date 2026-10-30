import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Check, Copy, Search, Terminal, X } from 'lucide-react';

export type ExplorerCommand = {
  name: string;
  group: string;
  summary: string;
  usage: string;
  flags: { flag: string; description: string }[];
  example: string;
};

type GroupId = 'deploy' | 'units' | 'groups' | 'ops';

const GROUP_META: Record<GroupId, { label: string; blurb: string }> = {
  deploy: { label: 'Deploy', blurb: 'Ship, move traffic, roll back' },
  units: { label: 'Units', blurb: 'One service, accessory or glob' },
  groups: { label: 'Groups', blurb: 'Namespaces and host prerequisites' },
  ops: { label: 'Ops', blurb: 'Read-only, over the same ssh' },
};

const GROUP_ORDER: GroupId[] = ['deploy', 'units', 'groups', 'ops'];

/** Substring match on the command name and its summary, case-insensitive. */
export function filterCommands(commands: ExplorerCommand[], query: string): ExplorerCommand[] {
  const q = query.trim().toLowerCase();
  if (q === '') return commands;
  return commands.filter((command) =>
    `${command.name} ${command.summary} ${command.group}`.toLowerCase().includes(q),
  );
}

/** `#commands/deploy` -> `deploy`; any other hash -> null. */
export function commandFromHash(hash: string): string | null {
  const match = /^#commands\/([a-z0-9-]+)$/i.exec(hash);
  return match ? match[1]!.toLowerCase() : null;
}

type Props = {
  commands: ExplorerCommand[];
};

export function CommandExplorer({ commands }: Props) {
  const searchId = useId();
  const listboxId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState<string>(commands[0]?.name ?? '');
  const [activeIndex, setActiveIndex] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => filterCommands(commands, query), [commands, query]);
  const selected = commands.find((command) => command.name === selectedName) ?? commands[0];
  const active = filtered[Math.min(activeIndex, Math.max(filtered.length - 1, 0))];

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      ...GROUP_META[group],
      commands: filtered.filter((command) => command.group === group),
    })).filter((entry) => entry.commands.length > 0);
  }, [filtered]);

  // The URL hash is the deep link: #commands/<name> selects that command, and
  // back/forward or a pasted link keeps working.
  useEffect(() => {
    const applyHash = () => {
      const name = commandFromHash(window.location.hash);
      if (name && commands.some((command) => command.name === name)) {
        setSelectedName(name);
        setMobileOpen(false);
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [commands]);

  // A new query starts the cursor at the first match again.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the keyboard cursor inside the scrolled list - and ONLY the list. Using
  // scrollIntoView here also scrolled every ancestor, so opening the page jumped the
  // window down to this section, and a reload restored that offset.
  useEffect(() => {
    if (!active) return;
    const list = listRef.current;
    const option = document.getElementById(`command-option-${active.name}`);
    if (!list || !option) return;
    const listRect = list.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    if (optionRect.top < listRect.top) {
      list.scrollTop -= listRect.top - optionRect.top;
    } else if (optionRect.bottom > listRect.bottom) {
      list.scrollTop += optionRect.bottom - listRect.bottom;
    }
  }, [active]);

  useEffect(() => {
    setCopied(false);
  }, [selected?.name]);

  function select(name: string) {
    setSelectedName(name);
    setMobileOpen(false);
    const hash = `#commands/${name}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash);
    }
  }

  function move(delta: number) {
    if (filtered.length === 0) return;
    const next = Math.min(Math.max(activeIndex + delta, 0), filtered.length - 1);
    setActiveIndex(next);
    setMobileOpen(true);
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
      listRef.current?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
      listRef.current?.focus();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const pick = active ?? filtered[0];
      if (pick) select(pick.name);
    } else if (event.key === 'Escape') {
      setQuery('');
      setMobileOpen(false);
    }
  }

  function onListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(filtered.length - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active) select(active.name);
    } else if (event.key === 'Escape') {
      setMobileOpen(false);
    }
  }

  async function copyExample() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.example);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permission denied: the example stays selectable by hand.
    }
  }

  if (!selected) return null;

  return (
    <div className="mt-10 grid min-w-0 gap-4 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:items-start md:gap-6">
      <div className="relative min-w-0 md:sticky md:top-[5.5rem]">
        <label htmlFor={searchId} className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Search commands
        </label>
        <div className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 transition-colors focus-within:border-primary">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            role="combobox"
            aria-expanded={mobileOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
            placeholder="deploy, rollback, logs…"
            value={query}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setMobileOpen(true);
            }}
            onFocus={() => setMobileOpen(true)}
            onKeyDown={onSearchKeyDown}
          />
          {query !== '' && (
            <button
              type="button"
              className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3.5"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                setMobileOpen(false);
              }}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="mt-2 font-mono text-[11px] text-muted-foreground" aria-live="polite">
          {filtered.length} of {commands.length} commands
        </p>

        <div
          id={listboxId}
          ref={listRef}
          role="listbox"
          tabIndex={0}
          aria-label="Commands"
          aria-activedescendant={active ? `command-option-${active.name}` : undefined}
          className="absolute top-[calc(100%+0.375rem)] right-0 left-0 z-30 hidden max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-2 shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[open=true]:block md:static md:mt-2 md:block md:max-h-[min(38rem,calc(100vh-7rem))] md:shadow-none"
          data-open={mobileOpen ? 'true' : 'false'}
          onKeyDown={onListKeyDown}
        >
          {grouped.length === 0 && (
            <p className="px-2 py-3 text-[13px] text-muted-foreground">
              No command matches <span className="text-foreground">“{query.trim()}”</span>.
            </p>
          )}
          {grouped.map((group) => (
            <div
              key={group.group}
              className="mt-2 border-t border-border-muted pt-2 first:mt-0 first:border-t-0 first:pt-0"
              role="group"
              aria-label={group.label}
            >
              <p className="flex items-baseline justify-between px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {group.label}
                <span className="tracking-normal">{group.commands.length}</span>
              </p>
              {group.commands.map((command) => {
                const isSelected = command.name === selected.name;
                return (
                  <div
                    key={command.name}
                    id={`command-option-${command.name}`}
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected ? 'true' : 'false'}
                    className="group grid cursor-pointer gap-0.5 rounded-md px-2.5 py-2 hover:bg-muted aria-selected:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(command.name)}
                  >
                    <span className="font-mono text-[13px] font-semibold break-words text-foreground group-aria-selected:text-primary">
                      {command.name}
                    </span>
                    <span className="text-xs leading-[1.4] text-muted-foreground">{command.summary}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div
        className="min-w-0 rounded-xl border border-border bg-card p-5 md:p-7"
        role="region"
        aria-live="polite"
        aria-label={`${selected.name} command reference`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-primary">
                {GROUP_META[selected.group as GroupId]?.label ?? selected.group}
              </span>
              <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                bundant {selected.name}
              </span>
            </div>
            <h3 className="mt-2 font-mono text-2xl font-semibold tracking-tight break-words text-foreground md:text-[1.75rem]">
              {selected.name}
            </h3>
          </div>
          <Terminal className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>

        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{selected.summary}</p>

        <div className="mt-6">
          <p className="mb-2 flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Usage
          </p>
          <pre className="m-0 overflow-x-auto rounded-md border border-code-border bg-code-surface px-3.5 py-3 font-mono text-xs leading-[1.7] whitespace-pre-wrap break-words text-foreground [&_code]:font-[inherit]">
            <code>{selected.usage}</code>
          </pre>
        </div>

        <div className="mt-6">
          <p className="mb-2 flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Flags <span className="tracking-normal">{selected.flags.length}</span>
          </p>
          <dl className="m-0 border-t border-border-muted">
            {selected.flags.map((flag) => (
              <div
                key={flag.flag}
                className="grid gap-0.5 border-b border-border-muted py-2 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-baseline md:gap-4"
              >
                <dt className="font-mono text-xs leading-normal break-words text-foreground">{flag.flag}</dt>
                <dd className="m-0 text-[13px] leading-[1.55] break-words text-muted-foreground">{flag.description}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-4">
            <p className="mb-2 flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Example
            </p>
            <button
              type="button"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border px-2.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground [&_svg]:size-3"
              onClick={copyExample}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="m-0 overflow-x-auto rounded-md border border-code-border bg-code-surface px-3.5 py-3 font-mono text-xs leading-[1.7] whitespace-pre-wrap break-words text-foreground [&_code]:font-[inherit]">
            <code>
              <span className="text-primary">$</span> {selected.example}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
