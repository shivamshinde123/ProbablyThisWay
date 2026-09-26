import { useCallback, useEffect, useRef, useState } from "react";
import type {
  InternetTrailResult,
  RouteEvaluation,
  RouteFeature,
  RouteRecommendation,
} from "@probably-this-way/contracts";
import {
  ArcGISTiledElevationTerrainProvider,
  BoundingSphere,
  Cartesian3,
  Cartographic,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  HeadingPitchRange,
  HeightReference,
  Ion,
  Material,
  Math as CesiumMath,
  PolylineGlowMaterialProperty,
  Terrain,
  VerticalOrigin,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

type MapCoordinate = readonly [number, number, number?];
type PlaybackState = "idle" | "playing" | "paused" | "complete";
type PlaybackVisual = {
  coordinates: readonly MapCoordinate[];
  markerPosition: ConstantPositionProperty;
  markerRotation: ConstantProperty;
  haloPosition: ConstantPositionProperty;
  haloSize: ConstantProperty;
  progressPositions: ConstantProperty;
};

const ROUTE_PLAYBACK_DURATION_MS = 16_000;
const ROUTE_POINTER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='52' viewBox='0 0 44 52'%3E%3Cpath d='M22 2 40 46 22 38 4 46Z' fill='%2307110e' stroke='%23e7eadf' stroke-width='3'/%3E%3Cpath d='M22 8 33 38 22 33 11 38Z' fill='%23b7ff6a'/%3E%3Ccircle cx='22' cy='34' r='3' fill='%23ff5c35'/%3E%3C/svg%3E";

function segmentLength(start: MapCoordinate, end: MapCoordinate): number {
  const averageLatitude = CesiumMath.toRadians((start[1] + end[1]) / 2);
  const longitude = (end[0] - start[0]) * Math.cos(averageLatitude);
  const latitude = end[1] - start[1];
  return Math.hypot(longitude, latitude);
}

function sampleRoute(
  coordinates: readonly MapCoordinate[],
  progress: number,
): {
  coordinate: MapCoordinate;
  completed: MapCoordinate[];
  rotation: number;
} {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  if (coordinates.length < 2) {
    const coordinate = coordinates[0] ?? [0, 0, 0];
    return {
      coordinate,
      completed: [coordinate, coordinate],
      rotation: 0,
    };
  }

  const lengths = coordinates
    .slice(1)
    .map((coordinate, index) => segmentLength(coordinates[index]!, coordinate));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const target = totalLength * boundedProgress;
  let traversed = 0;

  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index]!;
    const start = coordinates[index]!;
    const end = coordinates[index + 1]!;
    if (traversed + length >= target || index === lengths.length - 1) {
      const segmentProgress =
        length === 0 ? 0 : Math.min(1, (target - traversed) / length);
      const coordinate: MapCoordinate = [
        start[0] + (end[0] - start[0]) * segmentProgress,
        start[1] + (end[1] - start[1]) * segmentProgress,
        (start[2] ?? 0) + ((end[2] ?? 0) - (start[2] ?? 0)) * segmentProgress,
      ];
      const completed = [...coordinates.slice(0, index + 1), coordinate];
      if (completed.length === 1) completed.push(coordinate);
      const averageLatitude = CesiumMath.toRadians((start[1] + end[1]) / 2);
      const bearing = Math.atan2(
        (end[0] - start[0]) * Math.cos(averageLatitude),
        end[1] - start[1],
      );
      return { coordinate, completed, rotation: -bearing };
    }
    traversed += length;
  }

  const coordinate = coordinates.at(-1)!;
  return {
    coordinate,
    completed: [...coordinates],
    rotation: 0,
  };
}

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
  evaluation?: RouteEvaluation;
  recommendation?: RouteRecommendation;
  onShowModelResponse?: () => void;
  internetTrail?: InternetTrailResult;
};

