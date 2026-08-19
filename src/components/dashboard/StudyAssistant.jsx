import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import {
    MessageCircle,
    Send,
    Bot,
    User as UserIcon,
    Maximize2,
    Sparkles,
    Brain,
    Target,
    BookOpen,
    Loader2,
    X,
    Trash2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import AceShuffle from "@/components/ace/AceShuffle";

const MessageBubble = ({ message, isUser }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
        {!isUser && (
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
            </div>
        )}
        <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-secondary text-foreground border border-border'
            }`}
        >
            {isUser ? (
                <p className="text-sm">{message.content}</p>
            ) : (
                <ReactMarkdown
                    className="text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                    components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>
                    }}
                >
                    {message.content}
                </ReactMarkdown>
            )}

            {message.tool_calls && message.tool_calls.length > 0 && (
                <div className="mt-2 space-y-1">
                    {message.tool_calls.map((toolCall, idx) => (
                        <div key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded flex items-center gap-1">
                            <Brain className="w-3 h-3" />
                            {toolCall.name.replace('_', ' ')}
                            {toolCall.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
        {isUser && (
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
            </div>
        )}
    </motion.div>
);

const SuggestedPrompts = ({ onSelect }) => {
    const regularPrompts = [
        { icon: Target, text: "How can I improve my study schedule?", category: "Planning" },
        { icon: BookOpen, text: "What should I focus on this week?", category: "Subjects" },
        { icon: Brain, text: "How do I use the Pomodoro technique effectively?", category: "Techniques" },
        { icon: Sparkles, text: "Help me plan for my upcoming assessments", category: "Goals" }
    ];

    const prompts = regularPrompts;

    return (
        <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Suggested questions:</p>
            <div className="grid grid-cols-1 gap-2">
                {prompts.map((prompt, idx) => {
                    const Icon = prompt.icon;
                    return (
                        <button
                            key={idx}
                            onClick={() => onSelect(prompt.text)}
                            className="flex items-center gap-2 p-2 text-left text-sm bg-secondary/50 hover:bg-secondary rounded-lg transition-colors"
                        >
                            <Icon className="w-4 h-4 text-purple-600" />
                            <span className="text-muted-foreground">{prompt.text}</span>
                            <Badge variant="outline" className="ml-auto text-xs">{prompt.category}</Badge>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default function StudyAssistant({ user }) {
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMinimized, setIsMinimized] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const [initError, setInitError] = useState(false);
    const messagesEndRef = useRef(null);
    const { toast } = useToast();

    // Chat persistence for regular chat
    const saveChat = useCallback((conversationId, messages) => {
        try {
            const chatData = {
                conversationId,
                messages,
                timestamp: Date.now(),
                expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            };
            localStorage.setItem(`chat_${conversationId}`, JSON.stringify(chatData));
        } catch (error) {
            console.error("Error saving chat:", error);
        }
    }, []);

    const loadSavedChat = useCallback((conversationId) => {
        try {
            const saved = localStorage.getItem(`chat_${conversationId}`);
            if (saved) {
                const chatData = JSON.parse(saved);
                if (Date.now() < chatData.expiresAt) {
                    return chatData.messages;
                } else {
                    localStorage.removeItem(`chat_${conversationId}`);
                }
            }
        } catch (error) {
            console.error("Error loading saved chat:", error);
        }
        return null;
    }, []);

    const cleanupExpiredChats = useCallback(() => {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('chat_')) {
                    const saved = localStorage.getItem(key);
                    if (saved) {
                        const chatData = JSON.parse(saved);
                        if (Date.now() >= chatData.expiresAt) {
                            localStorage.removeItem(key);
                        }
                    }
                }
            });
        } catch (error) {
            console.error("Error cleaning up chats:", error);
        }
    }, []);

    // Function to create a new conversation - only called when chat is opened
    const createConversation = useCallback(async () => {
        if (isInitialized || !user) return;
        
        setIsLoading(true);
        setInitError(false);
        
        try {
            const newConversation = await base44.agents.createConversation({
                agent_name: "study_assistant",
                metadata: {
                    name: "Study Assistant Chat",
                    description: "AI assistant for study planning and guidance"
                }
            });
            
            setConversation(newConversation);
            setIsInitialized(true);

            // Attempt to load previous messages for this ID
            const savedMessages = loadSavedChat(newConversation.id);
            if (savedMessages && savedMessages.length > 0) {
                setMessages(savedMessages);
                setIsLoading(false);
                return;
            }

            // Send initial welcome message
            const welcomeMessage = "Hi! I'm your AI study assistant. I can help you with:\n• Study planning and VCE advice\n• Using app features (timers, flashcards, quizzes, etc.)\n• Managing your subjects and goals\n• Updating your account information\n\nWhat can I help you with today?";

            await base44.agents.addMessage(newConversation, {
                role: "assistant",
                content: welcomeMessage
            });
        } catch (error) {
            console.error("Error creating conversation:", error);
            setInitError(true);
            toast({
                title: "Assistant Unavailable",
                description: "Could not start chat. Please try again later.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }, [user, isInitialized, loadSavedChat, toast]);

    // Only initialize when chat is opened
    useEffect(() => {
        if (!user || isMinimized || isInitialized) return;
        
        cleanupExpiredChats();
        createConversation();
    }, [user, isMinimized, isInitialized, cleanupExpiredChats, createConversation]);

    // Subscribe to conversation updates
    useEffect(() => {
        if (!conversation?.id) return;

        const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
            const newMessages = data.messages || [];
            setMessages(newMessages);
            setIsLoading(false);

            // Save chat to localStorage
            if (newMessages.length > 0) {
                saveChat(conversation.id, newMessages);
            }
        });

        return () => unsubscribe();
    }, [conversation, saveChat]);

    // Auto-scroll to bottom when messages update
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (messageText) => {
        if (!conversation?.id || !messageText.trim() || isLoading) return;

        setInputMessage('');
        setIsLoading(true);

        try {
            await base44.agents.addMessage(conversation, {
                role: "user",
                content: messageText.trim()
            });
        } catch (error) {
            console.error("Error sending message:", error);
            toast({
                title: "Message Failed",
                description: "Could not send message. Please try again.",
                variant: "destructive"
            });
            setIsLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage(inputMessage);
    };

    const handleSuggestedPrompt = (prompt) => {
        setInputMessage(prompt);
        sendMessage(prompt);
    };

    const clearChat = () => {
        if (conversation) {
            localStorage.removeItem(`chat_${conversation.id}`);
            setMessages([]);
            toast({ title: "Chat cleared", description: "Your conversation history has been cleared." });
        }
    };

    const handleOpenChat = () => {
        setIsMinimized(false);
        // Initialize conversation when opened
        if (!isInitialized && !conversation) {
            createConversation();
        }
    };

    if (!user) return null;

    // Minimized state - floating button in bottom right
    if (isMinimized) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="fixed bottom-6 right-6 z-40"
            >
                <Button
                    onClick={handleOpenChat}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg rounded-full px-6 py-3 flex items-center gap-2"
                >
                    <MessageCircle className="w-5 h-5" />
                    <span className="font-medium">AI Chat</span>
                </Button>
            </motion.div>
        );
    }

    // Show error state if initialization failed
    if (initError && !conversation) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed bottom-6 right-6 z-40 w-96"
            >
                <Card className="shadow-xl border-0 bg-surface/95 backdrop-blur-sm">
                    <CardContent className="p-6 text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <X className="w-6 h-6 text-red-600" />
                        </div>
                        <p className="text-muted-foreground font-medium mb-2">Chat Unavailable</p>
                        <p className="text-sm text-muted-foreground mb-4">Unable to connect to AI assistant.</p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsMinimized(true)} className="flex-1">
                                Close
                            </Button>
                            <Button onClick={() => {
                                setInitError(false);
                                setIsInitialized(false);
                                createConversation();
                            }} className="flex-1">
                                Retry
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    // Expanded dialog state
    if (isExpanded) {
        return (
            <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 flex-shrink-0 border-b border-border">
                        <DialogTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                AI Study Assistant
                                <Badge className="ml-2 bg-green-100 text-green-800">Online</Badge>
                            </div>
                            <Button variant="ghost" size="icon" onClick={clearChat} className="text-muted-foreground hover:text-red-600" aria-label="Clear chat">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 flex flex-col min-h-0">
                        <ScrollArea className="flex-1 px-6 py-2">
                            <div className="min-h-full flex flex-col pb-4">
                                {isLoading && messages.length === 0 ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="text-center">
                                            <AceShuffle size="lg" className="mb-2 mx-auto" />
                                            <p className="text-muted-foreground">Connecting to assistant...</p>
                                        </div>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="text-center max-w-md">
                                            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Sparkles className="w-8 h-8 text-white" />
                                            </div>
                                            <h3 className="text-lg font-semibold mb-2">Your AI Study Assistant</h3>
                                            <p className="text-muted-foreground mb-6">I'm here to help you with study planning, VCE advice, app guidance, and account updates.</p>
                                            <SuggestedPrompts onSelect={handleSuggestedPrompt} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {messages.map((message, idx) => (
                                            <MessageBubble
                                                key={idx}
                                                message={message}
                                                isUser={message.role === 'user'}
                                            />
                                        ))}
                                        {isLoading && (
                                            <div className="flex justify-start mb-4">
                                                <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-2">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span className="text-sm text-muted-foreground">Assistant is thinking...</span>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        <div className="flex-shrink-0 border-t border-border p-6">
                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <Input
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder="Ask me anything about VCE, studying, or the app..."
                                    disabled={isLoading || !conversation}
                                    className="flex-1"
                                />
                                <Button type="submit" disabled={isLoading || !inputMessage.trim() || !conversation}>
                                    <Send className="w-4 h-4" />
                                </Button>
                            </form>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // Compact card state
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-6 right-6 z-40 w-96"
        >
            <Card className="shadow-xl border-0 bg-surface/95 backdrop-blur-sm max-h-[70vh] flex flex-col">
                <CardHeader className="pb-3 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                                <Bot className="w-3 h-3 text-white" />
                            </div>
                            AI Chat
                            <Badge className="ml-2 bg-green-100 text-green-800 text-xs">Online</Badge>
                        </CardTitle>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(true)} className="h-8 w-8" aria-label="Expand assistant">
                                <Maximize2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setIsMinimized(true)} className="h-8 w-8" aria-label="Minimize assistant">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
                    <ScrollArea className="flex-1 min-h-0 h-64">
                        {isLoading && messages.length === 0 ? (
                            <div className="text-center py-8">
                                <AceShuffle size="lg" className="mb-2 mx-auto" />
                                <p className="text-sm text-muted-foreground">Starting chat...</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="text-center py-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">I'm here to help with your studies!</p>
                                <SuggestedPrompts onSelect={handleSuggestedPrompt} />
                            </div>
                        ) : (
                            <div className="pb-2">
                                {messages.map((message, idx) => (
                                    <MessageBubble
                                        key={idx}
                                        message={message}
                                        isUser={message.role === 'user'}
                                    />
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start mb-4">
                                        <div className="flex items-center gap-2 bg-secondary rounded-full px-3 py-1">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span className="text-xs text-muted-foreground">Thinking...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </ScrollArea>

                    <div className="flex-shrink-0">
                        <form onSubmit={handleSubmit} className="flex gap-2">
                            <Input
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Ask me anything..."
                                disabled={isLoading || !conversation}
                                className="flex-1 text-sm"
                                size="sm"
                            />
                            <Button type="submit" disabled={isLoading || !inputMessage.trim() || !conversation} size="sm">
                                <Send className="w-3 h-3" />
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}