/**
 * OM Service - Custom Authentication Script
 * Handles user sign-in, sign-up with OTP verification, and session management.
 * Uses localStorage + backend MongoDB for auth - no third-party auth required.
 */

// ─── User helpers - defined first so initAuth can use them ─────
window.getUser = () => {
    try {
        return JSON.parse(localStorage.getItem("serviceUser")) || null;
    } catch(e) { return null; }
};

// Set current user into the global shortcut
window.__authUser = window.getUser();

async function initAuth() {
    console.log("🚀 Auth Initialization Started...");

    // Re-read user from storage
    window.__authUser = window.getUser();

    await setupUserUI();

    // Dispatch on BOTH document and window so all listeners work
    document.dispatchEvent(new CustomEvent("auth-ready"));
    window.dispatchEvent(new CustomEvent("auth-ready"));
}

function showDefaultSignInButton() {
    const userButtonDiv = document.getElementById("user-button");
    if (!userButtonDiv) return;
    userButtonDiv.innerHTML = `
        <button id="sign-in-btn" class="join-us-btn"
            style="background: transparent; border: 2px solid #fcdc3b; color: white !important; cursor: pointer;">
            SIGN IN
        </button>
    `;
    document.getElementById("sign-in-btn").onclick = () => window.location.href = "signin.html";
}

async function setupUserUI() {
    const userButtonDiv = document.getElementById("user-button");
    if (!userButtonDiv) return;

    const userStr = localStorage.getItem("serviceUser");
    if (!userStr) {
        showDefaultSignInButton();
        return;
    }

    let user;
    try {
        user = JSON.parse(userStr);
    } catch(e) {
        showDefaultSignInButton();
        return;
    }

    window.__authUser = user;

    if (user) {
        // Only use profileImage if it's a valid Base64 data URL (old /uploads/ paths won't work on cloud)
        const avatarUrl = (user.profileImage && user.profileImage.startsWith("data:")) ? user.profileImage : "";
        const displayName = user.name || user.email?.split("@")[0] || "User";
        const initialsFallback = `<div style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;border:1px solid rgba(255,255,255,0.2);">${displayName[0].toUpperCase()}</div>`;
        const avatarHtml = avatarUrl
            ? `<img src="${avatarUrl}" alt="Avatar" style="width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,0.2);object-fit:cover;" onerror="this.outerHTML=\`${initialsFallback.replace(/`/g, '\\`')}\`">`
            : initialsFallback;

        userButtonDiv.innerHTML = `
            <div class="dropdown">
                <div id="user-dropdown-trigger" data-bs-toggle="dropdown" aria-expanded="false"
                    style="cursor:pointer;display:flex;align-items:center;gap:10px;">
                    ${avatarHtml}
                    <span class="d-none d-lg-inline" style="color:white;font-weight:500;">${displayName}</span>
                </div>
                <ul class="dropdown-menu dropdown-menu-end"
                    style="background:rgba(25,2,28,0.95);backdrop-filter:blur(10px);border:1px solid rgba(252,220,59,0.2);">
                    <li><a class="dropdown-item text-white" href="user-dashboard.html">
                        <i class="fas fa-tachometer-alt me-2" style="color:#fcdc3b;"></i>Dashboard</a></li>
                    <li><hr class="dropdown-divider" style="border-color:rgba(252,220,59,0.1);"></li>
                    <li><a class="dropdown-item text-white" href="#" onclick="signOutUser();return false;">
                        <i class="fas fa-sign-out-alt me-2 text-danger"></i>Sign Out</a></li>
                </ul>
            </div>
        `;
    } else {
        showDefaultSignInButton();
    }
}

async function signOutUser() {
    localStorage.removeItem("serviceUser");
    window.location.reload();
}

// ─── Custom Auth Modal ─────────────────────────────────────────

let isLoginMode = true;
let isOtpMode = false;
let isForgotMode = false;
let forgotStep = 'email'; // 'email', 'otp', 'new-password'
let forgotEmail = '';
let forgotOtp = '';

function showCustomAuthModal() {
    isLoginMode = true;
    isOtpMode = false;
    isForgotMode = false;
    forgotStep = 'email';
    renderAuthModal();
}

function closeCustomAuthModal() {
    const modal = document.getElementById("customAuthModal");
    if (modal) modal.style.display = "none";
}

