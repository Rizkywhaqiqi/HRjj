import { letterResponse } from "@/modules/letters/file-response";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return letterResponse((await params).id, true);
}
