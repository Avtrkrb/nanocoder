/**
 * Plan-related type definitions for the Enhanced Plan Mode feature.
 */

import type {ToolCall} from '@/types/core';

/**
 * Status of a plan task.
 */
export type PlanTaskStatus = 'pending' | 'approved' | 'rejected';

/**
 * Estimated complexity level of a plan or task.
 */
export type PlanComplexity = 'low' | 'medium' | 'high';

/**
 * A single task within an implementation plan.
 */
export interface PlanTask {
	/** Unique identifier for the task */
	id: string;
	/** Human-readable description of the task */
	description: string;
	/** File affected by this task (optional) */
	file?: string;
	/** Tool or operation to be performed (optional) */
	tool?: string;
	/** Current status of the task */
	status: PlanTaskStatus;
	/** Tool call details if this task represents a tool execution */
	toolCall?: ToolCall;
}

/**
 * Metadata about a saved plan.
 */
export interface PlanMetadata {
	/** Unique plan identifier (matches filename without extension) */
	id: string;
	/** ISO 8601 timestamp of plan creation */
	timestamp: string;
	/** Plan title or short description */
	title: string;
	/** Number of tasks in the plan */
	tasksCount: number;
	/** Number of unique files affected */
	filesCount: number;
	/** Estimated complexity (if provided) */
	complexity?: PlanComplexity;
	/** Full path to the plan file */
	filePath: string;
}

/**
 * Complete implementation plan.
 */
export interface ImplementationPlan {
	/** Unique plan identifier */
	id: string;
	/** ISO 8601 timestamp of plan creation */
	timestamp: string;
	/** Plan title */
	title: string;
	/** Detailed description of the plan */
	description: string;
	/** List of tasks in the plan */
	tasks: PlanTask[];
	/** List of unique files affected by the plan */
	affectedFiles: string[];
	/** Estimated complexity of the plan */
	estimatedComplexity?: PlanComplexity;
	/** Current approval status */
	approved: boolean;
}

/**
 * Options for saving a plan.
 */
export interface SavePlanOptions {
	/** Override the plan title (optional) */
	title?: string;
	/** Override the description (optional) */
	description?: string;
	/** Override the estimated complexity (optional) */
	estimatedComplexity?: PlanComplexity;
}

/**
 * Result of a plan save operation.
 */
export interface SavePlanResult {
	/** The plan ID */
	planId: string;
	/** Full path to the saved plan file */
	filePath: string;
	/** Number of tasks saved */
	tasksCount: number;
}

/**
 * Options for loading a plan.
 */
export interface LoadPlanOptions {
	/** Whether to include full task details */
	includeTasks?: boolean;
}
