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
  await page.route("https://elevation3d.arcgis.com/**", (route) =>
    route.abort(),
  );
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Wachusett Summit Access Trails" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Massachusetts DCR trail geometry" }),
  ).toHaveAttribute("href", /mass\.gov/);
  const searchFontSize = await page
    .getByRole("searchbox", { name: "Search trails from the internet" })
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
  expect(searchFontSize).toBeGreaterThanOrEqual(13);
  const routeMetadataFontSize = await page
    .getByRole("button", { name: /Pine Hill Trail/ })
    .locator("small")
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
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
  await expect(
    page.getByRole("button", { name: "Frame 3D terrain" }),
  ).toBeEnabled();
  await expect(page.locator(".map-mode")).toContainText("3D");
  const cesiumAsset = await page.request.get(
    "/cesiumStatic/Assets/Textures/SkyBox/tycho2t3_80_px.jpg",
  );
  expect(cesiumAsset.ok()).toBe(true);
  expect(cesiumAsset.headers()["content-type"]).toContain("image/jpeg");

  const viewport = page.viewportSize();
  if (viewport && viewport.width < 600) {
    const mapBox = await page.locator(".map-stage").boundingBox();
    const panelBox = await page.locator(".mission-panel").boundingBox();
    expect(mapBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(mapBox!.y).toBeLessThan(panelBox!.y);
  }
  await page
    .getByRole("button", { name: "Start field session" })
    .dispatchEvent("click");

  await expect(page.getByText("Recommendation ready")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Current route recommendation" }),
  ).toContainText("Pine Hill Trail");
  await expect(
    page.getByRole("region", { name: "Current hiking state" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search trails from the internet" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Decision signal" }),
  ).toBeVisible();
  await expect(page.getByText("Initial route signal")).toBeVisible();
  await expect(
    page.getByLabel(/highlighting recommended route Pine Hill Trail/),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "End field session" }),
  ).toBeVisible();
  await page.evaluate(() => window.location.replace("about:blank"));
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
        query: "Newton Hill, Worcester, MA, USA",
        attribution: "© OpenStreetMap contributors",
        attributionUrl: "https://www.openstreetmap.org/copyright",
        items: [
          {
            id: "osm-nearby-node-358271617",
            name: "Trails at Newton Hill",
            location:
              "Worcester, Worcester County, Massachusetts, United States",
            distanceMiles: 0.42,
            geometry: {
              type: "LineString",
              coordinates: [
                [-71.8209, 42.2676],
                [-71.8194, 42.2682],
                [-71.8178, 42.2691],
              ],
            },
            source: "OpenStreetMap via Nominatim",
            sourceUrl: "https://www.openstreetmap.org/node/358271617",
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "Search trails from the internet" })
    .fill("Newton Hill, Worcester, MA, USA");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("button", { name: /^Trails at Newton Hill Worcester/ })
    .click();

  await expect(
    page.getByRole("heading", { name: "Trails at Newton Hill" }),
  ).toBeVisible();
  await expect(
    page.getByLabel(
      "Interactive 3D map previewing internet trail Trails at Newton Hill",
    ),
  ).toBeVisible();
  await expect(page.getByText(/Preview geometry only/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open trail in OpenStreetMap" }),
  ).toHaveAttribute("href", /openstreetmap.org\/node\/358271617/);
  await expect(
    page.getByRole("button", { name: "Start field session" }),
  ).toBeDisabled();
});
