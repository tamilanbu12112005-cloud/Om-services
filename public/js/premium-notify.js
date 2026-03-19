/**
 * Premium Notification System for OM Services
 * Replaces standard alert() and confirm() with custom, styled, and animated modals.
 * Includes glassmorphic design and smooth transitions.
 */

const PremiumModal = {
    // Inject CSS styles
    injectStyles() {
        if (document.getElementById('premium-modal-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'premium-modal-styles';
        style.innerHTML = `
            /* Modal Overlay */
            .premium-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .premium-modal-overlay.show {
                opacity: 1;
            }

            /* Modal Container */
            .premium-modal-container {
                background: rgba(25, 25, 25, 0.85);
                border: 1px solid rgba(252, 220, 59, 0.2);
                border-radius: 20px;
                padding: 30px;
                width: 90%;
                max-width: 450px;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5), 0 0 15px rgba(252, 220, 59, 0.1);
                transform: scale(0.85) translateY(20px);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                text-align: center;
                position: relative;
                color: white;
                font-family: 'Outfit', sans-serif;
            }
            .premium-modal-overlay.show .premium-modal-container {
                transform: scale(1) translateY(0);
            }

            /* Icon */
            .premium-modal-icon {
                font-size: 50px;
                margin-bottom: 20px;
                color: #fcdc3b;
                display: inline-block;
                animation: premium-pop 0.5s ease;
            }
            @keyframes premium-pop {
                0% { transform: scale(0.5); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
            }

            /* Title & Message */
            .premium-modal-title {
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 12px;
                background: linear-gradient(135deg, #fcdc3b, #f97316);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .premium-modal-message {
                font-size: 16px;
                color: rgba(255, 255, 255, 0.8);
                line-height: 1.6;
                margin-bottom: 25px;
            }

            /* Buttons */
            .premium-modal-actions {
                display: flex;
                gap: 15px;
                justify-content: center;
            }
            .premium-modal-btn {
                padding: 10px 25px;
                border-radius: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                border: none;
                font-size: 15px;
                min-width: 100px;
            }
            .premium-modal-btn-primary {
                background: linear-gradient(135deg, #fcdc3b, #f97316);
                color: #1a1000;
                box-shadow: 0 4px 15px rgba(252, 220, 59, 0.3);
            }
            .premium-modal-btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(252, 220, 59, 0.4);
            }
            .premium-modal-btn-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .premium-modal-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.15);
                transform: translateY(-2px);
            }

            /* Toast Styles */
            .premium-toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 11000;
            }
            .premium-toast {
                background: rgba(25, 25, 25, 0.9);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(252, 220, 59, 0.3);
                border-left: 5px solid #fcdc3b;
                padding: 15px 25px;
                border-radius: 12px;
                margin-bottom: 10px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                gap: 15px;
                color: white;
                transform: translateX(120%);
                transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .premium-toast.show {
                transform: translateX(0);
            }
            .premium-toast-icon {
                color: #fcdc3b;
                font-size: 20px;
            }
            .premium-toast-error {
                border-left-color: #ef4444;
            }
            .premium-toast-error .premium-toast-icon {
                color: #ef4444;
            }
        `;
        document.head.appendChild(style);
    },

    // Create Modal Elements
    createModal(title, message, icon, showSecondary = false, onConfirm, onCancel) {
        this.injectStyles();
        
        const overlay = document.createElement('div');
        overlay.className = 'premium-modal-overlay';
        
        const container = document.createElement('div');
        container.className = 'premium-modal-container';
        
        container.innerHTML = `
            <div class="premium-modal-icon">${icon}</div>
            <div class="premium-modal-title">${title}</div>
            <div class="premium-modal-message">${message}</div>
            <div class="premium-modal-actions">
                ${showSecondary ? `<button class="premium-modal-btn premium-modal-btn-secondary" id="premium-cancel">Cancel</button>` : ''}
                <button class="premium-modal-btn premium-modal-btn-primary" id="premium-confirm">OK</button>
            </div>
        `;
        
        overlay.appendChild(container);
        document.body.appendChild(overlay);
        
        // Trigger animation
        setTimeout(() => overlay.classList.add('show'), 10);
        
        const cleanup = () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
        };
        
        document.getElementById('premium-confirm').onclick = () => {
            if (onConfirm) onConfirm();
            cleanup();
        };
        
        if (showSecondary) {
            document.getElementById('premium-cancel').onclick = () => {
                if (onCancel) onCancel();
                cleanup();
            };
        }
    },

    showAlert(message, title = "Notice") {
        this.createModal(title, message, '<i class="fas fa-info-circle"></i>', false);
    },

    showConfirm(message, title = "Confirmation") {
        return new Promise((resolve) => {
            this.createModal(
                title, 
                message, 
                '<i class="fas fa-question-circle"></i>', 
                true, 
                () => resolve(true), 
                () => resolve(false)
            );
        });
    },

    showToast(message, type = 'success', duration = 3000) {
        this.injectStyles();
        let container = document.querySelector('.premium-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'premium-toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `premium-toast ${type === 'error' ? 'premium-toast-error' : ''}`;
        const icon = type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-check-circle"></i>';
        
        toast.innerHTML = `
            <div class="premium-toast-icon">${icon}</div>
            <div class="premium-toast-message">${message}</div>
        `;
        
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }
};

// Global Exposure and Overrides
window.showAlert = (msg, title) => PremiumModal.showAlert(msg, title);
window.showConfirm = (msg, title) => PremiumModal.showConfirm(msg, title);
window.showToast = (msg, type, duration) => PremiumModal.showToast(msg, type, duration);

// Override original alert
const originalAlert = window.alert;
window.alert = function(msg) {
    // If it's a simple message string, use our custom one
    if (typeof msg === 'string' || typeof msg === 'number') {
        PremiumModal.showAlert(msg);
    } else {
        originalAlert(msg);
    }
};

// Override original confirm (Note: confirm is synchronous, but ours is async)
// We provide confirmReplacement as a modern alternative
window.confirmReplacement = (msg) => PremiumModal.showConfirm(msg);

// Auto-inject Font Awesome if not present
if (!document.querySelector('link[href*="font-awesome"]')) {
    const fa = document.createElement('link');
    fa.rel = 'stylesheet';
    fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
    document.head.appendChild(fa);
}
