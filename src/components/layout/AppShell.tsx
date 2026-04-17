import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";

interface AppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, header, children }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background">
        {sidebar}
        <div className="flex flex-1 flex-col min-w-0">
          {header}
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
