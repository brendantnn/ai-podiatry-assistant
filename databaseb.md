# step 1:
cd /ITP_Grp21
npm install firebase
>> if got error msg, can try run as admin for powershell then paste the following:
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
type 'Y' for the prompt
then return to VScode and try the "npm install firebase" agn.

# step 2:
create a new file at root "firebase-config.js"
get from firebase/project settings

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDk0L-LZn8B3UZOUnzH26QFFVtpadrd4js",
  authDomain: "itp-grp21.firebaseapp.com",
  projectId: "itp-grp21",
  storageBucket: "itp-grp21.firebasestorage.app",
  messagingSenderId: "1050091792638",
  appId: "1:1050091792638:web:2cdc82bbd6608844105daf",
  measurementId: "G-VCTS5QNC64"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

# step 3:
i have enabled the Authentication -> email/password on firebase.

# step 4:
get/download the serviceAccountKey.json given personally.
