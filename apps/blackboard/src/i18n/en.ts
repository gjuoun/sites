import type { Dict } from "./types.ts";

export const en: Dict = {
  locale: "en",
  lang: "en",
  title: "Blackboard — review markdown with your coding agent",
  description:
    "Plan review, back in the document: highlight a passage, leave a comment, and your coding agent answers over the same CLI. Local, MIT licensed.",
  languageName: "English",
  switcher: { href: "/zh/", label: "中文", lang: "zh" },
  hero: {
    tagline: "Plan review, back in the document.",
    who: "Highlight a passage, leave a comment; your agent answers over the same CLI — back and forth until it ships.",
    cta: "Get started",
    github: "GitHub ↗",
    shot: {
      src: "/assets/doc.png",
      alt: "Blackboard doc view: a markdown plan with a highlighted passage, table of contents, mermaid diagram and a comments panel where an agent asks about a passage and a human replies",
      width: 1440,
      height: 1160,
      caption: "The doc view — select a passage, comment; the agent answers from its shell and the page updates live.",
    },
  },
  install: {
    rows: ["npm install -g blackboard", "blackboard open docs/plan.md"],
    copy: "Copy",
    copied: "Copied",
    bunPrefix: "or with bun: ",
    bunCommand: "bunx blackboard open docs/plan.md",
  },
  home: {
    heading: "Home",
    shot: {
      src: "/assets/home.png",
      alt: "Blackboard home: a scratchpad card and session cards with repo path, branch and open comment count",
      width: 1440,
      height: 540,
      caption: "Every session is one markdown file on disk — where it lives and which branch it is on, at a glance. Click a highlight in the app to focus its comment; click a comment to scroll to the passage.",
      loading: "lazy",
    },
  },
  features: {
    heading: "What it does",
    items: [
      { title: "Sessions", text: "one markdown file anywhere on disk; the browser shows where it lives (repo, path, branch)." },
      { title: "Comments on text", text: "select a passage, write a note; flat replies, resolve and reopen." },
      { title: "Live view", text: "the page refreshes when the file changes; highlights follow their passage." },
      { title: "CLI for agents", text: "pi, Claude Code, Codex or any shell user reads and answers comments under a shared lock." },
      { title: "Markdown done right", text: "GFM tables with sticky headers, heading anchors, TOC, front matter as a table." },
      { title: "Offline mermaid", text: "diagrams render in the browser from the bundled library." },
      { title: "Local and safe", text: "binds 127.0.0.1, serves only registered files, re-checks every request." },
      { title: "Copy open", text: "copy the open comments as markdown to paste anywhere." },
    ],
  },
  cli: {
    heading: "CLI for agents",
    rows: [
      { command: "open     <file> [--no-browser]                ", comment: 'prints "<id>  <url>"' },
      { command: "sessions [--json]                             ", comment: "id, title, location, branch, open comments" },
      { command: "comments <session> [--all] [--json]" },
      { command: 'reply    <session> <comment-id> "text"' },
      { command: "resolve  <session> <comment-id>               ", comment: "or: reopen" },
      { command: 'comment  <session> --quote "passage" "note"' },
      { command: "wait     <session> [--timeout 30m]            ", comment: "blocks until a human comments" },
    ],
    note: {
      before: "The CLI edits files under ",
      code: "~/.blackboard",
      after: " under a lock shared with the web app, so it works whether or not the app is running; an open page shows its changes live.",
    },
  },
  footer: {
    license: "MIT License",
    requirements: "Requires bun 1.3+ · macOS & Linux · Chrome/Edge, Safari 17.2+",
  },
};
