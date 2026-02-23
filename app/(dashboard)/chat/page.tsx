"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Send,
  Plus,
  Trash2,
  MessageCircle,
  Bot,
  User,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useErrorModal } from "@/components/error-modal";
import ReactMarkdown from "react-markdown";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  title: string;
  messages: Message[];
}

export default function ChatPage() {
  const { showApiError } = useErrorModal();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiFetch<Conversation[]>("/api/chat");
      setConversations(data);
    } catch (err) {
      showApiError(err, "Failed to load conversations");
    }
  }, [showApiError]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadConversation = useCallback(
    async (id: string) => {
      setIsLoading(true);
      try {
        const data = await apiFetch<ConversationDetail>(`/api/chat/${id}`);
        setActiveConversationId(id);
        setMessages(data.messages);
      } catch (err) {
        showApiError(err, "Failed to load conversation");
      } finally {
        setIsLoading(false);
      }
    },
    [showApiError]
  );

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/chat/${id}`, { method: "DELETE" });
      toast.success("Conversation deleted");
      if (activeConversationId === id) {
        startNewChat();
      }
      loadConversations();
    } catch (err) {
      showApiError(err, "Failed to delete conversation");
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const data = await apiFetch<{
        conversationId: string;
        response: string;
      }>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationId: activeConversationId,
        }),
      });

      const assistantMessage: Message = {
        id: `resp-${Date.now()}`,
        role: "assistant",
        content: data.response,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (!activeConversationId) {
        setActiveConversationId(data.conversationId);
      }

      loadConversations();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      setInput(trimmed);
      showApiError(err, "Failed to get AI response");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const exampleQuestions = [
    "What did I work on last week?",
    "Summarize my commits from the last month",
    "What repositories did I contribute to recently?",
    "What patterns do you see in my recent work?",
  ];

  return (
    <div className="flex h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] gap-0">
      {/* Collapsible Sidebar */}
      <div
        className={`shrink-0 flex flex-col border-r border-border/50 bg-card/30 transition-all duration-300 overflow-hidden ${
          sidebarOpen ? "w-72" : "w-0"
        }`}
      >
        <div className="p-3 flex items-center justify-between border-b border-border/50 shrink-0">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
            Conversations
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={startNewChat}
            className="gap-1.5 h-7 text-xs shrink-0"
          >
            <Plus className="w-3 h-3" />
            New
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-3">
              No conversations yet. Start by asking a question.
            </p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`w-full text-left p-2.5 rounded-lg text-sm transition-all duration-150 group flex items-start gap-2 ${
                  activeConversationId === conv.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "hover:bg-muted/50 text-foreground border border-transparent"
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-50" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium">{conv.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {conv._count.messages} msgs
                  </p>
                </div>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar with sidebar toggle */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/30 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            {activeConversationId
              ? conversations.find((c) => c.id === activeConversationId)
                  ?.title || "Chat"
              : "New Chat"}
          </span>
        </div>

        {/* Messages area - native scroll */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  Ask about your commits
                </h3>
                <p className="text-muted-foreground text-center max-w-md mb-8">
                  Ask anything about your Azure DevOps commit history. I can
                  summarize periods, explain specific commits, and help you
                  understand your work patterns.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                  {exampleQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        inputRef.current?.focus();
                      }}
                      className="text-left p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-foreground"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 ${
                      msg.role === "assistant"
                        ? "bg-primary/10"
                        : "bg-muted"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <Bot className="w-4 h-4 text-primary" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {msg.role === "assistant" ? "AI Assistant" : "You"}
                    </p>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:my-3 prose-pre:my-2 prose-code:text-xs">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}

            {isSending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    AI Assistant
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing your commits...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border/50 p-4 bg-card/30 shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3 items-center">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your commits... (e.g., 'What did I do last week?')"
                  rows={1}
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/60 min-h-[44px] max-h-[120px]"
                  style={{
                    height: "auto",
                    minHeight: "44px",
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height =
                      Math.min(target.scrollHeight, 120) + "px";
                  }}
                  disabled={isSending}
                />
              </div>
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isSending}
                size="icon"
                className="h-[44px] w-[44px] rounded-xl shrink-0"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Press Enter to send, Shift+Enter for new line. Mention dates or
              commit hashes for targeted answers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
