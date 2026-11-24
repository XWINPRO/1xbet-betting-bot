"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { ChevronsUpDown, LogOut, Menu, Shield, Bike, User, X } from "lucide-react";
import { Brand, LogoMark } from "@/components/brand";
import { NavLinks, type NavItem } from "@/components/layout/nav-link";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { signOutAction } from "@/lib/actions/auth";

export type ShellUser = { name: string; email: string | null; isAdmin: boolean; isCourier: boolean };
export type ShellSection = { title?: string; items: NavItem[] };

export function AppShell({
  sections,
  user,
  header,
  topbar,
  children,
  homeHref,
}: {
  sections: ShellSection[];
  user: ShellUser;
  header?: React.ReactNode;
  topbar?: React.ReactNode;
  children: React.ReactNode;
  homeHref: string;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  React.useEffect(() => setOpen(false), [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-[52px] items-center px-4">
        <Brand href={homeHref} size="sm" />
      </div>
      {header ? <div className="px-3 pb-3">{header}</div> : null}
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navigation principale">
        {sections.map((section, i) => (
          <div key={i} className={i > 0 ? "mt-5" : undefined}>
            {section.title ? <p className="mb-1 px-2.5 text-[11px] font-medium tracking-wide text-ink-4 uppercase">{section.title}</p> : null}
            <NavLinks items={section.items} onNavigate={() => setOpen(false)} />
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <UserMenu user={user} />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-surface lg:block">{sidebar}</aside>

      <D.Root open={open} onOpenChange={setOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-ink/30 data-[state=open]:animate-fade-in lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-surface shadow-pop data-[state=open]:animate-fade-in lg:hidden">
            <D.Title className="sr-only">Menu</D.Title>
            <D.Description className="sr-only">Navigation principale</D.Description>
            <D.Close className="absolute top-3 right-3 rounded-sm p-1.5 text-ink-3 hover:bg-muted" aria-label="Fermer le menu">
              <X className="size-4" />
            </D.Close>
            {sidebar}
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="sticky top-0 z-20 flex h-[52px] items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
        <button type="button" className="-ml-1 rounded-md p-1.5 text-ink-2 hover:bg-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
          <Menu className="size-5" />
        </button>
        <Link href={homeHref} className="lg:hidden" aria-label="Accueil">
          <LogoMark size={22} />
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{topbar}</div>
      </div>

      <main>{children}</main>
    </div>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  return (
    <Dropdown>
      <DropdownTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-subtle focus-visible:outline-none focus-visible:shadow-focus">
        <Avatar name={user.name} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{user.name || "Mon compte"}</span>
          <span className="block truncate text-xs text-ink-3">{user.email}</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-ink-4" />
      </DropdownTrigger>
      <DropdownContent align="start" side="top" className="w-[224px]">
        <DropdownLabel>Espaces</DropdownLabel>
        <DropdownItem asChild>
          <Link href="/account">
            <User /> Mon compte
          </Link>
        </DropdownItem>
        {user.isCourier ? (
          <DropdownItem asChild>
            <Link href="/courier">
              <Bike /> Espace livreur
            </Link>
          </DropdownItem>
        ) : null}
        {user.isAdmin ? (
          <DropdownItem asChild>
            <Link href="/admin">
              <Shield /> Administration
            </Link>
          </DropdownItem>
        ) : null}
        <DropdownSeparator />
        <form action={signOutAction}>
          <DropdownItem asChild destructive>
            <button type="submit" className="w-full">
              <LogOut /> Se déconnecter
            </button>
          </DropdownItem>
        </form>
      </DropdownContent>
    </Dropdown>
  );
}
