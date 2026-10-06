// Outbound notifications (email / SMS).
// No provider is wired up in this MVP: messages are written to the server log so the
// flow is observable in development. Replace `deliver` with an SMTP / SMS gateway
// (e.g. an Ethio telecom SMS API) to send for real; callers don't need to change.

type Message = { to: string; channel: "email" | "sms"; subject?: string; body: string };

async function deliver(message: Message): Promise<void> {
  console.info(`[notify:${message.channel}] to=${message.to} ${message.subject ?? ""}\n${message.body}`);
}

export async function notify(message: Message): Promise<void> {
  try {
    await deliver(message);
  } catch (err) {
    // Notification failures must never fail the business operation that triggered them.
    console.error("[notify] failed", err);
  }
}