function renderAuthModal() {
    let modal = document.getElementById("customAuthModal");
    if (!modal) {
        if (!document.getElementById("custom-modal-styles")) {
            const style = document.createElement("style");
            style.id = "custom-modal-styles";
            style.textContent = `
                .custom-modal-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 10000; animation: fadeIn .2s ease;
                }
                @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
                .custom-modal-content {
                    background: rgba(25,2,28,0.95); backdrop-filter: blur(20px);
                    border: 1px solid rgba(252,220,59,0.25);
                    box-shadow: 0 0 60px rgba(0,0,0,0.6);
                    padding: 30px; border-radius: 15px;
                    width: 90%; max-width: 450px; position: relative;
                    text-align: left;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                .custom-modal-content::-webkit-scrollbar { width: 6px; }
                .custom-modal-content::-webkit-scrollbar-thumb { background: #fcdc3b; border-radius: 6px; }
                .custom-modal-content h2 { color: #fcdc3b; margin-bottom: 20px; text-align: center; }
                .auth-input { width: 100%; padding: 10px; margin-bottom: 12px; border-radius: 5px; border: 1px solid #555; background: #222; color: #fff; }
                .auth-input:focus { border-color: #fcdc3b; outline: none; }
                .auth-btn { width: 100%; padding: 12px; background: #fcdc3b; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; color: #000; margin-top: 10px; }
                .auth-btn:hover { background: #e0c330; }
                .close-auth-modal {
                    position: absolute; right: 20px; top: 14px;
                    color: rgba(255,255,255,0.5); font-size: 25px; cursor: pointer;
                    transition: .2s; line-height: 1; background: none; border: none;
                }
                .close-auth-modal:hover { color: #fcdc3b; transform: rotate(90deg); }
                .auth-toggle { text-align: center; margin-top: 15px; color: #aaa; font-size: 14px; }
                .auth-toggle a { color: #fcdc3b; text-decoration: none; cursor: pointer; }
                .auth-toggle a:hover { text-decoration: underline; }
                .auth-error { color: #ff5e5e; font-size: 14px; margin-bottom: 10px; text-align: center; display: none; }
            `;
            document.head.appendChild(style);
        }

        modal = document.createElement("div");
        modal.id = "customAuthModal";
        modal.className = "custom-modal-overlay";
        document.body.appendChild(modal);

        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeCustomAuthModal();
        });
    }

    // Render inner content based on state
    let innerHtml = '<div class="custom-modal-content"><button class="close-auth-modal" onclick="closeCustomAuthModal()">&times;</button>';
    innerHtml += '<div id="authError" class="auth-error"></div>';

    if (isForgotMode) {
        if (forgotStep === 'email') {
            innerHtml += `
                <h2>Forgot Password</h2>
                <p style="text-align: center; color: #bbb; font-size: 14px; margin-bottom: 20px;">Enter your email to receive a password reset OTP.</p>
                <input type="email" id="authEmail" class="auth-input" placeholder="Email Address" required>
                <button class="auth-btn" onclick="submitForgotRequest()" id="authSubmitBtn">Send Reset OTP</button>
                <div class="auth-toggle">Remember your password? <a onclick="toggleForgotMode()">Sign In</a></div>
            `;
        } else if (forgotStep === 'otp') {
            innerHtml += `
                <h2>Verify Reset OTP</h2>
                <p style="text-align: center; color: #bbb; font-size: 14px; margin-bottom: 20px;">We sent a reset code to ${forgotEmail}.</p>
                <input type="text" id="authOtp" class="auth-input" placeholder="Enter 6-digit OTP" required>
                <button class="auth-btn" onclick="verifyForgotOtp()" id="authSubmitBtn">Verify OTP</button>
                <div class="auth-toggle">Didn't receive code? <a onclick="submitForgotRequest()">Resend OTP</a></div>
            `;
        } else if (forgotStep === 'new-password') {
            innerHtml += `
                <h2>Set New Password</h2>
                <input type="password" id="authNewPassword" class="auth-input" placeholder="New Password" required>
                <input type="password" id="authConfirmNewPassword" class="auth-input" placeholder="Confirm New Password" required>
                <button class="auth-btn" onclick="submitResetPassword()" id="authSubmitBtn">Update Password</button>
            `;
        }
    } else if (isOtpMode) {
        innerHtml += `
            <h2>Verify OTP</h2>
            <p style="text-align: center; color: #bbb; font-size: 14px; margin-bottom: 20px;">We sent a verification code to your email.</p>
            <input type="text" id="authOtp" class="auth-input" placeholder="Enter 6-digit OTP" required>
            <button class="auth-btn" onclick="submitVerifyOtp()" id="authSubmitBtn">Verify &amp; Sign In</button>
            <div class="auth-toggle">Didn't receive code? <a onclick="submitSignUp()">Resend OTP</a></div>
        `;
    } else if (isLoginMode) {
        innerHtml += `
            <h2>Sign In</h2>
            <input type="email" id="authEmail" class="auth-input" placeholder="Email Address" required>
            <input type="password" id="authPassword" class="auth-input" placeholder="Password" required>
            <div style="text-align: right; margin-bottom: 15px; margin-top: -5px;">
                <a onclick="toggleForgotMode()" style="color: #fcdc3b; font-size: 12px; cursor: pointer; text-decoration: none;">Forgot Password?</a>
            </div>
            <button class="auth-btn" onclick="submitLogin()" id="authSubmitBtn">Sign In</button>
            <div class="auth-toggle">Don't have an account? <a onclick="toggleAuthMode()">Sign Up</a></div>
        `;
    } else {
        innerHtml += `
            <h2>Create Account</h2>
            <input type="text" id="authName" class="auth-input" placeholder="Full Name" required>
            <input type="email" id="authEmail" class="auth-input" placeholder="Email Address" required>
            <input type="text" id="authPhone" class="auth-input" placeholder="Phone Number" required>
            <input type="text" id="authAddress" class="auth-input" placeholder="Residential Address" required>
            <input type="password" id="authPassword" class="auth-input" placeholder="Create Password" required>
            <input type="password" id="authConfirmPassword" class="auth-input" placeholder="Confirm Password" required>
            <button class="auth-btn" onclick="submitSignUp()" id="authSubmitBtn">Send OTP</button>
            <div class="auth-toggle">Already have an account? <a onclick="toggleAuthMode()">Sign In</a></div>
        `;
    }

    innerHtml += '</div>';
    modal.innerHTML = innerHtml;
    modal.style.display = "flex";
}

