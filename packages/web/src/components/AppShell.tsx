import { ReactNode } from "react";

interface Props {
  sidebar?: ReactNode;
  sidebarOpen?: boolean;
  onCloseSidebar?: () => void;
  children: ReactNode;
}

export function AppShell({ sidebar, sidebarOpen = true, onCloseSidebar, children }: Props) {
  return (
    <div className={`app-shell${sidebar ? " app-shell--with-sidebar" : ""}${sidebar && !sidebarOpen ? " app-shell--sidebar-collapsed" : ""}`}>
      {sidebar ? (
        <>
          <button
            type="button"
            className={`app-shell__overlay${sidebarOpen ? " is-open" : ""}`}
            onClick={onCloseSidebar}
            aria-label="Close sidebar"
          />
          <aside className="app-shell__sidebar">
            <div className="app-shell__sidebar-inner">
              <button
                type="button"
                className="app-shell__sidebar-close"
                onClick={onCloseSidebar}
                aria-label="Close sidebar"
              >
                ✕
              </button>
              {sidebar}
            </div>
          </aside>
        </>
      ) : null}
      <main className="app-shell__content">{children}</main>
    </div>
  );
}
