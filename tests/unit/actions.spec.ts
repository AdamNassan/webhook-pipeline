import { describe, expect, it } from "vitest";
import { filterAction } from "../../src/worker/actions/handlers/filter";
import { transformAction } from "../../src/worker/actions/handlers/transform";
import { validateAction } from "../../src/worker/actions/handlers/validate";

describe("worker action handlers", () => {
  it("transform action renames keys and applies defaults", async () => {
    const result = await transformAction({
      payload: { oldName: "value" },
      config: {
        rename: { oldName: "newName" },
        defaults: { country: "US" }
      }
    });

    expect(result.status).toBe("succeeded");
    expect(result.payload).toEqual({ newName: "value", country: "US" });
  });

  it("validate action fails when required field missing and failOnError true", async () => {
    await expect(
      validateAction({
        payload: { name: "test" },
        config: { requiredFields: ["name", "country"], failOnError: true }
      })
    ).rejects.toThrow("Missing required fields");
  });

  it("validate action skips when required field missing and failOnError false", async () => {
    const result = await validateAction({
      payload: { name: "test" },
      config: { requiredFields: ["name", "country"], failOnError: false }
    });

    expect(result.status).toBe("skipped");
    expect(result.payload).toEqual({ name: "test" });
  });

  it("filter action drops payload when condition fails and onFail=drop", async () => {
    const result = await filterAction({
      payload: { country: "CA" },
      config: { field: "country", equals: "US", onFail: "drop" }
    });

    expect(result.status).toBe("succeeded");
    expect(result.dropped).toBe(true);
  });
});
