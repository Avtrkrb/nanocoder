/**
 * Git Workflow Integration Types
 *
 * TypeScript interfaces for the advanced git workflow tools
 */

/**
 * Conventional commit type categories
 */
export type CommitType =
	| 'feat' // New feature
	| 'fix' // Bug fix
	| 'docs' // Documentation only changes
	| 'style' // Changes that don't affect code meaning (formatting)
	| 'refactor' // Code change that neither fixes a bug nor adds a feature
	| 'perf' // Performance improvement
	| 'test' // Adding missing tests or correcting existing tests
	| 'build' // Changes to build system or external dependencies
	| 'ci' // Changes to CI configuration files and scripts
	| 'chore' // Other changes that don't modify src or test files
	| 'revert'; // Reverts a previous commit

/**
 * File change status from git
 */
export type FileChangeStatus =
	| 'added'
	| 'modified'
	| 'deleted'
	| 'renamed'
	| 'copied';

/**
 * Represents a single file change in a git diff
 */
export interface FileChange {
	path: string;
	status: FileChangeStatus;
	oldPath?: string; // For renames
	additions: number;
	deletions: number;
	isBinary: boolean;
}

/**
 * Analysis result from parsing git diff
 */
export interface DiffAnalysis {
	files: FileChange[];
	totalAdditions: number;
	totalDeletions: number;
	totalFiles: number;
	suggestedType: CommitType;
	suggestedScope?: string;
	isBreakingChange: boolean;
	breakingChangeReason?: string;
}

/**
 * Generated commit message structure
 */
export interface GeneratedCommit {
	type: CommitType;
	scope?: string;
	subject: string;
	body?: string;
	footer?: string;
	isBreakingChange: boolean;
	fullMessage: string;
}

/**
 * Branch workflow strategies
 */
export type WorkflowStrategy =
	| 'feature-branch'
	| 'gitflow'
	| 'trunk-based'
	| 'release-flow';

/**
 * PR template structure
 */
export interface PRTemplate {
	title: string;
	summary: string;
	changes: string[];
	testPlan: string[];
	breakingChanges?: string[];
	suggestedReviewers?: string[];
	labels?: string[];
}

/**
 * Enhanced git status result
 */
export interface EnhancedStatus {
	branch: string;
	upstream?: string;
	ahead: number;
	behind: number;
	staged: FileChange[];
	unstaged: FileChange[];
	untracked: string[];
	hasConflicts: boolean;
	conflicts: string[];
	summary: string;
}

/**
 * Git tool input types for tool definitions
 */
export interface SmartCommitInput {
	dryRun?: boolean;
	includeBody?: boolean;
	customScope?: string;
}

export interface CreatePRInput {
	targetBranch?: string;
	draft?: boolean;
	includeSummary?: boolean;
}

export interface BranchSuggestInput {
	workType: 'feature' | 'bugfix' | 'hotfix' | 'release' | 'chore';
	description: string;
	ticketId?: string;
}

export interface EnhancedStatusInput {
	detailed?: boolean;
	showStash?: boolean;
}

/**
 * Branch strategy configuration
 */
export interface BranchStrategyConfig {
	strategy: WorkflowStrategy;
	enforceRules?: boolean;
	requireReviews?: boolean;
	requireStatusChecks?: boolean;
	requiredReviewers?: number;
	allowedBranches?: string[];
}

/**
 * Input for git_branch_strategy tool
 */
export interface BranchStrategyInput {
	action?: 'get' | 'set' | 'validate' | 'recommend';
	strategy?: WorkflowStrategy;
	config?: BranchStrategyConfig;
	currentBranch?: string;
}

/**
 * Semantic version information
 */
export interface SemanticVersion {
	major: number;
	minor: number;
	patch: number;
	prerelease?: string;
	build?: string;
	version: string; // Full version string
}

/**
 * Release configuration
 */
export interface ReleaseConfig {
	versionPrefix?: string; // e.g., "v"
	includeShaInTags?: boolean;
	changelogFormat?: 'keep-a-changelog' | 'standard' | 'custom';
	autoDetectVersion?: boolean;
}

/**
 * Release notes structure
 */
export interface ReleaseNotes {
	version: string;
	date: string;
	commits: Array<{
		type: CommitType;
		scope?: string;
		subject: string;
		breaking?: boolean;
	}>;
	categories: {
		features: string[];
		fixes: string[];
		breaking: string[];
		other: string[];
	};
	summary: string;
}

/**
 * Input for git_release tool
 */
export interface ReleaseInput {
	version?: string; // Optional explicit version
	level?: 'major' | 'minor' | 'patch' | 'auto'; // Bump level
	dryRun?: boolean;
	createTag?: boolean;
	pushTag?: boolean;
	generateNotes?: boolean;
	updateChangelog?: boolean;
	prerelease?: string;
}

/**
 * Changelog entry
 */
export interface ChangelogEntry {
	version: string;
	date: string;
	released: boolean;
	changes: {
		added?: string[];
		changed?: string[];
		deprecated?: string[];
		removed?: string[];
		fixed?: string[];
		security?: string[];
	};
	links?: {
		diff?: string;
		compare?: string;
	};
}

/**
 * Changelog generation options
 */
export interface ChangelogOptions {
	format?: 'keep-a-changelog' | 'standard' | 'compact';
	includeUnreleased?: boolean;
	groupByType?: boolean;
	linkCommits?: boolean;
	linkIssues?: boolean;
	repositoryUrl?: string;
}

/**
 * Input for git_changelog tool
 */
export interface ChangelogInput {
	version?: string;
	since?: string; // Tag or ref
	until?: string; // Tag or ref
	format?: ChangelogOptions['format'];
	output?: 'file' | 'stdout' | 'both';
	update?: boolean; // Update existing changelog
}

/**
 * Code owner rule from CODEOWNERS file
 */
export interface CodeOwnerRule {
	pattern: string; // File path pattern
	owners: string[]; // Usernames or emails
	line: number; // Line number for errors
}

/**
 * Code owner match result
 */
export interface CodeOwnerMatch {
	file: string;
	owners: string[];
	matchedRule: CodeOwnerRule;
}

/**
 * Input for git_codeowners tool
 */
export interface CodeOwnerInput {
	files?: string[]; // Specific files to check
	suggest?: boolean; // Generate CODEOWNERS suggestions
	validate?: boolean; // Validate existing CODEOWNERS
	format?: 'github' | 'gitlab';
}
