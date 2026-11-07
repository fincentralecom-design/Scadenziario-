import { errorJson, json } from "@/lib/http";
import { saveContract } from "@/lib/service";
import { getStore } from "@/lib/store";
import type { Contract } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await getStore().listContracts());
  } catch (e) {
    return errorJson(e, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Contract>;
    return json(await saveContract({ ...body, id: undefined }), 201);
  } catch (e) {
    return errorJson(e);
  }
}
