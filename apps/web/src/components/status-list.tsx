interface StatusListItem {
  id: string;
  label: string;
  status: string;
  statusClassName?: string;
}

export interface StatusListProps {
  items: StatusListItem[];
}

export function StatusList({ items }: StatusListProps) {
  return (
    <ul className="status-list">
      {items.map((item) => (
        <li key={item.id}>
          <span>{item.label}</span>
          <span className={item.statusClassName ?? "badge primary"}>{item.status}</span>
        </li>
      ))}
    </ul>
  );
}
