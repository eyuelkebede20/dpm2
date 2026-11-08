import type { Metadata } from "next";
import "./globals.css";
import { getSessionContext } from "@/lib/authz";
import { Navbar } from "@/components/navbar";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { RoleSwitcher } from "@/components/role-switcher";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DPM - Daily Product Manager",
  description: "Simple, clean factory production tracking and quality management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, isImpersonating } = await getSessionContext();

  return (
    <html lang="en" data-theme="light">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col">
        {user && isImpersonating && (
          <ImpersonationBanner
            impersonatedUser={{
              name: user.name,
              email: user.email,
              role: user.role,
            }}
          />
        )}
        {user && <Navbar user={user} />}
        <main className="flex-1">{children}</main>
        <RoleSwitcher
          currentRole={user?.role || null}
          currentEmail={user?.email || null}
        />
      </body>
    </html>
  );
}