export function TerrainMap({
  routes,
  selectedRouteId,
  recommendedRouteId,
  recommendationSuitability,
  evaluation,
  recommendation,
  onShowModelResponse,
  internetTrail,
}: TerrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const routeEntityIdsRef = useRef<string[]>([]);
  const playbackEntityIdsRef = useRef<string[]>([]);
  const playbackVisualRef = useRef<PlaybackVisual | undefined>(undefined);
  const playbackFrameRef = useRef<number | undefined>(undefined);
  const playbackElapsedRef = useRef(0);
  const playbackProgressRef = useRef(0);
  const usesElevationTerrainRef = useRef(false);
  const focusedRecommendationRef = useRef<string | undefined>(undefined);
  const focusedInternetTrailRef = useRef<string | undefined>(undefined);
  const [status, setStatus] = useState<MapStatus>("starting");
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackRun, setPlaybackRun] = useState(0);

  const updatePlaybackVisual = useCallback((progress: number) => {
    const viewer = viewerRef.current;
    const visual = playbackVisualRef.current;
    if (!viewer || viewer.isDestroyed() || !visual) return;
    const sample = sampleRoute(visual.coordinates, progress);
    const position = Cartesian3.fromDegrees(
      sample.coordinate[0],
      sample.coordinate[1],
      usesElevationTerrainRef.current ? 0 : sample.coordinate[2],
    );
    visual.markerPosition.setValue(position);
    visual.haloPosition.setValue(position);
    visual.markerRotation.setValue(sample.rotation);
    visual.haloSize.setValue(30 + Math.sin(progress * Math.PI * 14) * 5);
    visual.progressPositions.setValue(
      Cartesian3.fromDegreesArray(
        sample.completed.flatMap(([longitude, latitude]) => [
          longitude,
          latitude,
        ]),
      ),
    );
    viewer.scene.requestRender();
  }, []);

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
      const cameraController = viewer.scene.screenSpaceCameraController;
      cameraController.enableInputs = true;
      cameraController.enableRotate = true;
      cameraController.enableTranslate = true;
      cameraController.enableZoom = true;
      cameraController.enableTilt = true;
      cameraController.enableLook = true;
      cameraController.minimumZoomDistance = 20;
      cameraController.maximumZoomDistance = 20_000_000;
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
      if (playbackFrameRef.current !== undefined)
        window.cancelAnimationFrame(playbackFrameRef.current);
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
    playbackEntityIdsRef.current.forEach((id) =>
      viewer.entities.removeById(id),
    );
    routeEntityIdsRef.current = [];
    playbackEntityIdsRef.current = [];
    playbackVisualRef.current = undefined;
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

    if (focusRoute && focusRoute.properties.id === recommendedRouteId) {
      const initial = sampleRoute(
        focusRoute.geometry.coordinates,
        playbackProgressRef.current,
      );
      const initialPosition = Cartesian3.fromDegrees(
        initial.coordinate[0],
        initial.coordinate[1],
        usesElevationTerrainRef.current ? 0 : initial.coordinate[2],
      );
      const markerPosition = new ConstantPositionProperty(initialPosition);
      const haloPosition = new ConstantPositionProperty(initialPosition);
      const markerRotation = new ConstantProperty(initial.rotation);
      const haloSize = new ConstantProperty(30);
      const progressPositions = new ConstantProperty(
        Cartesian3.fromDegreesArray(
          initial.completed.flatMap(([longitude, latitude]) => [
            longitude,
            latitude,
          ]),
        ),
      );
      const progressId = "route-playback-progress";
      const haloId = "route-playback-halo";
      const markerId = "route-playback-marker";
      playbackEntityIdsRef.current.push(progressId, haloId, markerId);
      viewer.entities.add({
        id: progressId,
        polyline: {
          positions: progressPositions,
          width: 11,
          material: new PolylineGlowMaterialProperty({
            color: Color.fromCssColorString("#d8ff9f"),
            glowPower: 0.24,
            taperPower: 0.72,
          }),
          clampToGround: true,
        },
      });
      viewer.entities.add({
        id: haloId,
        position: haloPosition,
        point: {
          color: Color.fromCssColorString("#b7ff6a").withAlpha(0.18),
          outlineColor: Color.fromCssColorString("#b7ff6a").withAlpha(0.58),
          outlineWidth: 2,
          pixelSize: haloSize,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      viewer.entities.add({
        id: markerId,
        position: markerPosition,
        billboard: {
          image: ROUTE_POINTER_IMAGE,
          width: 31,
          height: 37,
          rotation: markerRotation,
          verticalOrigin: VerticalOrigin.CENTER,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      playbackVisualRef.current = {
        coordinates: focusRoute.geometry.coordinates,
        markerPosition,
        markerRotation,
        haloPosition,
        haloSize,
        progressPositions,
      };
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
    if (playbackVisualRef.current)
      updatePlaybackVisual(playbackProgressRef.current);
    viewer.scene.requestRender();
  }, [
    routes,
    selectedRouteId,
    recommendedRouteId,
    recommendationSuitability,
    internetTrail,
    status,
    updatePlaybackVisual,
  ]);

  useEffect(() => {
    if (playbackFrameRef.current !== undefined)
      window.cancelAnimationFrame(playbackFrameRef.current);
    playbackElapsedRef.current = 0;
    playbackProgressRef.current = 0;
    updatePlaybackVisual(0);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const resetFrame = window.requestAnimationFrame(() => {
      setPlaybackProgress(0);
      setPlaybackState(
        recommendedRouteId ? (reduceMotion ? "paused" : "playing") : "idle",
      );
    });
    return () => window.cancelAnimationFrame(resetFrame);
  }, [recommendedRouteId, updatePlaybackVisual]);

  useEffect(() => {
    if (playbackState !== "playing" || !recommendedRouteId) return;
    const startedAt = performance.now() - playbackElapsedRef.current;
    let displayedPercent = Math.round(playbackProgressRef.current * 100);
    const tick = (now: number) => {
      playbackElapsedRef.current = now - startedAt;
      const progress = Math.min(
        1,
        playbackElapsedRef.current / ROUTE_PLAYBACK_DURATION_MS,
      );
      playbackProgressRef.current = progress;
      updatePlaybackVisual(progress);
      const percent = Math.round(progress * 100);
      if (percent !== displayedPercent) {
        displayedPercent = percent;
        setPlaybackProgress(progress);
      }
      if (progress >= 1) {
        setPlaybackState("complete");
        playbackFrameRef.current = undefined;
        return;
      }
      playbackFrameRef.current = window.requestAnimationFrame(tick);
    };
    playbackFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (playbackFrameRef.current !== undefined)
        window.cancelAnimationFrame(playbackFrameRef.current);
      playbackFrameRef.current = undefined;
    };
  }, [
    playbackState,
    playbackRun,
    recommendedRouteId,
    status,
    updatePlaybackVisual,
  ]);

  function toggleRoutePlayback() {
    if (!recommendedRouteId) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      playbackElapsedRef.current = ROUTE_PLAYBACK_DURATION_MS;
      playbackProgressRef.current = 1;
      setPlaybackProgress(1);
      updatePlaybackVisual(1);
      setPlaybackState("complete");
      return;
    }
    if (playbackState === "playing") {
      setPlaybackState("paused");
      return;
    }
    if (playbackState === "complete") {
      playbackElapsedRef.current = 0;
      playbackProgressRef.current = 0;
      setPlaybackProgress(0);
      updatePlaybackVisual(0);
    }
    setPlaybackState("playing");
  }

  function replayRoutePlayback() {
    if (!recommendedRouteId) return;
    playbackElapsedRef.current = 0;
    playbackProgressRef.current = 0;
    setPlaybackProgress(0);
    updatePlaybackVisual(0);
    setPlaybackRun((run) => run + 1);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    setPlaybackState(reduceMotion ? "paused" : "playing");
  }

  function moveCamera(
    operation: "zoom-in" | "zoom-out" | "left" | "right" | "up" | "down",
  ) {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const height = viewer.camera.positionCartographic.height;
    const zoomAmount = Math.max(30, Math.min(100_000, height * 0.22));
    const panAmount = Math.max(20, Math.min(50_000, height * 0.12));
    if (operation === "zoom-in") viewer.camera.zoomIn(zoomAmount);
    if (operation === "zoom-out") viewer.camera.zoomOut(zoomAmount);
    if (operation === "left") viewer.camera.moveLeft(panAmount);
    if (operation === "right") viewer.camera.moveRight(panAmount);
    if (operation === "up") viewer.camera.moveUp(panAmount);
    if (operation === "down") viewer.camera.moveDown(panAmount);
    viewer.scene.requestRender();
  }

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
  const topScore = evaluation?.scores.reduce((best, score) =>
    score.suitability > best.suitability ? score : best,
  );
  const topRouteName = routes.find(
    (route) => route.properties.id === topScore?.routeId,
  )?.properties.name;
  const providerLabel =
    evaluation?.provider === "openrouter"
      ? "OpenRouter"
      : evaluation?.provider === "jev"
        ? "Legacy Jev"
        : "Deterministic fallback";
  const decisionSteps =
    evaluation && recommendation?.status === "recommended"
      ? [
          {
            label: "Candidate scores received",
            detail: `${providerLabel} · ${evaluation.scores.length} validated ${evaluation.scores.length === 1 ? "score" : "scores"}`,
          },
          {
            label: "Score leader identified",
            detail: `${topRouteName ?? "Top candidate"} · ${Math.round((topScore?.suitability ?? 0) * 100)}% scored fit`,
          },
          {
            label: "Application policy checked",
            detail: `${recommendation.policyVersion} · ${recommendation.excludedRoutes.length} excluded`,
          },
          {
            label: "Recommended route confirmed",
            detail: `${focusedName ?? "Chosen route"} · ${Math.round(recommendation.suitability * 100)}% fit`,
          },
        ]
      : [];
  const activeDecisionStep = Math.min(
    decisionSteps.length - 1,
    Math.floor(playbackProgress * decisionSteps.length),
  );
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
          className="map-fit-control"
          type="button"
          disabled={status === "starting"}
          onClick={showObliqueView}
        >
          Frame 3D terrain
        </button>
        <div
          className="map-navigation"
          role="group"
          aria-label="Map navigation controls"
        >
          <div className="map-zoom-controls">
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              disabled={status === "starting"}
              onClick={() => moveCamera("zoom-in")}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              disabled={status === "starting"}
              onClick={() => moveCamera("zoom-out")}
            >
              −
            </button>
          </div>
          <div className="map-pan-controls">
            <button
              type="button"
              aria-label="Pan up"
              title="Pan up"
              disabled={status === "starting"}
              onClick={() => moveCamera("up")}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Pan left"
              title="Pan left"
              disabled={status === "starting"}
              onClick={() => moveCamera("left")}
            >
              ←
            </button>
            <span aria-hidden="true">PAN</span>
            <button
              type="button"
              aria-label="Pan right"
              title="Pan right"
              disabled={status === "starting"}
              onClick={() => moveCamera("right")}
            >
              →
            </button>
            <button
              type="button"
              aria-label="Pan down"
              title="Pan down"
              disabled={status === "starting"}
              onClick={() => moveCamera("down")}
            >
              ↓
            </button>
          </div>
        </div>
        <span>Drag to orbit · scroll to zoom · shift-drag to pan</span>
      </div>
      {recommendedRouteId && focusedRoute ? (
        <section
          className="route-playback"
          aria-label="Animated route preview"
          data-state={playbackState}
        >
          <div className="route-playback-heading">
            <div>
              <span className="route-playback-kicker">Route preview</span>
              <strong>
                {playbackState === "playing"
                  ? "Moving to trail end"
                  : playbackState === "paused"
                    ? "Preview paused"
                    : playbackState === "complete"
                      ? "Trail end reached"
                      : "Ready to preview"}
              </strong>
            </div>
            <span className="route-playback-percent">
              {Math.round(playbackProgress * 100)
                .toString()
                .padStart(2, "0")}
              %
            </span>
          </div>
          <div
            className="route-playback-track"
            role="progressbar"
            aria-label="Route preview progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(playbackProgress * 100)}
          >
            <span style={{ width: playbackProgress * 100 + "%" }} />
          </div>
          {decisionSteps.length > 0 ? (
            <div className="decision-replay">
              <div className="decision-replay-heading">
                <span>Decision replay</span>
                <strong>{providerLabel} → application policy</strong>
              </div>
              <ol aria-label="Model and policy decision replay">
                {decisionSteps.map((step, index) => {
                  const stepState =
                    index < activeDecisionStep
                      ? "complete"
                      : index === activeDecisionStep
                        ? "active"
                        : "upcoming";
                  return (
                    <li key={step.label} data-state={stepState}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{step.label}</strong>
                        <small>{step.detail}</small>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="decision-replay-live" aria-live="polite">
                {decisionSteps[activeDecisionStep]?.label}
              </p>
            </div>
          ) : null}
          <div className="route-playback-actions">
            <button type="button" onClick={toggleRoutePlayback}>
              {playbackState === "playing"
                ? "Pause preview"
                : playbackState === "complete"
                  ? "Play again"
                  : "Resume preview"}
            </button>
            <button
              type="button"
              onClick={replayRoutePlayback}
              disabled={playbackProgress === 0}
            >
              Replay from start
            </button>
            {onShowModelResponse ? (
              <button type="button" onClick={onShowModelResponse}>
                Full model response
              </button>
            ) : null}
            <small>Animated guide · not live GPS</small>
          </div>
        </section>
      ) : null}
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
