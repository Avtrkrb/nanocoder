import {getPlanningManager} from '@/planning/planning-manager';
import type {DevelopmentMode} from '@/types/core';

/**
 * Global development mode state
 * This is used by tool definitions to determine needsApproval dynamically
 * Updated via setCurrentMode() when mode changes in the UI
 */
let currentMode: DevelopmentMode = 'normal';

/**
 * Get the current development mode
 * Used by tool definitions to determine if approval is needed
 */
export function getCurrentMode(): DevelopmentMode {
	return currentMode;
}

/**
 * Set the current development mode
 * Called by the app when mode changes via Shift+Tab
 */
export function setCurrentMode(mode: DevelopmentMode): void {
	currentMode = mode;

	// Sync planning state based on mode
	const planningManager = getPlanningManager();
	if (mode === 'plan') {
		planningManager.enable();
	} else {
		planningManager.disable();
	}
}

/**
 * Check if a tool is allowed in the current context
 * Takes into account both the development mode and planning phase
 *
 * @param toolName - The name of the tool to check
 * @returns true if the tool is allowed, false otherwise
 */
export function isToolAllowed(toolName: string): boolean {
	const mode = getCurrentMode();
	const planningManager = getPlanningManager();

	// When planning mode is enabled, check phase-specific restrictions
	if (mode === 'plan' && planningManager.enabled) {
		return planningManager.isToolAllowed(toolName);
	}

	// Otherwise, all tools are allowed (subject to individual tool's needsApproval)
	return true;
}

/**
 * Get the current planning phase (if in plan mode)
 */
export function getCurrentPlanningPhase() {
	const planningManager = getPlanningManager();
	return planningManager.enabled ? planningManager.currentPhase : null;
}
