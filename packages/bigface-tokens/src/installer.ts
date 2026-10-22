/**
 * Renders `install.sh`, the one-curl installer served from the Pages site.
 *
 *   curl -fsSL https://bigface.qqntt.com/install.sh | sh -s -- ghostty vim
 *
 * The script only writes Bigface's own files. It never edits an existing config file; it prints the
 * line you need to add instead.
 */

export const SITE = "https://bigface.qqntt.com";

export type InstallKind =
  /** Copy files to their standard location. Included in `all` when the app is detected. */
  | "files"
  /** Download the .vsix and hand it to `code` / `cursor`. */
  | "vsix"
  /** Needs a vault path (`BIGFACE_VAULT`). */
  | "vault"
  /** Download to ~/.config/bigface/<id>/ and print the steps (nothing safe to drop in). */
  | "manual"
  /** Print the contents (Slack). */
  | "print";

export interface InstallSpec {
  id: string;
  kind: InstallKind;
  /** Shell test: true when the app looks installed. Only used by `all`. */
  detect?: string;
  /** [remote path under themes/<id>/, destination]. Destinations may use $HOME and $CFG. */
  files: [remote: string, dest: string][];
  /** Printed after install: the one thing the user still has to do. */
  note: string;
  /** Printed after uninstall: what to undo by hand (we never edit the user's config). */
  undo: string;
  /** Directories the installer created for itself; removed on uninstall only if empty. */
  owned?: string[];
}

const APPS = '"${BIGFACE_APPS:-/Applications}"';

