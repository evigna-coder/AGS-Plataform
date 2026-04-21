/**
 * Firebase client SDK init for the Playwright E2E suite (Phase 8 Wave 0).
 *
 * DECISION (orchestrator I1): use the Firestore **client SDK** (not Admin SDK)
 * because Admin requires a service-account JSON + env var setup that is
 * out of scope for this phase. The client SDK runs fine from Node under
 * Playwright as long as Firestore security rules allow the reads.
 *
 * Config is hardcoded to mirror `e2e/cleanup-e2e-data.mjs` — the project_id
 * is already public in `.env.local`. DO NOT ship secrets here; the `apiKey`
 * is a browser-facing identifier per Firebase docs.
 *
 * Exports `db` (Firestore instance) used by `helpers/firestore-assert.ts`
 * and any spec that needs direct Firestore reads.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD5oxchnQBK69zXGE-hrbRZ8vdduvwVjWw',
  authDomain: 'agssop-e7353.firebaseapp.com',
  projectId: 'agssop-e7353',
  storageBucket: 'agssop-e7353.firebasestorage.app',
  messagingSenderId: '818451692964',
  appId: '1:818451692964:web:e9c4c9485f81d823e45531',
};

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);
