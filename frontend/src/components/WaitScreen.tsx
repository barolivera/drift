/** Spinner, a title and one line — nothing else on the screen. */
export function WaitScreen({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-16 text-center" role="status" aria-live="polite">
      <span
        aria-hidden
        className="mx-auto block h-12 w-12 animate-spin rounded-full border-[3px] border-line border-t-coral"
      />
      <p className="display mt-8 text-[clamp(1.75rem,3.2vw,2.5rem)]">{title}</p>
      <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-mute">{body}</p>
    </div>
  );
}
