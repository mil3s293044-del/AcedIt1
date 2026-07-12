import { createContext, useContext } from "react";

// Lets an AI tool render its generation output into the AITools page sidebar
// (replacing the tips/examples card) instead of below its setup form.
//
// The provider (AITools.jsx) supplies:
//   node      — the portal target DOM node in the sidebar, or null on small
//               screens (tools fall back to rendering inline below the form)
//   setActive — tell the page a generation panel is showing, so it swaps the
//               tips/examples card out (and back in when the panel closes)
//
// Currently wired for the AI English Mentor / Essay Marker; other tools can
// adopt the same pattern by consuming this context.
export const AIToolSidePanelContext = createContext(null);

export function useAIToolSidePanel() {
  return useContext(AIToolSidePanelContext);
}
