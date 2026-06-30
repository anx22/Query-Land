/**
 * HeroBand — the per-screen topographic Höhenlinien illustration, dropped into a
 * `.card.hero-card` as a subtle, left-masked background band (orange contour ring
 * upper-right). One confirmed band per screen lives under /brand/.
 *
 * Decorative only (aria-hidden); the masked fade keeps the kicker/title legible.
 */
export function HeroBand({ src }: { src: string }) {
  return (
    <div
      className="hero-card__band"
      aria-hidden="true"
      style={{ backgroundImage: `url(${src})` }}
    />
  );
}
