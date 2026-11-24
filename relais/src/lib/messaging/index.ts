import "server-only";
import { serverEnv } from "@/lib/server-env";
import { phoneDigits } from "@/lib/phone";

/**
 * Messagerie — deux canaux :
 *  - « whatsapp_link » (actif) : liens wa.me préremplis, envoi manuel ;
 *  - « whatsapp_cloud » (inactif par défaut) : API WhatsApp Business Cloud.
 *
 * L'envoi automatique n'est possible que si WHATSAPP_CLOUD_API_TOKEN et
 * WHATSAPP_PHONE_NUMBER_ID sont configurés ET que les modèles de message
 * ont été approuvés par Meta. Aucune synchronisation n'est simulée.
 */
export function whatsappCloudStatus() {
  return { configured: Boolean(serverEnv.whatsappToken && serverEnv.whatsappPhoneNumberId) };
}

export async function sendWhatsAppTemplate(input: {
  to: string;
  template: string;
  language?: string;
  parameters?: string[];
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  if (!whatsappCloudStatus().configured) return { ok: false, reason: "not_configured" };
  const to = phoneDigits(input.to);
  if (!to) return { ok: false, reason: "invalid_phone" };
  const res = await fetch(`https://graph.facebook.com/v21.0/${serverEnv.whatsappPhoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serverEnv.whatsappToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: input.template,
        language: { code: input.language ?? "fr" },
        components: input.parameters?.length
          ? [{ type: "body", parameters: input.parameters.map((text) => ({ type: "text", text })) }]
          : undefined,
      },
    }),
  });
  if (!res.ok) return { ok: false, reason: `http_${res.status}` };
  const data = (await res.json()) as { messages?: { id: string }[] };
  return data.messages?.[0]?.id ? { ok: true, id: data.messages[0].id } : { ok: false, reason: "no_message_id" };
}
