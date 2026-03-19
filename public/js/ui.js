/**
 * OM Service - UI & Interaction Script
 * Standardizes common UI elements like popups and navigation effects.
 */

// Navigation helper
function navigateTo(page) {
    window.location.href = page;
}

// --- Admin Login Popup (Admin Portal) ---
function showLoginPopup() {
    const popup = document.getElementById('loginPopup');
    if (popup) {
        popup.classList.add('active');
        const errorMsg = document.getElementById('loginError');
        if (errorMsg) errorMsg.textContent = '';
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.reset();
        const userIdInput = document.getElementById('userId');
        if (userIdInput) userIdInput.focus();
    }
}

function hideLoginPopup() {
    const popup = document.getElementById('loginPopup');
    if (popup) popup.classList.remove('active');
}

async function validateLogin(event) {
    event.preventDefault();
    const userIdInput = document.getElementById('userId');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('loginError');
    const btn = document.querySelector('.btn-login-glow');
    
    if (!userIdInput || !passwordInput || !btn) return false;
    
    const originalBtnText = btn.innerHTML;

    // Simple client-side check before API
    if (!userIdInput.value || !passwordInput.value) {
        if (errorMsg) {
            errorMsg.style.color = "#ff4c4c";
            errorMsg.textContent = "Please fill in all fields.";
        }
        return false;
    }

    // Loading State
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
    btn.disabled = true;
    if (errorMsg) errorMsg.textContent = '';

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: userIdInput.value.trim(),
                password: passwordInput.value.trim()
            })
        });

        const data = await res.json();

        if (data.success) {
            if (errorMsg) {
                errorMsg.style.color = "#4BB543"; // Success Green
                errorMsg.innerHTML = '<i class="fas fa-check-circle me-1"></i> Access Granted. Redirecting...';
            }

            // Set Auth
            localStorage.setItem('isAdmin', 'true');

            setTimeout(() => {
                window.location.href = "admin.html";
            }, 800);
        } else {
            if (errorMsg) {
                errorMsg.style.color = "#ff4c4c"; // Error Red
                errorMsg.innerHTML = '<i class="fas fa-exclamation-circle me-1"></i> Invalid Credentials';
            }

            // Shake animation effect
            const popupContent = document.querySelector('#loginPopup .popup-content');
            if (popupContent) {
                popupContent.style.transform = "translateX(10px)";
                setTimeout(() => popupContent.style.transform = "translateX(-10px)", 100);
                setTimeout(() => popupContent.style.transform = "translateX(0)", 200);
            }
        }
    } catch (err) {
        console.error(err);
        if (errorMsg) {
            errorMsg.style.color = "#ff4c4c";
            errorMsg.textContent = "Server connection error.";
        }
    } finally {
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
    }
    return false;
}

// --- Visiting Card Popup ---
function showCardPopup() {
    const popup = document.getElementById('cardPopup');
    if (popup) popup.classList.add('active');
}

function hideCardPopup() {
    const popup = document.getElementById('cardPopup');
    if (popup) popup.classList.remove('active');
}

// --- Image Viewer Popup ---
function openImageViewer(src) {
    const viewer = document.getElementById('imageViewer');
    const fullImg = document.getElementById('fullScreenImage');
    if (viewer && fullImg) {
        fullImg.src = src;
        viewer.classList.add('active');
    }
}

function closeImageViewer() {
    const viewer = document.getElementById('imageViewer');
    if (viewer) viewer.classList.remove('active');
}

// --- Global Event Listeners ---
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        hideLoginPopup();
        hideCardPopup();
        closeImageViewer();
    }
});

// For accessibility on close buttons
document.addEventListener('DOMContentLoaded', () => {
    const closeButtons = document.querySelectorAll('.close-btn, .close-viewer-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });
    });
});

// Export functions to window
window.navigateTo = navigateTo;
window.showLoginPopup = showLoginPopup;
window.hideLoginPopup = hideLoginPopup;
window.validateLogin = validateLogin;
window.showCardPopup = showCardPopup;
window.hideCardPopup = hideCardPopup;
window.openImageViewer = openImageViewer;
window.closeImageViewer = closeImageViewer;
