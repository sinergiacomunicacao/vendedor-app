import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseApp, initializeApp } from "firebase/app";
import { Auth, getAuth, initializeAuth } from "firebase/auth";
// @ts-ignore - getReactNativePersistence exists at runtime but the firebase
// package's TypeScript exports map does not resolve it for React Native.
import { getReactNativePersistence } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Fica falso enquanto o .env não tiver as credenciais reais do projeto Firebase.
// App.tsx usa essa flag para não renderizar telas que dependem de auth/db,
// então os valores "vazios" abaixo nunca chegam a ser usados nesse caso.
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

export const app: FirebaseApp = isFirebaseConfigured
  ? initializeApp(firebaseConfig)
  : ({} as FirebaseApp);

export const auth: Auth = isFirebaseConfigured
  ? Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : ({} as Auth);

export const db: Firestore = isFirebaseConfigured ? getFirestore(app) : ({} as Firestore);
