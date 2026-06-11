#!/usr/bin/env node
// scripts/backfill-plotline-members.mjs
//
// One-off migration: derive each plotline's ordered `members[]` (and the
// denormalized `memberKeys[]`) from the legacy `plotlineRefs` that used to
// live on stories and events.
//
// It reads the existing `_timelineEntries` projection rows — which, before
// this migration, still carry `plotlineIds[]` and `dateSortKey` — groups the
// story/event entities by plotline, orders them by `dateSortKey`, and writes
// `members` + `memberKeys` onto each `plotlines/{id}` canonical doc.
//
// RUN ORDER: run this BEFORE rebuilding projections with the new code, while
// `_timelineEntries` rows still hold `plotlineIds`. The new write path no
// longer emits that field, so a rebuild would erase the only ordering source.
// After backfilling, plotlines own membership and `plotlineRefs` is dead.
//
// Auth mirrors scripts/rebuild-projections.mjs: signs in via Firebase Auth
// using FIREBASE_ADMIN_EMAIL / FIREBASE_ADMIN_PASSWORD; the user must be a
// member of the target universe.
//
// Usage:
//   FIREBASE_ADMIN_EMAIL=ops@example.com \
//   FIREBASE_ADMIN_PASSWORD=... \
//   node scripts/backfill-plotline-members.mjs <universeId>

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  initializeFirestore,
  updateDoc,
} from 'firebase/firestore/lite';

const firebaseConfig = {
  apiKey: 'AIzaSyC2ICioH1E5qmNlk9jLmXFz31awItS55tU',
  authDomain: 'ff14-story-timeline.firebaseapp.com',
  projectId: 'ff14-story-timeline',
  messagingSenderId: '1063589458640',
  appId: '1:1063589458640:web:75590ccfe6cf0a599364d5',
};

const TIMELINE = '_timelineEntries';

function memberKeyOf(ref) {
  return `${ref.kind}:${ref.id}`;
}

async function main() {
  const universeId = process.argv[2];
  if (!universeId) {
    console.error('Usage: node scripts/backfill-plotline-members.mjs <universeId>');
    process.exit(1);
  }
  const email = process.env['FIREBASE_ADMIN_EMAIL'];
  const password = process.env['FIREBASE_ADMIN_PASSWORD'];
  if (!email || !password) {
    console.error('FIREBASE_ADMIN_EMAIL and FIREBASE_ADMIN_PASSWORD are required.');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const firestore = initializeFirestore(app, { ignoreUndefinedProperties: true });
  const auth = getAuth(app);

  console.log(`Signing in as ${email}...`);
  await signInWithEmailAndPassword(auth, email, password);

  console.log(`Reading timeline rows for universe ${universeId}...`);
  const snap = await getDocs(collection(firestore, 'universes', universeId, TIMELINE));

  // plotlineId -> array of { ref, dateSortKey }
  const byPlotline = new Map();
  for (const d of snap.docs) {
    const row = d.data();
    const ref = { kind: row.kind, id: row.entityId };
    const dateSortKey = row.dateSortKey ?? '';
    for (const plotlineId of row.plotlineIds ?? []) {
      if (!byPlotline.has(plotlineId)) byPlotline.set(plotlineId, []);
      byPlotline.get(plotlineId).push({ ref, dateSortKey });
    }
  }

  if (byPlotline.size === 0) {
    console.log('No plotlineIds found on timeline rows — nothing to backfill.');
    return;
  }

  for (const [plotlineId, rows] of byPlotline) {
    rows.sort((a, b) => a.dateSortKey.localeCompare(b.dateSortKey));
    const members = rows.map((r) => r.ref);
    const memberKeys = members.map(memberKeyOf);
    await updateDoc(doc(firestore, 'universes', universeId, 'plotlines', plotlineId), {
      members,
      memberKeys,
      updatedAt: Date.now(),
    });
    console.log(`  ${plotlineId}: ${members.length} members`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
