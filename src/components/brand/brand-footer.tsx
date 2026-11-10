/** Static footer on every page, including sign-in. */
export function BrandFooter() {
  return (
    <footer className="shrink-0 border-t border-panel-border bg-panel-bg px-4 py-2 text-[11.5px] text-text-sub flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center">
      <a
        href="https://task.digipresence.in/login"
        className="font-bold text-text-main hover:text-accent"
      >
        Task Manager
      </a>
      <span className="text-text-faint hidden sm:inline">|</span>
      <span>
        Designed and developed by{" "}
        <a
          href="https://www.digipresence.in"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-accent hover:underline"
        >
          Digi Presence Solutions
        </a>
      </span>
      <span className="text-text-faint hidden sm:inline">|</span>
      <span>
        ✉ Email:{" "}
        <a href="mailto:contact@digipresence.in" className="font-semibold text-accent hover:underline">
          contact@digipresence.in
        </a>
      </span>
    </footer>
  );
}
