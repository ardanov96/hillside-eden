/**
 * Endpoint untuk melihat bukti struk pengeluaran (S3-02).
 * GET /api/receipts/[...key]
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createStorageProvider } from "@/ingest/storage";

export const instant = false;

interface Params {
  params: Promise<{ key: string[] }>;
}

export async function GET(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { key: keyParts } = await params;
  if (!keyParts || keyParts.length === 0) {
    return new NextResponse("Missing key", { status: 400 });
  }

  const fullKey = keyParts.join("/");

  // Pastikan key diawali dengan receipts/<orgId>/ untuk keamanan isolasi tenant
  const expectedPrefix = `receipts/${session.user.organizationId}/`;
  if (!fullKey.startsWith(expectedPrefix)) {
    return new NextResponse("Forbidden: Access limited to organization receipts", { status: 403 });
  }

  try {
    const storage = createStorageProvider();
    const exists = await storage.exists(fullKey);
    if (!exists) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const [buffer, meta] = await Promise.all([storage.get(fullKey), storage.head(fullKey)]);

    const contentType = meta.contentType || "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    return new NextResponse(`Error retrieving receipt: ${(err as Error).message}`, { status: 500 });
  }
}
