/** The web-app name, animated letter by letter. */
export function AnimatedTitle({ text }: { text: string }) {
  return (
    <h1 className="text-[34px] sm:text-[40px] font-extrabold tracking-tight leading-tight" aria-label={text}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="tm-letter"
          style={{ ["--i" as string]: i }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </h1>
  );
}
