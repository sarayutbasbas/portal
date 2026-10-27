import { checkAllTargets } from "../lib/status-check.mjs";

export async function GET() {
  try {
    return Response.json(await checkAllTargets(), {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=15, must-revalidate" },
    });
  } catch (error) {
    console.error("Portal status check failed", error.message);
    return Response.json({ error: "ตรวจสอบสถานะไม่ได้" }, { status: 503 });
  }
}
