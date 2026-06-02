/**
 * theme.js
 * Centralized theme management for Xaytheon
 */

function initTheme() {
    const toggleBtn = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    // Apply the saved theme immediately
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateButtonLabel(toggleBtn, savedTheme);

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateButtonLabel(toggleBtn, newTheme);

            // Dispatch a custom event so other scripts can react to theme changes
            window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
        });
    }
}

function updateButtonLabel(btn, theme) {
    if (!btn) return;
    // Keep it minimal as per original design or slightly improved
    btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initTheme);
