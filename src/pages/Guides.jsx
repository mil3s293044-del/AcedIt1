import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { BookOpen, Search, Filter, X, Star, Sparkles, GraduationCap, Brain, Target, Heart, Plus, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import GuideReader from "../components/guides/GuideReader";
import GuideCard from "../components/guides/GuideCard";
import AceShuffle from "@/components/ace/AceShuffle";

export default function Guides() {
    const [guides, setGuides] = useState([]);
    const [filteredGuides, setFilteredGuides] = useState([]);
    const [selectedGuide, setSelectedGuide] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [difficultyFilter, setDifficultyFilter] = useState("all");
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingGuide, setIsCreatingGuide] = useState(false);
    const [newGuide, setNewGuide] = useState({
        title: "",
        category: "study_techniques",
        subject: "",
        content: "",
        difficulty_level: "beginner",
        estimated_read_time: 5,
        tags: [],
        is_featured: false,
        key_points: []
    });
    const [tagInput, setTagInput] = useState("");
    const [keyPointInput, setKeyPointInput] = useState("");
    const { toast } = useToast();

    useEffect(() => {
        loadGuides();
    }, []);

    useEffect(() => {
        filterGuides();
    }, [guides, searchQuery, categoryFilter, difficultyFilter]);

    const loadGuides = async () => {
        setIsLoading(true);
        try {
            const allGuides = await base44.entities.StudyGuide.list();
            setGuides(allGuides || []);
        } catch (error) {
            console.error("Error loading guides:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filterGuides = () => {
        let filtered = [...guides];

        if (searchQuery) {
            filtered = filtered.filter(guide =>
                guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                guide.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        if (categoryFilter !== "all") {
            filtered = filtered.filter(guide => guide.category === categoryFilter);
        }

        if (difficultyFilter !== "all") {
            filtered = filtered.filter(guide => guide.difficulty_level === difficultyFilter);
        }

        setFilteredGuides(filtered);
    };

    const handleCreateGuide = async () => {
        if (!newGuide.title || !newGuide.content) {
            toast({ title: "Missing fields", description: "Title and content are required.", variant: "destructive" });
            return;
        }

        try {
            await base44.entities.StudyGuide.create(newGuide);
            toast({ title: "Guide created!", description: "Your study guide has been published." });
            setIsCreatingGuide(false);
            setNewGuide({
                title: "",
                category: "study_techniques",
                subject: "",
                content: "",
                difficulty_level: "beginner",
                estimated_read_time: 5,
                tags: [],
                is_featured: false,
                key_points: []
            });
            setTagInput("");
            setKeyPointInput("");
            loadGuides();
        } catch (error) {
            console.error("Error creating guide:", error);
            toast({ title: "Creation failed", description: "Could not create the guide.", variant: "destructive" });
        }
    };

    const handleAddTag = () => {
        if (tagInput.trim() && !newGuide.tags.includes(tagInput.trim())) {
            setNewGuide({ ...newGuide, tags: [...newGuide.tags, tagInput.trim()] });
            setTagInput("");
        }
    };

    const handleRemoveTag = (tag) => {
        setNewGuide({ ...newGuide, tags: newGuide.tags.filter(t => t !== tag) });
    };

    const handleAddKeyPoint = () => {
        if (keyPointInput.trim() && !newGuide.key_points.includes(keyPointInput.trim())) {
            setNewGuide({ ...newGuide, key_points: [...newGuide.key_points, keyPointInput.trim()] });
            setKeyPointInput("");
        }
    };

    const handleRemoveKeyPoint = (point) => {
        setNewGuide({ ...newGuide, key_points: newGuide.key_points.filter(p => p !== point) });
    };

    const categories = [
        { value: "all", label: "All Categories", icon: BookOpen, color: "text-purple-600" },
        { value: "vce_system", label: "VCE System", icon: GraduationCap, color: "text-blue-600" },
        { value: "study_techniques", label: "Study Techniques", icon: Brain, color: "text-green-600" },
        { value: "subject_specific", label: "Subject Specific", icon: BookOpen, color: "text-orange-600" },
        { value: "exam_prep", label: "Exam Preparation", icon: Target, color: "text-red-600" },
        { value: "wellbeing", label: "Wellbeing", icon: Heart, color: "text-pink-600" }
    ];

    const featuredGuides = filteredGuides.filter(g => g.is_featured);
    const regularGuides = filteredGuides.filter(g => !g.is_featured);

    if (selectedGuide) {
        return (
            <div className="p-4 lg:p-8">
                <GuideReader
                    guide={selectedGuide}
                    onClose={() => {
                        setSelectedGuide(null);
                        loadGuides();
                    }}
                />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-2xl mb-6">
                        <BookOpen className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                        Study Guides
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                        Comprehensive guides to help you master your VCE journey, from study techniques to exam strategies.
                    </p>
                </motion.div>

                {/* Filters and Create Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-8"
                >
                    <Card className="shadow-xl border-2 border-purple-100">
                        <CardContent className="p-6">
                            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60 w-5 h-5" />
                                    <Input
                                        placeholder="Search guides by title or tags..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 border-2 h-11"
                                    />
                                    {searchQuery && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-1 top-1/2 transform -translate-y-1/2"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                                <Button
                                    onClick={() => setIsCreatingGuide(true)}
                                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Guide
                                </Button>
                            </div>
                            <div className="flex gap-3">
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="w-48 border-2">
                                        <Filter className="w-4 h-4 mr-2" />
                                        <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(cat => {
                                            const Icon = cat.icon;
                                            return (
                                                <SelectItem key={cat.value} value={cat.value}>
                                                    <div className="flex items-center gap-2">
                                                        <Icon className={`w-4 h-4 ${cat.color}`} />
                                                        {cat.label}
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                                <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                                    <SelectTrigger className="w-40 border-2">
                                        <SelectValue placeholder="Difficulty" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Levels</SelectItem>
                                        <SelectItem value="beginner">Beginner</SelectItem>
                                        <SelectItem value="intermediate">Intermediate</SelectItem>
                                        <SelectItem value="advanced">Advanced</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {(searchQuery || categoryFilter !== "all" || difficultyFilter !== "all") && (
                                <div className="mt-4 flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Active filters:</span>
                                    {searchQuery && (
                                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                                            Search: "{searchQuery}"
                                        </Badge>
                                    )}
                                    {categoryFilter !== "all" && (
                                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                                            {categories.find(c => c.value === categoryFilter)?.label}
                                        </Badge>
                                    )}
                                    {difficultyFilter !== "all" && (
                                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                                            {difficultyFilter}
                                        </Badge>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSearchQuery("");
                                            setCategoryFilter("all");
                                            setDifficultyFilter("all");
                                        }}
                                        className="ml-auto text-purple-600 hover:text-purple-700"
                                    >
                                        Clear all
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Featured Guides */}
                {featuredGuides.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mb-12"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                                <Star className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground">Featured Guides</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {featuredGuides.map((guide, index) => (
                                <motion.div
                                    key={guide.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 + index * 0.1 }}
                                >
                                    <GuideCard
                                        guide={guide}
                                        onSelect={setSelectedGuide}
                                        isFeatured={true}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* All Guides */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground">All Guides</h2>
                        <Badge variant="secondary" className="ml-auto bg-purple-100 text-purple-800">
                            {filteredGuides.length} guide{filteredGuides.length !== 1 ? 's' : ''}
                        </Badge>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-12">
                            <AceShuffle size="lg" className="mb-4 mx-auto" />
                            <p className="text-muted-foreground">Loading guides...</p>
                        </div>
                    ) : filteredGuides.length === 0 ? (
                        <Card className="shadow-xl">
                            <CardContent className="p-12 text-center">
                                <BookOpen className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-foreground mb-2">No guides found</h3>
                                <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {regularGuides.map((guide, index) => (
                                <motion.div
                                    key={guide.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 + index * 0.05 }}
                                >
                                    <GuideCard
                                        guide={guide}
                                        onSelect={setSelectedGuide}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Create Guide Dialog */}
                <Dialog open={isCreatingGuide} onOpenChange={setIsCreatingGuide}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create New Study Guide</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <label className="text-sm font-medium block mb-2">Title</label>
                                <Input
                                    value={newGuide.title}
                                    onChange={(e) => setNewGuide({ ...newGuide, title: e.target.value })}
                                    placeholder="e.g., Mastering Pomodoro Technique"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium block mb-2">Category</label>
                                    <Select
                                        value={newGuide.category}
                                        onValueChange={(value) => setNewGuide({ ...newGuide, category: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="vce_system">VCE System</SelectItem>
                                            <SelectItem value="study_techniques">Study Techniques</SelectItem>
                                            <SelectItem value="subject_specific">Subject Specific</SelectItem>
                                            <SelectItem value="exam_prep">Exam Preparation</SelectItem>
                                            <SelectItem value="wellbeing">Wellbeing</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-2">Difficulty</label>
                                    <Select
                                        value={newGuide.difficulty_level}
                                        onValueChange={(value) => setNewGuide({ ...newGuide, difficulty_level: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="beginner">Beginner</SelectItem>
                                            <SelectItem value="intermediate">Intermediate</SelectItem>
                                            <SelectItem value="advanced">Advanced</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium block mb-2">Subject (optional)</label>
                                <Input
                                    value={newGuide.subject}
                                    onChange={(e) => setNewGuide({ ...newGuide, subject: e.target.value })}
                                    placeholder="e.g., Biology, Chemistry"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium block mb-2">Content (Markdown supported)</label>
                                <Textarea
                                    value={newGuide.content}
                                    onChange={(e) => setNewGuide({ ...newGuide, content: e.target.value })}
                                    rows={10}
                                    placeholder="Write your guide content here..."
                                    className="font-mono text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium block mb-2">Key Points</label>
                                <div className="flex gap-2 mb-2">
                                    <Input
                                        value={keyPointInput}
                                        onChange={(e) => setKeyPointInput(e.target.value)}
                                        placeholder="Add a key takeaway..."
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyPoint())}
                                    />
                                    <Button onClick={handleAddKeyPoint} type="button">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {newGuide.key_points.map((point, idx) => (
                                        <Badge key={idx} variant="secondary" className="gap-1">
                                            {point}
                                            <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveKeyPoint(point)} />
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium block mb-2">Tags</label>
                                <div className="flex gap-2 mb-2">
                                    <Input
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        placeholder="Add a tag..."
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                    />
                                    <Button onClick={handleAddTag} type="button">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {newGuide.tags.map((tag, idx) => (
                                        <Badge key={idx} variant="secondary" className="gap-1">
                                            {tag}
                                            <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium block mb-2">Read Time (minutes)</label>
                                <Input
                                    type="number"
                                    value={newGuide.estimated_read_time}
                                    onChange={(e) => setNewGuide({ ...newGuide, estimated_read_time: parseInt(e.target.value) })}
                                    min="1"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreatingGuide(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateGuide} className="bg-gradient-to-r from-green-600 to-emerald-600">
                                <Save className="w-4 h-4 mr-2" />
                                Create Guide
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}