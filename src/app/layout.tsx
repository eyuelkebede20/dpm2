import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSessionContext } from "@/lib/authz";
import { Navbar } from "@/components/navbar";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { RoleSwitcher } from "@/components/role-switcher";
import { PwaOtaManager } from "@/components/pwa/pwa-ota-manager";
import { NavigationProgress } from "@/components/ui/navigation-progress";

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
  const { user, isImpersonating, canSwitchRole } = await getSessionContext();

  return (
    <html lang="en" data-theme="light">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__pwaInstallPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaInstallPrompt=e;window.dispatchEvent(new CustomEvent('pwa-prompt-captured'));});`,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col">
        <NavigationProgress />
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
          <main className="flex-1 pb-24 md:pb-0">{children}</main>
          {user && (user.role === "sys_admin" || canSwitchRole) && (
            <RoleSwitcher
              currentRole={user.role}
              currentEmail={user.email}
              canSwitchRole={canSwitchRole}
            />
          )}
        </PwaOtaManager>
      </body>
    </html>
  );
}
