import type { Engine } from "../types";
import { createCoral } from "./coral";
import { createFulgurite } from "./fulgurite";
import { createInk } from "./ink";
import { createIsing } from "./ising";
import { createReliquary } from "./reliquary";
import { createShaderEngine } from "./shaders";
import { createSinai } from "./sinai";
import { createSpinodal } from "./spinodal";
import { createWorms } from "./worms";

export function createEngine(id: string, seed: number): Engine {
  switch (id) {
    case "polariscope":
    case "basilica":
    case "leadlight":
    case "switchyard":
      return createShaderEngine(id, seed);
    case "unmixing":
      return createSpinodal(seed);
    case "ventricle":
      return createInk(seed);
    case "enamel":
      return createIsing(seed);
    case "fulgurite":
      return createFulgurite(seed);
    case "coral":
      return createCoral(seed);
    case "wormsilk":
      return createWorms(seed);
    case "sinai":
      return createSinai(seed);
    case "reliquary":
      return createReliquary(seed);
    default:
      return createShaderEngine("polariscope", seed);
  }
}
