import ForbiddenPage from "@/app/forbidden";

export const metadata = {
  title: "403 Forbidden - Access Restricted | DPM Pro",
  description: "You do not have permission to access this page.",
};

export default function ForbiddenRoutePage() {
  return <ForbiddenPage />;
}
