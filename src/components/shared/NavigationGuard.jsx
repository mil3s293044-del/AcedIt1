import { useEffect } from 'react';

/**
 * Hook to register unsaved work with the navigation guard
 * @param {boolean} hasUnsavedWork - Whether component has unsaved work
 * @param {Function} onSave - Callback to save work
 */
export function useNavigationGuard(hasUnsavedWork, onSave) {
    useEffect(() => {
        const detail = { hasUnsavedWork, onSave };
        window.dispatchEvent(new CustomEvent('navigation-guard-status', { detail }));

        return () => {
            // Clear on unmount
            window.dispatchEvent(new CustomEvent('navigation-guard-status', { 
                detail: { hasUnsavedWork: false, onSave: null } 
            }));
        };
    }, [hasUnsavedWork, onSave]);
}

/**
 * Check if there's unsaved work before navigation
 * @returns {Promise<{hasUnsavedWork: boolean, onSave: Function|null}>}
 */
export function checkUnsavedWork() {
    return new Promise((resolve) => {
        let hasWork = false;
        let saveCallback = null;

        const handler = (event) => {
            if (event.detail?.hasUnsavedWork) {
                hasWork = true;
                saveCallback = event.detail.onSave;
            }
        };

        window.addEventListener('navigation-guard-status', handler);
        
        // Trigger check
        window.dispatchEvent(new CustomEvent('navigation-guard-check'));
        
        // Small delay to collect all responses
        setTimeout(() => {
            window.removeEventListener('navigation-guard-status', handler);
            resolve({ hasUnsavedWork: hasWork, onSave: saveCallback });
        }, 10);
    });
}