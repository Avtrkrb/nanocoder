/**
 * Planning Handlers Hook
 *
 * Manages the planning mode state and provides handlers for:
 * - Question flow (answer, skip, cancel)
 * - Plan approval (approve, edit, discard)
 * - Phase transitions
 */

import React, {useCallback, useEffect} from 'react';
import {getPlanManager} from '@/planning/plan-manager';
import {getPlanningManager} from '@/planning/planning-manager';
import {
	getQuestionManager,
	resetQuestionManager,
} from '@/planning/questions/question-manager';
import type {QuestionAnswer} from '@/planning/questions/types';
import type {PlanFile, PlanningPhase} from '@/planning/types';
import type {DevelopmentMode} from '@/types/core';

export interface UsePlanningHandlersProps {
	planningPhase: PlanningPhase | null;
	planFile: PlanFile | null;
	planningEnabled: boolean;
	setPlanningPhase: (phase: PlanningPhase | null) => void;
	setPlanFile: (file: PlanFile | null) => void;
	setPlanningEnabled: (enabled: boolean) => void;
	setDevelopmentMode: (mode: DevelopmentMode) => void;
	addToChatQueue: (component: React.ReactNode) => void;
}

export interface PlanningHandlersResult {
	// State
	currentQuestion: import('@/planning/questions/types').Question | null;
	questionNumber: number;
	totalQuestions: number;
	isQuestionMode: boolean;
	isPlanApprovalMode: boolean;

	// Handlers
	enablePlanningMode: () => void;
	disablePlanningMode: () => void;
	transitionToNextPhase: () => Promise<void>;
	handleQuestionAnswer: (answer: QuestionAnswer) => void;
	handleQuestionSkip: () => void;
	handleQuestionCancel: () => void;
	handlePlanApprove: (mode: 'normal' | 'auto-accept') => Promise<void>;
	handlePlanEdit: () => Promise<void>;
	handlePlanDiscard: () => Promise<void>;
}

