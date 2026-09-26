import { useEffect, useRef, useState } from "react";
import type {
  InternetTrailResult,
  RouteFeature,
} from "@probably-this-way/contracts";
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
  HeadingPitchRange,
  Ion,
  LabelStyle,
  Math as CesiumMath,
  Terrain,
  VerticalOrigin,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

type MapStatus = "starting" | "ready" | "fallback" | "error";
type TerrainMapProps = {
  routes: RouteFeature[];
  selectedRouteId?: string;
  recommendedRouteId?: string;
  recommendationSuitability?: number;
  internetTrail?: InternetTrailResult;
};

export function TerrainMap({
  routes,
  selectedRouteId,
  recommendedRouteId,
  recommendationSuitability,
  internetTrail,
}: TerrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const routeEntityIdsRef = useRef<string[]>([]);
  const usesWorldTerrainRef = useRef(false);
  const focusedRecommendationRef = useRef<string | undefined>(undefined);
  const focusedInternetTrailRef = useRef<string | undefined>(undefined);
  const [status, setStatus] = useState<MapStatus>("starting");

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    let statusTimer: number | undefined;
    const updateStatus = (nextStatus: MapStatus) => {
      statusTimer = window.setTimeout(() => setStatus(nextStatus), 0);
    };
    const token = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN?.trim();
    usesWorldTerrainRef.current = Boolean(token);
    if (token) Ion.defaultAccessToken = token;
    try {
      const viewer = new Viewer(containerRef.current, {
        animation: false,
        baseLayer: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        terrain: token
          ? Terrain.fromWorldTerrain({ requestVertexNormals: true })
          : undefined,
        requestRenderMode: true,
        maximumRenderTimeChange: Number.POSITIVE_INFINITY,
      });
      viewerRef.current = viewer;
      viewer.scene.globe.baseColor = Color.fromCssColorString("#10241c");
      viewer.scene.globe.enableLighting = Boolean(token);
      viewer.scene.globe.depthTestAgainstTerrain = Boolean(token);
      viewer.scene.backgroundColor = Color.fromCssColorString("#07110e");
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(-71.888, 42.4848, 4_500),
        orientation: {
          heading: CesiumMath.toRadians(8),
          pitch: CesiumMath.toRadians(-38),
          roll: 0,
        },
        duration: 0,
      });
      updateStatus(token ? "ready" : "fallback");
    } catch (error) {
      console.error("Unable to initialize Cesium", error);
      updateStatus("error");
    }
    return () => {
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
      if (viewerRef.current && !viewerRef.current.isDestroyed())
        viewerRef.current.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || status === "starting") return;
    routeEntityIdsRef.current.forEach((id) => viewer.entities.removeById(id));
    routeEntityIdsRef.current = [];
    const routePriority = (route: RouteFeature) =>
      route.properties.id === recommendedRouteId
        ? 2
        : route.properties.id === selectedRouteId
          ? 1
          : 0;
    [...routes]
      .sort((left, right) => routePriority(left) - routePriority(right))
      .forEach((route) => {
        const active = route.properties.id === selectedRouteId;
        const recommended = route.properties.id === recommendedRouteId;
        const id = `route-${route.properties.id}`;
        routeEntityIdsRef.current.push(id);
        const color = recommended ? "#b7ff6a" : active ? "#ff5c35" : "#8c9b75";
        viewer.entities.add({
          id,
          name: route.properties.name,
          polyline: {
            positions: Cartesian3.fromDegreesArrayHeights(
              route.geometry.coordinates.flat(),
            ),
            width: recommended ? 7 : active ? 5 : 3,
            material: Color.fromCssColorString(color).withAlpha(
              recommended || active ? 1 : 0.62,
            ),
            clampToGround: usesWorldTerrainRef.current,
          },
        });
      });

    const internetLines = internetTrail
      ? internetTrail.geometry.type === "LineString"
        ? [internetTrail.geometry.coordinates]
        : internetTrail.geometry.coordinates
      : [];
    internetLines.forEach((line, index) => {
      const id = "internet-trail-" + index;
      routeEntityIdsRef.current.push(id);
      viewer.entities.add({
        id,
        name: internetTrail?.name,
        polyline: {
          positions: Cartesian3.fromDegreesArray(line.flat()),
          width: 6,
          material: Color.fromCssColorString("#ff5c35"),
          clampToGround: usesWorldTerrainRef.current,
        },
      });
    });
    const focusRoute = routes.find(
      (route) =>
        route.properties.id === (recommendedRouteId ?? selectedRouteId),
    );
    const endpoint = focusRoute?.geometry.coordinates.at(-1);
    if (focusRoute && endpoint) {
      const recommended = focusRoute.properties.id === recommendedRouteId;
      const scoreText =
        recommended && recommendationSuitability !== undefined
          ? `  ·  ${Math.round(recommendationSuitability * 100)}% FIT`
          : "";
      const id = "focus-route-label";
      routeEntityIdsRef.current.push(id);
      viewer.entities.add({
        id,
        position: Cartesian3.fromDegrees(
          endpoint[0],
          endpoint[1],
          usesWorldTerrainRef.current ? 0 : endpoint[2],
        ),
        label: {
          text: `${recommended ? "RECOMMENDED  ·  " : ""}${focusRoute.properties.name.toUpperCase()}${scoreText}`,
          font: "500 12px DM Mono",
          fillColor: Color.fromCssColorString("#e7eadf"),
          outlineColor: Color.fromCssColorString("#07110e"),
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -14),
        },
        point: {
          color: Color.fromCssColorString(recommended ? "#b7ff6a" : "#ff5c35"),
          outlineColor: Color.fromCssColorString("#e7eadf"),
          outlineWidth: 2,
          pixelSize: recommended ? 13 : 11,
        },
      });
    }

    const internetCoordinates = internetLines.flat();
    const internetEndpoint = internetCoordinates.at(-1);
    if (internetTrail && internetEndpoint) {
      const id = "internet-trail-label";
      routeEntityIdsRef.current.push(id);
      viewer.entities.add({
        id,
        position: Cartesian3.fromDegrees(
          internetEndpoint[0],
          internetEndpoint[1],
        ),
        label: {
          text: "INTERNET PREVIEW  ·  " + internetTrail.name.toUpperCase(),
          font: "500 12px DM Mono",
          fillColor: Color.fromCssColorString("#e7eadf"),
          outlineColor: Color.fromCssColorString("#07110e"),
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -14),
        },
        point: {
          color: Color.fromCssColorString("#ff5c35"),
          outlineColor: Color.fromCssColorString("#e7eadf"),
          outlineWidth: 2,
          pixelSize: 11,
        },
      });
      if (focusedInternetTrailRef.current !== internetTrail.id) {
        focusedInternetTrailRef.current = internetTrail.id;
        const sphere = BoundingSphere.fromPoints(
          internetCoordinates.map(([longitude, latitude]) =>
            Cartesian3.fromDegrees(longitude, latitude),
          ),
        );
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        viewer.camera.flyToBoundingSphere(sphere, {
          duration: reduceMotion ? 0 : 1.6,
          offset: new HeadingPitchRange(
            CesiumMath.toRadians(8),
            CesiumMath.toRadians(-48),
            Math.max(1_000, sphere.radius * 3.2),
          ),
        });
      }
    }
    if (
      recommendedRouteId &&
      focusRoute &&
      focusedRecommendationRef.current !== recommendedRouteId
    ) {
      focusedRecommendationRef.current = recommendedRouteId;
      const positions = focusRoute.geometry.coordinates.map(
        ([longitude, latitude, height]) =>
          Cartesian3.fromDegrees(longitude, latitude, height),
      );
      const sphere = BoundingSphere.fromPoints(positions);
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      viewer.camera.flyToBoundingSphere(sphere, {
        duration: reduceMotion ? 0 : 1.6,
        offset: new HeadingPitchRange(
          CesiumMath.toRadians(8),
          CesiumMath.toRadians(-48),
          Math.max(1_500, sphere.radius * 3.2),
        ),
      });
    }
    viewer.scene.requestRender();
  }, [
    routes,
    selectedRouteId,
    recommendedRouteId,
    recommendationSuitability,
    internetTrail,
    status,
  ]);

  const focusedName =
    internetTrail?.name ??
    routes.find(
      (route) =>
        route.properties.id === (recommendedRouteId ?? selectedRouteId),
    )?.properties.name;
  const internetFirstCoordinate =
    internetTrail?.geometry.type === "LineString"
      ? internetTrail.geometry.coordinates[0]
      : internetTrail?.geometry.coordinates[0]?.[0];
  return (
    <div className="terrain-map">
      <div
        ref={containerRef}
        className="cesium-host"
        aria-label={
          internetTrail
            ? "Interactive 3D map previewing internet trail " +
              internetTrail.name
            : recommendedRouteId
              ? "Interactive 3D map highlighting recommended route " +
                focusedName
              : "Interactive 3D route alternatives map"
        }
      />
      <div className="map-meta">
        <span>
          {internetFirstCoordinate
            ? Math.abs(internetFirstCoordinate[1]).toFixed(2) +
              "° " +
              (internetFirstCoordinate[1] >= 0 ? "N" : "S")
            : "42.49° N"}
        </span>
        <span>
          {internetFirstCoordinate
            ? Math.abs(internetFirstCoordinate[0]).toFixed(2) +
              "° " +
              (internetFirstCoordinate[0] >= 0 ? "E" : "W")
            : "71.89° W"}
        </span>
      </div>
      <div className="map-mode" data-status={status}>
        <span />
        {status === "starting" ? "Initializing terrain" : null}
        {status === "ready" ? "World Terrain online" : null}
        {status === "fallback"
          ? "Ellipsoid preview · add ion token for terrain"
          : null}
        {status === "error" ? "Map unavailable" : null}
      </div>
      <div className="map-caption">
        {focusedName ?? "Loading route alternatives"}
        <span>
          {internetTrail
            ? "Orange internet preview · not yet evaluated"
            : recommendedRouteId
              ? "Signal green recommended · orange original"
              : "Orange selected · moss alternatives"}
        </span>
      </div>
    </div>
  );
}
