import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "./history.css";
import HistoryApp from "./HistoryApp";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <HistoryApp />
    </ConvexProvider>
  </StrictMode>,
);
