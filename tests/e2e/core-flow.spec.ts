import { expect, test, type Page } from "@playwright/test";

const newtonHill = {
  id: "osm-newton-hill",
  name: "Trails at Newton Hill",
  location: "Worcester, Worcester County, Massachusetts, United States",
  distanceMiles: 0.78,
  geometry: {
    type: "MultiLineString" as const,
    coordinates: [
      [
        [-71.8209, 42.2676],
        [-71.8194, 42.2682],
        [-71.8178, 42.2691],
      ],
      [
        [-71.8194, 42.2682],
        [-71.8187, 42.2671],
        [-71.8179, 42.2664],
      ],
    ],
  },
  source: "OpenStreetMap via Nominatim" as const,
  sourceUrl: "https://www.openstreetmap.org/node/358271617",
};

async function mockTrailSearch(
  page: Page,
  items: Array<Record<string, unknown>> = [newtonHill],
) {
  await page.route("**/api/v1/trails/search?q=*", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query: url.searchParams.get("q") ?? "",
        attribution: "© OpenStreetMap contributors",
        attributionUrl: "https://www.openstreetmap.org/copyright",
        items,
      }),
    });
  });
}

async function selectNewtonHill(page: Page) {
  await page
    .getByRole("searchbox", { name: "Search trails from the internet" })
    .fill("Newton Hill, Worcester, MA, USA");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("button", { name: /^Trails at Newton Hill Worcester/ })
    .click();
}

test("searches, starts, evaluates, frames, and ends a Newton Hill trail", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await mockTrailSearch(page);
  await page.route("https://elevation3d.arcgis.com/**", (route) =>
    route.abort(),
  );
  await page.goto("/");

  await expect(page.getByText("Search for your trail")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Pine Hill Trail/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Mountain House Trail/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Harrington Trail/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /simulation/i })).toHaveCount(
    0,
  );

  const collapse = page.getByRole("button", { name: "Collapse trail panel" });
  await collapse.click();
  await expect(page.locator("#trail-control-panel")).toBeHidden();
  await page.getByRole("button", { name: "Open trail panel" }).click();
  await expect(page.locator("#trail-control-panel")).toBeVisible();

  const searchFontSize = await page
    .getByRole("searchbox", { name: "Search trails from the internet" })
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
  expect(searchFontSize).toBeGreaterThanOrEqual(16);

  await selectNewtonHill(page);
  await expect(
    page.getByRole("heading", { name: "Trails at Newton Hill" }),
  ).toBeVisible();
  await expect(
    page.getByLabel(
      "Interactive 3D map previewing internet trail Trails at Newton Hill",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/unverified access and elevation/i),
  ).toBeVisible();
  await expect(
    page.getByText(/Start this trail to request structured route scores/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Analyze & start this trail" }),
  ).toBeEnabled();

  const frameButton = page.getByRole("button", { name: "Frame 3D terrain" });
  await expect(frameButton).toBeEnabled();
  await frameButton.click();
  await expect(page.locator(".cesium-widget canvas")).toBeVisible();
  const captionPosition = await page
    .locator(".map-caption")
    .evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top, viewport: window.innerHeight };
    });
  expect(captionPosition.top).toBeLessThan(captionPosition.viewport / 2);

  const cesiumAsset = await page.request.get(
    "/cesiumStatic/Assets/Textures/SkyBox/tycho2t3_80_px.jpg",
  );
  expect(cesiumAsset.ok()).toBe(true);
  expect(cesiumAsset.headers()["content-type"]).toContain("image/jpeg");

  await page
    .getByRole("button", { name: "Analyze & start this trail" })
    .click();
  await expect(page.getByText("Recommendation ready")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Deterministic fallback scores" }),
  ).toBeVisible();
  await expect(page.getByText("2 routes evaluated")).toBeVisible();
  await expect(
    page.getByLabel("Evaluated route scores").locator("article"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("region", { name: "Current route recommendation" }),
  ).toContainText("Trails at Newton Hill");
  await expect(
    page.getByRole("region", { name: "Current hiking state" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Decision signal" }),
  ).toBeVisible();
  await expect(
    page.getByLabel(/highlighting recommended route Trails at Newton Hill/),
  ).toBeVisible();

  const playback = page.getByRole("region", {
    name: "Animated route preview",
  });
  const playbackProgress = page.getByRole("progressbar", {
    name: "Route preview progress",
  });
  await expect(playback).toBeVisible();
  await expect(playback).toContainText("Animated guide · not live GPS");
  await expect
    .poll(async () => Number(await playbackProgress.getAttribute("aria-valuenow")))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause preview" }).click();
  await expect(playback).toContainText("Preview paused");
  const pausedProgress = await playbackProgress.getAttribute("aria-valuenow");
  await page.waitForTimeout(300);
  await expect(playbackProgress).toHaveAttribute(
    "aria-valuenow",
    pausedProgress ?? "0",
  );
  await page.getByRole("button", { name: "Resume preview" }).click();
  await expect(playback).toContainText("Moving to trail end");
  await page.getByRole("button", { name: "Replay from start" }).click();
  await expect
    .poll(async () => Number(await playbackProgress.getAttribute("aria-valuenow")))
    .toBeLessThan(10);

  await page.getByRole("button", { name: "End field session" }).click();
  await expect(page.getByText("Search for your trail")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trails at Newton Hill" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Analyze & start trail" }),
  ).toBeVisible();
});

test("surfaces stale environmental state for a searched trail", async ({
  page,
}) => {
  await mockTrailSearch(page);
  await page.route("https://elevation3d.arcgis.com/**", (route) =>
    route.abort(),
  );
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
  await selectNewtonHill(page);
  await page
    .getByRole("button", { name: "Analyze & start this trail" })
    .click();

  await expect(page.getByText("Refresh failed")).toBeVisible();
  await expect(page.getByText("Showing last valid observation")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Current hiking state" }),
  ).toContainText("54");
});

test("can replace a Worcester search with another Worcester trail", async ({
  page,
}) => {
  const cascadingWaters = {
    ...newtonHill,
    id: "osm-cascading-waters",
    name: "Cascading Waters",
    sourceUrl: "https://www.openstreetmap.org/way/1001",
    geometry: {
      type: "LineString" as const,
      coordinates: [
        [-71.859, 42.245],
        [-71.857, 42.246],
      ],
    },
  };
  await mockTrailSearch(page, [cascadingWaters]);
  await page.route("https://elevation3d.arcgis.com/**", (route) =>
    route.abort(),
  );
  await page.goto("/");

  await page
    .getByRole("searchbox", { name: "Search trails from the internet" })
    .fill("Cascading Waters, Worcester, MA, USA");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("button", { name: /^Cascading Waters Worcester/ })
    .click();

  await expect(
    page.getByRole("heading", { name: "Cascading Waters" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Analyze & start this trail" }),
  ).toBeEnabled();
});
