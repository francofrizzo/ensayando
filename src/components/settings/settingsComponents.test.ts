import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ConfirmTypedDialog from "./ConfirmTypedDialog.vue";
import SegmentedControl from "./SegmentedControl.vue";

describe("ConfirmTypedDialog", () => {
  it("enables the destructive button only when the text matches", async () => {
    const wrapper = mount(ConfirmTypedDialog, {
      props: {
        open: true,
        title: "Eliminar Coro",
        description: "Se eliminan 7 canciones.",
        expected: "coro-del-puerto",
        confirmLabel: "Eliminar colección"
      }
    });
    const button = wrapper.get('[data-testid="confirm-delete"]');
    expect(button.attributes("disabled")).toBeDefined();

    await wrapper.get('[data-testid="confirm-input"]').setValue("coro");
    expect(button.attributes("disabled")).toBeDefined();

    await wrapper.get('[data-testid="confirm-input"]').setValue("Coro-del-Puerto ");
    expect(button.attributes("disabled")).toBeUndefined();
    await button.trigger("click");
    expect(wrapper.emitted("confirm")).toHaveLength(1);
  });
});

describe("SegmentedControl", () => {
  it("marks the selected option and emits the new one", async () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        modelValue: "normal",
        label: "Intensidad",
        options: [
          { value: "suave", label: "Suave" },
          { value: "normal", label: "Normal" }
        ]
      }
    });
    const [suave, normal] = wrapper.findAll('[role="radio"]');
    expect(normal!.attributes("aria-checked")).toBe("true");
    await suave!.trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([["suave"]]);
  });
});
