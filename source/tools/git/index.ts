/**
 * Git Workflow Tools
 *
 * Advanced git workflow integration for nanocoder.
 * Provides intelligent version control operations including:
 * - Smart commit message generation
 * - PR template creation
 * - Branch naming suggestions
 * - Enhanced status reporting
 * - Code owners management
 * - Changelog generation
 * - Release automation
 * - Branch strategy management
 */

export {gitBranchSuggestTool} from './git-branch-suggest';
export {gitBranchStrategyTool} from './git-branch-strategy';
export {gitChangelogTool} from './git-changelog';
export {gitCodeOwnersTool} from './git-codeowners';
export {gitCreatePRTool} from './git-create-pr';
export {gitReleaseTool} from './git-release';
export {gitSmartCommitTool} from './git-smart-commit';
export {gitStatusEnhancedTool} from './git-status-enhanced';

// Re-export types for external use
export type {
	BranchSuggestInput,
	BranchStrategyConfig,
	BranchStrategyInput,
	ChangelogEntry,
	ChangelogInput,
	ChangelogOptions,
	CodeOwnerInput,
	CodeOwnerMatch,
	CodeOwnerRule,
	CommitType,
	CreatePRInput,
	DiffAnalysis,
	EnhancedStatus,
	EnhancedStatusInput,
	FileChange,
	FileChangeStatus,
	GeneratedCommit,
	PRTemplate,
	ReleaseConfig,
	ReleaseInput,
	ReleaseNotes,
	SemanticVersion,
	SmartCommitInput,
	WorkflowStrategy,
} from './types';