export function usePlanningHandlers({
	planningPhase,
	planFile,
	planningEnabled,
	setPlanningPhase,
	setPlanFile,
	setPlanningEnabled,
	setDevelopmentMode,
	addToChatQueue,
}: UsePlanningHandlersProps): PlanningHandlersResult {
	const planningManager = getPlanningManager();
	const questionManager = getQuestionManager();
	const planManager = getPlanManager(process.cwd());

	// Sync planning manager state with app state
	useEffect(() => {
		if (planningEnabled !== planningManager.enabled) {
			if (planningEnabled) {
				planningManager.enable();
			} else {
				planningManager.disable();
			}
		}
	}, [planningEnabled, planningManager]);

	// Sync phase state
	useEffect(() => {
		if (planningPhase && planningPhase !== planningManager.currentPhase) {
			planningManager.setPhase(planningPhase);
		}
	}, [planningPhase, planningManager]);

	// Listen for phase changes from planning manager
	useEffect(() => {
		const handlePhaseChange = (phase: PlanningPhase) => {
			setPlanningPhase(phase);
		};

		const handlePlanCreated = (createdPlanFile: PlanFile) => {
			setPlanFile(createdPlanFile);
		};

		const handlePlanUpdated = (updatedPlanFile: PlanFile) => {
			setPlanFile(updatedPlanFile);
		};

		planningManager.on('phaseChanged', handlePhaseChange);
		planningManager.on('planCreated', handlePlanCreated);
		planningManager.on('planUpdated', handlePlanUpdated);

		return () => {
			planningManager.off('phaseChanged', handlePhaseChange);
			planningManager.off('planCreated', handlePlanCreated);
			planningManager.off('planUpdated', handlePlanUpdated);
		};
	}, [planningManager, setPlanningPhase, setPlanFile]);

	// Get current question state
	const currentQuestion = questionManager.state.currentQuestion;
	const questionNumber = questionManager.answeredCount + 1;
	const totalQuestions = questionManager.totalQuestions;
	const isQuestionMode = planningEnabled && currentQuestion !== null;
	const isPlanApprovalMode =
		planningEnabled && planningPhase === 'exit' && planFile !== null;

	// Enable planning mode
	const enablePlanningMode = useCallback(() => {
		setPlanningEnabled(true);
		setDevelopmentMode('plan');
	}, [setPlanningEnabled, setDevelopmentMode]);

	// Disable planning mode
	const disablePlanningMode = useCallback(() => {
		setPlanningEnabled(false);
		setPlanningPhase(null);
		setPlanFile(null);
		resetQuestionManager();
	}, [setPlanningEnabled, setPlanningPhase, setPlanFile]);

	// Transition to next phase
	const transitionToNextPhase = useCallback(async () => {
		const success = planningManager.transitionToNextPhase();
		if (!success) {
			addToChatQueue(
				React.createElement(
					'Box',
					{flexDirection: 'column', marginBottom: 1},
					React.createElement(
						'Text',
						{color: 'warning'},
						'No more phases to transition to',
					),
				),
			);
		}
	}, [planningManager, addToChatQueue]);

	// Handle question answer
	const handleQuestionAnswer = useCallback(
		(answer: QuestionAnswer) => {
			questionManager.submitAnswer(answer);

			// Check if questions are complete
			if (questionManager.isCompleted()) {
				// Questions done, transition to design phase
				transitionToNextPhase();
			}
		},
		[questionManager, transitionToNextPhase],
	);

	// Handle question skip
	const handleQuestionSkip = useCallback(() => {
		try {
			questionManager.skipCurrentQuestion();

			// Check if questions are complete
			if (questionManager.isCompleted()) {
				// Questions done, transition to design phase
				transitionToNextPhase();
			}
		} catch (error) {
			addToChatQueue(
				React.createElement(
					'Box',
					{flexDirection: 'column', marginBottom: 1},
					React.createElement('Text', {color: 'error'}, String(error)),
				),
			);
		}
	}, [questionManager, transitionToNextPhase, addToChatQueue]);

	// Handle question cancel
	const handleQuestionCancel = useCallback(() => {
		disablePlanningMode();
	}, [disablePlanningMode]);

	// Handle plan approve
	const handlePlanApprove = useCallback(
		async (mode: 'normal' | 'auto-accept') => {
			if (!planFile) {
				return;
			}

			// Update plan phase to completed
			const updatedPlan = {...planFile, phase: 'completed' as PlanningPhase};
			await planManager.updatePlan(updatedPlan);

			// Switch to the requested mode
			setDevelopmentMode(mode);
			setPlanningEnabled(false);
			setPlanningPhase(null);

			addToChatQueue(
				React.createElement(
					'Box',
					{flexDirection: 'column', marginBottom: 1},
					React.createElement(
						'Text',
						{color: 'success'},
						'✓ Plan approved! Switching to ' + mode + ' mode',
					),
				),
			);
		},
		[
			planFile,
			planManager,
			setDevelopmentMode,
			setPlanningEnabled,
			setPlanningPhase,
			addToChatQueue,
		],
	);

	// Handle plan edit
	const handlePlanEdit = useCallback(async () => {
		if (!planFile) {
			return;
		}

		try {
			await planManager.openInEditor(planFile.slug);
			addToChatQueue(
				React.createElement(
					'Box',
					{flexDirection: 'column', marginBottom: 1},
					React.createElement(
						'Text',
						{color: 'info'},
						'Opening plan in external editor...',
					),
				),
			);
		} catch (error) {
			addToChatQueue(
				React.createElement(
					'Box',
					{flexDirection: 'column', marginBottom: 1},
					React.createElement(
						'Text',
						{color: 'error'},
						'Failed to open editor: ' + String(error),
					),
				),
			);
		}
	}, [planFile, planManager, addToChatQueue]);

	// Handle plan discard
	const handlePlanDiscard = useCallback(async () => {
		if (!planFile) {
			return;
		}

		await planManager.deletePlan(planFile.slug);
		disablePlanningMode();

		addToChatQueue(
			React.createElement(
				'Box',
				{flexDirection: 'column', marginBottom: 1},
				React.createElement('Text', {color: 'warning'}, 'Plan discarded'),
			),
		);
	}, [planFile, planManager, disablePlanningMode, addToChatQueue]);

	return {
		currentQuestion,
		questionNumber,
		totalQuestions,
		isQuestionMode,
		isPlanApprovalMode,
		enablePlanningMode,
		disablePlanningMode,
		transitionToNextPhase,
		handleQuestionAnswer,
		handleQuestionSkip,
		handleQuestionCancel,
		handlePlanApprove,
		handlePlanEdit,
		handlePlanDiscard,
	};
}
