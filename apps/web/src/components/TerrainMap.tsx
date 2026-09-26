import { useEffect, useRef, useState } from "react";
import type {
  InternetTrailResult,
  RouteFeature,
} from "@probably-this-way/contracts";
import {
  ArcGISTiledElevationTerrainProvider,
  BoundingSphere,
  Cartesian3,
  Cartographic,
  Color,
  HeadingPitchRange,
  HeightReference,
  Ion,
  Material,
  Math as CesiumMath,
  Terrain,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

type MapCoordinate = readonly [number, number, number?];

function frameTerrainCoordinates(
  viewer: Viewer,
  coordinates: readonly MapCoordinate[],
  duration: number,
): void {
  if (coordinates.length === 0) return;
  const positions = coordinates.map(([longitude, latitude, suppliedHeight]) => {
    const sampledHeight = viewer.scene.globe.getHeight(
      Cartographic.fromDegrees(longitude, latitude),
    );
    const surfaceHeight =
      sampledHeight !== undefined
        ? sampledHeight + 45
        : Math.max(suppliedHeight ?? 0, 800);
    return Cartesian3.fromDegrees(longitude, latitude, surfaceHeight);
  });
  const sphere = BoundingSphere.fromPoints(positions);
  viewer.camera.flyToBoundingSphere(sphere, {
    duration,
    offset: new HeadingPitchRange(
      CesiumMath.toRadians(16),
      CesiumMath.toRadians(-34),
      Math.max(2_800, sphere.radius * 5.2),
    ),
    complete: () => viewer.scene.requestRender(),
  });
}
type MapStatus = "starting" | "cesium" | "global" | "error";
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
  const usesElevationTerrainRef = useRef(false);
  const focusedRecommendationRef = useRef<string | undefined>(undefined);
  const focusedInternetTrailRef = useRef<string | undefined>(undefined);
  const [status, setStatus] = useState<MapStatus>("starting");

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    let statusTimer: number | undefined;
    let removeTerrainReady: (() => void) | undefined;
    let removeTerrainError: (() => void) | undefined;
    let removeProviderError: (() => void) | undefined;
    const updateStatus = (nextStatus: MapStatus) => {
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(() => setStatus(nextStatus), 0);
    };
    const token = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN?.trim();
    usesElevationTerrainRef.current = true;
    if (token) Ion.defaultAccessToken = token;
    try {
      const terrain = token
        ? Terrain.fromWorldTerrain({ requestVertexNormals: true })
        : new Terrain(
            ArcGISTiledElevationTerrainProvider.fromUrl(
              "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer",
            ),
          );
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
        terrain,
        requestRenderMode: true,
        maximumRenderTimeChange: Number.POSITIVE_INFINITY,
      });
      viewerRef.current = viewer;
      viewer.scene.globe.baseColor = Color.fromCssColorString("#10241c");
      viewer.scene.globe.maximumScreenSpaceError = 4;
      viewer.scene.verticalExaggeration = 1.8;
      const contourMaterial = Material.fromType(Material.ElevationContourType);
      contourMaterial.uniforms.color =
        Color.fromCssColorString("#a7bd88").withAlpha(0.42);
      contourMaterial.uniforms.spacing = 20;
      contourMaterial.uniforms.width = 1.25;
      viewer.scene.globe.material = contourMaterial;
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.backgroundColor = Color.fromCssColorString("#07110e");
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(-71.888, 42.4848, 4_500),
        orientation: {
          heading: CesiumMath.toRadians(8),
          pitch: CesiumMath.toRadians(-30),
          roll: 0,
        },
        duration: 0,
      });
      const handleTerrainReady = () => {
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.depthTestAgainstTerrain = true;
        removeProviderError = terrain.provider.errorEvent.addEventListener(
          (error) => {
            console.warn("Terrain tile request failed", error);
          },
        );
        updateStatus(token ? "cesium" : "global");
        viewer.scene.requestRender();
      };
      removeTerrainReady =
        terrain.readyEvent.addEventListener(handleTerrainReady);
      removeTerrainError = terrain.errorEvent.addEventListener((error) => {
        console.error("Unable to load elevation terrain", error);
        usesElevationTerrainRef.current = false;
        updateStatus("error");
      });
      if (terrain.ready) handleTerrainReady();
    } catch (error) {
      console.error("Unable to initialize Cesium", error);
      updateStatus("error");
    }
    return () => {
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
      removeTerrainReady?.();
      removeTerrainError?.();
      removeProviderError?.();
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
            clampToGround: true,
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
          clampToGround: true,
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
      const id = "focus-route-label";
      routeEntityIdsRef.current.push(id);
      viewer.entities.add({
        id,
        position: Cartesian3.fromDegrees(
          endpoint[0],
          endpoint[1],
          usesElevationTerrainRef.current ? 0 : endpoint[2],
        ),
        point: {
          color: Color.fromCssColorString(recommended ? "#b7ff6a" : "#ff5c35"),
          outlineColor: Color.fromCssColorString("#e7eadf"),
          outlineWidth: 2,
          pixelSize: recommended ? 13 : 11,
          heightReference: HeightReference.CLAMP_TO_GROUND,
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
        point: {
          color: Color.fromCssColorString("#ff5c35"),
          outlineColor: Color.fromCssColorString("#e7eadf"),
          outlineWidth: 2,
          pixelSize: 11,
          heightReference: HeightReference.CLAMP_TO_GROUND,
        },
      });
      if (focusedInternetTrailRef.current !== internetTrail.id) {
        focusedInternetTrailRef.current = internetTrail.id;
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        frameTerrainCoordinates(
          viewer,
          internetCoordinates,
          reduceMotion ? 0 : 1.2,
        );
      }
    }
    if (
      recommendedRouteId &&
      focusRoute &&
      focusedRecommendationRef.current !== recommendedRouteId
    ) {
      focusedRecommendationRef.current = recommendedRouteId;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      frameTerrainCoordinates(
        viewer,
        focusRoute.geometry.coordinates,
        reduceMotion ? 0 : 1.2,
      );
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

  function showObliqueView() {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const internetCoordinates = internetTrail
      ? internetTrail.geometry.type === "LineString"
        ? internetTrail.geometry.coordinates
        : internetTrail.geometry.coordinates.flat()
      : [];
    const focusRoute = routes.find(
      (route) =>
        route.properties.id === (recommendedRouteId ?? selectedRouteId),
    );
    const coordinates =
      internetCoordinates.length > 0
        ? internetCoordinates
        : (focusRoute?.geometry.coordinates ?? []);
    if (coordinates.length === 0) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    frameTerrainCoordinates(viewer, coordinates, reduceMotion ? 0 : 1.2);
  }
  const focusedRoute = routes.find(
    (route) => route.properties.id === (recommendedRouteId ?? selectedRouteId),
  );
  const focusedName = internetTrail?.name ?? focusedRoute?.properties.name;
  const mapFirstCoordinate =
    internetTrail?.geometry.type === "LineString"
      ? internetTrail.geometry.coordinates[0]
      : (internetTrail?.geometry.coordinates[0]?.[0] ??
        focusedRoute?.geometry.coordinates[0]);
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
          {mapFirstCoordinate
            ? Math.abs(mapFirstCoordinate[1]).toFixed(2) +
              "° " +
              (mapFirstCoordinate[1] >= 0 ? "N" : "S")
            : "42.49° N"}
        </span>
        <span>
          {mapFirstCoordinate
            ? Math.abs(mapFirstCoordinate[0]).toFixed(2) +
              "° " +
              (mapFirstCoordinate[0] >= 0 ? "E" : "W")
            : "71.89° W"}
        </span>
      </div>
      <div className="map-mode" data-status={status}>
        <span />
        {status === "starting" ? "Initializing 3D terrain" : null}
        {status === "cesium" ? "3D · Cesium World Terrain" : null}
        {status === "global" ? "3D · Global elevation terrain" : null}
        {status === "error" ? "3D ellipsoid · elevation unavailable" : null}
      </div>
      <div className="map-3d-controls">
        <button
          type="button"
          disabled={status === "starting"}
          onClick={showObliqueView}
        >
          Frame 3D terrain
        </button>
        <span>Drag to orbit · wheel to zoom</span>
      </div>
      <div className="map-caption">
        <strong>
          {internetTrail
            ? `Preview · ${focusedName}`
            : recommendedRouteId
              ? `Recommended · ${focusedName}`
              : (focusedName ?? "Search for a trail")}
        </strong>
        <span>
          {internetTrail
            ? "Orange geometry · not yet evaluated"
            : recommendedRouteId
              ? `${recommendationSuitability === undefined ? "" : `${Math.round(recommendationSuitability * 100)}% fit · `}signal green route`
              : "Orange selected · moss alternatives"}
        </span>
      </div>
    </div>
  );
}
