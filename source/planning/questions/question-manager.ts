/**
 * Question Manager - Manages interactive questions for Plan Mode
 *
 * Handles:
 * - Question queue management
 * - Processing user answers
 * - Triggering follow-up questions
 * - Question state persistence
 */

import type {
	Question,
	QuestionAnswer,
	QuestionContext,
	QuestionState,
} from './types';
import {
	AMBIGUITY_TEMPLATES,
	CONFIRMATION_TEMPLATES,
	DECISION_TEMPLATES,
	DEFAULT_QUESTION_CONFIG,
	QUESTION_ICONS,
} from './types';

/**
 * Question Manager class
 */
export class QuestionManager {
	#state: QuestionState;
	#context: QuestionContext | null;
	#config: typeof DEFAULT_QUESTION_CONFIG;

	constructor(
		context?: QuestionContext,
		config: Partial<typeof DEFAULT_QUESTION_CONFIG> = {},
	) {
		this.#state = {
			questionQueue: [],
			currentQuestion: null,
			answeredQuestions: new Map(),
			completed: false,
		};
		this.#context = context || null;
		this.#config = {...DEFAULT_QUESTION_CONFIG, ...config};
	}

	/**
	 * Get the current state
	 */
	get state(): QuestionState {
		return this.#state;
	}

	/**
	 * Get the current context
	 */
	get context(): QuestionContext | null {
		return this.#context;
	}

	/**
	 * Update the context
	 */
	setContext(context: QuestionContext): void {
		this.#context = context;
	}

	/**
	 * Generate questions based on user request and context
	 */
	generateQuestions(userRequest: string, projectFiles: string[]): void {
		if (!this.#context) {
			this.#context = {
				userRequest,
				projectFiles,
				existingCode: undefined,
				previousAnswers: new Map(),
			};
		}

		// Find matching templates based on keywords in user request
		const matchedQuestions = this.#findMatchingQuestions(userRequest);

		// Prioritize questions by importance and confidence
		const prioritizedQuestions = this.#prioritizeQuestions(
			matchedQuestions,
			userRequest,
		);

		// Limit to max questions
		this.#state.questionQueue = prioritizedQuestions.slice(
			0,
			this.#config.maxQuestions,
		);

		// Set first question as current
		if (this.#state.questionQueue.length > 0) {
			this.#state.currentQuestion = this.#state.questionQueue[0];
		} else {
			this.#state.completed = true;
		}
	}

	/**
	 * Find matching question templates based on keywords
	 */
	#findMatchingQuestions(userRequest: string): Question[] {
		const questions: Question[] = [];
		const lowerRequest = userRequest.toLowerCase();

		// Check ambiguity templates
		for (const template of AMBIGUITY_TEMPLATES) {
			if (template.keywords.some(kw => lowerRequest.includes(kw))) {
				questions.push({
					id: template.id,
					type: 'ambiguity',
					template: template.template(userRequest),
					options: template.options,
					allowSkip: true,
				});
			}
		}

		// Check decision templates
		for (const template of DECISION_TEMPLATES) {
			if (template.keywords.some(kw => lowerRequest.includes(kw))) {
				questions.push({
					id: template.id,
					type: 'decision',
					template: template.template(userRequest),
					options: template.options,
					allowMultiple: template.allowMultiple,
					allowSkip: true,
				});
			}
		}

		// Always add assumptions confirmation for create/build/implement requests
		const confirmKeywords = ['create', 'build', 'implement', 'add', 'develop'];
		if (confirmKeywords.some(kw => lowerRequest.includes(kw))) {
			const confirmTemplate = CONFIRMATION_TEMPLATES.find(
				t => t.id === 'assumptions-confirmation',
			);
			if (confirmTemplate) {
				questions.push({
					id: confirmTemplate.id,
					type: 'confirmation',
					template: confirmTemplate.template({
						request: userRequest,
						scope: 'current task',
					}),
					allowSkip: false,
				});
			}
		}

		return questions;
	}

	/**
	 * Prioritize questions based on importance
	 */
	#prioritizeQuestions(questions: Question[], userRequest: string): Question[] {
		// Confirmation questions always come first
		const confirmationQuestions = questions.filter(
			q => q.type === 'confirmation',
		);
		const decisionQuestions = questions.filter(q => q.type === 'decision');
		const ambiguityQuestions = questions.filter(q => q.type === 'ambiguity');

		// Sort by keyword match count (more matches = higher priority)
		const sortByKeywordMatch = (a: Question, b: Question) => {
			const aKeywords = this.#getKeywordCount(a.id, userRequest);
			const bKeywords = this.#getKeywordCount(b.id, userRequest);
			return bKeywords - aKeywords;
		};

		decisionQuestions.sort(sortByKeywordMatch);
		ambiguityQuestions.sort(sortByKeywordMatch);

		return [
			...confirmationQuestions,
			...decisionQuestions,
			...ambiguityQuestions,
		];
	}

	/**
	 * Count keyword matches for a question
	 */
	#getKeywordCount(questionId: string, userRequest: string): number {
		const lowerRequest = userRequest.toLowerCase();

		// Check ambiguity templates
		const ambTemplate = AMBIGUITY_TEMPLATES.find(t => t.id === questionId);
		if (ambTemplate) {
			return ambTemplate.keywords.filter(kw => lowerRequest.includes(kw))
				.length;
		}

		// Check decision templates
		const decTemplate = DECISION_TEMPLATES.find(t => t.id === questionId);
		if (decTemplate) {
			return decTemplate.keywords.filter(kw => lowerRequest.includes(kw))
				.length;
		}

		return 0;
	}

	/**
	 * Submit an answer to the current question
	 */
	submitAnswer(answer: QuestionAnswer): void {
		if (!this.#state.currentQuestion) {
			throw new Error('No current question to answer');
		}

		const currentQuestion = this.#state.currentQuestion;

		// Validate the answer
		if (answer.questionId !== currentQuestion.id) {
			throw new Error(
				`Answer question ID ${answer.questionId} does not match current question ${currentQuestion.id}`,
			);
		}

		// Store the answer
		this.#state.answeredQuestions.set(answer.questionId, answer);

		// Process follow-up questions if any
		this.#processFollowUpQuestions(answer, currentQuestion);

		// Move to next question
		this.#moveToNextQuestion();
	}

	/**
	 * Process follow-up questions based on answer
	 */
	#processFollowUpQuestions(answer: QuestionAnswer, question: Question): void {
		const followUpIds: string[] = [];

		// Check for follow-ups based on selected options
		if (question.options && answer.selectedOptionIds) {
			for (const optionId of answer.selectedOptionIds) {
				const option = question.options.find(opt => opt.id === optionId);
				if (option?.followupQuestions) {
					followUpIds.push(...option.followupQuestions);
				}
			}
		}

		// Check for question-level follow-ups
		if (question.followupQuestions) {
			followUpIds.push(...question.followupQuestions);
		}

		// Add follow-up questions to queue (would need template lookup in real impl)
		// For now, this is a placeholder for future enhancement
	}

	/**
	 * Move to the next question in the queue
	 */
	#moveToNextQuestion(): void {
		const currentIndex = this.#state.questionQueue.findIndex(
			q => q.id === this.#state.currentQuestion?.id,
		);

		if (
			currentIndex >= 0 &&
			currentIndex < this.#state.questionQueue.length - 1
		) {
			this.#state.currentQuestion = this.#state.questionQueue[currentIndex + 1];
		} else {
			this.#state.currentQuestion = null;
			this.#state.completed = true;
		}
	}

	/**
	 * Skip the current question (if allowed)
	 */
	skipCurrentQuestion(): void {
		if (!this.#state.currentQuestion) {
			throw new Error('No current question to skip');
		}

		if (!this.#state.currentQuestion.allowSkip) {
			throw new Error('This question cannot be skipped');
		}

		// Record that the question was skipped
		this.#state.answeredQuestions.set(this.#state.currentQuestion.id, {
			questionId: this.#state.currentQuestion.id,
			selectedOptionIds: [],
			timestamp: new Date(),
		});

		// Move to next question
		this.#moveToNextQuestion();
	}

	/**
	 * Get all answers as a plain object
	 */
	getAnswers(): Record<string, QuestionAnswer> {
		return Object.fromEntries(this.#state.answeredQuestions);
	}

	/**
	 * Get answer for a specific question
	 */
	getAnswer(questionId: string): QuestionAnswer | undefined {
		return this.#state.answeredQuestions.get(questionId);
	}

	/**
	 * Reset the question manager
	 */
	reset(): void {
		this.#state = {
			questionQueue: [],
			currentQuestion: null,
			answeredQuestions: new Map(),
			completed: false,
		};
		this.#context = null;
	}

	/**
	 * Check if questions are completed
	 */
	isCompleted(): boolean {
		return this.#state.completed;
	}

	/**
	 * Get the current question with its icon
	 */
	getCurrentQuestionWithIcon(): {question: Question; icon: string} | null {
		if (!this.#state.currentQuestion) {
			return null;
		}

		return {
			question: this.#state.currentQuestion,
			icon: QUESTION_ICONS[this.#state.currentQuestion.type],
		};
	}

	/**
	 * Get the total number of questions
	 */
	get totalQuestions(): number {
		return this.#state.questionQueue.length;
	}

	/**
	 * Get the number of answered questions
	 */
	get answeredCount(): number {
		return this.#state.answeredQuestions.size;
	}

	/**
	 * Get the number of remaining questions
	 */
	get remainingCount(): number {
		return (
			this.#state.questionQueue.length - this.#state.answeredQuestions.size
		);
	}
}

/**
 * Create a singleton instance
 */
let singletonInstance: QuestionManager | null = null;

export function getQuestionManager(): QuestionManager {
	if (!singletonInstance) {
		singletonInstance = new QuestionManager();
	}
	return singletonInstance;
}

export function resetQuestionManager(): void {
	singletonInstance = null;
}
