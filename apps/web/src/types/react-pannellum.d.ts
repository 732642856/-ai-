declare module "react-pannellum" {
  import { ComponentType } from "react";
  interface PannellumProps {
    width?: string;
    height?: string;
    image?: string;
    haov?: number;
    vaov?: number;
    pitch?: number;
    yaw?: number;
    hfov?: number;
    autoLoad?: boolean;
    autoRotate?: number;
    compass?: boolean;
    preview?: string;
    title?: string;
    author?: string;
    showFullscreenCtrl?: boolean;
    showZoomCtrl?: boolean;
    keyboardZoom?: boolean;
    mouseZoom?: boolean;
    draggable?: boolean;
    style?: React.CSSProperties;
    className?: string;
    [key: string]: any;
  }
  const ReactPannellum: ComponentType<PannellumProps>;
  export default ReactPannellum;
}
