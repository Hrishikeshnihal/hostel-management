// Inject CSS dynamically so we don't rely on cached style.css
const style = document.createElement('style');
style.textContent = `
    .custom-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        
        /* Fallbacks mapping to dashboards CSS variables */
        --text-primary: var(--text, #E7E9EE);
        --text-secondary: var(--text-muted, #8B93A1);
        --accent-primary: var(--accent, #6E9B8F);
        --border-light: var(--border, #262B35);
        --surface: var(--panel, #141B2E);
        --border: var(--line, #232B42);
    }
    .custom-modal-overlay.visible {
        opacity: 1;
    }
    .custom-modal-box {
        background: var(--surface);
        padding: 32px;
        border-radius: 20px;
        border: 1px solid var(--border);
        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        width: 90%;
        max-width: 400px;
        transform: scale(0.8) translateY(20px);
        opacity: 0;
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
    }
    .custom-modal-box.visible {
        transform: scale(1) translateY(0);
        opacity: 1;
    }
    .custom-modal-box button:hover {
        transform: translateY(-2px);
    }
    .custom-modal-box button:active {
        transform: translateY(1px);
    }
`;
document.head.appendChild(style);

// Custom Promise-based UI Modal
window.showConfirmModal = function(message) {
    return new Promise((resolve) => {
        // 1. Create Overlay
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        
        // 2. Create Modal Box
        const modal = document.createElement('div');
        modal.className = 'custom-modal-box bento-card';
        
        // 3. Modal Content
        modal.innerHTML = `
            <h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.2rem;">Action Required</h3>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">${message}</p>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="modalBtnCancel" style="margin: 0; background: transparent; border: 1px solid var(--border-light); color: var(--text-primary); width: auto; padding: 10px 20px;">Cancel</button>
                <button id="modalBtnConfirm" style="margin: 0; background: var(--accent-primary); color: #000; width: auto; padding: 10px 20px;">Confirm</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // 4. Trigger Animation (Small delay to allow DOM attachment)
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
            modal.classList.add('visible');
        });

        // 5. Cleanup Function
        const cleanup = (result) => {
            overlay.classList.remove('visible');
            modal.classList.remove('visible');
            setTimeout(() => {
                document.body.removeChild(overlay);
                resolve(result);
            }, 300); // Wait for exit animation
        };

        // 6. Event Listeners
        document.getElementById('modalBtnCancel').addEventListener('click', () => cleanup(false));
        document.getElementById('modalBtnConfirm').addEventListener('click', () => cleanup(true));
        
        // Click outside to cancel
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cleanup(false);
        });
    });
};

// Custom Promise-based UI Alert
window.showAlertModal = function(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'custom-modal-box bento-card';
        
        modal.innerHTML = `
            <h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.2rem;">Notice</h3>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">${message}</p>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="modalBtnOk" style="margin: 0; background: var(--accent-primary); color: #000; width: auto; padding: 10px 20px;">OK</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.classList.add('visible');
            modal.classList.add('visible');
        });

        const cleanup = () => {
            overlay.classList.remove('visible');
            modal.classList.remove('visible');
            setTimeout(() => {
                document.body.removeChild(overlay);
                resolve();
            }, 300);
        };

        document.getElementById('modalBtnOk').addEventListener('click', cleanup);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cleanup();
        });
    });
};
