import Anthropic from '@anthropic-ai/sdk';
import db from '../config/database';
import config from '../config';
import { v4 as uuidv4 } from 'uuid';
import {
  AIConversation,
  AIMessage,
  ConversationType,
  AlertType,
} from '../../../shared/types';
import logger from '../utils/logger';

// System prompts for different conversation types
const SYSTEM_PROMPTS: Record<ConversationType, string> = {
  emergency_guidance: `You are HealthGuard's AI emergency guidance assistant. Your role is critical and potentially life-saving.

IMPORTANT GUIDELINES:
- Provide calm, clear, step-by-step emergency guidance.
- Always advise calling 911 or local emergency services for life-threatening situations.
- Ask clarifying questions about the patient's condition when needed.
- Provide first-aid instructions appropriate for the situation.
- Keep instructions simple and actionable - the user may be panicking.
- Never diagnose conditions - only provide guidance to stabilize until help arrives.
- Remind users that you are an AI assistant and cannot replace professional medical care.
- If vital signs data is available, reference it in your guidance.
- Prioritize: Safety > Stabilization > Comfort.

You have access to the user's health metrics and alert information. Use this data to provide contextual guidance.`,

  triage: `You are HealthGuard's AI triage assistant. Help users assess their symptoms and determine the appropriate level of care.

IMPORTANT GUIDELINES:
- Ask structured questions about symptoms: onset, duration, severity (1-10), location, and progression.
- Consider the user's medical history, allergies, and existing conditions when available.
- Categorize urgency: Emergency (call 911), Urgent Care (visit within hours), Primary Care (schedule appointment), Self-Care (home treatment).
- Never provide definitive diagnoses - suggest possible conditions and recommend appropriate care.
- Always err on the side of caution for potentially serious symptoms.
- Ask about red-flag symptoms (chest pain, difficulty breathing, sudden severe headache, etc.).
- Provide clear next-step recommendations.
- Remind users that this is not a substitute for professional medical evaluation.`,

  general_health: `You are HealthGuard's general health assistant. Provide helpful, evidence-based health information.

IMPORTANT GUIDELINES:
- Provide general health education and wellness information.
- Answer questions about medications, conditions, and treatments in general terms.
- Encourage healthy lifestyle choices and preventive care.
- Never prescribe medications or provide specific treatment plans.
- Suggest consulting with healthcare providers for personalized medical advice.
- Reference reputable medical sources when possible.
- Be empathetic and supportive in your responses.
- If the user describes symptoms suggesting a medical emergency, advise them to seek immediate medical attention.`,
};

/**
 * AI service powered by Anthropic Claude API.
 * Handles emergency guidance, triage conversations, and general health queries.
 */
