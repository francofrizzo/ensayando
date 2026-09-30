import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import IOSPlaybackNotice from "@/components/player/IOSPlaybackNotice.vue";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("IOSPlaybackNotice", () => {
  it("shows both iPhone recommendations and acknowledges the notice", async () => {
    const wrapper = mount(IOSPlaybackNotice, {
      attachTo: document.body,
      props: { show: true }
    });

    const notice = document.querySelector('[data-testid="ios-playback-notice"]');
    expect(notice?.textContent).toContain(
      "Recomendaciones para que Ensayando funcione correctamente en tu iPhone"
    );
    expect(notice?.textContent).toContain("Desactivá el modo silencio");
    expect(notice?.textContent).toContain("Mantené la pantalla encendida");

    (notice?.querySelector("button") as HTMLButtonElement).click();
    expect(wrapper.emitted("dismiss")).toHaveLength(1);
  });

  it("does not render the notice when hidden", () => {
    mount(IOSPlaybackNotice, { props: { show: false } });

    expect(document.querySelector('[data-testid="ios-playback-notice"]')).toBeNull();
  });
});
