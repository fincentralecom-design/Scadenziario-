import { errorJson, json } from "@/lib/http";
import { deleteContract, saveContract } from "@/lib/service";
import type { Contract } from "@/lib/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Partial<Contract>;
    return json(await saveContract({ ...body, id }));
  } catch (e) {
    return errorJson(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await deleteContract((await params).id);
    return json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
