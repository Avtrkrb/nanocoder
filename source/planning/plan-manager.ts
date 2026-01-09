/**
 * Plan Manager - Handles plan file operations
 *
 * Provides a high-level API for:
 * - Creating new plan files
 * - Saving plan content (markdown + metadata)
 * - Loading existing plans
 * - Listing all plans
 * - Deleting plans
 */

import {randomBytes} from 'node:crypto';
import {
	deletePlanFile,
	getPlanDirectory,
	getPlanJsonPath,
	getPlanMdPath,
	isValidProjectDirectory,
	listPlanFiles,
	loadPlanFile,
	loadPlanMarkdown,
	savePlanFile,
	updatePlanMarkdown,
} from './plan-file';
import type {PlanFile} from './types';

/**
 * Plan Manager class
 */
export class PlanManager {
	#cwd: string;

	constructor(cwd: string) {
		this.#cwd = cwd;
	}

	/**
	 * Create a new plan file
	 */
	async createPlan(userRequest: string): Promise<PlanFile> {
		// Validate directory
		if (!isValidProjectDirectory(this.#cwd)) {
			throw new Error(
				'Plan files can only be created in project directories, not in home directory',
			);
		}

		const slug = this.#generateSlug();
		const now = new Date();

		const planFile: PlanFile = {
			id: slug,
			slug,
			userRequest,
			phase: 'initial_understanding',
			clarifications: {},
			implementationPlan: '',
			filesToModify: [],
			verificationSteps: [],
			createdAt: now,
			updatedAt: now,
		};

		// Save the new plan file
		await savePlanFile(this.#cwd, planFile);

		return planFile;
	}

	/**
	 * Update plan file metadata
	 */
	async updatePlan(planFile: PlanFile): Promise<void> {
		planFile.updatedAt = new Date();
		await savePlanFile(this.#cwd, planFile);
	}

	/**
	 * Save plan markdown content
	 */
	async saveMarkdownContent(
		slug: string,
		markdownContent: string,
	): Promise<void> {
		await updatePlanMarkdown(this.#cwd, slug, markdownContent);
	}

	/**
	 * Save both plan file and markdown content
	 */
	async savePlanWithMarkdown(
		planFile: PlanFile,
		markdownContent: string,
	): Promise<void> {
		planFile.updatedAt = new Date();
		await savePlanFile(this.#cwd, planFile, markdownContent);
	}

	/**
	 * Load a plan file (metadata only)
	 */
	async loadPlan(slug: string): Promise<PlanFile | null> {
		return await loadPlanFile(this.#cwd, slug);
	}

	/**
	 * Load plan markdown content
	 */
	async loadMarkdown(slug: string): Promise<string | null> {
		return await loadPlanMarkdown(this.#cwd, slug);
	}

	/**
	 * Load both plan file and markdown content
	 */
	async loadPlanWithMarkdown(
		slug: string,
	): Promise<{planFile: PlanFile; markdown: string} | null> {
		const planFile = await loadPlanFile(this.#cwd, slug);
		if (!planFile) {
			return null;
		}

		const markdown = await loadPlanMarkdown(this.#cwd, slug);
		return {
			planFile,
			markdown: markdown || '',
		};
	}

	/**
	 * List all plan files in the current project
	 */
	async listPlans(): Promise<Array<{slug: string; planFile: PlanFile}>> {
		return await listPlanFiles(this.#cwd);
	}

	/**
	 * Delete a plan file (both markdown and JSON)
	 */
	async deletePlan(slug: string): Promise<void> {
		await deletePlanFile(this.#cwd, slug);
	}

	/**
	 * Get the plan directory path
	 */
	getPlanDirectoryPath(): string {
		return getPlanDirectory(this.#cwd);
	}

	/**
	 * Get the markdown file path for a plan
	 */
	getMarkdownPath(slug: string): string {
		return getPlanMdPath(this.#cwd, slug);
	}

	/**
	 * Get the JSON metadata file path for a plan
	 */
	getJsonPath(slug: string): string {
		return getPlanJsonPath(this.#cwd, slug);
	}

	/**
	 * Check if the current directory is valid for plan files
	 */
	isValidDirectory(): boolean {
		return isValidProjectDirectory(this.#cwd);
	}

	/**
	 * Generate a unique slug for a new plan
	 */
	#generateSlug(): string {
		return randomBytes(6).toString('hex');
	}

	/**
	 * Open a plan in external editor
	 * Returns the editor process exit code
	 */
	async openInEditor(slug: string): Promise<number> {
		const mdPath = getPlanMdPath(this.#cwd, slug);

		// Try to find an available editor
		const editor = process.env.VISUAL || process.env.EDITOR || 'code';

		const {spawn} = await import('node:child_process');

		return await new Promise((resolve, reject) => {
			const proc = spawn(editor, [mdPath], {
				stdio: 'inherit',
				detached: true,
			});

			proc.on('exit', code => {
				resolve(code ?? 0);
			});

			proc.on('error', error => {
				reject(error);
			});
		});
	}

	/**
	 * Get plan statistics
	 */
	async getPlanStats(): Promise<{
		totalPlans: number;
		phases: Record<string, number>;
		oldestPlan: Date | null;
		newestPlan: Date | null;
	}> {
		const plans = await this.listPlans();

		if (plans.length === 0) {
			return {
				totalPlans: 0,
				phases: {},
				oldestPlan: null,
				newestPlan: null,
			};
		}

		const phases: Record<string, number> = {};
		let oldest = plans[0].planFile.createdAt;
		let newest = plans[0].planFile.createdAt;

		for (const {planFile} of plans) {
			// Count phases
			phases[planFile.phase] = (phases[planFile.phase] || 0) + 1;

			// Track oldest
			if (planFile.createdAt < oldest) {
				oldest = planFile.createdAt;
			}

			// Track newest
			if (planFile.createdAt > newest) {
				newest = planFile.createdAt;
			}
		}

		return {
			totalPlans: plans.length,
			phases,
			oldestPlan: oldest,
			newestPlan: newest,
		};
	}

	/**
	 * Search plans by keyword
	 */
	async searchPlans(
		keyword: string,
	): Promise<Array<{slug: string; planFile: PlanFile}>> {
		const plans = await this.listPlans();
		const lowerKeyword = keyword.toLowerCase();

		return plans.filter(({planFile}) => {
			// Search in user request
			if (planFile.userRequest.toLowerCase().includes(lowerKeyword)) {
				return true;
			}

			// Search in implementation plan
			if (
				planFile.implementationPlan &&
				planFile.implementationPlan.toLowerCase().includes(lowerKeyword)
			) {
				return true;
			}

			// Search in clarifications
			for (const [key, value] of Object.entries(planFile.clarifications)) {
				if (
					key.toLowerCase().includes(lowerKeyword) ||
					String(value).toLowerCase().includes(lowerKeyword)
				) {
					return true;
				}
			}

			return false;
		});
	}
}

/**
 * Create a singleton instance per working directory
 */
const singletonCache = new Map<string, PlanManager>();

export function getPlanManager(cwd: string): PlanManager {
	if (!singletonCache.has(cwd)) {
		singletonCache.set(cwd, new PlanManager(cwd));
	}
	// Safe because we just created the instance if it didn't exist
	return singletonCache.get(cwd) as PlanManager;
}

export function clearPlanManagerCache(): void {
	singletonCache.clear();
}