function toggleAuthMode() {
    isForgotMode = false;
    isLoginMode = !isLoginMode;
    renderAuthModal();
}

function toggleForgotMode() {
    isForgotMode = !isForgotMode;
    isOtpMode = false;
    forgotStep = 'email';
    renderAuthModal();
}

function showAuthError(msg) {
    const errDiv = document.getElementById("authError");
    if (errDiv) {
        errDiv.textContent = msg;
        errDiv.style.display = "block";
    }
}

function setAuthLoading(isLoading) {
    const btn = document.getElementById("authSubmitBtn");
    if (btn) {
        btn.disabled = isLoading;
        if (isLoading) {
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = 'Loading...';
        } else {
            btn.innerHTML = btn.dataset.originalText;
        }
    }
}

let currentSignupData = {};

async function submitSignUp() {
    const name = document.getElementById("authName").value.trim();
    const email = document.getElementById("authEmail").value.trim();
    const phone = document.getElementById("authPhone").value.trim();
    const address = document.getElementById("authAddress").value.trim();
    const password = document.getElementById("authPassword").value;
    const confirmPassword = document.getElementById("authConfirmPassword").value;

    if (!name || !email || !phone || !address || !password) {
        return showAuthError("Please fill out all fields.");
    }
    if (password !== confirmPassword) {
        return showAuthError("Passwords do not match.");
    }

    currentSignupData = { name, email, phone, address, password };

    setAuthLoading(true);
    showAuthError("");

    try {
        const res = await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(currentSignupData)
        });
        const data = await res.json();
        setAuthLoading(false);

        if (data.success) {
            isOtpMode = true;
            renderAuthModal();
        } else {
            showAuthError(data.error || "Failed to send OTP.");
        }
    } catch (err) {
        setAuthLoading(false);
        showAuthError("Network error. Please try again.");
    }
}

