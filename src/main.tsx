import React from "react";
import { createRoot } from "react-dom/client";
import { Bench } from "../vitreous/lab/bench";
import "./styles.css";
createRoot(document.getElementById("root")!).render(<React.StrictMode><Bench /></React.StrictMode>);
