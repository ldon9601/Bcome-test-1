import { amzDate, signV4 } from "./sigv4.ts";

export interface Email {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(email: Email): Promise<void>;
}

/** Development only: prints emails to the server log instead of sending them. */
export class ConsoleMailer implements Mailer {
  sent: Email[] = [];
  async send(email: Email) {
    this.sent.push(email);
    console.info(`[bcome email] to ${email.to}: ${email.subject}\n${email.text}`);
  }
}

/**
 * Amazon SES in ap-southeast-2 (Sydney), so email content is processed in Australia (ST4S H1).
 * Needs a verified sending domain and an IAM key limited to ses:SendEmail.
 */
export class SesMailer implements Mailer {
  region: string;
  from: string;
  accessKeyId: string;
  secretAccessKey: string;
  constructor(opts: { region: string; from: string; accessKeyId: string; secretAccessKey: string }) {
    this.region = opts.region;
    this.from = opts.from;
    this.accessKeyId = opts.accessKeyId;
    this.secretAccessKey = opts.secretAccessKey;
  }
  async send(email: Email) {
    const url = `https://email.${this.region}.amazonaws.com/v2/email/outbound-emails`;
    const body = JSON.stringify({
      FromEmailAddress: this.from,
      Destination: { ToAddresses: [email.to] },
      Content: { Simple: { Subject: { Data: email.subject, Charset: "UTF-8" }, Body: { Text: { Data: email.text, Charset: "UTF-8" } } } },
    });
    const { headers } = signV4({
      method: "POST",
      url,
      headers: { "content-type": "application/json" },
      body,
      region: this.region,
      service: "ses",
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      amzDate: amzDate(new Date()),
    });
    delete headers.host;
    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) throw new Error(`SES send failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}

/** Resend (https://resend.com). Simpler to set up, but processes email outside Australia. */
export class ResendMailer implements Mailer {
  apiKey: string;
  from: string;
  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }
  async send(email: Email) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [email.to], subject: email.subject, text: email.text }),
    });
    if (!res.ok) throw new Error(`Resend send failed (${res.status})`);
  }
}

export function mailerFromEnv(env: NodeJS.ProcessEnv = process.env): Mailer {
  const from = env.EMAIL_FROM ?? "Bcome <no-reply@bcome.example>";
  if (env.EMAIL_PROVIDER === "ses") {
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) throw new Error("EMAIL_PROVIDER=ses needs AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY");
    return new SesMailer({ region: env.AWS_SES_REGION ?? "ap-southeast-2", from, accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY });
  }
  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY) throw new Error("EMAIL_PROVIDER=resend needs RESEND_API_KEY");
    return new ResendMailer(env.RESEND_API_KEY, from);
  }
  if (env.NODE_ENV === "production" && env.EMAIL_PROVIDER !== "console") {
    throw new Error("Set EMAIL_PROVIDER to ses or resend. Sign-in codes can't be delivered otherwise.");
  }
  return new ConsoleMailer();
}
