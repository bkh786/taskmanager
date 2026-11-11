/** The web-app name, animated letter by letter, one word per line. */
export function AnimatedTitle({ text }: { text: string }) {
  let n = 0;
  return (
    <h1
      className="text-[40px] sm:text-[44px] font-extrabold tracking-tight leading-[0.98]"
      aria-label={text}
    >
      {text.split(" ").map((word, w) => (
        <span key={w} className="block" aria-hidden="true">
          {word.split("").map((ch) => {
            const i = n++;
            return (
              <span key={i} className="tm-letter" style={{ ["--i" as string]: i }}>
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}
