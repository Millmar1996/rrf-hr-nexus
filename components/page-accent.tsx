export function PageAccent({ variant = "arc" }: { variant?: "arc" | "lines" }) {
  return <svg className={`page-accent page-accent-${variant}`} viewBox="0 0 240 140" aria-hidden="true" focusable="false">
    {variant === "arc" ? <><path d="M237 142C237 65 175 3 98 3S-41 65-41 142"/><path d="M237 142c0-57-46-103-103-103S31 85 31 142"/><path d="M193 142c0-33-27-60-60-60s-60 27-60 60"/><path d="M118 0v140"/></> : <><path d="M18 0v140M38 0v140M58 0v140M78 0v140M98 0v140M118 0v140M138 0v140M158 0v140M178 0v140M198 0v140M218 0v140"/><path d="M0 25h240M0 45h240M0 65h240M0 85h240M0 105h240M0 125h240"/><path d="M18 0l200 140"/></>}
  </svg>;
}
