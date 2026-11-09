"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, LogOut } from "lucide-react";

interface ImpersonationBannerProps {
  impersonatedUser: {
    name: string;
    email: string;
    role: string;
  };
}

export function ImpersonationBanner({ impersonatedUser }: ImpersonationBannerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleStopImpersonation = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
        router.push("/admin");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside
      aria-label="Developer Impersonation Warning"
      className="relative z-50 bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium border-b border-amber-600/40 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-amber-600/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4 animate-pulse text-amber-950" />
          </div>
          <div className="text-xs sm:text-sm leading-relaxed truncate sm:overflow-visible sm:whitespace-normal">
            <span className="inline-block font-black uppercase tracking-wider text-[10px] bg-amber-950/15 text-amber-950 px-2 py-0.5 rounded-md mr-1.5 border border-amber-950/20">
              Dev Mode Active
            </span>
            <span>
              Impersonating <span className="font-black underline underline-offset-2">{impersonatedUser.name}</span>
            </span>{" "}
            <span className="text-xs font-medium text-amber-950/80">
              (<span className="uppercase font-mono font-bold tracking-wider">{impersonatedUser.role}</span> &bull; {impersonatedUser.email})
            </span>
          </div>
        </div>
        <button
          onClick={handleStopImpersonation}
          disabled={loading}
          className="btn btn-xs bg-amber-950 hover:bg-black text-amber-50 border-none gap-1.5 font-bold rounded-xl shadow-2xs self-end sm:self-auto shrink-0 transition-all active:scale-95 px-3 py-1"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{loading ? "Reverting..." : "Exit Impersonation"}</span>
        </button>
      </div>
    </aside>
  );
}
