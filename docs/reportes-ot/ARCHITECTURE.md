# Reportes-OT Architecture Overview

## Document Purpose
This document outlines the current architectural state of the `reportes-ot` application. It details the core components, state management strategies, and the PDF generation pipeline.

## 1. High-Level Architecture
`reportes-ot` is a React single-page application designed for field engineers to fill out service reports, capture signatures, and generate paginated PDFs. It relies on Firebase for authentication and database storage (Firestore).

The application currently has a monolithic structure centered around `App.tsx`, which acts as the main orchestrator, context provider, and layout wrapper.

## 2. Core Hooks (State and Logic)
Business logic is extracted into a suite of custom hooks to keep components (relatively) clean:

*   **`useReportForm.ts`**: Manages the enormous `ReportFormState`. It handles individual field updates for client data, equipment specifics, timestamps, report content, signatures, and dynamic protocol data.
*   **`useOTManagement.ts`**: Handles the lifecycle of an Order of Work (OT). It includes fetching existing OTs from Firestore, creating new "Borrador" (draft) OTs, duplicating OTs (with or without protocols/signatures), and managing the associated modal states.
*   **`usePDFGeneration.ts`**: The most complex utility. It orchestrates the conversion of DOM elements to a PDF blob using `html2canvas` and `pdf-lib`. It handles injecting signatures, dealing with multi-page protocol tables, saving to Firebase, and triggering the browser's download/share API.

## 3. Key UI Components
*   **`components/ProtocolView.tsx`**: The engine for rendering dynamic protocol definitions. It takes a `ProtocolTemplateDoc` and renders Text, Checklist, Table, or Signature sections. It implements complex layout calculations (`getUsefulHeightPx`) to switch between 'edit' (continuous scroll) and 'print' (paginated, avoiding table breaks) modes.
*   **`components/SignaturePad.tsx`**: A robust wrapper around HTML `<canvas>` to capture user signatures. It handles device pixel ratio scaling, touch/pointer events, and drawing restoration during window resizes or scrolling.
*   **`components/MobileMenu.tsx`**: A responsive action menu that floats on mobile devices or sits fixed on desktop. It triggers actions like "FinalSubmit", "Duplicate", and "Share PDF" based on the current report status and preview mode.

## 4. Workflows

### 4.1. Data Loading and Editing
1. User enters an OT number.
2. `useOTManagement.loadOT` queries Firestore.
3. If found, `useReportForm` is hydrated. If not, a modal prompts to create a new one.
4. Auto-save triggers periodically as the user interacts with the form.

### 4.2. Protocol Rendering
Protocols are highly dynamic. `ProtocolView` reads a template (e.g., HPLC configuration) and renders specific tables or checklists. In edit mode, it behaves like a standard web form. Before PDF generation, it switches to 'print' mode to calculate explicit page breaks so tables are not cut in half across A4 pages.

### 4.3. PDF Generation & Finalization
1. Engineer clicks "Generar PDF".
2. `usePDFGeneration.handleFinalSubmit` validates signatures and mandatory fields.
3. The report status is marked as 'FINALIZADO' in Firestore.
4. The DOM `root` elements for the main page (.report-page) and protocol pages (.protocol-page) are captured via `html2canvas`.
5. Images are embedded into a `pdf-lib` document.
6. The resulting Blob is downloaded or shared via the Web Share API.

## 5. Identified Technical Debt
*   **Monolithic `App.tsx`**: The main file is over 800 lines long, making it hard to maintain.
*   **Prop Drilling**: Many props and state setters are passed down manually from `App.tsx` to nested components.
*   **PDF Generation Performance**: `html2canvas` is synchronous and heavy. Capturing many protocol pages can cause UI freezes on lower-end mobile devices.
*   **Hardcoded Protocol Logic**: Certain logic (`sec_18`, `sec_19` complex tables) is hardcoded inside `ProtocolView.tsx`, rather than being fully data-driven.
