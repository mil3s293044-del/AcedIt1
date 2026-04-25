import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpCircle, Upload as UploadIcon, Info, Loader2, History, Clock } from "lucide-react";
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
                { user_email: userEmail },
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

            await base44.functions.invoke('sendSupportTicket', {
                issueType: supportForm.issueType,
                location: supportForm.location,
                description: supportForm.description,
                screenshotUrl
            });

            toast({ 
                title: "Support ticket submitted!", 
                description: "We'll review your report and get back to you soon."
            });

            setSupportForm({
                issueType: "",
                location: "",
                description: "",
                screenshot: null
            });

            // Reload ticket history
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
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                            <HelpCircle className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                            Support
                        </h1>
                    </div>
                    <p className="text-gray-600 text-lg">
                        Report bugs or technical issues
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-xl">
                        <Tabs defaultValue="report" className="w-full">
                            <CardHeader>
                                <TabsList className="grid w-full grid-cols-2 mb-2">
                                    <TabsTrigger value="report" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                                        <HelpCircle className="w-4 h-4 mr-2" />
                                        Report Bug
                                    </TabsTrigger>
                                    <TabsTrigger value="history" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                                        <History className="w-4 h-4 mr-2" />
                                        History ({ticketHistory.length})
                                    </TabsTrigger>
                                </TabsList>
                            </CardHeader>

                            <CardContent>
                                <TabsContent value="report" className="space-y-6 mt-0">
                                    <form onSubmit={handleSupportSubmit} className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-gray-700">Issue Type *</Label>
                                            <Select 
                                                value={supportForm.issueType} 
                                                onValueChange={(value) => setSupportForm({...supportForm, issueType: value})}
                                            >
                                                <SelectTrigger className="bg-white">
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
                                            <Label className="text-gray-700">Where did this occur? *</Label>
                                            <Select 
                                                value={supportForm.location} 
                                                onValueChange={(value) => setSupportForm({...supportForm, location: value})}
                                            >
                                                <SelectTrigger className="bg-white">
                                                    <SelectValue placeholder="Select page/section" />
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
                                            <Label className="text-gray-700">Describe the issue *</Label>
                                            <Textarea
                                                value={supportForm.description}
                                                onChange={(e) => setSupportForm({...supportForm, description: e.target.value})}
                                                placeholder="Please provide as much detail as possible about what happened, what you expected to happen, and any steps to reproduce the issue..."
                                                rows={6}
                                                className="bg-white"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-gray-700">Screenshot (Optional)</Label>
                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-white hover:border-gray-400 transition-colors">
                                                <Button 
                                                    type="button"
                                                    variant="outline" 
                                                    className="w-full" 
                                                    asChild
                                                >
                                                    <label className="cursor-pointer flex items-center justify-center gap-2">
                                                        <UploadIcon className="w-4 h-4" />
                                                        {supportForm.screenshot ? supportForm.screenshot.name : "Upload Screenshot"}
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
                                                </Button>
                                                <p className="text-xs text-gray-500 mt-2 text-center">
                                                    PNG, JPG, or JPEG up to 10MB
                                                </p>
                                            </div>
                                        </div>

                                        <Alert className="bg-blue-50 border-blue-200">
                                            <Info className="w-4 h-4 text-blue-600" />
                                            <AlertDescription className="text-blue-800">
                                                Your report will be sent to our support team. We typically respond within 24-48 hours.
                                            </AlertDescription>
                                        </Alert>

                                        <Button 
                                            type="submit" 
                                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                                            disabled={isSubmittingSupport}
                                        >
                                            {isSubmittingSupport ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                "Submit Bug Report"
                                            )}
                                        </Button>
                                    </form>
                                </TabsContent>

                                <TabsContent value="history" className="mt-0">
                                    {isLoadingHistory ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                                        </div>
                                    ) : ticketHistory.length === 0 ? (
                                        <div className="text-center py-12">
                                            <History className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                            <h3 className="text-xl font-bold text-gray-900 mb-2">No Support Tickets Yet</h3>
                                            <p className="text-gray-600">Your submitted support tickets will appear here.</p>
                                        </div>
                                    ) : (
                                        <ScrollArea className="h-[600px] pr-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {ticketHistory.map((ticket, index) => (
                                                    <motion.div
                                                        key={ticket.id}
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: index * 0.05 }}
                                                        whileHover={{ scale: 1.02 }}
                                                        className="cursor-pointer"
                                                    >
                                                        <Card className="bg-gradient-to-br from-white to-purple-50/30 border-2 border-purple-200/50 hover:border-purple-300 hover:shadow-xl transition-all h-full">
                                                            <CardHeader className="pb-3">
                                                                <div className="flex items-start justify-between mb-2">
                                                                    <Badge variant="outline" className="text-xs bg-white">
                                                                        Bug Report
                                                                    </Badge>
                                                                </div>
                                                                <CardTitle className="text-base font-bold text-gray-900 line-clamp-2">
                                                                    {ticket.subject}
                                                                </CardTitle>
                                                            </CardHeader>
                                                            <CardContent className="space-y-3">
                                                                <div className="bg-white/80 rounded-lg p-3 border border-purple-100">
                                                                    <p className="text-sm text-gray-700 line-clamp-4 whitespace-pre-wrap">
                                                                        {ticket.description}
                                                                    </p>
                                                                </div>

                                                                {ticket.screenshot_url && (
                                                                    <div className="flex items-center gap-1.5 text-xs text-purple-600 font-medium">
                                                                        <span>📷</span>
                                                                        <span>Screenshot attached</span>
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center justify-between pt-2 border-t border-purple-100">
                                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                                        <Clock className="w-3 h-3" />
                                                                        {format(new Date(ticket.created_date), 'MMM d, yyyy')}
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    )}
                                </TabsContent>
                            </CardContent>
                        </Tabs>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}