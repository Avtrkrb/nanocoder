/**
 * Interactive Questions System for Plan Mode
 *
 * Allows the AI to ask clarifying questions before generating implementation plans.
 * This reduces rework and ensures alignment between user expectations and AI implementation.
 */

/**
 * Types of questions the AI can ask
 */
export type QuestionType = 'ambiguity' | 'decision' | 'confirmation';

/**
 * Icon for each question type
 */
export const QUESTION_ICONS: Record<QuestionType, string> = {
	ambiguity: '❓',
	decision: '🔧',
	confirmation: '✋',
};

/**
 * A single question that can be asked to the user
 */
export interface Question {
	id: string;
	type: QuestionType;
	template: string;
	options?: QuestionOption[];
	followupQuestions?: string[]; // IDs of follow-up questions based on answer
	allowSkip?: boolean; // Allow user to skip this question
	allowMultiple?: boolean; // Allow multiple selections
}

/**
 * A selectable option for a question
 */
export interface QuestionOption {
	id: string;
	text: string;
	description?: string;
	pros?: string[];
	cons?: string[];
	followupQuestions?: string[]; // IDs of follow-up questions for this option
}

/**
 * User's answer to a question
 */
export interface QuestionAnswer {
	questionId: string;
	selectedOptionIds: string[]; // Multiple selections supported
	customText?: string; // For custom/other answers
	timestamp: Date;
}

/**
 * State of the question system
 */
export interface QuestionState {
	questionQueue: Question[]; // Questions waiting to be asked
	currentQuestion: Question | null; // Currently displayed question
	answeredQuestions: Map<string, QuestionAnswer>; // All answers provided
	completed: boolean; // True when all questions answered or skipped
}

/**
 * Template for ambiguity resolution questions
 */
export interface AmbiguityTemplate {
	id: string;
	keywords: string[]; // Keywords that trigger this question
	template: (context: string) => string; // Function to generate question text
	options: QuestionOption[];
	allowSkip?: boolean; // Allow user to skip this question
}

/**
 * Template for decision point questions
 */
export interface DecisionTemplate {
	id: string;
	keywords: string[]; // Keywords that trigger this question
	template: (context: string) => string; // Function to generate question text
	options: QuestionOption[];
	allowMultiple: boolean;
}

/**
 * Template for assumption confirmation questions
 */
export interface ConfirmationTemplate {
	id: string;
	triggers: string[]; // Scenarios that trigger this question
	template: (assumptions: Record<string, unknown>) => string;
	confirmLabel: string; // Text for confirm button
	modifyLabel: string; // Text for modify button
}

/**
 * Context for generating questions
 */
export interface QuestionContext {
	userRequest: string;
	projectFiles: string[];
	existingCode?: string;
	previousAnswers?: Map<string, QuestionAnswer>;
}

/**
 * Priority for questions (higher = more important)
 */
export type QuestionPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Question with priority metadata
 */
export interface PrioritizedQuestion extends Question {
	priority: QuestionPriority;
	confidence: number; // 0-1, how confident AI is that this question is needed
}

/**
 * Default question system configuration
 */
export const DEFAULT_QUESTION_CONFIG = {
	maxQuestions: 10,
	allowSkip: true,
	confidenceThreshold: 0.7, // Ask questions when confidence < 0.7
} as const;

/**
 * Predefined question templates for common scenarios
 */

// Ambiguity resolution templates
export const AMBIGUITY_TEMPLATES: AmbiguityTemplate[] = [
	{
		id: 'performance-requirements',
		keywords: ['optimize', 'performance', 'fast', 'efficient'],
		template: (context: string) =>
			`When you say "optimize performance", I need to understand your priorities better.\n\n` +
			`Which metrics are most important?\n` +
			`[1] Response time / latency\n` +
			`[2] Memory usage\n` +
			`[3] CPU utilization\n` +
			`[4] Database query performance\n` +
			`[5] Network bandwidth\n\n` +
			`What's your target improvement?\n` +
			`[1] 2x faster\n` +
			`[2] 50% memory reduction\n` +
			`[3] Handle 10x more users\n` +
			`[4] Other specific target`,
		options: [
			{
				id: 'response-time',
				text: 'Response time',
				description: 'Focus on latency and speed',
			},
			{
				id: 'memory',
				text: 'Memory usage',
				description: 'Focus on memory efficiency',
			},
			{
				id: 'cpu',
				text: 'CPU utilization',
				description: 'Focus on CPU efficiency',
			},
			{
				id: 'database',
				text: 'Database performance',
				description: 'Focus on query optimization',
			},
		],
		allowSkip: true,
	},
	{
		id: 'error-handling',
		keywords: ['error handling', 'robust', 'reliable'],
		template: (_context: string) =>
			`How should we handle errors and failures?\n\n` +
			`What's your preferred approach?\n` +
			`[1] Graceful degradation with fallbacks\n` +
			`[2] Fail fast with detailed error messages\n` +
			`[3] Retry mechanisms with exponential backoff\n` +
			`[4] Circuit breaker pattern\n\n` +
			`Should errors be:\n` +
			`[1] Logged for debugging\n` +
			`[2] Shown to users (sanitized)\n` +
			`[3] Sent to monitoring service\n` +
			`[4] All of the above`,
		options: [
			{
				id: 'graceful',
				text: 'Graceful degradation',
				description: 'Continue operating with reduced functionality',
			},
			{
				id: 'fail-fast',
				text: 'Fail fast',
				description: 'Stop immediately and show detailed errors',
			},
			{
				id: 'retry',
				text: 'Retry mechanisms',
				description: 'Automatically retry failed operations',
			},
			{
				id: 'circuit-breaker',
				text: 'Circuit breaker',
				description: 'Stop calling failing services',
			},
		],
		allowSkip: true,
	},
];

