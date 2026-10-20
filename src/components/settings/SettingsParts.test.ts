import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsParts from "@/components/settings/SettingsParts.vue";
import { fetchCollectionParts, updateCollectionMusic } from "@/data/parts";
import type { CollectionPart, CollectionWithRole } from "@/data/types";

vi.mock("@/data/parts", () => ({ fetchCollectionParts: vi.fn(), updateCollectionMusic: vi.fn() }));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn() } }));

const collection: CollectionWithRole = {
  id: 1,
  slug: "coro",
  title: "Coro",
  hue: 30,
  intensity: "media",
  track_colors: {
    voz: { hue: 120, intensity: "media" },
    otra: { hue: 240, intensity: "media" },
    tercera: { neutral: true }
  },
  user_role: "admin",
  visibility: "private",
  created_by: null,
  created_at: ""
};
const parts: CollectionPart[] = [
  { id: "a", collection_id: 1, name: "Coro", color_key: "voz", parent_id: null, order: 0 },
  { id: "b", collection_id: 1, name: "Tenores", color_key: "voz", parent_id: "a", order: 1 },
  { id: "c", collection_id: 1, name: "Solistas", color_key: "otra", parent_id: null, order: 2 }
];
const render = () => mount(SettingsParts, { props: { collection, songs: [], songsLoaded: true } });
type Wrapper = ReturnType<typeof render>;
const save = (wrapper: Wrapper) =>
  wrapper.get('[data-testid="save-bar"]').findAll("button")[1]!.trigger("click");
async function openColor(wrapper: Wrapper) {
  await wrapper.get('[aria-label="Elegir color"]').trigger("click");
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Editar color")!
    .trigger("click");
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchCollectionParts).mockResolvedValue(parts.map((part) => ({ ...part })));
  vi.mocked(updateCollectionMusic).mockResolvedValue();
});

describe("SettingsParts", () => {
  it("shows hierarchy, collapses children and excludes cyclic parents", async () => {
    const wrapper = render();
    await flushPromises();
    expect(
      wrapper
        .get('[aria-label="Dentro de"]')
        .findAll("option")
        .map((option) => option.text())
    ).toEqual(["Ninguna", "Solistas"]);
    await wrapper.get('[aria-label="Contraer Coro"]').trigger("click");
    expect(wrapper.find('[data-testid="part-row-b"]').exists()).toBe(false);
    await wrapper.get('[aria-label="Expandir Coro"]').trigger("click");
    expect(wrapper.get('[data-testid="part-row-b"]').text()).toContain("Tenores");
  });

  it("adds a subdivision with its own identity and saves one combined draft", async () => {
    const wrapper = render();
    await flushPromises();
    await wrapper.get('[aria-label="Acciones de Coro"]').trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Agregar subdivisión")!
      .trigger("click");
    expect(
      wrapper.get('[data-testid="save-bar"]').findAll("button")[1]!.attributes("disabled")
    ).toBeDefined();
    await wrapper.get('[aria-label="Nombre de parte"]').setValue("Sopranos");
    await save(wrapper);
    await flushPromises();
    expect(wrapper.emitted("updated")?.[0]?.[0]).toMatchObject({ user_role: "admin" });
    expect(wrapper.emitted("songs-changed")).toHaveLength(1);
    expect(wrapper.find('[data-testid="save-bar"]').exists()).toBe(false);
    const created = vi.mocked(updateCollectionMusic).mock.calls[0]![1][3]!;
    expect(created).toMatchObject({ name: "Sopranos", color_key: "voz", parent_id: "a" });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("renames a shared palette key without losing either part and discards all edits", async () => {
    const wrapper = render();
    await flushPromises();
    await openColor(wrapper);
    await wrapper.get('[aria-label="Clave de color"]').setValue("voces");
    await wrapper.get('[aria-label="Nombre de color"]').setValue("Voces");
    await wrapper.get('[aria-label="Cerrar color"]').trigger("click");
    expect(wrapper.get('[data-testid="part-row-b"]').text()).toContain("Tenores");
    await save(wrapper);
    await flushPromises();
    const [, savedParts, palette] = vi.mocked(updateCollectionMusic).mock.calls[0]!;
    expect(savedParts.slice(0, 2).map((part) => part.color_key)).toEqual(["voces", "voces"]);
    expect(palette.keyMap).toEqual({ voz: "voces" });
    expect(palette.trackColors.voces).toMatchObject({ name: "Voces" });
    await wrapper.get('[aria-label="Nombre de parte"]').setValue("Cambio");
    await wrapper.get('[data-testid="save-bar"]').findAll("button")[0]!.trigger("click");
    expect((wrapper.get('[aria-label="Nombre de parte"]').element as HTMLInputElement).value).toBe(
      "Coro"
    );
  });

  it("changes a removed color's replacement without reassigning unrelated parts", async () => {
    const wrapper = render();
    await flushPromises();
    await openColor(wrapper);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Eliminar color")!
      .trigger("click");
    await wrapper.get('[aria-label="Reemplazo de voz"]').setValue("tercera");
    await save(wrapper);
    await flushPromises();
    expect(
      vi.mocked(updateCollectionMusic).mock.calls[0]![1].map((part) => part.color_key)
    ).toEqual(["tercera", "tercera", "otra"]);
    expect(vi.mocked(updateCollectionMusic).mock.calls[0]![2].keyMap).toEqual({ voz: "tercera" });
  });

  it("retains the whole draft on failure and never overwrites a failed initial load", async () => {
    vi.mocked(updateCollectionMusic).mockRejectedValue(new Error("Parte en uso"));
    const wrapper = render();
    await flushPromises();
    await wrapper.get('[aria-label="Nombre de parte"]').setValue("Cambio");
    await save(wrapper);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("Parte en uso");
    expect(wrapper.find('[data-testid="save-bar"]').exists()).toBe(true);
    expect(wrapper.emitted("updated")).toBeUndefined();
    vi.mocked(fetchCollectionParts).mockRejectedValue(new Error("Sin conexión"));
    const failed = render();
    await flushPromises();
    expect(failed.get('[data-testid="add-part"]').attributes("disabled")).toBeDefined();
    expect(failed.get('[role="alert"]').text()).toContain("Sin conexión");
  });
});
