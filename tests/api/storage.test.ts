// @vitest-environment node
import { describe, expect, it } from "vitest";

import { rolesForFileType } from "../../api/storage";

describe("storage permissions", () => {
  it("lets editors upload audio but only admins change the artwork", () => {
    expect(rolesForFileType("audio")).toEqual(["admin", "editor"]);
    expect(rolesForFileType("artwork")).toEqual(["admin"]);
  });
});
