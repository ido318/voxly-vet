import { describe, expect, it } from "vitest";
import { assertStoragePathMatchesVisit } from "@/lib/api/storage-path-guard";

const clinicId = "clinic-1";
const visitId = "visit-1";

describe("assertStoragePathMatchesVisit", () => {
  it("does not throw when the storagePath matches the visit exactly", () => {
    expect(() =>
      assertStoragePathMatchesVisit(`${clinicId}/${visitId}/some-uuid.webm`, clinicId, visitId),
    ).not.toThrow();
  });

  it("rejects an empty storagePath gracefully (forbidden, not an unhandled exception)", () => {
    expect(() => assertStoragePathMatchesVisit("", clinicId, visitId)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("rejects a storagePath with no '/' segments gracefully", () => {
    expect(() => assertStoragePathMatchesVisit(clinicId, clinicId, visitId)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("rejects a storagePath with an empty segment (e.g. 'clinic-1//uuid.webm') gracefully", () => {
    expect(() =>
      assertStoragePathMatchesVisit(`${clinicId}//some-uuid.webm`, clinicId, visitId),
    ).toThrow(expect.objectContaining({ status: 403 }));
  });

  it("rejects a storagePath belonging to a different clinic or visit", () => {
    expect(() =>
      assertStoragePathMatchesVisit("other-clinic/other-visit/uuid.webm", clinicId, visitId),
    ).toThrow(expect.objectContaining({ status: 403 }));
  });
});
