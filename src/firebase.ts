import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAEl-XCSoOJtWjHa8lqLiGcLGiSZdPEzc4",
  authDomain: "ashapura-app-f8e6c.firebaseapp.com",
  projectId: "ashapura-app-f8e6c",
  storageBucket: "ashapura-app-f8e6c.firebasestorage.app",
  messagingSenderId: "1006500502499",
  appId: "1:1006500502499:web:43f93bcd4520aec77d9ed6",
  measurementId: "G-S94J9GHRJZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

            