// Decision point templates
export const DECISION_TEMPLATES: DecisionTemplate[] = [
	{
		id: 'architecture-pattern',
		keywords: ['build', 'create', 'implement', 'architecture', 'structure'],
		template: (context: string) =>
			`What architectural pattern would you prefer?\n\n` +
			`[1] Monolithic - Single application with all components\n` +
			`    Pros: Simple to develop, easier debugging, lower complexity\n` +
			`    Cons: Harder to scale, tight coupling\n\n` +
			`[2] Microservices - Separate services for different functions\n` +
			`    Pros: Scalable, independent deployment, technology diversity\n` +
			`    Cons: Network complexity, data consistency challenges\n\n` +
			`[3] Modular Monolith - Single app with clear module boundaries\n` +
			`    Pros: Balanced approach, future migration path\n` +
			`    Cons: Still single deployment unit`,
		options: [
			{
				id: 'monolithic',
				text: 'Monolithic',
				description: 'Simple, single-unit application',
				pros: ['Simple to develop', 'Easier debugging'],
				cons: ['Harder to scale'],
			},
			{
				id: 'microservices',
				text: 'Microservices',
				description: 'Distributed, independent services',
				pros: ['Scalable', 'Independent deployment'],
				cons: ['Network complexity', 'Data consistency'],
			},
			{
				id: 'modular-monolith',
				text: 'Modular Monolith',
				description: 'Single app with module boundaries',
				pros: ['Balanced approach', 'Future migration path'],
				cons: ['Single deployment unit'],
			},
		],
		allowMultiple: false,
	},
	{
		id: 'database-choice',
		keywords: ['database', 'storage', 'persistence', 'data'],
		template: (_context: string) =>
			`What type of database would you prefer?\n\n` +
			`[1] PostgreSQL - Relational database with strong consistency\n` +
			`    Pros: ACID compliance, complex queries, data integrity\n` +
			`    Cons: Vertical scaling, schema migrations\n\n` +
			`[2] MongoDB - Document database with flexible schema\n` +
			`    Pros: Schema flexibility, horizontal scaling, JSON native\n` +
			`    Cons: Eventual consistency, no joins\n\n` +
			`[3] SQLite - File-based relational database\n` +
			`    Pros: Simple setup, zero configuration, portable\n` +
			`    Cons: Single writer, limited scaling`,
		options: [
			{
				id: 'postgresql',
				text: 'PostgreSQL',
				description: 'Strong consistency, complex queries',
			},
			{
				id: 'mongodb',
				text: 'MongoDB',
				description: 'Flexible schema, horizontal scaling',
			},
			{
				id: 'sqlite',
				text: 'SQLite',
				description: 'Simple, portable, embedded',
			},
		],
		allowMultiple: false,
	},
	{
		id: 'authentication-method',
		keywords: ['authentication', 'login', 'auth', 'user', 'security'],
		template: () =>
			`What authentication approach should I implement?\n\n` +
			`[1] JWT Tokens - Stateless tokens with digital signatures\n` +
			`    Pros: Scalable, standard approach, no server state\n` +
			`    Cons: Token management, cannot revoke easily\n\n` +
			`[2] Session-based - Server-side session storage\n` +
			`    Pros: Easy to revoke, secure, simple\n` +
			`    Cons: Server memory usage, not scalable\n\n` +
			`[3] OAuth2 Integration - Third-party authentication\n` +
			`    Pros: No password management, social login, trusted\n` +
			`    Cons: External dependency, complex setup`,
		options: [
			{
				id: 'jwt',
				text: 'JWT Tokens',
				description: 'Stateless, scalable',
			},
			{
				id: 'session',
				text: 'Session-based',
				description: 'Server-controlled, easy to revoke',
			},
			{
				id: 'oauth2',
				text: 'OAuth2',
				description: 'Third-party authentication',
			},
		],
		allowMultiple: false,
	},
];

// Confirmation templates
export const CONFIRMATION_TEMPLATES: ConfirmationTemplate[] = [
	{
		id: 'assumptions-confirmation',
		triggers: ['create', 'build', 'implement'],
		template: (assumptions: Record<string, unknown>) => {
			const items = Object.entries(assumptions)
				.map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
				.join('\n');
			return `Before I start implementing, I want to confirm my understanding:\n\nCurrent Requirements:\n${items}\n\nAre these assumptions correct? Should I proceed with this understanding?`;
		},
		confirmLabel: 'Yes, proceed',
		modifyLabel: 'No, let me clarify',
	},
];