class AIService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }

  /**
   * Start a new AI conversation.
   */
  async startConversation(
    userId: string,
    conversationType: ConversationType,
    initialMessage: string,
    emergencyAlertId?: string
  ): Promise<{ conversation: AIConversation; response: AIMessage }> {
    const conversationId = uuidv4();
    const now = new Date().toISOString();

    // Create the conversation record
    const [conversation] = await db('ai_conversations')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        emergency_alert_id: emergencyAlertId || null,
        conversation_type: conversationType,
        started_at: now,
        total_messages: 0,
      })
      .returning('*');

    // Store the user's initial message
    await this.storeMessage(conversationId, 'user', initialMessage);

    // Build context from user history if available
    const context = await this.buildUserContext(userId, conversationType, emergencyAlertId);

    // Get AI response
    const aiResponse = await this.callClaude(
      conversationType,
      [{ role: 'user', content: context + initialMessage }]
    );

    // Store the AI response
    const responseMessage = await this.storeMessage(
      conversationId,
      'assistant',
      aiResponse.content,
      aiResponse.tokensUsed
    );

    // Update message count
    await db('ai_conversations')
      .where('conversation_id', conversationId)
      .update({ total_messages: 2 });

    logger.info('AI conversation started', {
      conversationId,
      userId,
      type: conversationType,
    });

    return { conversation, response: responseMessage };
  }

  /**
   * Send a message in an existing conversation and get AI response.
   */
  async sendMessage(
    conversationId: string,
    userId: string,
    content: string
  ): Promise<AIMessage> {
    // Verify conversation exists and belongs to user
    const conversation = await db('ai_conversations')
      .where('conversation_id', conversationId)
      .where('user_id', userId)
      .first();

    if (!conversation) {
      throw new Error('Conversation not found or access denied.');
    }

    if (conversation.ended_at) {
      throw new Error('This conversation has ended.');
    }

    // Store user message
    await this.storeMessage(conversationId, 'user', content);

    // Fetch conversation history
    const history = await db('ai_messages')
      .where('conversation_id', conversationId)
      .orderBy('timestamp', 'asc');

    // Build messages array for Claude
    const messages = history.map((msg: AIMessage) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })).filter((msg: { role: string }) => msg.role !== 'system');

    // Get AI response
    const aiResponse = await this.callClaude(
      conversation.conversation_type as ConversationType,
      messages
    );

    // Store AI response
    const responseMessage = await this.storeMessage(
      conversationId,
      'assistant',
      aiResponse.content,
      aiResponse.tokensUsed
    );

    // Update message count
    await db('ai_conversations')
      .where('conversation_id', conversationId)
      .update({
        total_messages: history.length + 1, // +1 for the new AI response
      });

    return responseMessage;
  }

  /**
   * Handle emergency guidance - auto-triggered when a critical alert occurs.
   */
  async handleEmergencyGuidance(
    userId: string,
    alertType: AlertType,
    metricValue: number | undefined,
    emergencyAlertId: string
  ): Promise<{ conversation: AIConversation; response: AIMessage }> {
    // Build emergency-specific prompt
    const alertDescriptions: Record<AlertType, string> = {
      low_heart_rate: `ALERT: Critically low heart rate detected${metricValue ? ` (${metricValue} BPM)` : ''}. The user's heart rate has dropped to dangerous levels.`,
      high_heart_rate: `ALERT: Dangerously high heart rate detected${metricValue ? ` (${metricValue} BPM)` : ''}. The user's heart rate has risen to dangerous levels.`,
      fall_detected: `ALERT: A fall has been detected. The user may be injured or unconscious.`,
      irregular_rhythm: `ALERT: Irregular heart rhythm detected. This could indicate a cardiac arrhythmia.`,
      low_spo2: `ALERT: Low blood oxygen saturation detected${metricValue ? ` (${metricValue}%)` : ''}. The user may be experiencing respiratory distress.`,
    };

    const emergencyMessage = alertDescriptions[alertType] +
      '\n\nPlease provide immediate, step-by-step guidance for this emergency situation. ' +
      'Start with the most critical actions first.';

    return this.startConversation(
      userId,
      'emergency_guidance',
      emergencyMessage,
      emergencyAlertId
    );
  }

  /**
   * Handle triage conversation for symptom assessment.
   */
  async handleTriageConversation(
    userId: string,
    symptoms: string
  ): Promise<{ conversation: AIConversation; response: AIMessage }> {
    const triageMessage = `I would like help assessing my symptoms:\n\n${symptoms}`;

    return this.startConversation(userId, 'triage', triageMessage);
  }

  /**
   * Handle a general health query.
   */
  async handleGeneralHealthQuery(
    userId: string,
    question: string
  ): Promise<{ conversation: AIConversation; response: AIMessage }> {
    return this.startConversation(userId, 'general_health', question);
  }

  /**
   * Get conversation history for a user.
   */
  async getUserConversations(
    userId: string,
    options: {
      type?: ConversationType;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AIConversation[]> {
    let query = db('ai_conversations').where('user_id', userId);

    if (options.type) {
      query = query.where('conversation_type', options.type);
    }

    return query
      .orderBy('started_at', 'desc')
      .limit(options.limit || 20)
      .offset(options.offset || 0);
  }

  /**
   * Get messages for a specific conversation.
   */
  async getConversationMessages(
    conversationId: string,
    userId: string
  ): Promise<AIMessage[]> {
    // Verify ownership
    const conversation = await db('ai_conversations')
      .where('conversation_id', conversationId)
      .where('user_id', userId)
      .first();

    if (!conversation) {
      throw new Error('Conversation not found or access denied.');
    }

    return db('ai_messages')
      .where('conversation_id', conversationId)
      .orderBy('timestamp', 'asc');
  }

  /**
   * Call the Anthropic Claude API.
   */
  private async callClaude(
    conversationType: ConversationType,
    messages: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<{ content: string; tokensUsed: number }> {
    try {
      const response = await this.client.messages.create({
        model: config.anthropic.model,
        max_tokens: config.anthropic.maxTokens,
        system: SYSTEM_PROMPTS[conversationType],
        messages,
      });

      const content = response.content
        .filter((block) => block.type === 'text')
        .map((block) => {
          if (block.type === 'text') return block.text;
          return '';
        })
        .join('\n');

      const tokensUsed =
        (response.usage?.input_tokens || 0) +
        (response.usage?.output_tokens || 0);

      return { content, tokensUsed };
    } catch (error) {
      logger.error('Claude API call failed', { error, conversationType });
      throw new Error('AI service temporarily unavailable. Please try again.');
    }
  }

  /**
   * Build user context for the AI conversation.
   * Includes relevant medical history and current metrics.
   */
  private async buildUserContext(
    userId: string,
    conversationType: ConversationType,
    emergencyAlertId?: string
  ): Promise<string> {
    let context = '';

    try {
      // Fetch user profile for medical context
      const user = await db('users')
        .select('full_name', 'date_of_birth', 'blood_type', 'allergies', 'medical_conditions')
        .where('user_id', userId)
        .first();

      if (user) {
        context += '\n[PATIENT CONTEXT]\n';
        if (user.date_of_birth) {
          const age = Math.floor(
            (Date.now() - new Date(user.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
          );
          context += `Age: ${age}\n`;
        }
        if (user.blood_type) context += `Blood Type: ${user.blood_type}\n`;
        if (user.allergies?.length) context += `Allergies: ${user.allergies.join(', ')}\n`;
        if (user.medical_conditions?.length) context += `Medical Conditions: ${user.medical_conditions.join(', ')}\n`;
      }

      // For emergency guidance, include recent metrics
      if (conversationType === 'emergency_guidance') {
        const recentMetrics = await db('health_metrics')
          .where('user_id', userId)
          .orderBy('recorded_at', 'desc')
          .limit(10);

        if (recentMetrics.length > 0) {
          context += '\n[RECENT VITAL SIGNS]\n';
          for (const metric of recentMetrics) {
            context += `${metric.metric_type}: ${metric.value} ${metric.unit} (at ${metric.recorded_at})\n`;
          }
        }

        // Include the triggering alert details
        if (emergencyAlertId) {
          const alert = await db('emergency_alerts')
            .where('alert_id', emergencyAlertId)
            .first();

          if (alert) {
            context += `\n[TRIGGERING ALERT]\nType: ${alert.alert_type}\nSeverity: ${alert.severity}\nMetric Value: ${alert.metric_value}\nTime: ${alert.created_at}\n`;
          }
        }
      }

      if (context) {
        context += '\n[USER MESSAGE]\n';
      }
    } catch (error) {
      logger.warn('Failed to build user context for AI', { userId, error });
      // Continue without context rather than failing
    }

    return context;
  }

  /**
   * Store a message in the database.
   */
  private async storeMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    tokensUsed?: number
  ): Promise<AIMessage> {
    const messageId = uuidv4();

    const [message] = await db('ai_messages')
      .insert({
        message_id: messageId,
        conversation_id: conversationId,
        role,
        content,
        timestamp: new Date().toISOString(),
        tokens_used: tokensUsed || null,
      })
      .returning('*');

    return message;
  }
}

export default new AIService();
