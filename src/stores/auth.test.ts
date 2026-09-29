import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

let authListener: ((event: string, session: { user: { id: string } } | null) => void) | null = null;

vi.mock("vue-router", () => ({ useRoute: () => ({ params: {}, query: {} }) }));
vi.mock("@/data/admin", () => ({ fetchIsAppAdmin: vi.fn().mockResolvedValue(true) }));
vi.mock("@/data/supabase", () => ({
  getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } } }),
  onAuthStateChange: vi.fn((cb) => {
    authListener = cb;
  })
}));

import { fetchIsAppAdmin } from "@/data/admin";

import { useAuthStore } from "./auth";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("auth store - isAppAdmin", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(fetchIsAppAdmin).mockClear();
  });

  it("is fetched once after sign-in and reset on sign-out", async () => {
    const store = useAuthStore();
    expect(store.isAppAdmin).toBe(false);
    await store.initAuth();
    await flush();
    expect(store.isAppAdmin).toBe(true);
    expect(fetchIsAppAdmin).toHaveBeenCalledTimes(1);

    authListener?.("SIGNED_IN", { user: { id: "u1" } });
    await flush();
    expect(fetchIsAppAdmin).toHaveBeenCalledTimes(1);

    authListener?.("SIGNED_OUT", null);
    expect(store.isAppAdmin).toBe(false);
  });
});
