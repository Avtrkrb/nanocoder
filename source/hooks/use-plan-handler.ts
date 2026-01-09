/**
 * Plan Handler Hook - Manages plan workflows for Enhanced Plan Mode.
 */

import {useCallback} from 'react';
import type {ImplementationPlan, PlanMetadata, SavePlanOptions} from '@/types/plan';
import {getPlanManager} from '@/services/plan-manager';
import type {Logger} from '@/utils/logging/types';

export interface UsePlanHandlerOptions {
	logger: Logger;
	onPlanSaved?: (planId: string) => void;
	onPlanLoadError?: (error: Error) => void;
}

export interface PlanHandlerResult {
	savePlan: (plan: ImplementationPlan, options?: SavePlanOptions) => Promise<string>;
	loadPlan: (planId: string) => Promise<ImplementationPlan>;
	listPlans: () => Promise<PlanMetadata[]>;
	deletePlan: (planId: string) => Promise<void>;
	planExists: (planId: string) => Promise<boolean>;
	validateDirectory: () => boolean;
}

/**
 * Hook for managing plan operations.
 * @param options - Handler options including logger and callbacks
 * @returns Plan handler functions
 */
export function usePlanHandler(options: UsePlanHandlerOptions): PlanHandlerResult {
	const {logger, onPlanSaved, onPlanLoadError} = options;

	/**
	 * Saves a plan to disk.
	 */
	const savePlan = useCallback(
		async (plan: ImplementationPlan, saveOptions?: SavePlanOptions): Promise<string> => {
			try {
				const manager = getPlanManager();
				const result = await manager.savePlan(plan, saveOptions);
				logger.info(`Plan saved: ${result.planId}`);
				onPlanSaved?.(result.planId);
				return result.planId;
			} catch (error) {
				const message = `Failed to save plan: ${(error as Error).message}`;
				logger.error(message);
				throw new Error(message);
			}
		},
		[logger, onPlanSaved],
	);

	/**
	 * Loads a plan from disk.
	 */
	const loadPlan = useCallback(
		async (planId: string): Promise<ImplementationPlan> => {
			try {
				const manager = getPlanManager();
				const plan = await manager.loadPlan(planId);
				logger.info(`Plan loaded: ${planId}`);
				return plan;
			} catch (error) {
				const message = `Failed to load plan '${planId}': ${(error as Error).message}`;
				logger.error(message);
				onPlanLoadError?.(error as Error);
				throw new Error(message);
			}
		},
		[logger, onPlanLoadError],
	);

	/**
	 * Lists all available plans.
	 */
	const listPlans = useCallback(async (): Promise<PlanMetadata[]> => {
		try {
			const manager = getPlanManager();
			const plans = await manager.listPlans();
			logger.debug(`Found ${plans.length} plans`);
			return plans;
		} catch (error) {
			const message = `Failed to list plans: ${(error as Error).message}`;
			logger.error(message);
			return [];
		}
	}, [logger]);

	/**
	 * Deletes a plan.
	 */
	const deletePlan = useCallback(
		async (planId: string): Promise<void> => {
			try {
				const manager = getPlanManager();
				await manager.deletePlan(planId);
				logger.info(`Plan deleted: ${planId}`);
			} catch (error) {
				const message = `Failed to delete plan '${planId}': ${(error as Error).message}`;
				logger.error(message);
				throw new Error(message);
			}
		},
		[logger],
	);

	/**
	 * Checks if a plan exists.
	 */
	const planExists = useCallback(
		async (planId: string): Promise<boolean> => {
			try {
				const manager = getPlanManager();
				return await manager.planExists(planId);
			} catch {
				return false;
			}
		},
		[],
	);

	/**
	 * Validates the current directory for plan operations.
	 */
	const validateDirectory = useCallback((): boolean => {
		const manager = getPlanManager();
		const isValid = manager.validateProjectDirectory();
		if (!isValid) {
			logger.warn('Plan operations not allowed in home directory');
		}
		return isValid;
	}, [logger]);

	return {
		savePlan,
		loadPlan,
		listPlans,
		deletePlan,
		planExists,
		validateDirectory,
	};
}

/**
 * Extracts an implementation plan from tool calls and conversation context.
 * This is a utility function for building plans from detected patterns.
 */
export function extractPlanFromToolCalls(
	toolCalls: Array<{name: string; arguments: Record<string, unknown>}>,
	context?: string,
): ImplementationPlan {
	const tasks = toolCalls.map((call, index) => ({
		id: `task-${index + 1}`,
		description: `Execute ${call.name}`,
		tool: call.name,
		// Try to extract file path from common arguments
		file: 'path' in call.arguments ? (call.arguments.path as string) : undefined,
		status: 'pending' as const,
		toolCall: call as any,
	}));

	// Extract unique files
	const affectedFiles = Array.from(
		new Set(
			tasks
				.map(t => t.file)
				.filter((f): f is string => f !== undefined),
		),
	);

	return {
		id: '',
		timestamp: new Date().toISOString(),
		title: context?.split('\n')[0]?.substring(0, 100) || 'Implementation Plan',
		description: context || 'Plan extracted from conversation context',
		tasks,
		affectedFiles,
		estimatedComplexity: tasks.length > 5 ? 'high' : tasks.length > 2 ? 'medium' : 'low',
		approved: false,
	};
}
