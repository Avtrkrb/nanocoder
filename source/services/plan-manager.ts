/**
 * Plan Manager - Handles storage, retrieval, and listing of implementation plans.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
	ImplementationPlan,
	LoadPlanOptions,
	PlanComplexity,
	PlanMetadata,
	SavePlanOptions,
	SavePlanResult,
} from '@/types/plan';

/**
 * Manages implementation plans for the Enhanced Plan Mode feature.
 * Plans are stored as markdown files with YAML frontmatter in `.nanocoder/plans/`.
 */
export class PlanManager {
	private readonly plansDir: string;
	private readonly workspaceRoot: string;

	/**
	 * Creates a new PlanManager instance.
	 * @param workspaceRoot - Root directory of the workspace (defaults to current working directory)
	 */
	constructor(workspaceRoot: string = process.cwd()) {
		this.workspaceRoot = workspaceRoot;
		this.plansDir = path.join(workspaceRoot, '.nanocoder', 'plans');
	}

	/**
	 * Validates that the current directory is not the user's home directory.
	 * @returns true if in a valid project directory, false if in home directory
	 */
	validateProjectDirectory(): boolean {
		const homeDir = os.homedir();
		const currentDir = path.resolve(this.workspaceRoot);
		return currentDir !== path.resolve(homeDir);
	}

	/**
	 * Ensures the plans directory exists, creating it if necessary.
	 */
	async ensurePlansDir(): Promise<void> {
		if (!this.validateProjectDirectory()) {
			throw new Error(
				'Plans can only be created in project directories, not in your home directory.',
			);
		}

		await fs.mkdir(this.plansDir, {recursive: true});
	}

	/**
	 * Generates a unique plan ID based on the current timestamp.
	 * @returns A plan ID in the format `plan-YYYY-MM-DD-HH-MM-SS`
	 */
	generatePlanId(): string {
		const now = new Date();
		const timestamp = now
			.toISOString()
			.replace(/[:.]/g, '-')
			.replace('T', '-')
			.split('.')[0];
		return `plan-${timestamp}`;
	}

	/**
	 * Generates the filename for a plan.
	 * @param planId - The plan ID
	 * @returns The filename (e.g., `plan-2025-01-02-15-30-45.md`)
	 */
	getPlanFilename(planId: string): string {
		return `${planId}.md`;
	}

	/**
	 * Gets the full file path for a plan.
	 * @param planId - The plan ID
	 * @returns The full file path
	 */
	getPlanPath(planId: string): string {
		return path.join(this.plansDir, this.getPlanFilename(planId));
	}

	/**
	 * Saves an implementation plan to disk.
	 * @param plan - The plan to save
	 * @param options - Optional save options
	 * @returns The save result with plan ID and file path
	 */
	async savePlan(
		plan: ImplementationPlan,
		options: SavePlanOptions = {},
	): Promise<SavePlanResult> {
		await this.ensurePlansDir();

		const planId = plan.id || this.generatePlanId();
		const filePath = this.getPlanPath(planId);

		// Build the plan with options applied
		const planToSave: ImplementationPlan = {
			...plan,
			id: planId,
			title: options.title ?? plan.title,
			description: options.description ?? plan.description,
			estimatedComplexity: options.estimatedComplexity ?? plan.estimatedComplexity,
		};

		// Generate markdown content with YAML frontmatter
		const content = this.formatPlanAsMarkdown(planToSave);

		await fs.writeFile(filePath, content, 'utf-8');

		return {
			planId,
			filePath,
			tasksCount: planToSave.tasks.length,
		};
	}

	/**
	 * Formats an implementation plan as markdown with YAML frontmatter.
	 * @param plan - The plan to format
	 * @returns The formatted markdown content
	 */
	private formatPlanAsMarkdown(plan: ImplementationPlan): string {
		const {id, timestamp, title, description, tasks, affectedFiles, estimatedComplexity} =
			plan;

		// Count unique files
		const filesCount = affectedFiles.length > 0 ? affectedFiles.length : this.countUniqueFiles(tasks);

		// YAML frontmatter
		const frontmatter = [
			'---',
			`id: ${id}`,
			`timestamp: ${timestamp}`,
			`title: ${this.escapeYaml(title)}`,
			`complexity: ${estimatedComplexity || 'medium'}`,
			`tasks: ${tasks.length}`,
			`files: ${filesCount}`,
			`approved: ${plan.approved ? 'true' : 'false'}`,
			'---',
			'',
		].join('\n');

		// Plan content
		const content = [
			`# ${title}`,
			'',
			description,
			'',
			`**Created:** ${new Date(timestamp).toLocaleString()}`,
			`**Complexity:** ${estimatedComplexity || 'medium'}`,
			`**Tasks:** ${tasks.length}`,
			`**Files:** ${filesCount}`,
			'',
			'## Tasks',
			'',
		];

		// Add each task
		for (const [index, task] of tasks.entries()) {
			const statusEmoji = this.getStatusEmoji(task.status);
			content.push(`${index + 1}. ${statusEmoji} ${task.description}`);
			if (task.file) {
				content.push(`   - **File:** \`${task.file}\``);
			}
			if (task.tool) {
				content.push(`   - **Tool:** ${task.tool}`);
			}
			content.push('');
		}

		// Add affected files summary
		if (affectedFiles.length > 0) {
			content.push('## Affected Files');
			content.push('');
			for (const file of affectedFiles) {
				content.push(`- \`${file}\``);
			}
			content.push('');
		}

		return frontmatter + content.join('\n');
	}

	/**
	 * Counts the number of unique files referenced in tasks.
	 * @param tasks - The tasks to analyze
	 * @returns The count of unique files
	 */
	private countUniqueFiles(tasks: ImplementationPlan['tasks']): number {
		const files = new Set<string>();
		for (const task of tasks) {
			if (task.file) {
				files.add(task.file);
			}
		}
		return files.size;
	}

