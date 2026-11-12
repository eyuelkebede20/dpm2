import { NextRequest } from "next/server";
import { GET as pushGet, POST as pushPost } from "../push-db/route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return pushGet(request);
}

export async function POST(request: NextRequest) {
  return pushPost(request);
}
