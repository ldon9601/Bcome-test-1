import { createHash, createHmac } from "node:crypto";

/** AWS Signature Version 4, enough to call Amazon SES in Sydney without the AWS SDK. */

const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s, "utf8").digest();

const encode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export interface SignInput {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  /** e.g. 20150830T123600Z */
  amzDate: string;
}

export function signV4(input: SignInput): { headers: Record<string, string>; signature: string } {
  const url = new URL(input.url);
  const headers: Record<string, string> = { ...input.headers, host: url.host, "x-amz-date": input.amzDate };
  if (input.sessionToken) headers["x-amz-security-token"] = input.sessionToken;
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v.trim().replace(/\s+/g, " ")]));
  const names = Object.keys(lower).sort();
  const canonicalHeaders = names.map((n) => `${n}:${lower[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const query = [...url.searchParams.entries()]
    .map(([k, v]) => [encode(k), encode(v)])
    .sort(([a, x], [b, y]) => (a === b ? x.localeCompare(y) : a.localeCompare(b)))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const path = url.pathname.split("/").map((p) => encode(decodeURIComponent(p))).join("/") || "/";
  const canonical = [input.method.toUpperCase(), path, query, canonicalHeaders, signedHeaders, sha256hex(input.body)].join("\n");
  const date = input.amzDate.slice(0, 8);
  const scope = `${date}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", input.amzDate, scope, sha256hex(canonical)].join("\n");
  const kDate = hmac(`AWS4${input.secretAccessKey}`, date);
  const kSigning = hmac(hmac(hmac(kDate, input.region), input.service), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  return {
    signature,
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

export const amzDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
