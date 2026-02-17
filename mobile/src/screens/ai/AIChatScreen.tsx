// ============================================================
// HealthGuard Mobile - AI Chat Screen
// ============================================================
// AI-powered health chatbot with conversation type selector,
// message bubbles, typing indicator, and auto-scroll.
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { aiAPI } from '../../api/endpoints';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  touchTargets,
  layout,
} from '../../theme';
import type { AIMessage, ConversationType } from '../../../shared/types';

// ── Types ─────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface ConversationTypeOption {
  type: ConversationType;
  label: string;
  icon: string;
  color: string;
}

// ── Constants ─────────────────────────────────────────────────

const CONVERSATION_TYPES: ConversationTypeOption[] = [
  {
    type: 'general_health',
    label: 'General Health',
    icon: 'heart-plus',
    color: colors.success,
  },
  {
    type: 'triage',
    label: 'Symptom Check',
    icon: 'stethoscope',
    color: colors.secondary,
  },
  {
    type: 'emergency_guidance',
    label: 'Emergency Guide',
    icon: 'ambulance',
    color: colors.danger,
  },
];

// ── Message Bubble Sub-Component ──────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <View style={styles.systemMessageContainer}>
        <Text style={styles.systemMessageText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.messageBubbleContainer,
        isUser ? styles.userMessageContainer : styles.aiMessageContainer,
      ]}
    >
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Icon name="robot" size={22} color={colors.white} />
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.aiMessageText,
          ]}
          selectable
        >
          {message.content}
        </Text>
        <Text
          style={[
            styles.messageTime,
            isUser ? styles.userMessageTime : styles.aiMessageTime,
          ]}
        >
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
};

// ── Typing Indicator Sub-Component ────────────────────────────

const TypingIndicator: React.FC = () => (
  <View style={styles.typingContainer}>
    <View style={styles.aiAvatar}>
      <Icon name="robot" size={22} color={colors.white} />
    </View>
    <View style={styles.typingBubble}>
      <View style={styles.typingDots}>
        <View style={[styles.typingDot, styles.typingDot1]} />
        <View style={[styles.typingDot, styles.typingDot2]} />
        <View style={[styles.typingDot, styles.typingDot3]} />
      </View>
    </View>
  </View>
);

// ── Main Component ────────────────────────────────────────────

const AIChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ConversationType>('general_health');
  const [showTypeSelector, setShowTypeSelector] = useState(true);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Start conversation when type is selected
  const startConversation = useCallback(
    async (type: ConversationType) => {
      setSelectedType(type);
      setShowTypeSelector(false);
      setMessages([]);
      setConversationId(null);

      try {
        const response = await aiAPI.startConversation({
          conversation_type: type,
        });

        if (response.data.success && response.data.data) {
          const conversation = response.data.data;
          setConversationId(conversation.conversation_id);

          // Add a welcome system message
          const typeLabel =
            CONVERSATION_TYPES.find((t) => t.type === type)?.label || 'Health';
          const welcomeMessage: ChatMessage = {
            id: 'welcome',
            role: 'assistant',
            content: getWelcomeMessage(type),
            timestamp: new Date().toISOString(),
          };
          setMessages([welcomeMessage]);
        }
      } catch {
        Alert.alert(
          'Connection Error',
          'Unable to start a conversation. Please try again.',
          [{ text: 'OK' }],
        );
        setShowTypeSelector(true);
      }
    },
    [],
  );

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !conversationId || isSending) return;

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);
    setIsSending(true);

    try {
      const response = await aiAPI.sendMessage(conversationId, text);

      if (response.data.success && response.data.data) {
        const aiMsg = response.data.data;
        const assistantMessage: ChatMessage = {
          id: aiMsg.message_id,
          role: aiMsg.role,
          content: aiMsg.content,
          timestamp: aiMsg.timestamp,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content:
          'I apologize, but I encountered an error. Please try sending your message again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setIsSending(false);
    }
  }, [inputText, conversationId, isSending]);

  const handleNewConversation = useCallback(() => {
    if (conversationId) {
      Alert.alert(
        'New Conversation',
        'Start a new conversation? The current conversation will end.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start New',
            onPress: async () => {
              try {
                await aiAPI.endConversation(conversationId);
              } catch {
                // Proceed even if ending fails
              }
              setShowTypeSelector(true);
              setMessages([]);
              setConversationId(null);
            },
          },
        ],
      );
    } else {
      setShowTypeSelector(true);
    }
  }, [conversationId]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isTyping]);

  // Invert list data for FlatList (newest at bottom)
  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <MessageBubble message={item} />,
    [],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const currentTypeConfig = CONVERSATION_TYPES.find((t) => t.type === selectedType);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="robot" size={28} color={colors.primary} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>AI Health Assistant</Text>
            {!showTypeSelector && currentTypeConfig && (
              <Text style={[styles.headerSubtitle, { color: currentTypeConfig.color }]}>
                {currentTypeConfig.label}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={handleNewConversation}
          style={styles.newChatButton}
          accessibilityRole="button"
          accessibilityLabel="Start new conversation"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="chat-plus" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Conversation Type Selector */}
        {showTypeSelector ? (
          <View style={styles.typeSelectorContainer}>
            <Text style={styles.typeSelectorTitle}>
              How can I help you today?
            </Text>
            <Text style={styles.typeSelectorSubtitle}>
              Choose a conversation topic to get started
            </Text>
            <View style={styles.typeCardsContainer}>
              {CONVERSATION_TYPES.map((typeOption) => (
                <TouchableOpacity
                  key={typeOption.type}
                  style={styles.typeCard}
                  onPress={() => startConversation(typeOption.type)}
                  accessibilityRole="button"
                  accessibilityLabel={`Start ${typeOption.label} conversation`}
                >
                  <View
                    style={[
                      styles.typeCardIconCircle,
                      { backgroundColor: typeOption.color + '20' },
                    ]}
                  >
                    <Icon name={typeOption.icon} size={36} color={typeOption.color} />
                  </View>
                  <Text style={styles.typeCardLabel}>{typeOption.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <>
            {/* Messages List */}
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={isTyping ? <TypingIndicator /> : null}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: true })
              }
            />

            {/* Input Bar */}
            <View style={styles.inputBar}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type your message..."
                placeholderTextColor={colors.placeholder}
                multiline
                maxLength={2000}
                returnKeyType="default"
                blurOnSubmit={false}
                accessibilityLabel="Message input"
                accessibilityHint="Type a message to send to the AI health assistant"
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={!inputText.trim() || isSending}
                style={[
                  styles.sendButton,
                  (!inputText.trim() || isSending) && styles.sendButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <Icon
                  name="send"
                  size={24}
                  color={
                    !inputText.trim() || isSending
                      ? colors.disabled
                      : colors.white
                  }
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── Helpers ───────────────────────────────────────────────────

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getWelcomeMessage(type: ConversationType): string {
  switch (type) {
    case 'triage':
      return 'Hello! I am your HealthGuard symptom checker. Please describe the symptoms you are experiencing and I will help you assess them. Remember, this is not a replacement for professional medical advice.';
    case 'emergency_guidance':
      return 'I am here to help you with emergency guidance. Please describe the emergency situation and I will provide step-by-step assistance. If this is a life-threatening emergency, please call 911 immediately.';
    default:
      return 'Hello! I am your HealthGuard health assistant. I can help answer general health questions, explain medical terms, or provide wellness tips. How can I help you today?';
  }
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.base,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextContainer: {
    marginLeft: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginTop: 1,
  },
  newChatButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },

  // Type Selector
  typeSelectorContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing['4xl'],
  },
  typeSelectorTitle: {
    ...typography.heading2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  typeSelectorSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  typeCardsContainer: {
    gap: spacing.base,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
    minHeight: touchTargets.large,
  },
  typeCardIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  typeCardLabel: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },

  // Messages
  messagesList: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    maxWidth: '85%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  aiMessageContainer: {
    alignSelf: 'flex-start',
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 4,
  },
  messageBubble: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    maxWidth: '100%',
    flexShrink: 1,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.sm,
  },
  aiBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: borderRadius.sm,
    ...shadows.sm,
  },
  messageText: {
    fontSize: typography.fontSize.base,
    lineHeight: 26,
  },
  userMessageText: {
    color: colors.white,
  },
  aiMessageText: {
    color: colors.textPrimary,
  },
  messageTime: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  userMessageTime: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  aiMessageTime: {
    color: colors.textTertiary,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  systemMessageText: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Typing Indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  typingBubble: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderBottomLeftRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  typingDots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textTertiary,
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },

  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  textInput: {
    flex: 1,
    minHeight: layout.inputHeight,
    maxHeight: 120,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: touchTargets.preferred,
    height: touchTargets.preferred,
    borderRadius: touchTargets.preferred / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  sendButtonDisabled: {
    backgroundColor: colors.borderLight,
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default AIChatScreen;
