import { useEffect, useRef, useState } from "react";
import {
  Cartesian2,
  Cartesian3,
  Color,
  Ion,
  LabelStyle,
  Math as CesiumMath,
  Terrain,
  VerticalOrigin,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

const WACHUSETT_ROUTE = [
  -71.8976, 42.4898, 310,
  -71.8948, 42.4932, 390,
  -71.8908, 42.4967, 480,
  -71.8868, 42.5005, 574,
  -71.8862, 42.5031, 611,
];

type MapStatus = "starting" | "ready" | "fallback" | "error";

export function TerrainMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [status, setStatus] = useState<MapStatus>("starting");

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    const token = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN?.trim();
    if (token) Ion.defaultAccessToken = token;

    try {
      const viewer = new Viewer(containerRef.current, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        terrain: token ? Terrain.fromWorldTerrain({ requestVertexNormals: true }) : undefined,
        requestRenderMode: true,
        maximumRenderTimeChange: Number.POSITIVE_INFINITY,
      });

      viewerRef.current = viewer;
      viewer.scene.globe.enableLighting = Boolean(token);
      viewer.scene.globe.depthTestAgainstTerrain = Boolean(token);
      viewer.scene.backgroundColor = Color.fromCssColorString("#07110e");
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;

      viewer.entities.add({
        id: "wachusett-preview-route",
        name: "Wachusett Summit Circuit",
        polyline: {
          positions: Cartesian3.fromDegreesArrayHeights(WACHUSETT_ROUTE),
          width: 5,
          material: Color.fromCssColorString("#ff5c35"),
          clampToGround: Boolean(token),
        },
      });

      viewer.entities.add({
        position: Cartesian3.fromDegrees(-71.8862, 42.5031, token ? 0 : 611),
        label: {
          text: "WACHUSETT SUMMIT  ·  2,006 FT",
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

      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(-71.8878, 42.4905, 5_400),
        orientation: { heading: CesiumMath.toRadians(8), pitch: CesiumMath.toRadians(-38), roll: 0 },
        duration: 0,
      });
      setStatus(token ? "ready" : "fallback");
    } catch (error) {
      console.error("Unable to initialize Cesium", error);
      setStatus("error");
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) viewerRef.current.destroy();
      viewerRef.current = null;
    };
  }, []);

  return (
    <div className="terrain-map">
      <div ref={containerRef} className="cesium-host" aria-label="Interactive 3D map of the Wachusett Summit Circuit" />
      <div className="map-meta"><span>42.49° N</span><span>71.89° W</span></div>
      <div className="map-mode" data-status={status}><span />{status === "starting" && "Initializing terrain"}{status === "ready" && "World Terrain online"}{status === "fallback" && "Ellipsoid preview · add ion token for terrain"}{status === "error" && "Map unavailable"}</div>
      <div className="map-caption">Wachusett field preview <span>Drag to orbit · scroll to zoom</span></div>
    </div>
  );
}
