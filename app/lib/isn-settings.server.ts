/**
 * The ISN panel's load and save, kept out of settings-advanced.tsx so the
 * route stays a list of panels. Credentials go to the encrypted secrets store
 * (PUT /api/secrets); the hold switch is plaintext integration config
 * (POST /api/admin/config, which merges, so other keys survive).
 */
import type { Api } from "./api-client.server";
import { ISN_SECRET_KEYS, type IsnSecrets } from "~/components/settings/advanced/IsnPanel";
import { m } from "~/paraglide/messages";

export async function loadIsnSettings(api: Api, secrets: Record<string, string>): Promise<{ secrets: IsnSecrets; isnHoldsReports: boolean }> {
  // Owner-only route: a manager reads the switch as off, which is also the default.
  const res = await api.admin.config.$get().catch(() => null);
  const body = res?.ok ? ((await res.json()) as { data?: { integrationConfig?: { isnReportAccess?: string } } }) : null;
  return {
    secrets: Object.fromEntries(ISN_SECRET_KEYS.map((k) => [k, secrets[k] || ""])) as IsnSecrets,
    isnHoldsReports: body?.data?.integrationConfig?.isnReportAccess === "isn",
  };
}

export async function saveIsnSettings(api: Api, fd: FormData) {
  const intent = "save-isn";
  const fail = (error: string, field: string | null = null) => ({ intent, success: false, error, field, test: null });
  const secrets: Record<string, string> = {};
  for (const key of ISN_SECRET_KEYS) {
    const val = fd.get(key);
    if (typeof val === "string" && val.trim()) secrets[key] = val;
  }
  if (Object.keys(secrets).length > 0) {
    const res = await api.secrets.secrets.$put({ json: secrets });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: { message?: string; field?: string } } | null;
      return fail(err?.error?.message ?? m.settings_isn_save_error(), err?.error?.field ?? null);
    }
  }
  const cfg = await api.admin.config.$post({ json: { isnReportAccess: fd.get("isnHoldsReports") === "on" ? "isn" : "openinspection" } });
  if (!cfg.ok) return fail(m.settings_isn_save_error());
  return { intent, success: true, error: null, field: null, test: null };
}
