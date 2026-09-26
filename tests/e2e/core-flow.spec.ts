import { expect, test } from "@playwright/test";

test("loads authoritative routes and completes the recommendation flow", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Wachusett Summit Access Trails" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Massachusetts DCR trail geometry" }),
  ).toHaveAttribute("href", /mass\.gov/);
  await expect(
    page.getByRole("button", { name: /Pine Hill Trail/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Mountain House Trail/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Harrington Trail/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /simulation/i })).toHaveCount(
    0,
  );
  await expect(
    page.getByLabel("Interactive 3D route alternatives map"),
  ).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Search supported trails" })
    .fill("Mountain House");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("button", { name: /^Mountain House Trail Princeton/ })
    .click();
  await page.getByRole("button", { name: "Start field session" }).click();

  await expect(page.getByText("Recommendation ready")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Current route recommendation" }),
  ).toContainText("Pine Hill Trail");
  await expect(
    page.getByRole("region", { name: "Current hiking state" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Decision signal" }),
  ).toBeVisible();
  await expect(page.getByText("Initial route signal")).toBeVisible();
  await expect(
    page.getByLabel(/highlighting recommended route Pine Hill Trail/),
  ).toBeVisible();

  await page.getByRole("button", { name: "End field session" }).click();
  await expect(
    page.getByRole("button", { name: "Start field session" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search supported trails" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("region", { name: "Current hiking state" }),
  ).toHaveCount(0);
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 600) {
    const mapBox = await page.locator(".map-stage").boundingBox();
    const panelBox = await page.locator(".mission-panel").boundingBox();
    expect(mapBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(mapBox!.y).toBeLessThan(panelBox!.y);
  }
});

test("surfaces stale environmental state while retaining the last values", async ({
  page,
}) => {
  await page.route("**/sessions/*/events?after=*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.environmentalStatus = {
      status: "stale",
      reason: "refresh_failed",
      checkedAt: new Date().toISOString(),
    };
    await route.fulfill({ response, json: body });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start field session" }).click();

  await expect(page.getByText("Refresh failed")).toBeVisible();
  await expect(page.getByText("Showing last valid observation")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Current hiking state" }),
  ).toContainText("54");
});
