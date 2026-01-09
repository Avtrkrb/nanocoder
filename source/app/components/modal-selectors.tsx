import React from 'react';
import {ModelDatabaseDisplay} from '@/commands/model-database';
import CheckpointSelector from '@/components/checkpoint-selector';
import InteractiveQuestion from '@/components/interactive-question';
import ModelSelector from '@/components/model-selector';
import PlanApproval from '@/components/plan-approval';
import ProviderSelector from '@/components/provider-selector';
import ThemeSelector from '@/components/theme-selector';
import TitleShapeSelector from '@/components/title-shape-selector';
import type {QuestionAnswer} from '@/planning/questions/types';
import type {CheckpointListItem, LLMClient} from '@/types';
import {ConfigWizard} from '@/wizard/config-wizard';

export interface ModalSelectorsProps {
	// State flags
	isModelSelectionMode: boolean;
	isProviderSelectionMode: boolean;
	isThemeSelectionMode: boolean;
	isModelDatabaseMode: boolean;
	isConfigWizardMode: boolean;
	isCheckpointLoadMode: boolean;
	isTitleShapeSelectionMode: boolean;

	// Planning mode state
	isQuestionMode: boolean;
	isPlanApprovalMode: boolean;
	planFile: import('@/planning/types').PlanFile | null;

	// Current values
	client: LLMClient | null;
	currentModel: string;
	currentProvider: string;
	checkpointLoadData: {
		checkpoints: CheckpointListItem[];
		currentMessageCount: number;
	} | null;

	// Handlers - Model Selection
	onModelSelect: (model: string) => Promise<void>;
	onModelSelectionCancel: () => void;

	// Handlers - Provider Selection
	onProviderSelect: (provider: string) => Promise<void>;
	onProviderSelectionCancel: () => void;

	// Handlers - Theme Selection
	onThemeSelect: (theme: import('@/types/ui').ThemePreset) => void;
	onThemeSelectionCancel: () => void;

	// Handlers - Title Shape Selection
	onTitleShapeSelect: (shape: import('@/types/ui').TitleShape) => void;
	onTitleShapeSelectionCancel: () => void;

	// Handlers - Model Database
	onModelDatabaseCancel: () => void;

	// Handlers - Config Wizard
	onConfigWizardComplete: (configPath: string) => Promise<void>;
	onConfigWizardCancel: () => void;

	// Handlers - Checkpoint
	onCheckpointSelect: (name: string, backup: boolean) => Promise<void>;
	onCheckpointCancel: () => void;

	// Handlers - Planning
	question?: import('@/planning/questions/types').Question | null;
	questionNumber?: number;
	totalQuestions?: number;
	onQuestionAnswer?: (answer: QuestionAnswer) => void;
	onQuestionSkip?: () => void;
	onQuestionCancel?: () => void;
	onPlanApprove?: (mode: 'normal' | 'auto-accept') => void;
	onPlanEdit?: () => void;
	onPlanDiscard?: () => void;
}

/**
 * Renders the appropriate modal selector based on current application mode
 * Returns null if no modal is active
 */
export function ModalSelectors({
	isModelSelectionMode,
	isProviderSelectionMode,
	isThemeSelectionMode,
	isModelDatabaseMode,
	isConfigWizardMode,
	isCheckpointLoadMode,
	isTitleShapeSelectionMode,
	isQuestionMode,
	isPlanApprovalMode,
	planFile,
	client,
	currentModel,
	currentProvider,
	checkpointLoadData,
	onModelSelect,
	onModelSelectionCancel,
	onProviderSelect,
	onProviderSelectionCancel,
	onThemeSelect,
	onThemeSelectionCancel,
	onModelDatabaseCancel,
	onConfigWizardComplete,
	onConfigWizardCancel,
	onCheckpointSelect,
	onCheckpointCancel,
	onTitleShapeSelect,
	onTitleShapeSelectionCancel,
	question,
	questionNumber = 1,
	totalQuestions = 1,
	onQuestionAnswer,
	onQuestionSkip,
	onQuestionCancel,
	onPlanApprove,
	onPlanEdit,
	onPlanDiscard,
}: ModalSelectorsProps): React.ReactElement | null {
	// Planning mode modals - highest priority
	if (isQuestionMode && question) {
		return (
			<InteractiveQuestion
				question={question}
				questionNumber={questionNumber}
				totalQuestions={totalQuestions}
				onAnswer={onQuestionAnswer!}
				onSkip={onQuestionSkip!}
				onCancel={onQuestionCancel!}
			/>
		);
	}

	if (isPlanApprovalMode && planFile) {
		return (
			<PlanApproval
				planFile={planFile}
				onApprove={onPlanApprove!}
				onEdit={onPlanEdit!}
				onDiscard={onPlanDiscard!}
			/>
		);
	}

	// Existing modals
	if (isModelSelectionMode) {
		return (
			<ModelSelector
				client={client}
				currentModel={currentModel}
				onModelSelect={model => void onModelSelect(model)}
				onCancel={onModelSelectionCancel}
			/>
		);
	}

	if (isProviderSelectionMode) {
		return (
			<ProviderSelector
				currentProvider={currentProvider}
				onProviderSelect={provider => void onProviderSelect(provider)}
				onCancel={onProviderSelectionCancel}
			/>
		);
	}

	if (isThemeSelectionMode) {
		return (
			<ThemeSelector
				onThemeSelect={onThemeSelect}
				onCancel={onThemeSelectionCancel}
			/>
		);
	}

	if (isTitleShapeSelectionMode) {
		return (
			<TitleShapeSelector
				onComplete={onTitleShapeSelect}
				onCancel={onTitleShapeSelectionCancel}
			/>
		);
	}

	if (isModelDatabaseMode) {
		return <ModelDatabaseDisplay onCancel={onModelDatabaseCancel} />;
	}

	if (isConfigWizardMode) {
		return (
			<ConfigWizard
				projectDir={process.cwd()}
				onComplete={configPath => void onConfigWizardComplete(configPath)}
				onCancel={onConfigWizardCancel}
			/>
		);
	}

	if (isCheckpointLoadMode && checkpointLoadData) {
		return (
			<CheckpointSelector
				checkpoints={checkpointLoadData.checkpoints}
				currentMessageCount={checkpointLoadData.currentMessageCount}
				onSelect={(name, backup) => void onCheckpointSelect(name, backup)}
				onCancel={onCheckpointCancel}
			/>
		);
	}

	return null;
}
