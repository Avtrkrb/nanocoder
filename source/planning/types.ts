/**
 * Planning phase types for the enhanced Plan Mode implementation
 *
 * The planning system implements a structured 5-phase workflow:
 * 1. initial_understanding - Explore codebase with read-only tools
 * 2. design - Create plan file (read + write_plan_file only)
 * 3. review - Review collected information (read-only)
 * 4. final_plan - Finalize plan document (read-only)
 * 5. exit - Wait for user approval (no tools)
 */

/**
 * The five phases of the planning workflow
 */
export type PlanningPhase =
	| 'initial_understanding'
	| 'design'
	| 'review'
	| 'final_plan'
	| 'exit';

/**
 * Planning phase order for transitions
 */
export const PLANNING_PHASE_ORDER: readonly PlanningPhase[] = [
	'initial_understanding',
	'design',
	'review',
	'final_plan',
	'exit',
] as const;

/**
 * Human-readable labels for each planning phase
 */
export const PLANNING_PHASE_LABELS: Record<PlanningPhase, string> = {
	initial_understanding: '🔍 Understanding',
	design: '📝 Designing',
	review: '👀 Reviewing',
	final_plan: '✨ Finalizing',
	exit: '✅ Ready for Approval',
};

/**
 * Tools allowed in each phase (empty array = no tools allowed)
 */
export const PHASE_ALLOWED_TOOLS: Record<PlanningPhase, readonly string[]> = {
	initial_understanding: [
		'read_file',
		'find_files',
		'search_file_contents',
		'list_directory',
	] as const,
	design: [
		'read_file',
		'find_files',
		'search_file_contents',
		'list_directory',
		'write_plan_file',
	] as const,
	review: [
		'read_file',
		'find_files',
		'search_file_contents',
		'list_directory',
	] as const,
	final_plan: [
		'read_file',
		'find_files',
		'search_file_contents',
		'list_directory',
	] as const,
	exit: [] as const,
};

/**
 * Progress tracking for a single phase
 */
export interface PhaseProgress {
	completed: boolean;
	steps: string[];
	notes?: string;
}

/**
 * Main planning state structure
 */
export interface PlanningState {
	currentPhase: PlanningPhase;
	planFile: PlanFile | null;
	phaseProgress: Record<PlanningPhase, PhaseProgress>;
	enabled: boolean;
}

/**
 * Plan file metadata (stored as .plan.json)
 */
export interface PlanFile {
	id: string;
	slug: string;
	createdAt: Date;
	updatedAt: Date;
	phase: PlanningPhase;
	userRequest: string;
	clarifications: Record<string, unknown>;
	implementationPlan: string;
	filesToModify: string[];
	verificationSteps: string[];
}

/**
 * Plan file content (stored as .plan.md)
 */
export interface PlanContent {
	title: string;
	created: string;
	updated: string;
	phase: PlanningPhase;
	userRequest: string;
	clarifications: string;
	implementationPlan: string;
	filesToModify: string;
	verification: string;
}

/**
 * Default initial planning state
 */
export function createInitialPlanningState(): PlanningState {
	return {
		currentPhase: 'initial_understanding',
		planFile: null,
		enabled: false,
		phaseProgress: {
			initial_understanding: {completed: false, steps: []},
			design: {completed: false, steps: []},
			review: {completed: false, steps: []},
			final_plan: {completed: false, steps: []},
			exit: {completed: false, steps: []},
		},
	};
}

/**
 * Check if a tool is allowed in the current phase
 */
export function isToolAllowedInPhase(
	toolName: string,
	phase: PlanningPhase,
): boolean {
	const allowedTools = PHASE_ALLOWED_TOOLS[phase];
	return allowedTools.includes(toolName);
}

/**
 * Get the next phase in the workflow
 */
export function getNextPhase(
	currentPhase: PlanningPhase,
): PlanningPhase | null {
	const currentIndex = PLANNING_PHASE_ORDER.indexOf(currentPhase);
	if (currentIndex === -1 || currentIndex === PLANNING_PHASE_ORDER.length - 1) {
		return null;
	}
	return PLANNING_PHASE_ORDER[currentIndex + 1];
}

/**
 * Check if a phase can transition to another phase
 * (only forward transitions allowed)
 */
export function canTransitionToPhase(
	from: PlanningPhase,
	to: PlanningPhase,
): boolean {
	const fromIndex = PLANNING_PHASE_ORDER.indexOf(from);
	const toIndex = PLANNING_PHASE_ORDER.indexOf(to);
	return toIndex === fromIndex + 1;
}
