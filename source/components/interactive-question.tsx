/**
 * Interactive Question Component for Plan Mode
 *
 * Displays questions to the user and collects answers.
 * Supports keyboard shortcuts for quick selection.
 */

import {Box, Text, useInput} from 'ink';
import {useState} from 'react';
import {useTerminalWidth} from '@/hooks/useTerminalWidth';
import {useTheme} from '@/hooks/useTheme';
import type {
	Question,
	QuestionAnswer,
	QuestionOption,
} from '@/planning/questions/types';
import {QUESTION_ICONS} from '@/planning/questions/types';

interface InteractiveQuestionProps {
	question: Question;
	questionNumber: number;
	totalQuestions: number;
	onAnswer: (answer: QuestionAnswer) => void;
	onSkip: () => void;
	onCancel: () => void;
}

interface SelectionState {
	selectedIndices: number[];
	isConfirmed: boolean;
}

export default function InteractiveQuestion({
	question,
	questionNumber,
	totalQuestions,
	onAnswer,
	onSkip,
	onCancel,
}: InteractiveQuestionProps) {
	const {colors} = useTheme();
	const boxWidth = useTerminalWidth();
	const [selectionState, setSelectionState] = useState<SelectionState>({
		selectedIndices: [],
		isConfirmed: false,
	});

	const icon = QUESTION_ICONS[question.type];

	// Handle keyboard input
	useInput((_inputChar, key) => {
		if (selectionState.isConfirmed) {
			return;
		}

		// Escape to cancel
		if (key.escape) {
			onCancel();
			return;
		}

		// S to skip (if allowed)
		if (
			key.return &&
			question.allowSkip &&
			selectionState.selectedIndices.length === 0
		) {
			onSkip();
			return;
		}

		// Number keys 1-9 for option selection
		if (question.options) {
			const num = parseInt(_inputChar, 10);
			if (!Number.isNaN(num) && num >= 1 && num <= question.options.length) {
				const index = num - 1;
				handleOptionToggle(index);
				return;
			}
		}

		// Enter to confirm selection
		if (key.return) {
			if (selectionState.selectedIndices.length > 0) {
				submitAnswer();
			}
		}
	});

	const handleOptionToggle = (index: number) => {
		setSelectionState(prev => {
			let newIndices: number[];

			if (question.allowMultiple) {
				// Multi-select: toggle the index
				if (prev.selectedIndices.includes(index)) {
					newIndices = prev.selectedIndices.filter(i => i !== index);
				} else {
					newIndices = [...prev.selectedIndices, index];
				}
			} else {
				// Single-select: replace selection
				newIndices = [index];
			}

			return {...prev, selectedIndices: newIndices};
		});
	};

	const submitAnswer = () => {
		if (!question.options || selectionState.selectedIndices.length === 0) {
			return;
		}

		// Safe: we checked options exists above
		const options = question.options;
		const selectedOptionIds = selectionState.selectedIndices
			.map(index => options[index]?.id)
			.filter((id): id is string => id !== undefined);

		if (selectedOptionIds.length === 0) {
			return;
		}

		const answer: QuestionAnswer = {
			questionId: question.id,
			selectedOptionIds,
			timestamp: new Date(),
		};

		setSelectionState(prev => ({...prev, isConfirmed: true}));
		onAnswer(answer);
	};

	return (
		<Box flexDirection="column" width={boxWidth} marginBottom={1}>
			{/* Question header */}
			<Box marginBottom={1}>
				<Text color={colors.secondary}>
					[Question {questionNumber}/{totalQuestions}]
				</Text>
			</Box>

			{/* Question text with icon */}
			<Box marginBottom={1}>
				<Text color={colors.text}>
					{icon} {question.template}
				</Text>
			</Box>

			{/* Options */}
			{question.options && question.options.length > 0 && (
				<Box flexDirection="column" marginBottom={1}>
					{question.options.map((option: QuestionOption, index: number) => {
						const isSelected = selectionState.selectedIndices.includes(index);
						const optionNumber = index + 1;

						return (
							<Box
								key={option.id}
								flexDirection="column"
								marginBottom={isSelected ? 1 : 0}
							>
								{/* Option header */}
								<Box>
									<Text color={isSelected ? colors.success : colors.secondary}>
										{isSelected ? '✓' : '['}
										{optionNumber}
										{isSelected ? '' : ']'}
									</Text>
									<Text color={isSelected ? colors.success : colors.text}>
										{' '}
										{option.text}
									</Text>
								</Box>

								{/* Option description */}
								{option.description && (
									<Box paddingLeft={4}>
										<Text color={colors.secondary} dimColor>
											{option.description}
										</Text>
									</Box>
								)}

								{/* Pros and cons */}
								{(option.pros || option.cons) && (
									<Box flexDirection="column" paddingLeft={4}>
										{option.pros && option.pros.length > 0 && (
											<Box>
												<Text color={colors.secondary} dimColor>
													Pros: {option.pros.join(', ')}
												</Text>
											</Box>
										)}
										{option.cons && option.cons.length > 0 && (
											<Box>
												<Text color={colors.secondary} dimColor>
													Cons: {option.cons.join(', ')}
												</Text>
											</Box>
										)}
									</Box>
								)}

								{/* Sub-selection indicator for multi-select */}
								{isSelected &&
									question.allowMultiple &&
									selectionState.selectedIndices.length > 1 && (
										<Box paddingLeft={4}>
											<Text color={colors.secondary} dimColor>
												(Selected {selectionState.selectedIndices.length}{' '}
												options)
											</Text>
										</Box>
									)}
							</Box>
						);
					})}
				</Box>
			)}

			{/* Help text */}
			<Box flexDirection="column">
				<Text color={colors.secondary}>
					{question.allowMultiple
						? 'Press 1-9 to select options (multiple allowed)'
						: 'Press 1-9 to select an option'}
				</Text>
				{question.allowSkip && (
					<Text color={colors.secondary}>
						Press S to skip • Enter to confirm
					</Text>
				)}
				{!question.allowSkip && (
					<Text color={colors.secondary}>Press Enter to confirm</Text>
				)}
				<Text color={colors.secondary}>Press Escape to cancel</Text>
			</Box>

			{/* Multi-select confirmation prompt */}
			{question.allowMultiple &&
				selectionState.selectedIndices.length > 0 &&
				!selectionState.isConfirmed && (
					<Box marginTop={1}>
						<Text color={colors.success}>
							{selectionState.selectedIndices.length} option
							{selectionState.selectedIndices.length > 1 ? 's' : ''} selected.
							Press Enter to confirm.
						</Text>
					</Box>
				)}

			{/* Confirmation message */}
			{selectionState.isConfirmed && (
				<Box marginTop={1}>
					<Text color={colors.success}>✓ Answer recorded</Text>
				</Box>
			)}
		</Box>
	);
}
