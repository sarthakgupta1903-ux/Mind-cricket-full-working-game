/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "hallowed-vertex-wcf5x",
  appId: "1:742104155367:web:59d5495618bd2834acce42",
  apiKey: "AIzaSyC3ZSnGrLmWtxZSdQ1fcrUh_asCuxEnIKQ",
  authDomain: "hallowed-vertex-wcf5x.firebaseapp.com",
  storageBucket: "hallowed-vertex-wcf5x.firebasestorage.app",
  messagingSenderId: "742104155367"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore targeting the custom databaseId provided
const db = initializeFirestore(app, {}, "ai-studio-e7f247c8-85cf-44c8-b75a-c46f81cc7711");
const auth = getAuth(app);

export { app, db, auth };
