import { FabricObject } from "fabric";

// Fabric 7 positions objects by their centre by default. Slides (and engine windows)
// are laid out by their top-left corner, so restore the classic origin once.
FabricObject.ownDefaults.originX = "left";
FabricObject.ownDefaults.originY = "top";
