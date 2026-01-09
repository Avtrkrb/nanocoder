/**
 * Plan File Persistence - Handles saving and loading plan files
 *
 * Plans are stored in {projectRoot}/.nanocoder/plans/ as:
 * - {slug}.plan.md - Markdown content (human-readable)
 * - {slug}.plan.json - Metadata (machine-readable)
 */

import {mkdir, readdir, readFile, unlink, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import type {PlanFile} from './types';

/**
 * Plan directory name
 */
export const PLAN_DIR = '.nanocoder/plans';

/**
 * Plan file extensions
 */
export const PLAN_MD_EXT = '.plan.md';
export const PLAN_JSON_EXT = '.plan.json';

/**
 * Check if the current directory is a valid project directory
 * (not home directory or subdirectory of home)
 */
export function isValidProjectDirectory(cwd: string): boolean {
	const home = homedir();
	// Normalize paths for comparison
	const normalizedCwd = cwd.replace(/\\/g, '/');
	const normalizedHome = home.replace(/\\/g, '/');

	// Cannot be home directory itself
	if (normalizedCwd === normalizedHome) {
		return false;
	}

	// Cannot be a subdirectory of home
	if (normalizedCwd.startsWith(normalizedHome + '/')) {
		return false;
	}

	return true;
}

/**
 * Get the plan directory path for the current project
 */
export function getPlanDirectory(cwd: string): string {
	return join(cwd, PLAN_DIR);
}

/**
 * Ensure the plan directory exists
 */
export async function ensurePlanDirectory(cwd: string): Promise<void> {
	if (!isValidProjectDirectory(cwd)) {
		throw new Error(
			'Plan files can only be created in project directories, not in home directory',
		);
	}

	const planDir = getPlanDirectory(cwd);
	await mkdir(planDir, {recursive: true});
}

/**
 * Get the markdown file path for a plan
 */
export function getPlanMdPath(cwd: string, slug: string): string {
	return join(getPlanDirectory(cwd), `${slug}${PLAN_MD_EXT}`);
}

/**
 * Get the JSON metadata file path for a plan
 */
export function getPlanJsonPath(cwd: string, slug: string): string {
	return join(getPlanDirectory(cwd), `${slug}${PLAN_JSON_EXT}`);
}

/**
 * Generate plan markdown content from plan file data
 */
export function generatePlanMarkdown(planFile: PlanFile): string {
	const clarifications = Object.entries(planFile.clarifications)
		.map(([key, value]) => `**${key}**: ${JSON.stringify(value)}`)
		.join('\n');

	const filesList = planFile.filesToModify
		.map(file => `- \`${file}\``)
		.join('\n');

	const verificationSteps = planFile.verificationSteps
		.map((step, i) => `${i + 1}. ${step}`)
		.join('\n');

	return `# Plan: ${planFile.slug}

**Created:** ${planFile.createdAt.toISOString()}
**Updated:** ${planFile.updatedAt.toISOString()}
**Phase:** ${planFile.phase}

## User Request
${planFile.userRequest}

## Clarifications
${clarifications || 'None'}

## Implementation Plan
${planFile.implementationPlan || 'To be determined...'}

## Files to Modify
${filesList || 'None identified yet'}

## Verification
${verificationSteps || 'To be determined...'}
`;
}

/**
 * Save a plan file (both markdown and JSON)
 */
export async function savePlanFile(
	cwd: string,
	planFile: PlanFile,
	markdownContent?: string,
): Promise<void> {
	await ensurePlanDirectory(cwd);

	const mdPath = getPlanMdPath(cwd, planFile.slug);
	const jsonPath = getPlanJsonPath(cwd, planFile.slug);

	// Save markdown content
	const content = markdownContent || generatePlanMarkdown(planFile);
	await writeFile(mdPath, content, 'utf8');

	// Save JSON metadata
	await writeFile(jsonPath, JSON.stringify(planFile, null, 2), 'utf8');
}

/**
 * Load a plan file (JSON metadata only)
 */
export async function loadPlanFile(
	cwd: string,
	slug: string,
): Promise<PlanFile | null> {
	const jsonPath = getPlanJsonPath(cwd, slug);

	try {
		const content = await readFile(jsonPath, 'utf8');
		const data = JSON.parse(content) as PlanFile;

		// Convert date strings back to Date objects
		return {
			...data,
			createdAt: new Date(data.createdAt),
			updatedAt: new Date(data.updatedAt),
		};
	} catch {
		return null;
	}
}

/**
 * Load plan markdown content
 */
export async function loadPlanMarkdown(
	cwd: string,
	slug: string,
): Promise<string | null> {
	const mdPath = getPlanMdPath(cwd, slug);

	try {
		return await readFile(mdPath, 'utf8');
	} catch {
		return null;
	}
}

/**
 * Delete a plan file (both markdown and JSON)
 */
export async function deletePlanFile(cwd: string, slug: string): Promise<void> {
	const mdPath = getPlanMdPath(cwd, slug);
	const jsonPath = getPlanJsonPath(cwd, slug);

	try {
		await unlink(mdPath);
	} catch {
		// Ignore if file doesn't exist
	}

	try {
		await unlink(jsonPath);
	} catch {
		// Ignore if file doesn't exist
	}
}

/**
 * List all plan files in the current project
 */
export async function listPlanFiles(
	cwd: string,
): Promise<Array<{slug: string; planFile: PlanFile}>> {
	const planDir = getPlanDirectory(cwd);

	let entries: string[];
	try {
		entries = await readdir(planDir);
	} catch {
		// Directory doesn't exist yet
		return [];
	}

	// Filter for .plan.json files and extract slugs
	const jsonFiles = entries.filter(entry => entry.endsWith(PLAN_JSON_EXT));
	const slugs = jsonFiles.map(file => file.replace(PLAN_JSON_EXT, ''));

	// Load metadata for each plan
	const plans: Array<{slug: string; planFile: PlanFile}> = [];
	for (const slug of slugs) {
		const planFile = await loadPlanFile(cwd, slug);
		if (planFile) {
			plans.push({slug, planFile});
		}
	}

	// Sort by creation date (newest first)
	return plans.sort(
		(a, b) => b.planFile.createdAt.getTime() - a.planFile.createdAt.getTime(),
	);
}

/**
 * Update plan markdown content only
 */
export async function updatePlanMarkdown(
	cwd: string,
	slug: string,
	markdownContent: string,
): Promise<void> {
	const mdPath = getPlanMdPath(cwd, slug);
	await writeFile(mdPath, markdownContent, 'utf8');

	// Also update the updatedAt timestamp in the JSON metadata
	const planFile = await loadPlanFile(cwd, slug);
	if (planFile) {
		planFile.updatedAt = new Date();
		const jsonPath = getPlanJsonPath(cwd, slug);
		await writeFile(jsonPath, JSON.stringify(planFile, null, 2), 'utf8');
	}
}