async function submitVerifyOtp() {
    const otp = document.getElementById("authOtp").value.trim();
    if (!otp) return showAuthError("Please enter OTP.");

    setAuthLoading(true);
    showAuthError("");

    try {
        const res = await fetch("/api/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: currentSignupData.email, otp })
        });
        const data = await res.json();
        setAuthLoading(false);

        if (data.success) {
            localStorage.setItem("serviceUser", JSON.stringify(data.user));
            window.__authUser = data.user;
            closeCustomAuthModal();
            await setupUserUI();

            // Dispatch auth-ready on both targets
            document.dispatchEvent(new CustomEvent("auth-ready"));
            window.dispatchEvent(new CustomEvent("auth-ready"));

            if (!window.location.href.includes("user-dashboard.html")) {
                window.location.href = "user-dashboard.html";
            } else {
                window.location.reload();
            }
        } else {
            showAuthError(data.error || "Invalid OTP.");
        }
    } catch (err) {
        setAuthLoading(false);
        showAuthError("Network error. Please try again.");
    }
}

async function submitLogin() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;

    if (!email || !password) return showAuthError("Please enter email and password.");

    setAuthLoading(true);
    showAuthError("");

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        setAuthLoading(false);

        if (data.success) {
            localStorage.setItem("serviceUser", JSON.stringify(data.user));
            window.__authUser = data.user;
            closeCustomAuthModal();
            await setupUserUI();

            // Dispatch auth-ready on both targets
            document.dispatchEvent(new CustomEvent("auth-ready"));
            window.dispatchEvent(new CustomEvent("auth-ready"));

            if (window.location.href.includes("user-dashboard.html")) {
                window.location.reload();
            } else {
                window.location.href = "user-dashboard.html";
            }
        } else {
            showAuthError(data.error || "Login failed.");
        }
    } catch (err) {
        setAuthLoading(false);
        showAuthError("Network error. Please try again.");
    }
}

async function submitForgotRequest() {
    const email = document.getElementById("authEmail").value.trim();
    if (!email) return showAuthError("Please enter your email.");

    setAuthLoading(true);
    showAuthError("");

    try {
        const res = await fetch("/api/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        setAuthLoading(false);

        if (data.success) {
            forgotEmail = email;
            forgotStep = 'otp';
            renderAuthModal();
        } else {
            showAuthError(data.error || "Failed to send reset OTP.");
        }
    } catch (err) {
        setAuthLoading(false);
        showAuthError("Network error. Please try again.");
    }
}

async function verifyForgotOtp() {
    const otp = document.getElementById("authOtp").value.trim();
    if (!otp) return showAuthError("Please enter OTP.");

    forgotOtp = otp;
    forgotStep = 'new-password';
    renderAuthModal();
}

async function submitResetPassword() {
    const newPassword = document.getElementById("authNewPassword").value;
    const confirmPassword = document.getElementById("authConfirmNewPassword").value;

    if (!newPassword) return showAuthError("Please enter a new password.");
    if (newPassword !== confirmPassword) return showAuthError("Passwords do not match.");

    setAuthLoading(true);
    showAuthError("");

    try {
        const res = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: forgotEmail,
                otp: forgotOtp,
                newPassword: newPassword
            })
        });
        const data = await res.json();
        setAuthLoading(false);

        if (data.success) {
            alert("Password updated successfully! Please sign in with your new password.");
            isForgotMode = false;
            isLoginMode = true;
            renderAuthModal();
        } else {
            showAuthError(data.error || "Failed to update password.");
        }
    } catch (err) {
        setAuthLoading(false);
        showAuthError("Network error. Please try again.");
    }
}

// ─── Expose all functions globally ────────────────────────────
window.showAuthModal = showCustomAuthModal;
window.closeAuthModal = closeCustomAuthModal;
window.signOutUser = signOutUser;
window.setupUserUI = setupUserUI;
window.toggleAuthMode = toggleAuthMode;
window.toggleForgotMode = toggleForgotMode;
window.submitSignUp = submitSignUp;
window.submitVerifyOtp = submitVerifyOtp;
window.submitLogin = submitLogin;
window.submitForgotRequest = submitForgotRequest;
window.verifyForgotOtp = verifyForgotOtp;
window.submitResetPassword = submitResetPassword;

// ─── Bootstrap ────────────────────────────────────────────────
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth);
} else {
    initAuth();
}
