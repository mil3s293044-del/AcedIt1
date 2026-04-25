import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Custom hook for autosaving AI tool conversations
 * @param {Object} params
 * @param {string} params.toolType - Type of AI tool (math_tutor, teaching_assistant, etc.)
 * @param {string} params.savedResultId - ID of the saved result if loaded from history
 * @param {any} params.data - Data to autosave
 * @param {boolean} params.enabled - Whether autosave is enabled
 * @param {number} params.intervalMs - Autosave interval in milliseconds (default 30000 = 30s)
 */
export function useAutoSave({ toolType, savedResultId, data, enabled = false, intervalMs = 30000 }) {
    const lastSaveRef = useRef(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!enabled || !savedResultId || !data) {
            return;
        }

        const performAutoSave = async () => {
            try {
                // Check if data has changed
                const dataString = JSON.stringify(data);
                if (lastSaveRef.current === dataString) {
                    return; // No changes, skip save
                }

                await base44.entities.AISavedResult.update(savedResultId, {
                    content: typeof data === 'string' ? data : JSON.stringify(data),
                    input_data: data
                });

                lastSaveRef.current = dataString;
                console.log(`Autosaved ${toolType} at ${new Date().toLocaleTimeString()}`);
            } catch (error) {
                console.error('Autosave failed:', error);
            }
        };

        // Perform autosave on interval
        intervalRef.current = setInterval(performAutoSave, intervalMs);

        // Cleanup
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, savedResultId, data, intervalMs, toolType]);
}

/**
 * Custom hook for temporary state preservation across tab switches
 * @param {string} key - Unique key for storing state
 * @param {any} state - Current state to preserve
 * @param {boolean} enabled - Whether to preserve state
 */
export function useTemporaryState(key, state, enabled = true) {
    const stateRef = useRef(state);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Save to sessionStorage when enabled
    useEffect(() => {
        if (!enabled || !key) return;

        const saveState = () => {
            try {
                sessionStorage.setItem(`temp_${key}`, JSON.stringify(stateRef.current));
            } catch (error) {
                console.error('Failed to save temporary state:', error);
            }
        };

        // Save on unmount
        return () => {
            saveState();
        };
    }, [key, enabled]);

    // Load from sessionStorage on mount
    useEffect(() => {
        if (!enabled || !key) return;

        try {
            const saved = sessionStorage.getItem(`temp_${key}`);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load temporary state:', error);
        }
        return null;
    }, []);
}

/**
 * Clear temporary state for a specific key
 */
export function clearTemporaryState(key) {
    try {
        sessionStorage.removeItem(`temp_${key}`);
    } catch (error) {
        console.error('Failed to clear temporary state:', error);
    }
}