// simple auth helpers used by auth pages
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// copy your firebaseConfig from previous project
const firebaseConfig = {
    // TODO: replace with your project settings
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function showError(msg) {
    alert(msg);
}

function handleLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        signInWithEmailAndPassword(auth, email, password)
            .then(() => { location.href = '../index.html'; })
            .catch(err => showError(err.message));
    });
}

function handleRegister() {
    const form = document.getElementById('registerForm');
    if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        const displayName = document.getElementById('displayName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        createUserWithEmailAndPassword(auth, email, password)
            .then(userCred => {
                // optionally set displayName in profile
                userCred.user.updateProfile({ displayName });
                location.href = 'login.html';
            })
            .catch(err => showError(err.message));
    });
}

function handleForgot() {
    const form = document.getElementById('forgotForm');
    if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        sendPasswordResetEmail(auth, email)
            .then(() => alert('Password reset mail sent'))
            .catch(err => showError(err.message));
    });
}

// initialize appropriate handlers based on page elements
window.addEventListener('DOMContentLoaded', () => {
    handleLogin();
    handleRegister();
    handleForgot();
});
