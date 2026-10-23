"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createCommissionRule,
  deleteCommissionRule,
  estimateCommissionForBooking,
  type CreateCommissionRuleInput,
} from "@/server/queries/commissions";

export async function createCommissionRuleAction(
  input: Omit<CreateCommissionRuleInput, "organizationId" | "actorId">,
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  const result = await createCommissionRule({
    ...input,
    organizationId: session.user.organizationId,
    actorId: session.user.id ?? null,
  });

  revalidatePath("/cash");
  return { success: true, data: result };
}

export async function deleteCommissionRuleAction(id: string) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  await deleteCommissionRule(id, session.user.organizationId, session.user.id ?? null);
  revalidatePath("/cash");
  return { success: true };
}

export async function estimateBookingCommissionAction(bookingId: string) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  const result = await estimateCommissionForBooking(bookingId);
  revalidatePath("/cash");
  revalidatePath("/bookings");
  return { success: true, data: result };
}