	/**
	 * Gets the emoji representing a task status.
	 * @param status - The task status
	 * @returns The emoji character
	 */
	private getStatusEmoji(status: string): string {
		switch (status) {
			case 'approved':
				return '✅';
			case 'rejected':
				return '❌';
			default:
				return '⏳';
		}
	}

	/**
	 * Escapes a string for use in YAML.
	 * @param value - The value to escape
	 * @returns The escaped value
	 */
	private escapeYaml(value: string): string {
		// If value contains special characters, quote it
		if (/[:\n\r"'\\]/.test(value)) {
			return JSON.stringify(value);
		}
		return value;
	}

	/**
	 * Parses YAML frontmatter from a markdown file.
	 * @param content - The markdown content
	 * @returns The parsed frontmatter object
	 */
	private parseFrontmatter(content: string): Record<string, string | number | boolean> {
		const match = content.match(/^---\n([\s\S]+?)\n---/);
		if (!match) {
			return {};
		}

		const frontmatter: Record<string, string | number | boolean> = {};
		const lines = match[1].split('\n');

		for (const line of lines) {
			const [key, ...valueParts] = line.split(':');
			if (key && valueParts.length > 0) {
				let value: string | number | boolean = valueParts.join(':').trim();
				// Parse booleans
				if (value === 'true') value = true;
				if (value === 'false') value = false;
				// Parse numbers
				if (/^\d+$/.test(value as string)) value = Number.parseInt(value as string, 10);
				frontmatter[key.trim()] = value;
			}
		}

		return frontmatter;
	}

	/**
	 * Loads a plan from disk.
	 * @param planId - The plan ID to load
	 * @param options - Optional load options
	 * @returns The loaded plan
	 */
	async loadPlan(planId: string, options: LoadPlanOptions = {}): Promise<ImplementationPlan> {
		const filePath = this.getPlanPath(planId);

		try {
			const content = await fs.readFile(filePath, 'utf-8');
			const frontmatter = this.parseFrontmatter(content);

			// Extract title from content (first # heading)
			const titleMatch = content.match(/^#\s+(.+)$/m);
			const title = titleMatch ? titleMatch[1] : (frontmatter.title as string) || 'Untitled Plan';

			// Extract description (content after title until next ## heading)
			const descriptionMatch = content.match(/^#\s+.+?\n\n([\s\S]+?)\n\n##/m);
			const description = descriptionMatch
				? descriptionMatch[1].trim()
				: (frontmatter.description as string) || '';

			return {
				id: (frontmatter.id as string) || planId,
				timestamp: (frontmatter.timestamp as string) || new Date().toISOString(),
				title,
				description,
				tasks: [], // Tasks would need to be parsed from the content
				affectedFiles: [],
				estimatedComplexity: frontmatter.complexity as PlanComplexity | undefined,
				approved: frontmatter.approved === true,
			};
		} catch (error) {
			throw new Error(`Failed to load plan '${planId}': ${(error as Error).message}`);
		}
	}

	/**
	 * Lists all saved plans with their metadata.
	 * @returns Array of plan metadata
	 */
	async listPlans(): Promise<PlanMetadata[]> {
		try {
			await this.ensurePlansDir();
		} catch {
			// Directory validation failed
			return [];
		}

		try {
			const entries = await fs.readdir(this.plansDir);
			const planFiles = entries.filter(entry => entry.endsWith('.md'));

			const plans: PlanMetadata[] = [];

			for (const file of planFiles) {
				const filePath = path.join(this.plansDir, file);
				try {
					const content = await fs.readFile(filePath, 'utf-8');
					const frontmatter = this.parseFrontmatter(content);

					// Extract title from content
					const titleMatch = content.match(/^#\s+(.+)$/m);
					const title = titleMatch ? titleMatch[1] : (frontmatter.title as string) || file;

					plans.push({
						id: (frontmatter.id as string) || file.replace('.md', ''),
						timestamp: (frontmatter.timestamp as string) || new Date().toISOString(),
						title,
						tasksCount: (frontmatter.tasks as number) || 0,
						filesCount: (frontmatter.files as number) || 0,
						complexity: frontmatter.complexity as PlanComplexity | undefined,
						filePath,
					});
				} catch {
					// Skip files that can't be read or parsed
					// eslint-disable-next-line no-continue
					continue;
				}
			}

			// Sort by timestamp, newest first
			plans.sort((a, b) => {
				const dateA = new Date(a.timestamp).getTime();
				const dateB = new Date(b.timestamp).getTime();
				return dateB - dateA;
			});

			return plans;
		} catch {
			return [];
		}
	}

	/**
	 * Deletes a plan.
	 * @param planId - The plan ID to delete
	 */
	async deletePlan(planId: string): Promise<void> {
		const filePath = this.getPlanPath(planId);
		await fs.unlink(filePath);
	}

	/**
	 * Checks if a plan exists.
	 * @param planId - The plan ID to check
	 * @returns true if the plan exists, false otherwise
	 */
	async planExists(planId: string): Promise<boolean> {
		const filePath = this.getPlanPath(planId);
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}
}

/**
 * Default singleton instance using the current working directory.
 */
let defaultInstance: PlanManager | undefined;

/**
 * Gets the default PlanManager instance for the current workspace.
 * @returns The PlanManager instance
 */
export function getPlanManager(): PlanManager {
	if (!defaultInstance) {
		defaultInstance = new PlanManager();
	}
	return defaultInstance;
}

/**
 * Resets the default PlanManager instance (useful for testing).
 */
export function resetPlanManager(): void {
	defaultInstance = undefined;
}
