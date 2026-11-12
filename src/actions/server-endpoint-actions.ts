"use server";

import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { db } from "@/db";
import { serverEndpoints } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sanitizeString } from "@/lib/security";
import { cleanServerUrl } from "@/lib/backend-config";

export interface ServerEndpointItem {
  id: string;
  name: string;
  url: string;
  description: string | null;
  environment: "lan" | "cloud" | "local" | "backup";
  isDefault: boolean;
  isActive: boolean;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const FALLBACK_SERVER_ENDPOINTS: ServerEndpointItem[] = [
  {
    id: "srv_lan_factory",
    name: "Main Plant Factory LAN",
    url: "http://192.168.1.100:3000",
    description: "On-premises high-speed factory local area network server",
    environment: "lan",
    isDefault: true,
    isActive: true,
    createdAt: new Date("2026-11-12T00:00:00Z"),
    updatedAt: new Date("2026-11-12T00:00:00Z"),
  },
  {
    id: "srv_hq_cloud",
    name: "Homicho HQ Internet Cloud",
    url: "https://dpm.homicho.et",
    description: "Central cloud server accessible over public internet and mobile data",
    environment: "cloud",
    isDefault: false,
    isActive: true,
    createdAt: new Date("2026-11-12T00:00:00Z"),
    updatedAt: new Date("2026-11-12T00:00:00Z"),
  },
  {
    id: "srv_localhost",
    name: "Localhost Edge / Developer",
    url: "http://localhost:3000",
    description: "Local development gateway running on localhost",
    environment: "local",
    isDefault: false,
    isActive: true,
    createdAt: new Date("2026-11-12T00:00:00Z"),
    updatedAt: new Date("2026-11-12T00:00:00Z"),
  },
];

const serverEndpointSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    url: z
      .string()
      .min(7, "URL must be at least 7 characters")
      .max(255)
      .refine(
        (val) => {
          try {
            const parsed = new URL(val);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
          } catch {
            return false;
          }
        },
        { message: "URL must be a valid HTTP or HTTPS address (e.g. http://192.168.1.100:3000)" }
      ),
    description: z.string().max(255).optional().nullable(),
    environment: z.enum(["lan", "cloud", "local", "backup"]).default("lan"),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .strict();


/**
 * Returns active server endpoints for regular users and PWA clients.
 * Resilient to database failure by returning fallback presets.
 */
export async function getServerEndpointsAction(): Promise<ServerEndpointItem[]> {
  try {
    const records = await db
      .select()
      .from(serverEndpoints)
      .where(eq(serverEndpoints.isActive, true))
      .orderBy(desc(serverEndpoints.isDefault), asc(serverEndpoints.name));

    if (!records || records.length === 0) {
      return FALLBACK_SERVER_ENDPOINTS;
    }

    return records.map((r) => ({
      ...r,
      environment: r.environment as ServerEndpointItem["environment"],
    }));
  } catch (err) {
    console.warn("Failed to load server endpoints from DB, using fallback presets:", err);
    return FALLBACK_SERVER_ENDPOINTS;
  }
}

/**
 * Returns all server endpoints (active and inactive) for Sys Admin.
 */
export async function getAllServerEndpointsForAdminAction(): Promise<ServerEndpointItem[]> {
  const user = await requireUser();
  if (user.role !== "sys_admin") {
    throw new Error("Forbidden: Only Sys Admin can manage server endpoints");
  }

  try {
    const records = await db
      .select()
      .from(serverEndpoints)
      .orderBy(desc(serverEndpoints.isDefault), desc(serverEndpoints.createdAt));

    return records.map((r) => ({
      ...r,
      environment: r.environment as ServerEndpointItem["environment"],
    }));
  } catch (err) {
    console.error("Failed to load admin server endpoints:", err);
    return FALLBACK_SERVER_ENDPOINTS;
  }
}

/**
 * Creates a new server endpoint preset. Sys Admin only.
 */
export async function createServerEndpointAction(rawInput: unknown) {
  const user = await requireUser();
  if (user.role !== "sys_admin") {
    return { success: false, error: "Forbidden: Only Sys Admin can create server presets" };
  }

  const parsed = serverEndpointSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { name, url, description, environment, isDefault, isActive } = parsed.data;
  const sanitizedName = sanitizeString(name);
  const normalizedUrl = cleanServerUrl(url);
  const sanitizedDesc = description ? sanitizeString(description) : null;

  try {
    // If setting as default, clear default flag from all other endpoints
    if (isDefault) {
      await db.update(serverEndpoints).set({ isDefault: false });
    }

    const endpointId = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const [created] = await db
      .insert(serverEndpoints)
      .values({
        id: endpointId,
        name: sanitizedName,
        url: normalizedUrl,
        description: sanitizedDesc,
        environment,
        isDefault,
        isActive,
        createdBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    revalidatePath("/admin");
    return { success: true, endpoint: created };
  } catch (err: any) {
    console.error("Failed to create server endpoint:", err);
    return { success: false, error: "Database error creating server endpoint preset" };
  }
}

/**
 * Updates an existing server endpoint preset. Sys Admin only.
 */
export async function updateServerEndpointAction(id: string, rawInput: unknown) {
  const user = await requireUser();
  if (user.role !== "sys_admin") {
    return { success: false, error: "Forbidden: Only Sys Admin can update server presets" };
  }

  const parsed = serverEndpointSchema.partial().safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  try {
    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (parsed.data.name !== undefined) {
      updateData.name = sanitizeString(parsed.data.name);
    }
    if (parsed.data.url !== undefined) {
      updateData.url = cleanServerUrl(parsed.data.url);
    }
    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description ? sanitizeString(parsed.data.description) : null;
    }
    if (parsed.data.environment !== undefined) {
      updateData.environment = parsed.data.environment;
    }
    if (parsed.data.isActive !== undefined) {
      updateData.isActive = parsed.data.isActive;
    }
    if (parsed.data.isDefault !== undefined) {
      updateData.isDefault = parsed.data.isDefault;
      if (parsed.data.isDefault) {
        await db.update(serverEndpoints).set({ isDefault: false });
      }
    }

    await db.update(serverEndpoints).set(updateData).where(eq(serverEndpoints.id, id));

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to update server endpoint:", err);
    return { success: false, error: "Database error updating server endpoint" };
  }
}

/**
 * Toggles a server endpoint between active and inactive. Sys Admin only.
 */
export async function toggleServerEndpointActiveAction(id: string, isActive: boolean) {
  const user = await requireUser();
  if (user.role !== "sys_admin") {
    return { success: false, error: "Forbidden: Only Sys Admin can modify server presets" };
  }

  try {
    await db
      .update(serverEndpoints)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(serverEndpoints.id, id));

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to toggle server endpoint status:", err);
    return { success: false, error: "Database error updating server status" };
  }
}

/**
 * Deletes a server endpoint preset. Sys Admin only.
 */
export async function deleteServerEndpointAction(id: string) {
  const user = await requireUser();
  if (user.role !== "sys_admin") {
    return { success: false, error: "Forbidden: Only Sys Admin can delete server presets" };
  }

  try {
    await db.delete(serverEndpoints).where(eq(serverEndpoints.id, id));
    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to delete server endpoint:", err);
    return { success: false, error: "Database error deleting server endpoint" };
  }
}
