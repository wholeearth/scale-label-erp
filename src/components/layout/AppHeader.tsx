import { LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

function getInitials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6">
      <SidebarTrigger className="text-foreground" />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex-1 min-w-0">
        <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate hidden sm:block">{subtitle}</p>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="h-9 w-9"
      >
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2 hover:bg-muted">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:flex flex-col items-start leading-tight">
              <span className="text-xs font-medium text-foreground">{profile?.full_name}</span>
              {profile?.employee_code && (
                <span className="text-[10px] text-muted-foreground">{profile.employee_code}</span>
              )}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{profile?.full_name}</span>
              {profile?.employee_code && (
                <span className="text-xs text-muted-foreground font-normal">
                  {profile.employee_code}
                </span>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