export const installSpecs: InstallSpec[] = [
  {
    id: "pi",
    kind: "files",
    detect: 'command -v pi >/dev/null 2>&1 || [ -d "$HOME/.pi/agent" ]',
    files: [["bigface.json", "$HOME/.pi/agent/themes/bigface.json"]],
    note: "Run `pi --use-theme bigface`, or pick it under /settings -> Theme.",
    undo: "If Bigface is your selected theme, pick another under /settings -> Theme.",
  },
  {
    id: "ghostty",
    kind: "files",
    detect: `[ -d ${APPS}/Ghostty.app ] || command -v ghostty >/dev/null 2>&1 || [ -d "$CFG/ghostty" ]`,
    files: [["Bigface", "$CFG/ghostty/themes/Bigface"]],
    note: "Add `theme = Bigface` to $CFG/ghostty/config and reload.",
    undo: "Remove `theme = Bigface` from $CFG/ghostty/config.",
  },
  {
    id: "herdr",
    kind: "manual",
    files: [["theme.toml", "$CFG/bigface/herdr/theme.toml"]],
    note: "herdr has no theme-file format: paste that file into $CFG/herdr/config.toml under your [theme] table, then run `herdr config check`.",
    undo: "Remove the [theme.custom] block you pasted from $CFG/herdr/config.toml.",
    owned: ["$CFG/bigface/herdr", "$CFG/bigface"],
  },
  {
    id: "vscode",
    kind: "vsix",
    detect: "command -v code >/dev/null 2>&1 || command -v cursor >/dev/null 2>&1",
    files: [],
    note: "Pick Bigface under Preferences -> Color Theme.",
    undo: "If Bigface is your selected colour theme, pick another under Preferences -> Color Theme.",
  },
  {
    id: "zed",
    kind: "files",
    detect: `[ -d ${APPS}/Zed.app ] || command -v zed >/dev/null 2>&1 || [ -d "$CFG/zed" ]`,
    files: [["themes/bigface.json", "$CFG/zed/themes/bigface.json"]],
    note: "Open the theme selector (cmd-k cmd-t) and choose Bigface.",
    undo: "If Bigface is your selected theme, pick another (cmd-k cmd-t).",
  },
  {
    id: "jetbrains",
    kind: "manual",
    files: [["Bigface.xml", "$CFG/bigface/jetbrains/Bigface.xml"]],
    note: "In your IDE: Settings -> Editor -> Color Scheme -> gear icon -> Import Scheme..., then choose that file.",
    undo: "The scheme you imported lives inside the IDE: Settings -> Editor -> Color Scheme, pick another, then delete Bigface from the gear menu.",
    owned: ["$CFG/bigface/jetbrains", "$CFG/bigface"],
  },
  {
    id: "zellij",
    kind: "files",
    detect: 'command -v zellij >/dev/null 2>&1 || [ -d "$CFG/zellij" ]',
    files: [["bigface.kdl", "$CFG/zellij/themes/bigface.kdl"]],
    note: 'Set `theme "bigface"` in $CFG/zellij/config.kdl.',
    undo: 'Remove `theme "bigface"` from $CFG/zellij/config.kdl.',
  },
  {
    id: "starship",
    kind: "manual",
    files: [["palette.toml", "$CFG/bigface/starship/palette.toml"]],
    note: "Paste that file at the top of $CFG/starship.toml (the `palette` line must come before any table).",
    undo: "Remove the `palette = bigface` line and the [palettes.bigface] table from $CFG/starship.toml.",
    owned: ["$CFG/bigface/starship", "$CFG/bigface"],
  },
  {
    id: "vim",
    kind: "files",
    detect: "command -v vim >/dev/null 2>&1 || command -v nvim >/dev/null 2>&1",
    files: [
      ["colors/bigface.vim", "$HOME/.vim/colors/bigface.vim"],
      ["colors/bigface.vim", "$CFG/nvim/colors/bigface.vim"],
    ],
    note: "Run `:colorscheme bigface`.",
    undo: "Remove any `colorscheme bigface` line from your vimrc.",
  },
  {
    id: "xcode",
    kind: "files",
    detect: `[ -d ${APPS}/Xcode.app ]`,
    files: [
      [
        "Bigface.xccolortheme",
        "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes/Bigface.xccolortheme",
      ],
    ],
    note: "Restart Xcode, then choose Bigface in Settings -> Themes.",
    undo: "If Bigface is your selected theme, pick another in Xcode -> Settings -> Themes.",
  },
  {
    id: "micro",
    kind: "files",
    detect: 'command -v micro >/dev/null 2>&1 || [ -d "$CFG/micro" ]',
    files: [["bigface.micro", "$CFG/micro/colorschemes/bigface.micro"]],
    note: "In micro press ctrl-e and run `set colorscheme bigface` (needs COLORTERM=truecolor).",
    undo: "In micro run `set colorscheme default` (or your usual scheme).",
  },
  {
    id: "obsidian",
    kind: "vault",
    files: [
      ["Bigface/theme.css", "$BIGFACE_VAULT/.obsidian/themes/Bigface/theme.css"],
      ["Bigface/manifest.json", "$BIGFACE_VAULT/.obsidian/themes/Bigface/manifest.json"],
    ],
    note: "Select Bigface under Settings -> Appearance -> Themes. Needs BIGFACE_VAULT=/path/to/vault.",
    undo: "Select another theme under Settings -> Appearance -> Themes.",
    owned: ["$BIGFACE_VAULT/.obsidian/themes/Bigface"],
  },
  {
    id: "slack",
    kind: "print",
    files: [["theme.txt", ""]],
    note: "Paste it in Preferences -> Appearance -> Custom theme -> Import theme.",
    undo: "Nothing was written to disk. In Slack: Preferences -> Appearance -> pick another theme.",
  },
];

/** Single-quote a string for sh. */
const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
/** Double-quote for sh, keeping $VARS live. */
const dq = (s: string) => `"${s.replace(/(["\\`])/g, "\\$1")}"`;

const putLines = (s: InstallSpec) =>
  s.files.map(([r, d]) => `  put ${sq(`themes/${s.id}/${r}`)} ${dq(d)} || return 1`);

function installFn(s: InstallSpec): string {
  const head = `install_${s.id}() {`;
  const note = `  note ${dq(s.note)}`;
  switch (s.kind) {
    case "files":
    case "manual":
      return [head, ...putLines(s), note, "}"].join("\n");
    case "vault":
      return [head, "  need_vault || return 1", ...putLines(s), note, "}"].join("\n");
    case "vsix":
      return [
        head,
        `  if [ -n "$DRY" ]; then`,
        `    echo "  would download downloads/bigface-theme-0.1.0.vsix and run: code/cursor --install-extension"`,
        `  else`,
        `    tmp="$(mktemp -d)"`,
        `    trap 'rm -rf "$tmp"' EXIT`,
        `    get 'downloads/bigface-theme-0.1.0.vsix' "$tmp/bigface-theme.vsix"`,
        `    found=""`,
        `    for editor in code cursor; do`,
        `      if command -v "$editor" >/dev/null 2>&1; then`,
        `        "$editor" --install-extension "$tmp/bigface-theme.vsix" >/dev/null && echo "  installed in $editor"`,
        `        found=1`,
        `      fi`,
        `    done`,
        `    if [ -z "$found" ]; then`,
        '      echo "  neither code nor cursor is on PATH; download $BASE/downloads/bigface-theme-0.1.0.vsix and use Extensions -> Install from VSIX." >&2',
        `      return 1`,
        `    fi`,
        `  fi`,
        note,
        "}",
      ].join("\n");
    case "print":
      return [
        head,
        `  if [ -n "$DRY" ]; then echo "  would print ${s.id} theme"; else`,
        `    echo "  $(get ${sq(`themes/${s.id}/${s.files[0]?.[0]}`)} -)"`,
        `  fi`,
        note,
        "}",
      ].join("\n");
  }
}

