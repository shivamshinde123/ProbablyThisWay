import { useEffect, useRef, useState } from "react";
import type { RouteFeature } from "@probably-this-way/contracts";
import { Cartesian2, Cartesian3, Color, Ion, LabelStyle, Math as CesiumMath, Terrain, VerticalOrigin, Viewer } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

type MapStatus = "starting" | "ready" | "fallback" | "error";
type TerrainMapProps = { routes: RouteFeature[]; selectedRouteId?: string };

export function TerrainMap({ routes, selectedRouteId }: TerrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const routeEntityIdsRef = useRef<string[]>([]);
  const usesWorldTerrainRef = useRef(false);
  const [status, setStatus] = useState<MapStatus>("starting");

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    const token = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN?.trim();
    usesWorldTerrainRef.current = Boolean(token);
    if (token) Ion.defaultAccessToken = token;
    try {
      const viewer = new Viewer(containerRef.current, { animation:false, baseLayer:false, baseLayerPicker:false, fullscreenButton:false, geocoder:false, homeButton:false, infoBox:false, navigationHelpButton:false, sceneModePicker:false, selectionIndicator:false, timeline:false, terrain:token?Terrain.fromWorldTerrain({requestVertexNormals:true}):undefined, requestRenderMode:true, maximumRenderTimeChange:Number.POSITIVE_INFINITY });
      viewerRef.current=viewer;
      viewer.scene.globe.baseColor=Color.fromCssColorString("#10241c"); viewer.scene.globe.enableLighting=Boolean(token); viewer.scene.globe.depthTestAgainstTerrain=Boolean(token); viewer.scene.backgroundColor=Color.fromCssColorString("#07110e"); if(viewer.scene.skyAtmosphere)viewer.scene.skyAtmosphere.show=false;
      viewer.camera.flyTo({destination:Cartesian3.fromDegrees(-71.8878,42.4905,5_400),orientation:{heading:CesiumMath.toRadians(8),pitch:CesiumMath.toRadians(-38),roll:0},duration:0});
      setStatus(token?"ready":"fallback");
    } catch(error){console.error("Unable to initialize Cesium",error);setStatus("error");}
    return()=>{if(viewerRef.current&&!viewerRef.current.isDestroyed())viewerRef.current.destroy();viewerRef.current=null;};
  },[]);

  useEffect(()=>{
    const viewer=viewerRef.current;if(!viewer||viewer.isDestroyed()||status==="starting")return;
    routeEntityIdsRef.current.forEach((id)=>viewer.entities.removeById(id));routeEntityIdsRef.current=[];
    routes.forEach((route)=>{
      const active=route.properties.id===selectedRouteId;const id=`route-${route.properties.id}`;routeEntityIdsRef.current.push(id);
      viewer.entities.add({id,name:route.properties.name,polyline:{positions:Cartesian3.fromDegreesArrayHeights(route.geometry.coordinates.flat()),width:active?6:3,material:Color.fromCssColorString(active?"#ff5c35":"#8c9b75").withAlpha(active?1:.68),clampToGround:usesWorldTerrainRef.current}});
    });
    const selected=routes.find((route)=>route.properties.id===selectedRouteId);const summit=selected?.geometry.coordinates.at(-1);
    if(selected&&summit){const id="selected-route-label";routeEntityIdsRef.current.push(id);viewer.entities.add({id,position:Cartesian3.fromDegrees(summit[0],summit[1],usesWorldTerrainRef.current?0:summit[2]),label:{text:`${selected.properties.name.toUpperCase()}  ·  ${selected.properties.estimatedMinutes} MIN`,font:"500 12px DM Mono",fillColor:Color.fromCssColorString("#e7eadf"),outlineColor:Color.fromCssColorString("#07110e"),outlineWidth:4,style:LabelStyle.FILL_AND_OUTLINE,verticalOrigin:VerticalOrigin.BOTTOM,pixelOffset:new Cartesian2(0,-14)},point:{color:Color.fromCssColorString("#ff5c35"),outlineColor:Color.fromCssColorString("#e7eadf"),outlineWidth:2,pixelSize:11}});}
    viewer.scene.requestRender();
  },[routes,selectedRouteId,status]);

  const selectedName=routes.find((route)=>route.properties.id===selectedRouteId)?.properties.name;
  return <div className="terrain-map"><div ref={containerRef} className="cesium-host" aria-label="Interactive 3D route alternatives map"/><div className="map-meta"><span>42.49° N</span><span>71.89° W</span></div><div className="map-mode" data-status={status}><span/>{status==="starting"&&"Initializing terrain"}{status==="ready"&&"World Terrain online"}{status==="fallback"&&"Ellipsoid preview · add ion token for terrain"}{status==="error"&&"Map unavailable"}</div><div className="map-caption">{selectedName??"Loading route alternatives"}<span>Orange selected · moss alternatives</span></div></div>;
}
