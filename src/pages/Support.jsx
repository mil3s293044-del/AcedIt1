import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpCircle, Upload as UploadIcon, Info, Loader2, History, Clock, Camera, MessageSquareWarning } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

export default function Support() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [supportForm, setSupportForm] = useState({
        issueType: "",
        location: "",
        description: "",
        screenshot: null
    });
    const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
    const [ticketHistory, setTicketHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const loadUser = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                await loadTicketHistory(currentUser.email);
            } catch (error) {
                console.error("Error loading user:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadUser();
    }, []);

    const loadTicketHistory = async (userEmail) => {
        setIsLoadingHistory(true);
        try {
            const tickets = await base44.entities.SupportTicket.filter(
                { created_by: userEmail },
                '-created_date',
                50
            );
            setTicketHistory(tickets || []);
        } catch (error) {
            console.error("Error loading ticket history:", error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleSupportSubmit = async (e) => {
        e.preventDefault();

        if (!supportForm.issueType || !supportForm.location || !supportForm.description) {
            toast({
                title: "Missing information",
                description: "Please fill in all required fields.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmittingSupport(true);
        try {
            let screenshotUrl = null;

            if (supportForm.screenshot) {
                const { file_url } = await base44.integrations.Core.UploadFile({
                    file: supportForm.screenshot
                });
                screenshotUrl = file_url;
            }

            const { sendSupportTicket } = await import('@/api/functionsShim');
            await sendSupportTicket({
                issueType: supportForm.issueType,
                location: supportForm.location,
                description: supportForm.description,
                screenshotUrl
            });

            toast({
                title: "Support ticket submitted",
                description: "We'll review your report and get back to you soon."
            });

            setSupportForm({
                issueType: "",
                location: "",
                description: "",
                screenshot: null
            });

            await loadTicketHistory(user.email);

        } catch (error) {
            console.error("Error submitting support ticket:", error);
            toast({
                title: "Submission failed",
                description: "Could not submit your ticket. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsSubmittingSupport(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8 min-h-screen bg-background">
            <div className="max-w-4xl mx-auto">
                {/* Page header — Direction A: subtle accent, no high-contrast gradient */}
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-chart-4/10 border border-chart-4/15 flex items-center justify-center shadow-soft">
                            <HelpCircle className="w-6 h-6 text-chart-4" strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="stat-label text-chart-4/80 mb-0.5">Help & feedback</p>
                            <h1 className="font-display font-extrabold text-3xl lg:text-4xl text-foreground tracking-tight leading-none">
                                Support
                            </h1>
                        </div>
                    </div>
                    <p className="text-muted-foreground text-base ml-15 sm:ml-0">
                        Report bugs and view your past tickets.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                    className="card-soft p-6 lg:p-8"
                >
                    <Tabs defaultValue="report" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/60">
                            <TabsTrigger value="report" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-soft">
                                <HelpCircle className="w-4 h-4 mr-2" />
                                Report bug
                            </TabsTrigger>
                            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-soft">
                                <History className="w-4 h-4 mr-2" />
                                History ({ticketHistory.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="report" className="space-y-5 mt-0">
                            <form onSubmit={handleSupportSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-foreground font-semibold">Issue type <span className="text-streak">*</span></Label>
                                    <Select
                                        value={supportForm.issueType}
                                        onValueChange={(value) => setSupportForm({...supportForm, issueType: value})}
                                    >
                                        <SelectTrigger className="bg-surface">
                                            <SelectValue placeholder="Select issue type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="UI/Display Issue">UI/Display Issue</SelectItem>
                                            <SelectItem value="Feature Not Working">Feature Not Working</SelectItem>
                                            <SelectItem value="Data Not Saving">Data Not Saving</SelectItem>
                                            <SelectItem value="Performance Issue">Performance Issue</SelectItem>
                                            <SelectItem value="Login/Account Issue">Login/Account Issue</SelectItem>
                                            <SelectItem value="AI Tool Error">AI Tool Error</SelectItem>
                                            <SelectItem value="Payment/Subscription Issue">Payment/Subscription Issue</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-foreground font-semibold">Where did this happen? <span className="text-streak">*</span></Label>
                                    <Select
                                        value={supportForm.location}
                                        onValueChange={(value) => setSupportForm({...supportForm, location: value})}
                                    >
                                        <SelectTrigger className="bg-surface">
                                            <SelectValue placeholder="Select page or section" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Dashboard">Dashboard</SelectItem>
                                            <SelectItem value="Study (Pomodoro)">Study (Pomodoro)</SelectItem>
                                            <SelectItem value="Study (Spaced Repetition)">Study (Spaced Repetition)</SelectItem>
                                            <SelectItem value="Study (Active Recall)">Study (Active Recall)</SelectItem>
                                            <SelectItem value="Study (Blurting)">Study (Blurting)</SelectItem>
                                            <SelectItem value="Subjects">Subjects</SelectItem>
                                            <SelectItem value="Goals">Goals</SelectItem>
                                            <SelectItem value="Quizzes">Quizzes</SelectItem>
                                            <SelectItem value="AI Tools">AI Tools</SelectItem>
                                            <SelectItem value="Friends">Friends</SelectItem>
                                            <SelectItem value="Analytics">Analytics</SelectItem>
                                            <SelectItem value="Ranked">Ranked</SelectItem>
                                            <SelectItem value="Subscription">Subscription</SelectItem>
                                            <SelectItem value="Settings">Settings</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-foreground font-semibold">Describe the issue <span className="text-streak">*</span></Label>
                                    <Textarea
                                        value={supportForm.description}
                                        onChange={(e) => setSupportForm({...supportForm, description: e.target.value})}
                                        placeholder="What happened, what you expected, and any steps to reproduce."
                                        rows={6}
                                        className="bg-surface resize-y"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-foreground font-semibold">Screenshot <span className="text-muted-foreground font-normal">(optional)</span></Label>
                                    <div className="rounded-xl border border-dashed border-border bg-surface hover:border-primary/40 transition-colors p-5">
                                        <label className="cursor-pointer flex flex-col items-center justify-center gap-2 text-center">
                                            <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-center">
                                                <UploadIcon className="w-5 h-5 text-muted-foreground" strokeWidth={2.5} />
                                            </div>
                                            <p className="text-sm font-semibold text-foreground">
                                                {supportForm.screenshot ? supportForm.screenshot.name : "Upload a screenshot"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">PNG, JPG, or JPEG · up to 10 MB</p>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        setSupportForm({...supportForm, screenshot: file});
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>

                                <Alert className="bg-chart-3/5 border-chart-3/15 shadow-soft">
                                    <Info className="w-4 h-4 text-chart-3" />
                                    <AlertDescription className="text-foreground text-sm">
                                        We'll review your report and get back to you within 24–48 hours.
                                    </AlertDescription>
                                </Alert>

                                <Button
                                    type="submit"
                                    className="w-full btn-3d bg-primary text-primary-foreground hover:bg-primary"
                                    disabled={isSubmittingSupport}
                                >
                                    {isSubmittingSupport ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Submitting…
                                        </>
                                    ) : (
                                        "Submit bug report"
                                    )}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="history" className="mt-0">
                            {isLoadingHistory ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : ticketHistory.length === 0 ? (
                                <EmptyState
                                    icon={History}
                                    title="No tickets yet"
                                    description="Submitted bug reports and support tickets will appear here."
                                    tone="muted"
                                />
                            ) : (
                                <ScrollArea className="h-[600px] pr-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {ticketHistory.map((ticket, index) => {
                                            const screenshotAttached = !!(ticket.extra?.screenshot_url || ticket.screenshot_url);
                                            const status = ticket.status || "open";
                                            const statusColor =
                                                status === "open"     ? "bg-xp/10 text-xp" :
                                                status === "resolved" ? "bg-primary/10 text-primary" :
                                                                        "bg-muted text-muted-foreground";
                                            return (
                                                <motion.div
                                                    key={ticket.id}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.03 }}
                                                    className="card-soft card-soft-hover p-4 flex flex-col gap-3 h-full"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-8 h-8 rounded-lg bg-chart-4/10 border border-chart-4/15 flex items-center justify-center flex-shrink-0">
                                                                <MessageSquareWarning className="w-4 h-4 text-chart-4" strokeWidth={2.5} />
                                                            </div>
                                                            <p className="font-display font-extrabold text-foreground text-sm line-clamp-2">
                                                                {ticket.subject}
                                                            </p>
                                                        </div>
                                                        <span className={`pill ${statusColor} text-[10px] flex-shrink-0 capitalize`}>{status}</span>
                                                    </div>

                                                    <div className="bg-muted/40 rounded-lg p-3 border border-border/40">
                                                        <p className="text-sm text-foreground line-clamp-4 whitespace-pre-wrap">
                                                            {ticket.body || ticket.description}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <Clock className="w-3 h-3" />
                                                            {format(new Date(ticket.created_date), "d MMM yyyy")}
                                                        </div>
                                                        {screenshotAttached && (
                                                            <div className="flex items-center gap-1 text-xs text-chart-4 font-semibold">
                                                                <Camera className="w-3.5 h-3.5" strokeWidth={2.5} />
                                                                <span>Screenshot</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            )}
                        </TabsContent>
                    </Tabs>
                </motion.div>
            </div>
        </div>
    );
}
