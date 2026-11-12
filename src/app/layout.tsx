import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSessionContext } from "@/lib/authz";
import { Navbar } from "@/components/navbar";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { RoleSwitcher } from "@/components/role-switcher";
import { PwaOtaManager } from "@/components/pwa/pwa-ota-manager";

export const viewport: Viewport = {
  themeColor: "#1e293b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Homicho Ammunition Engineering Industry - DPM",
  description: "Munitions Manufacturing Production & Quality Management System",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HAEI DPM",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
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
        <PwaOtaManager>
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
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <RoleSwitcher
            currentRole={user?.role || null}
            currentEmail={user?.email || null}
          />
        </PwaOtaManager>
      </body>
    </html>
  );
}
