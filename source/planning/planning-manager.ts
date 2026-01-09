/**
 * Planning Manager - Core state machine for the enhanced Plan Mode
 *
 * Manages the 5-phase planning workflow:
 * - Phase transitions and state tracking
 * - Tool restrictions per phase
 * - Plan file integration
 */

import {randomBytes, randomUUID} from 'node:crypto';
import {EventEmitter} from 'node:events';
import type {PlanFile, PlanningPhase, PlanningState} from './types';
import {
	canTransitionToPhase,
	createInitialPlanningState,
	getNextPhase,
	isToolAllowedInPhase,
	PHASE_ALLOWED_TOOLS,
	PLANNING_PHASE_LABELS,
	PLANNING_PHASE_ORDER,
} from './types';

/**
 * Planning manager events
 */
export interface PlanningEvents {
	phaseChanged: (phase: PlanningPhase) => void;
	planCreated: (planFile: PlanFile) => void;
	planUpdated: (planFile: PlanFile) => void;
	enabled: () => void;
	disabled: () => void;
}

export declare interface PlanningManager {
	on: <K extends keyof PlanningEvents>(
		event: K,
		listener: PlanningEvents[K],
	) => this;
	emit: <K extends keyof PlanningEvents>(
		event: K,
		...args: Parameters<PlanningEvents[K]>
	) => boolean;
}

/**
 * Planning Manager class
 *
 * Manages the planning workflow state, phase transitions, and tool restrictions.
 * Extends EventEmitter for state change notifications.
 */
export class PlanningManager extends EventEmitter {
	#state: PlanningState;

	constructor() {
		super();
		this.#state = createInitialPlanningState();
	}

	/**
	 * Get the current planning state (read-only)
	 */
	get state(): Readonly<PlanningState> {
		return this.#state;
	}

	/**
	 * Get the current planning phase
	 */
	get currentPhase(): PlanningPhase {
		return this.#state.currentPhase;
	}

	/**
	 * Get the current plan file
	 */
	get planFile(): PlanFile | null {
		return this.#state.planFile;
	}

	/**
	 * Check if planning mode is enabled
	 */
	get enabled(): boolean {
		return this.#state.enabled;
	}

	/**
	 * Enable planning mode
	 */
	enable(): void {
		if (this.#state.enabled) {
			return;
		}

		this.#state.enabled = true;
		this.#state.currentPhase = 'initial_understanding';
		this.emit('enabled');
	}

	/**
	 * Disable planning mode and reset state
	 */
	disable(): void {
		if (!this.#state.enabled) {
			return;
		}

		this.#state = createInitialPlanningState();
		this.emit('disabled');
	}

	/**
	 * Transition to the next phase in the workflow
	 * Returns true if transition was successful, false otherwise
	 */
	transitionToNextPhase(): boolean {
		if (!this.#state.enabled) {
			return false;
		}

		// Mark current phase as completed
		this.#state.phaseProgress[this.#state.currentPhase].completed = true;

		// Get next phase
		const nextPhase = getNextPhase(this.#state.currentPhase);
		if (!nextPhase) {
			return false;
		}

		// Update phase
		this.#state.currentPhase = nextPhase;

		// Update plan file phase if exists
		if (this.#state.planFile) {
			this.#state.planFile.phase = nextPhase;
			this.#state.planFile.updatedAt = new Date();
			this.emit('planUpdated', this.#state.planFile);
		}

		this.emit('phaseChanged', nextPhase);
		return true;
	}

	/**
	 * Set the planning phase directly (only for testing/debugging)
	 * In normal flow, use transitionToNextPhase()
	 */
	setPhase(phase: PlanningPhase): void {
		if (!this.#state.enabled) {
			return;
		}

		if (!canTransitionToPhase(this.#state.currentPhase, phase)) {
			throw new Error(
				`Cannot transition from ${this.#state.currentPhase} to ${phase}`,
			);
		}

		this.#state.currentPhase = phase;

		if (this.#state.planFile) {
			this.#state.planFile.phase = phase;
			this.#state.planFile.updatedAt = new Date();
			this.emit('planUpdated', this.#state.planFile);
		}

		this.emit('phaseChanged', phase);
	}

	/**
	 * Check if a tool is allowed in the current phase
	 */
	isToolAllowed(toolName: string): boolean {
		if (!this.#state.enabled) {
			return true; // All tools allowed when planning is disabled
		}

		return isToolAllowedInPhase(toolName, this.#state.currentPhase);
	}

	/**
	 * Get allowed tools for the current phase
	 */
	getAllowedTools(): readonly string[] {
		if (!this.#state.enabled) {
			return []; // No restriction when planning is disabled
		}

		return PHASE_ALLOWED_TOOLS[this.#state.currentPhase];
	}

	/**
	 * Add a step to the current phase progress
	 */
	addStep(step: string): void {
		this.#state.phaseProgress[this.#state.currentPhase].steps.push(step);
	}

	/**
	 * Add notes to the current phase
	 */
	setNotes(notes: string): void {
		this.#state.phaseProgress[this.#state.currentPhase].notes = notes;
	}

	/**
	 * Create a new plan file
	 */
	createPlanFile(userRequest: string): PlanFile {
		const slug = this.#generateSlug();
		const now = new Date();

		const planFile: PlanFile = {
			id: randomUUID(),
			slug,
			createdAt: now,
			updatedAt: now,
			phase: this.#state.currentPhase,
			userRequest,
			clarifications: {},
			implementationPlan: '',
			filesToModify: [],
			verificationSteps: [],
		};

		this.#state.planFile = planFile;
		this.emit('planCreated', planFile);
		return planFile;
	}

	/**
	 * Update the plan file
	 */
	updatePlanFile(
		updates: Partial<Omit<PlanFile, 'id' | 'slug' | 'createdAt'>>,
	): void {
		if (!this.#state.planFile) {
			return;
		}

		this.#state.planFile = {
			...this.#state.planFile,
			...updates,
			updatedAt: new Date(),
		};

		this.emit('planUpdated', this.#state.planFile);
	}

	/**
	 * Clear the plan file
	 */
	clearPlanFile(): void {
		this.#state.planFile = null;
	}

	/**
	 * Add a clarification to the plan file
	 */
	addClarification(key: string, value: unknown): void {
		if (!this.#state.planFile) {
			return;
		}

		this.#state.planFile.clarifications[key] = value;
		this.#state.planFile.updatedAt = new Date();
		this.emit('planUpdated', this.#state.planFile);
	}

	/**
	 * Get the phase label for display
	 */
	getPhaseLabel(phase?: PlanningPhase): string {
		return PLANNING_PHASE_LABELS[phase ?? this.#state.currentPhase];
	}

	/**
	 * Get all phase labels in order
	 */
	getAllPhaseLabels(): readonly string[] {
		return PLANNING_PHASE_ORDER.map(phase => PLANNING_PHASE_LABELS[phase]);
	}

	/**
	 * Generate a unique slug for plan files
	 */
	#generateSlug(): string {
		// Generate 12-character random string using the same pattern as other ID generation in the codebase
		return randomBytes(6).toString('hex');
	}
}

/**
 * Singleton instance of the planning manager
 */
let planningManagerInstance: PlanningManager | null = null;

export function getPlanningManager(): PlanningManager {
	if (!planningManagerInstance) {
		planningManagerInstance = new PlanningManager();
	}
	return planningManagerInstance;
}
