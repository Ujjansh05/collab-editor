import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCiMovjz04JRruT9hkqnBUPEKa8BqDsY6s",
  authDomain: "collab-editor-web.firebaseapp.com",
  databaseURL: "https://collab-editor-web-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "collab-editor-web",
  storageBucket: "collab-editor-web.firebasestorage.app",
  messagingSenderId: "649111171410",
  appId: "1:649111171410:web:d308c206b7292ef521ca8b"
};

const app = initializeApp(firebaseConfig);

export const database = getDatabase(app);