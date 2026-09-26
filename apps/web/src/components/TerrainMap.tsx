import { useEffect, useRef, useState } from "react";
import type { TrailFeature } from "@probably-this-way/contracts";
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

type MapStatus = "starting" | "ready" | "fallback" | "error";
type TerrainMapProps = { trail?: TrailFeature };

export function TerrainMap({ trail }: TerrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const usesWorldTerrainRef = useRef(false);
  const [status, setStatus] = useState<MapStatus>("starting");

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
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
        terrain: token ? Terrain.fromWorldTerrain({ requestVertexNormals: true }) : undefined,
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

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !trail || status === "starting") return;
    const coordinates = trail.geometry.coordinates;
    const summit = coordinates.at(-1);
    if (!summit) return;

    viewer.entities.removeById("active-trail");
    viewer.entities.removeById("active-trail-summit");
    viewer.entities.add({
      id: "active-trail",
      name: trail.properties.name,
      polyline: {
        positions: Cartesian3.fromDegreesArrayHeights(coordinates.flat()),
        width: 5,
        material: Color.fromCssColorString("#ff5c35"),
        clampToGround: usesWorldTerrainRef.current,
      },
    });
    viewer.entities.add({
      id: "active-trail-summit",
      position: Cartesian3.fromDegrees(summit[0], summit[1], usesWorldTerrainRef.current ? 0 : summit[2]),
      label: {
        text: `${trail.properties.name.toUpperCase()}  ·  ${Math.round(summit[2] * 3.28084).toLocaleString("en-US")} FT`,
        font: "500 12px DM Mono",
        fillColor: Color.fromCssColorString("#e7eadf"),
        outlineColor: Color.fromCssColorString("#07110e"),
        outlineWidth: 4,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -14),
      },
      point: { color: Color.fromCssColorString("#ff5c35"), outlineColor: Color.fromCssColorString("#e7eadf"), outlineWidth: 2, pixelSize: 11 },
    });
    viewer.scene.requestRender();
  }, [status, trail]);

  return <div className="terrain-map">
    <div ref={containerRef} className="cesium-host" aria-label="Interactive 3D trail map" />
    <div className="map-meta"><span>42.49° N</span><span>71.89° W</span></div>
    <div className="map-mode" data-status={status}><span />{status === "starting" && "Initializing terrain"}{status === "ready" && "World Terrain online"}{status === "fallback" && "Ellipsoid preview · add ion token for terrain"}{status === "error" && "Map unavailable"}</div>
    <div className="map-caption">{trail ? trail.properties.name : "Loading trail overlay"} <span>Drag to orbit · scroll to zoom</span></div>
  </div>;
}