function uninstallFn(s: InstallSpec): string {
  const head = `uninstall_${s.id}() {`;
  const undo = `  note ${dq(s.undo)}`;
  const drops = (s.owned ?? []).map((d) => `  drop_dir ${dq(d)}`);
  switch (s.kind) {
    case "files":
    case "manual":
      return [head, ...s.files.map(([, d]) => `  remove ${dq(d)}`), ...drops, undo, "}"].join("\n");
    case "vault":
      return [
        head,
        "  need_vault || return 1",
        ...s.files.map(([, d]) => `  remove ${dq(d)}`),
        ...drops,
        undo,
        "}",
      ].join("\n");
    case "vsix":
      return [
        head,
        `  found=""`,
        `  for editor in code cursor; do`,
        `    if command -v "$editor" >/dev/null 2>&1; then`,
        `      found=1`,
        `      if [ -n "$DRY" ]; then echo "  would run: $editor --uninstall-extension ${EXTENSION_ID}"`,
        `      elif "$editor" --uninstall-extension ${EXTENSION_ID} >/dev/null 2>&1; then echo "  removed from $editor"`,
        `      else echo "  not installed in $editor"; fi`,
        `    fi`,
        `  done`,
        `  if [ -z "$found" ]; then echo "  neither code nor cursor is on PATH" >&2; return 1; fi`,
        undo,
        "}",
      ].join("\n");
    case "print":
      return [head, undo, "}"].join("\n");
  }
}

/** Shell body that returns 0 when this app's Bigface files are in place. */
function installedTest(s: InstallSpec): string {
  switch (s.kind) {
    case "files":
    case "manual":
      return s.files.map(([, d]) => `[ -e ${dq(d)} ]`).join(" || ");
    case "vault":
      return `[ -n "\${BIGFACE_VAULT:-}" ] && ${s.files.map(([, d]) => `[ -e ${dq(d)} ]`).join(" && ")}`;
    case "vsix":
      return [
        `for editor in code cursor; do`,
        `        if command -v "$editor" >/dev/null 2>&1; then`,
        `          case "$("$editor" --list-extensions 2>/dev/null)" in *${EXTENSION_ID}*) return 0 ;; esac`,
        `        fi`,
        `      done`,
        `      return 1`,
      ].join("\n");
    case "print":
      return "return 1";
  }
}

const EXTENSION_ID = "gjuoun.bigface-theme";

