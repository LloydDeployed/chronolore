import { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function SidebarSection({ title, children, defaultOpen = true }: Props) {
  return (
    <details className="sidebar-section" open={defaultOpen}>
      <summary className="sidebar-section__summary">
        <span className="sidebar-section__title">{title}</span>
        <span className="sidebar-section__caret" aria-hidden="true" />
      </summary>
      <div className="sidebar-section__body">{children}</div>
    </details>
  );
}
