# Reportes-OT Refactoring Plan

## Document Purpose
This document outlines a phased refactoring plan for the `reportes-ot` application. The primary goals are to break down the monolithic architecture, introduce a dynamic table catalog for protocol annexes, and improve maintainability—all **without altering the existing UI, functional behavior, or form design**.

## Phase 1: Component Extraction (De-monolith App.tsx)
Currently, `App.tsx` handles routing, context, layout, modals, and deep prop passing.

*   **1.1. Create Layout Components**: Extract the header and footer into `components/layout/AppHeader.tsx` and `components/layout/AppFooter.tsx`.
*   **1.2. Extract Main Form**: Move the core report form (client data, equipment, notes) into `components/form/ReportFormContent.tsx`.
*   **1.3. Isolate Modals**: Extract the Modals (New OT, Duplicate OT, WebAuthn) into their own directory (e.g., `components/modals/`).
*   **1.4. Context API Consolidation**: If prop drilling remains deep after extraction, consider wrapping the form state in a React Context (`ReportFormContext`) so deeply nested components (like `ProtocolView`) can access data without passing it through 5 layers.

## Phase 2: Dynamic Protocol Data Model (Table Catalog)
To accommodate new requirements for dynamic protocol annexes, the hardcoded table logic needs to be abstracted into a catalog-driven model.

*   **2.1. Define Firestore `protocol_catalogs` Schema**:
    Create a new collection to store reusable dictionaries, equipment specs, and parameter ranges.
    ```typescript
    interface ProtocolCatalogItem {
      id: string; // e.g., 'hplc_flow_accuracy'
      equipmentType: string;
      parameters: string[];
      acceptableRange: { min: number; max: number; unit: string };
    }
    ```
*   **2.2. Update Protocol Templates**: Enhance `ProtocolTemplateDoc` to reference these catalogs instead of hardcoding rows. Add a `source: 'catalog'` and `catalogId: string` to the `ProtocolTableSection`.
*   **2.3. Dynamic Table Renderer**: Update `ProtocolTable.tsx` and `ProtocolView.tsx` to fetch catalog data and dynamically generate rows and headers. Remove hardcoded special cases (like `sec_18` and `sec_19`) in favor of generic template flags (e.g., `hasCompositeHeader: true`).

## Phase 3: State Management Optimization
As protocols become more dynamic, the `useReportForm` state object will grow.

*   **3.1. Hook Splitting**: Separate standard form state (client, OT info) from protocol state. For example, introduce `useProtocolState.ts`.
*   **3.2. Autosave Performance**: Ensure the autosave mechanism debounces efficiently and only saves dirty subsets of the `protocolData` rather than the entire document on every keystroke, minimizing Firestore write costs and latency.
*   **3.3. Remote Signature Compatibility**: Ensure that the protocol data model correctly references external signature collection mechanisms without breaking the new dynamic table structure.

## Phase 4: PDF Generation Improvements
*   **4.1. DOM Isolation**: Ensure the hidden DOM elements used for `html2canvas` are completely isolated from the visible UI state to prevent flickering during generation.
*   **4.2. Chunked Rendering**: For large protocols, consider yielding execution to the browser main thread between `html2canvas` calls (e.g., using `requestAnimationFrame` or `setTimeout`) to prevent the UI from freezing.
*   **4.3. Catalog Data Injection**: Ensure catalog data fetched in Phase 2 is fully resolved and rendered in the DOM *before* PDF generation begins.

## Execution Strategy
To ensure the golden rule (no UI/UX changes) is respected:
1.  **Branching**: Execute Phase 1 on a dedicated branch (`refactor/component-extraction`).
2.  **Visual Regression**: Test the extracted components to ensure pixel-perfect parity with the monolith.
3.  **Data Mocking**: For Phase 2, create mock catalogs in memory before binding them to Firestore, verifying the dynamic rendering logic works seamlessly with existing OTs.
