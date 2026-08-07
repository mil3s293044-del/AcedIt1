
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { GroupMessage } from "@/entities/all";
import { useToast } from "@/components/ui/use-toast";
import { moderationPresets } from "@/components/shared/contentModeration";
import { fmtDate } from "@/lib/safeDate";

const MessageItem = React.memo(({ message, currentUserEmail }) => {
    const isCurrentUser = message.sender_email === currentUserEmail;
    const isSystemMessage = message.message_type === "system";

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${isCurrentUser ? "justify-end" : "justify-start"} ${isSystemMessage ? "justify-center" : ""}`}
        >
            {isSystemMessage ? (
                <div className="bg-secondary text-muted-foreground text-xs px-3 py-1 rounded-full">
                    {message.message}
                </div>
            ) : (
                <div className={`max-w-[70%] ${isCurrentUser ? "bg-purple-600 text-white" : "bg-surface border"} rounded-2xl px-4 py-2 shadow-sm`}>
                    {!isCurrentUser && (
                        <p className="text-xs font-semibold text-muted-foreground mb-1">
                            {message.sender_name}
                        </p>
                    )}
                    <p className={`text-sm break-words ${isCurrentUser ? "text-white" : "text-foreground"}`}>
                        {message.message}
                    </p>
                    <p className={`text-xs mt-1 ${isCurrentUser ? "text-purple-200" : "text-muted-foreground/60"}`}>
                        {fmtDate(message.timestamp, 'p', '')}
                    </p>
                </div>
            )}
        </motion.div>
    );
});

MessageItem.displayName = 'MessageItem';

export default function GroupChat({ group, user }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef(null);
    const { toast } = useToast();

    useEffect(() => {
        loadMessages();
        const interval = setInterval(loadMessages, 5000); // Poll for new messages every 5 seconds
        return () => clearInterval(interval);
    }, [group.id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadMessages = async () => {
        try {
            const groupMessages = await GroupMessage.filter({ group_id: group.id }, "timestamp");
            setMessages(groupMessages || []);
        } catch (error) {
            console.error("Error loading messages:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);
        try {
            // Content moderation
            const moderationResult = await moderationPresets.message(newMessage);
            
            if (!moderationResult.isAllowed) {
                toast({ 
                    title: "Message Not Sent", 
                    description: "This message cannot be sent due to a violation of our community guidelines. Please ensure your messages are respectful and appropriate.",
                    variant: "destructive" 
                });
                setIsSending(false);
                return;
            }

            await GroupMessage.create({
                group_id: group.id,
                sender_email: user.email,
                sender_name: user.full_name,
                message: newMessage.trim(),
                message_type: "text",
                timestamp: new Date().toISOString()
            });

            setNewMessage("");
            await loadMessages();
        } catch (error) {
            console.error("Error sending message:", error);
            toast({ title: "Failed to send message", variant: "destructive" });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="border-b flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-purple-600" />
                    Group Chat
                </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                <ScrollArea className="flex-1 p-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <AnimatePresence>
                                {messages.map((message) => (
                                    <MessageItem
                                        key={message.id || message.timestamp + message.sender_email} // Fallback key if message.id is missing
                                        message={message}
                                        currentUserEmail={user.email}
                                    />
                                ))}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </ScrollArea>

                <div className="p-4 border-t border-indigo-200 bg-indigo-50/50 flex-shrink-0">
                    <div className="flex gap-2">
                        <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="Type a message..."
                            disabled={isSending}
                            className="flex-1"
                        />
                        <Button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() || isSending}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                        >
                            {isSending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
