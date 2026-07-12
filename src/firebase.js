// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // <-- NAYA IMPORT

const firebaseConfig = {
  apiKey: "AIzaSyB2R-t1urTwcEMnW9mZ7FaG3fZrzGq4k7Y",
  authDomain: "molvi-stream.firebaseapp.com",
  projectId: "molvi-stream",
  storageBucket: "molvi-stream.firebasestorage.app",
  messagingSenderId: "332597615263",
  appId: "1:332597615263:web:144fc79706a98f223020aa",
  measurementId: "G-X8HZFQFYV2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // <-- NAYI LINE