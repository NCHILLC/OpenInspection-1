/**
 * The ISN panel's save: which credentials are sent, and what the hold switch
 * becomes. A blank credential field means "unchanged" (SecretField shows a mask
 * and submits nothing new), so it must not be sent as an empty value.
 */
import { describe, expect, it, vi } from "vitest";
import type { Api } from "./api-client.server";
import { saveIsnSettings } from "./isn-settings.server";

function fakeApi(ok = true) {
  const put = vi.fn(() => Promise.resolve(new Response(JSON.stringify(ok ? { success: true } : { error: { message: "ISN_DOMAIN must be https://", field: "ISN_DOMAIN" } }), { status: ok ? 200 : 400 })));
  const post = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
  const api = { secrets: { secrets: { $put: put } }, admin: { config: { $post: post } } } as unknown as Api;
  return { api, put, post };
}

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("saveIsnSettings", () => {
  it("sends only the credentials that were typed, and 'isn' when the switch is on", async () => {
    const { api, put, post } = fakeApi();
    const out = await saveIsnSettings(api, form({ ISN_DOMAIN: "https://inspectionsupport.com", ISN_ACCESS_KEY: "  ", isnHoldsReports: "on" }));
    expect(out.success).toBe(true);
    expect(put).toHaveBeenCalledWith({ json: { ISN_DOMAIN: "https://inspectionsupport.com" } });
    expect(post).toHaveBeenCalledWith({ json: { isnReportAccess: "isn" } });
  });

  it("writes 'openinspection' when the switch is off, and skips the secrets call when nothing was typed", async () => {
    const { api, put, post } = fakeApi();
    await saveIsnSettings(api, form({}));
    expect(put).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith({ json: { isnReportAccess: "openinspection" } });
  });

  it("returns the server's refusal against its field, and does not save the switch", async () => {
    const { api, post } = fakeApi(false);
    const out = await saveIsnSettings(api, form({ ISN_DOMAIN: "inspectionsupport.com" }));
    expect(out).toMatchObject({ success: false, error: "ISN_DOMAIN must be https://", field: "ISN_DOMAIN" });
    expect(post).not.toHaveBeenCalled();
  });
});
