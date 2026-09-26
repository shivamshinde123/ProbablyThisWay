import { expect, test } from "@playwright/test";

test("loads authoritative routes and completes the recommendation flow", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await page.route("**/api/v1/trails/search?q=*", async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get("q") ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query,
        attribution: "© OpenStreetMap contributors",
        attributionUrl: "https://www.openstreetmap.org/copyright",
        items: [],
      }),
    });
  });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Wachusett Summit Access Trails" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Massachusetts DCR trail geometry" }),
  ).toHaveAttribute("href", /mass\.gov/);
  const searchFontSize = await page
    .getByRole("searchbox", { name: "Search trails from the internet" })
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(searchFontSize).toBeGreaterThanOrEqual(13);
  const routeMetadataFontSize = await page
    .getByRole("button", { name: /Pine Hill Trail/ })
    .locator("small")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(routeMetadataFontSize).toBeGreaterThanOrEqual(13);
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
  await expect(page.getByText("Global elevation terrain")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Ellipsoid preview/)).toHaveCount(0);
  await expect(page.locator(".cesium-viewer-bottom")).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Search trails from the internet" })
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
    page.getByRole("searchbox", { name: "Search trails from the internet" }),
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

test("searches the internet and previews OpenStreetMap trail geometry", async ({
  page,
}) => {

  await page.route("**/api/v1/trails/search?q=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query: "Appalachian Trail",
        attribution: "© OpenStreetMap contributors",
        attributionUrl: "https://www.openstreetmap.org/copyright",
        items: [
          {
            id: "osm-way-249315063",
            name: "Appalachian Trail",
            location: "Salisbury, Connecticut, United States",
            distanceMiles: 0.68,
            geometry: {
              type: "LineString",
              coordinates: [
                [-73.4009, 41.977],
                [-73.4013, 41.9784],
                [-73.4082, 41.98],
              ],
            },
            source: "OpenStreetMap via Nominatim",
            sourceUrl: "https://www.openstreetmap.org/way/249315063",
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "Search trails from the internet" })
    .fill("Appalachian Trail");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("button", { name: /^Appalachian Trail Salisbury/ })
    .click();

  await expect(
    page.getByRole("heading", { name: "Appalachian Trail" }),
  ).toBeVisible();
  await expect(
    page.getByLabel(
      "Interactive 3D map previewing internet trail Appalachian Trail",
    ),
  ).toBeVisible();
  await expect(page.getByText(/Preview geometry only/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open trail in OpenStreetMap" }),
  ).toHaveAttribute("href", /openstreetmap.org\/way\/249315063/);
  await expect(
    page.getByRole("button", { name: "Start field session" }),
  ).toBeDisabled();
});