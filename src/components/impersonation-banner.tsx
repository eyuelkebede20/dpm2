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
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium flex items-center justify-between shadow-inner">
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 animate-pulse text-amber-900" />
          <span>
            <strong>Dev Mode Active:</strong> You are currently impersonating{" "}
            <span className="font-bold underline">{impersonatedUser.name}</span> (
            <span className="uppercase text-xs font-mono font-bold tracking-wider">
              {impersonatedUser.role}
            </span>{" "}
            - {impersonatedUser.email})
          </span>
        </div>
        <button
          onClick={handleStopImpersonation}
          disabled={loading}
          className="btn btn-xs bg-amber-900 text-white hover:bg-black border-none gap-1 ml-4"
        >
          <LogOut className="w-3.5 h-3.5" />
          {loading ? "Reverting..." : "Exit Impersonation"}
        </button>
      </div>
    </div>
  );
}
