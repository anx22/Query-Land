export interface SectionRailItem {
  /** Anchor target id (without the leading #). */
  id: string;
  label: string;
}

export interface SectionRailProps {
  items: SectionRailItem[];
  ariaLabel?: string;
}

/**
 * SectionRail — a sticky "Auf dieser Seite" jump-navigation for long single-object pages (e.g. the
 * URL-Dossier). Pure anchor links, server-renderable, no JS. Lets the user reach any section without
 * blind scrolling. Part of the "Schicht 2" vocabulary for stacked (non-alternative) content.
 */
export function SectionRail({ items, ariaLabel = "Auf dieser Seite" }: SectionRailProps) {
  if (items.length === 0) return null;
  return (
    <nav className="section-rail" aria-label={ariaLabel}>
      <span className="section-rail__label">Auf dieser Seite</span>
      <ul className="section-rail__list">
        {items.map((item) => (
          <li key={item.id}>
            <a className="section-rail__link" href={`#${item.id}`}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
