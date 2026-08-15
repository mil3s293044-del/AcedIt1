import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
    FolderOpen,
    Search,
    Filter,
    X,
    Eye,
    Trash2,
    Calendar,
    Book,
    HelpCircle,
    Brain,
    ClipboardList,
    Sparkles,
    ArrowLeft,
    Share2,
    Users
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import AceShuffle from "@/components/ace/AceShuffle";
import { subjectColor } from "@/components/cards/cardIdentity";

const toolIcons = {
    essay_planner: Book,
    concept_explainer: HelpCircle,
    question_generator: Brain,
    note_summarizer: ClipboardList
};

const toolColors = {
    essay_planner: 'from-blue-500 to-cyan-500',
    concept_explainer: 'from-emerald-500 to-green-500',
    question_generator: 'from-orange-500 to-amber-500',
    note_summarizer: 'from-teal-500 to-cyan-500'
};

const toolNames = {
    essay_planner: 'Essay Planner',
    concept_explainer: 'Concept Explainer',
    question_generator: 'Question Generator',
    note_summarizer: 'Note Summarizer'
};

export default function AIToolsHistory() {
    const [savedResults, setSavedResults] = useState([]);
    const [user, setUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterSubject, setFilterSubject] = useState('all');
    const [userSubjects, setUserSubjects] = useState([]);
    const [viewingResult, setViewingResult] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [friends, setFriends] = useState([]);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [sharingResult, setSharingResult] = useState(null);
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const currentUser = await base44.auth.me();
            setUser(currentUser);

            const [results, subjects, friendships] = await Promise.all([
                base44.entities.AISavedResult.filter({ created_by: currentUser.email }, '-created_date'),
                base44.entities.UserSubject.filter({ created_by: currentUser.email, is_active: true }),
                base44.entities.Friendship.filter({
                    $or: [
                        { requester_email: currentUser.email, status: 'accepted' },
                        { recipient_email: currentUser.email, status: 'accepted' }
                    ]
                })
            ]);

            const friendsList = friendships.map(f => {
                const isSender = f.requester_email === currentUser.email;
                return {
                    email: isSender ? f.recipient_email : f.requester_email,
                    name: isSender ? f.recipient_name : f.requester_name,
                    username: isSender ? f.recipient_username : f.requester_username
                };
            });

            setSavedResults(results || []);
            setUserSubjects(subjects || []);
            setFriends(friendsList || []);
        } catch (error) {
            console.error("Error loading data:", error);
            toast({ title: 'Error loading history', description: 'Could not load your saved results.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (resultId) => {
        try {
            await base44.entities.AISavedResult.delete(resultId);
            toast({ title: 'Deleted', description: 'Result removed from history.' });
            await loadData();
        } catch (error) {
            console.error("Error deleting result:", error);
            toast({ title: 'Delete failed', variant: 'destructive' });
        }
    };

    const handleShareResult = async (friendEmail, friendName) => {
        if (!sharingResult) return;
        
        try {
            await base44.entities.SharedAIResult.create({
                sender_email: user.email,
                sender_name: user.full_name,
                recipient_email: friendEmail,
                recipient_name: friendName,
                result_id: sharingResult.id,
                tool_type: sharingResult.tool_type,
                title: sharingResult.title || sharingResult.topic,
                topic: sharingResult.topic,
                content: sharingResult.content,
                subject_name: sharingResult.subject_name,
                status: 'pending'
            });
            
            toast({ title: 'Shared!', description: `Sent to ${friendName}` });
            setShowShareDialog(false);
            setSharingResult(null);
        } catch (error) {
            console.error("Error sharing:", error);
            toast({ title: 'Share failed', variant: 'destructive' });
        }
    };

    const filteredResults = savedResults.filter(result => {
        const matchesSearch = result.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            result.topic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            result.subject_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || result.tool_type === filterType;
        const matchesSubject = filterSubject === 'all' || result.subject_name === filterSubject;
        return matchesSearch && matchesType && matchesSubject;
    });

    // Group by subject
    const resultsBySubject = {};
    filteredResults.forEach(result => {
        const subject = result.subject_name || 'Other';
        if (!resultsBySubject[subject]) {
            resultsBySubject[subject] = [];
        }
        resultsBySubject[subject].push(result);
    });

    return (
        <div className="p-4 lg:p-8 min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <Link to={createPageUrl('AITools')}>
                        <Button variant="outline" className="mb-4 hover:bg-purple-50 border-2 border-purple-200">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to AI Tools
                        </Button>
                    </Link>

                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl shadow-2xl mb-6">
                            <FolderOpen className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent mb-4">
                            AI Tools History
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                            View and manage all your saved AI-generated content in one place.
                        </p>
                    </div>
                </motion.div>

                {/* Filters */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-8"
                >
                    <Card className="shadow-xl border-2 border-purple-100">
                        <CardContent className="p-6">
                            <div className="flex flex-col lg:flex-row gap-4">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60 w-5 h-5" />
                                    <Input
                                        placeholder="Search by topic, title or subject..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 border-2 h-11"
                                    />
                                    {searchTerm && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-1 top-1/2 transform -translate-y-1/2"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>

                                <Select value={filterSubject} onValueChange={setFilterSubject}>
                                    <SelectTrigger className="w-full lg:w-48 border-2">
                                        <SelectValue placeholder="All Subjects" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Subjects</SelectItem>
                                        {userSubjects.map(subject => (
                                            <SelectItem key={subject.id} value={subject.subject_name}>
                                                {subject.subject_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={filterType} onValueChange={setFilterType}>
                                    <SelectTrigger className="w-full lg:w-48 border-2">
                                        <Filter className="w-4 h-4 mr-2" />
                                        <SelectValue placeholder="All Tools" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Tools</SelectItem>
                                        <SelectItem value="essay_planner">Essay Planner</SelectItem>
                                        <SelectItem value="concept_explainer">Concept Explainer</SelectItem>
                                        <SelectItem value="question_generator">Question Generator</SelectItem>
                                        <SelectItem value="note_summarizer">Note Summarizer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Results */}
                {isLoading ? (
                    <div className="text-center py-12">
                        <AceShuffle size="lg" className="mb-4 mx-auto" />
                        <p className="text-muted-foreground">Loading your history...</p>
                    </div>
                ) : filteredResults.length === 0 ? (
                    <Card className="shadow-xl">
                        <CardContent className="p-12 text-center">
                            <FolderOpen className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-foreground mb-2">No saved results found</h3>
                            <p className="text-muted-foreground mb-6">
                                {searchTerm || filterType !== 'all' || filterSubject !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'Start using AI tools to see your saved results here'}
                            </p>
                            {!searchTerm && filterType === 'all' && filterSubject === 'all' && (
                                <Link to={createPageUrl('AITools')}>
                                    <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700">
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Explore AI Tools
                                    </Button>
                                </Link>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="space-y-6">
                            {Object.entries(resultsBySubject).map(([subjectName, subjectResults]) => {
                                const userSubject = userSubjects.find(s => s.subject_name === subjectName);
                                const tone = subjectColor(userSubject, subjectName);

                                return (
                                    <div key={subjectName} className="space-y-3">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div
                                                className="w-1 h-8 rounded-full"
                                                style={{ backgroundColor: tone }}
                                            />
                                            <h3 className="text-2xl font-bold text-foreground">{subjectName}</h3>
                                            <Badge variant="outline" className="text-purple-800 bg-purple-100">
                                                {subjectResults.length} result{subjectResults.length !== 1 ? 's' : ''}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {subjectResults.map((result, index) => {
                                                const Icon = toolIcons[result.tool_type] || Sparkles;
                                                const toolBgColor = toolColors[result.tool_type] || 'from-purple-500 to-indigo-600';
                                                return (
                                                    <motion.div
                                                        key={result.id}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: index * 0.05 }}
                                                    >
                                                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-5 border-2 border-purple-200 hover:shadow-md transition-all h-full flex flex-col">
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <div className={`w-7 h-7 bg-gradient-to-br ${toolBgColor} rounded-lg flex items-center justify-center shadow-sm flex-shrink-0`}>
                                                                            <Icon className="w-4 h-4 text-white" />
                                                                        </div>
                                                                        <span className="text-sm font-semibold text-muted-foreground">{toolNames[result.tool_type]}</span>
                                                                    </div>
                                                                    <h4 className="font-bold text-foreground text-lg mb-1">{result.topic}</h4>
                                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                        <Calendar className="w-3 h-3" />
                                                                        {result.date_created}
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-1 mt-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => setViewingResult(result)}
                                                                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-100 p-1 h-auto"
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            setSharingResult(result);
                                                                            setShowShareDialog(true);
                                                                        }}
                                                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 p-1 h-auto"
                                                                    >
                                                                        <Share2 className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleDelete(result.id)}
                                                                        className="text-red-600 hover:text-red-700 hover:bg-red-100 p-1 h-auto"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            {/* Preview */}
                                                            <div className="prose prose-sm max-w-none bg-surface/70 p-4 rounded-lg border border-purple-100 flex-grow">
                                                                {result.tool_type === 'question_generator' ? (
                                                                    <div>
                                                                        <p className="font-medium text-foreground mb-2">
                                                                            {JSON.parse(result.content).length} questions generated
                                                                        </p>
                                                                        <p className="text-muted-foreground text-sm line-clamp-2">
                                                                            Q1: {JSON.parse(result.content)[0]?.question}
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <ReactMarkdown className="line-clamp-3">
                                                                        {result.content.substring(0, 200) + (result.content.length > 200 ? '...' : '')}
                                                                    </ReactMarkdown>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Share Dialog */}
            <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Share2 className="w-5 h-5 text-blue-600" />
                            Share with Friends
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {friends.length === 0 ? (
                            <div className="text-center py-8">
                                <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                                <p className="text-muted-foreground mb-4">No friends to share with yet</p>
                                <Link to={createPageUrl('Friends')}>
                                    <Button className="bg-blue-600">
                                        <Users className="w-4 h-4 mr-2" />
                                        Add Friends
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {friends.map((friend) => (
                                    <Button
                                        key={friend.email}
                                        variant="outline"
                                        className="w-full justify-start hover:bg-blue-50"
                                        onClick={() => handleShareResult(friend.email, friend.name)}
                                    >
                                        <Users className="w-4 h-4 mr-2" />
                                        <div className="text-left flex-1">
                                            <div className="font-semibold">{friend.name}</div>
                                            <div className="text-xs text-muted-foreground">@{friend.username}</div>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={!!viewingResult} onOpenChange={() => setViewingResult(null)}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                            {viewingResult && (
                                <>
                                    {React.createElement(toolIcons[viewingResult.tool_type] || Sparkles, {
                                        className: "w-6 h-6 text-purple-600"
                                    })}
                                    {viewingResult.topic}
                                </>
                            )}
                        </DialogTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                            {viewingResult?.subject_name && <Badge className="bg-purple-100 text-purple-800">{viewingResult.subject_name}</Badge>}
                            <span>•</span>
                            <span>{viewingResult?.date_created}</span>
                            {viewingResult && <span>•</span>}
                            {viewingResult && <span>{toolNames[viewingResult.tool_type]}</span>}
                        </div>
                    </DialogHeader>
                    <div className="prose prose-sm max-w-none py-4">
                        {viewingResult?.tool_type === 'question_generator' ? (
                            <div className="space-y-4">
                                {JSON.parse(viewingResult.content).map((item, index) => (
                                    <Card key={index} className="border-2 border-purple-100">
                                        <CardContent className="p-4">
                                            <p className="font-semibold text-foreground mb-2">Q{index + 1}: {item.question}</p>
                                            <div className="mt-2 p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
                                                <p className="text-sm font-medium text-muted-foreground">{item.answer}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <ReactMarkdown>{viewingResult?.content || ''}</ReactMarkdown>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}