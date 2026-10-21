import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    if (!filename) {
      return new NextResponse("Filename is required", { status: 400 });
    }

    // Clean up filename (remove query string if attached)
    const cleanFilename = filename.split("?")[0];
    const localPath = path.join(process.cwd(), "public", "brand-asset", cleanFilename);

    if (fs.existsSync(localPath)) {
      const ext = path.extname(cleanFilename).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
      };
      const contentType = mimeMap[ext] || "application/octet-stream";
      const fileBuffer = fs.readFileSync(localPath);

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Fallback: proxy from live production site
    const liveUrl = `https://autoworldapprovals.com/api/public/brand-asset/${encodeURIComponent(cleanFilename)}`;
    const remoteRes = await fetch(liveUrl, { cache: "force-cache" });
    if (!remoteRes.ok) {
      return new NextResponse("Asset not found", { status: 404 });
    }

    const contentType = remoteRes.headers.get("content-type") || "image/png";
    const arrayBuffer = await remoteRes.arrayBuffer();

    // Cache locally for next time
    try {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, Buffer.from(arrayBuffer));
    } catch {
      // Ignore cache write errors
    }

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving brand asset:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
