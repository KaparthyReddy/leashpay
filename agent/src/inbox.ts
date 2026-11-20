import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type Memo = {
  from?: string;
  subject?: string;
  body: string;
};

export async function loadMemo(inboxDir: string, invoiceId: bigint): Promise<Memo | null> {
  try {
    const text = await readFile(join(inboxDir, `${invoiceId}.json`), "utf8");
    const data = JSON.parse(text) as Partial<Memo>;
    return {
      from: typeof data.from === "string" ? data.from : undefined,
      subject: typeof data.subject === "string" ? data.subject : undefined,
      body: typeof data.body === "string" ? data.body : "",
    };
  } catch {
    return null;
  }
}