export function renderInstaller(base = SITE): string {
  const ids = installSpecs.map((s) => s.id);
  const blurbCases = installSpecs.map((s) => `    ${s.id}) echo ${sq(describe(s))} ;;`).join("\n");
  const detectCases = installSpecs
    .filter((s) => s.kind === "files" || s.kind === "vsix")
    .map((s) => `    ${s.id}) ${s.detect} ;;`)
    .join("\n");
  const installedCases = installSpecs.map((s) => `    ${s.id}) ${installedTest(s)} ;;`).join("\n");
  const allIds = installSpecs
    .filter((s) => s.kind === "files" || s.kind === "vsix")
    .map((s) => s.id)
    .join(" ");

  return `#!/bin/sh
# Bigface installer — https://github.com/gjuoun/bigface-theme
#
#   curl -fsSL ${base}/install.sh | sh                          # interactive: asks what to install or remove
#   curl -fsSL ${base}/install.sh | sh -s -- ghostty vim       # install named apps
#   curl -fsSL ${base}/install.sh | sh -s -- all                # every drop-in app it detects
#   curl -fsSL ${base}/install.sh | sh -s -- --uninstall all    # remove what it installed
#   curl -fsSL ${base}/install.sh | sh -s -- --list
#   add --dry-run to any of them to see what would happen
#
# It only writes (and removes) Bigface's own files and never edits your config: it prints the
# one line you still need to add or remove. Read it first: it is this file.
#
# Environment: BIGFACE_BASE (site URL), BIGFACE_DRY_RUN=1, BIGFACE_VAULT (Obsidian vault path),
# BIGFACE_TTY (where interactive answers are read from; default /dev/tty).
# Generated by src/installer.ts — do not edit by hand.
set -eu

BASE="\${BIGFACE_BASE:-${base}}"
DRY="\${BIGFACE_DRY_RUN:-}"
CFG="\${XDG_CONFIG_HOME:-$HOME/.config}"
TTY="\${BIGFACE_TTY:-/dev/tty}"
IDS="${ids.join(" ")}"
ALL="${allIds}"
MODE="install"

usage() {
  echo "usage: sh install.sh [--dry-run] [--uninstall] [--list] <app>... | all"
  echo "       sh install.sh      (no arguments: interactive menu)"
}

blurb() {
  case "$1" in
${blurbCases}
  esac
}

list() {
  echo "Bigface apps:"
  for x in $IDS; do printf '  %-10s %s\\n' "$x" "$(blurb "$x")"; done
}

# get <remote path> <dest | ->   download from the site
get() {
  if [ "$2" = "-" ]; then curl -fsSL "$BASE/$1"; else curl -fsSL "$BASE/$1" -o "$2"; fi
}

# Show $HOME as ~ so the output stays short.
tilde() {
  rest="$1"; out=""
  while :; do
    case "$rest" in
      *"$HOME"*) out="$out\${rest%%"$HOME"*}~"; rest="\${rest#*"$HOME"}" ;;
      *) out="$out$rest"; break ;;
    esac
  done
  printf '%s\\n' "$out"
}

# put <remote path> <dest file>
put() {
  dest="$2"
  if [ -n "$DRY" ]; then echo "  would write $(tilde "$dest")"; return 0; fi
  mkdir -p "$(dirname "$dest")"
  part="$dest.part.$$"
  if get "$1" "$part"; then mv "$part" "$dest"; echo "  wrote $(tilde "$dest")"
  else rm -f "$part"; echo "  failed to download $1" >&2; return 1; fi
}

# remove <file>: deletes exactly that file
remove() {
  if [ -e "$1" ] || [ -L "$1" ]; then
    if [ -n "$DRY" ]; then echo "  would remove $(tilde "$1")"
    else rm -f "$1"; echo "  removed $(tilde "$1")"; fi
  else
    echo "  not installed: $(tilde "$1")"
  fi
}

# drop_dir <dir>: removes a directory we created, only when it is empty
drop_dir() {
  if [ -z "$DRY" ]; then rmdir "$1" 2>/dev/null || true; fi
}

need_vault() {
  if [ -z "\${BIGFACE_VAULT:-}" ]; then
    echo "  obsidian: set BIGFACE_VAULT=/path/to/your/vault and run again." >&2
    return 1
  fi
  if [ ! -d "$BIGFACE_VAULT" ]; then
    echo "  obsidian: $BIGFACE_VAULT is not a directory." >&2
    return 1
  fi
}

note() { echo "  -> $(tilde "$1")"; }

# detected <id>: does the app look installed on this machine? (drop-in apps only)
detected() {
  case "$1" in
${detectCases}
    *) return 1 ;;
  esac
}

# is_installed <id>: are Bigface's files in place?
is_installed() {
  case "$1" in
${installedCases}
    *) return 1 ;;
  esac
}

${installSpecs.map(installFn).join("\n\n")}

${installSpecs.map(uninstallFn).join("\n\n")}

valid() { case " $IDS " in *" $1 "*) return 0 ;; esac; return 1; }

# Apps that 'all' stands for: detected ones when installing, installed ones when uninstalling.
auto_targets() {
  out=""
  for a in $IDS; do
    if [ "$MODE" = "uninstall" ]; then
      if is_installed "$a"; then out="$out $a"; fi
    else
      case " $ALL " in
        *" $a "*) if detected "$a"; then out="$out $a"; fi ;;
      esac
    fi
  done
  echo "$out"
}

# ---- interactive -------------------------------------------------------------------------------
have_tty() { ( : < "$TTY" ) 2>/dev/null; }

# ask <prompt>: sets REPLY. End of input counts as 'q'.
ask() {
  printf '%s' "$1"
  if read -r REPLY <&3; then :; else REPLY="q"; echo; fi
}

id_at() {
  i=0
  for x in $IDS; do
    i=$((i + 1))
    if [ "$i" -eq "$1" ]; then echo "$x"; return 0; fi
  done
  return 1
}

resolve() {
  case "$1" in
    ''|*[!0-9]*) if valid "$1"; then echo "$1"; else return 1; fi ;;
    *) id_at "$1" ;;
  esac
}

show_menu() {
  echo
  echo "Apps (installed = Bigface is in place, detected = the app is on this machine):"
  i=0
  for x in $IDS; do
    i=$((i + 1)); mark=""
    if is_installed "$x"; then mark="installed"
    elif detected "$x"; then mark="detected"; fi
    printf '  %2d) %-10s %-10s %s\\n' "$i" "$x" "$mark" "$(blurb "$x")"
  done
  echo
}

interactive() {
  exec 3< "$TTY"
  echo "Bigface — dark color theme"
  if [ -z "$MODE_SET" ]; then
    echo
    while :; do
      ask "What do you want to do?  [1] install  [2] uninstall  [q] quit  (1) "
      case "$REPLY" in
        ''|1|i|install) MODE="install"; break ;;
        2|u|uninstall) MODE="uninstall"; break ;;
        q|quit) echo "Nothing changed."; exit 0 ;;
        *) echo "  please answer 1, 2 or q" ;;
      esac
    done
  fi
  while :; do
    show_menu
    if [ "$MODE" = "uninstall" ]; then which="installed"; else which="detected"; fi
    ask "$MODE which? Numbers or names, a = all $which, q = quit  (a) "
    case "$REPLY" in
      ''|a|all)
        targets="$(auto_targets)"
        if [ -z "$targets" ]; then echo "  no $which apps; pick some by number or name."; continue; fi ;;
      q|quit) echo "Nothing changed."; exit 0 ;;
      *)
        targets=""; bad=""
        for tok in $(printf '%s' "$REPLY" | tr ',' ' '); do
          if id="$(resolve "$tok")"; then targets="$targets $id"; else bad="$bad $tok"; fi
        done
        if [ -n "$bad" ]; then echo "  not an app:$bad"; continue; fi ;;
    esac
    echo
    echo "  $MODE:$targets"
    ask "Proceed? [Y/n] "
    case "$REPLY" in
      ''|y|Y|yes) break ;;
      *) echo "Nothing changed."; exit 0 ;;
    esac
  done
  case " $targets " in
    *" obsidian "*)
      if [ -z "\${BIGFACE_VAULT:-}" ]; then
        ask "Path to your Obsidian vault: "
        BIGFACE_VAULT="$REPLY"
      fi ;;
  esac
  echo
}

# ---- main --------------------------------------------------------------------------------------
targets=""
want_all=""
MODE_SET=""
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --list) list; exit 0 ;;
    -n|--dry-run) DRY=1 ;;
    -u|--uninstall|uninstall) MODE="uninstall"; MODE_SET=1 ;;
    install) MODE="install"; MODE_SET=1 ;;
    all) want_all=1 ;;
    -*) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
    *) targets="$targets $1" ;;
  esac
  shift
done

if [ -z "$targets" ] && [ -z "$want_all" ]; then
  if have_tty; then interactive
  else usage; echo; list; exit 0; fi
fi

if [ -n "$want_all" ]; then targets="$targets $(auto_targets)"; fi

if [ -z "$(echo $targets)" ]; then
  if [ "$MODE" = "uninstall" ]; then echo "nothing to uninstall: no Bigface files found."
  else echo "no supported apps detected; name one explicitly (see --list)."; fi
  exit 0
fi

# Reject unknown names before touching anything.
for t in $targets; do
  if ! valid "$t"; then echo "unknown app: $t (try --list)" >&2; exit 2; fi
done

status=0
done_list=" "
for t in $targets; do
  case "$done_list" in *" $t "*) continue ;; esac
  done_list="$done_list$t "
  echo "$t"
  if "\${MODE}_$t"; then :; else status=1; fi
done
exit $status
`;
}

function describe(s: InstallSpec): string {
  switch (s.kind) {
    case "files":
      return "installs the theme file";
    case "vsix":
      return "installs the extension into code and cursor";
    case "vault":
      return "needs BIGFACE_VAULT=/path/to/vault";
    case "manual":
      return "downloads the file and prints the steps";
    case "print":
      return "prints the theme string";
  }
}
