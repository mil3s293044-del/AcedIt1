import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Search,
    ArrowLeft,
    GraduationCap,
    TrendingUp,
    Clock,
    CheckCircle2,
    Target,
    BookOpen,
    Edit,
    Save,
    X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const universityOptions = [
    "University of Melbourne",
    "Monash University",
    "RMIT University",
    "Deakin University",
    "La Trobe University",
    "Swinburne University",
    "Victoria University"
];

const fieldOptions = [
    "Engineering",
    "Health Science",
    "Business",
    "Arts & Humanities",
    "Science",
    "Education",
    "Law",
    "Information Technology"
];

const initialCoursesData = [
    {
        name: "Bachelor of Engineering (Honours)",
        university: "University of Melbourne",
        field_of_study: "Engineering",
        indicative_atar: 95.00,
        duration_years: 4,
        description: "A comprehensive engineering program covering multiple disciplines including mechanical, electrical, and software engineering.",
        prerequisites: ["English EAL 25", "Maths Methods 25", "Chemistry 25"],
        career_outcomes: ["Mechanical Engineer", "Electrical Engineer", "Software Engineer", "Project Manager"],
        image_url: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&auto=format&fit=crop"
    },
    {
        name: "Bachelor of Biomedicine",
        university: "University of Melbourne",
        field_of_study: "Health Science",
        indicative_atar: 97.00,
        duration_years: 3,
        description: "Explore the molecular basis of human health and disease, preparing for careers in research and medicine.",
        prerequisites: ["English EAL 25", "Maths Methods 25", "Chemistry 30"],
        career_outcomes: ["Medical Researcher", "Biomedical Scientist", "Pathology Specialist", "Medical Doctor (with further study)"],
        image_url: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&auto=format&fit=crop"
    },
    {
        name: "Bachelor of Commerce",
        university: "Monash University",
        field_of_study: "Business",
        indicative_atar: 93.00,
        duration_years: 3,
        description: "Develop business expertise in accounting, finance, marketing, and management for diverse career opportunities.",
        prerequisites: ["English EAL 30", "Maths Methods 25"],
        career_outcomes: ["Accountant", "Financial Analyst", "Marketing Manager", "Business Consultant"],
        image_url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&auto=format&fit=crop"
    },
    {
        name: "Bachelor of Information Technology",
        university: "RMIT University",
        field_of_study: "Information Technology",
        indicative_atar: 85.00,
        duration_years: 3,
        description: "Learn cutting-edge IT skills including software development, cybersecurity, and data analytics.",
        prerequisites: ["English EAL 25", "Maths Methods 20"],
        career_outcomes: ["Software Developer", "IT Consultant", "Cybersecurity Analyst", "Data Scientist"],
        image_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop"
    },
    {
        name: "Bachelor of Arts",
        university: "University of Melbourne",
        field_of_study: "Arts & Humanities",
        indicative_atar: 88.00,
        duration_years: 3,
        description: "Explore diverse disciplines including history, philosophy, languages, and cultural studies.",
        prerequisites: ["English EAL 30"],
        career_outcomes: ["Writer", "Journalist", "Policy Advisor", "Research Analyst"],
        image_url: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop"
    },
    {
        name: "Bachelor of Science",
        university: "Monash University",
        field_of_study: "Science",
        indicative_atar: 90.00,
        duration_years: 3,
        description: "Study scientific principles across biology, chemistry, physics, and mathematics.",
        prerequisites: ["English EAL 25", "Maths Methods 25", "Chemistry 25"],
        career_outcomes: ["Research Scientist", "Laboratory Technician", "Environmental Consultant", "Science Educator"],
        image_url: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop"
    },
    {
        name: "Bachelor of Education",
        university: "Deakin University",
        field_of_study: "Education",
        indicative_atar: 80.00,
        duration_years: 4,
        description: "Train to become a qualified teacher with practical experience in schools.",
        prerequisites: ["English EAL 30"],
        career_outcomes: ["Primary Teacher", "Secondary Teacher", "Education Coordinator", "Curriculum Developer"],
        image_url: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop"
    },
    {
        name: "Bachelor of Laws (Honours)",
        university: "Monash University",
        field_of_study: "Law",
        indicative_atar: 98.00,
        duration_years: 4,
        description: "Study legal principles and develop critical thinking skills for a career in law.",
        prerequisites: ["English EAL 35"],
        career_outcomes: ["Lawyer", "Barrister", "Legal Advisor", "Judge (with experience)"],
        image_url: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop"
    }
];

export default function CoursePlanner() {
    const [courses, setCourses] = useState([]);
    const [filteredCourses, setFilteredCourses] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [fieldFilter, setFieldFilter] = useState("all");
    const [universityFilter, setUniversityFilter] = useState("all");
    const [atarFilter, setAtarFilter] = useState("all");
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditingCourse, setIsEditingCourse] = useState(false);
    const [editedCourse, setEditedCourse] = useState(null);
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        handleSearch();
    }, [courses, searchQuery, fieldFilter, universityFilter, atarFilter]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            let existingCourses = await base44.entities.UniversityCourse.list();
            
            if (!existingCourses || existingCourses.length === 0) {
                for (const courseData of initialCoursesData) {
                    await base44.entities.UniversityCourse.create(courseData);
                }
                existingCourses = await base44.entities.UniversityCourse.list();
            }
            
            setCourses(existingCourses || []);
        } catch (error) {
            console.error("Error loading courses:", error);
            toast({ title: "Error loading courses", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = () => {
        let filtered = [...courses];

        if (searchQuery) {
            filtered = filtered.filter(course =>
                course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                course.university.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (course.field_of_study && course.field_of_study.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        if (fieldFilter !== "all") {
            filtered = filtered.filter(course => course.field_of_study === fieldFilter);
        }

        if (universityFilter !== "all") {
            filtered = filtered.filter(course => course.university === universityFilter);
        }

        if (atarFilter !== "all") {
            if (atarFilter === "90+") {
                filtered = filtered.filter(course => course.indicative_atar >= 90);
            } else if (atarFilter === "80-90") {
                filtered = filtered.filter(course => course.indicative_atar >= 80 && course.indicative_atar < 90);
            } else if (atarFilter === "70-80") {
                filtered = filtered.filter(course => course.indicative_atar >= 70 && course.indicative_atar < 80);
            }
        }

        setFilteredCourses(filtered);
    };

    const handleViewCourse = (course) => {
        setSelectedCourse(course);
    };

    const handleEditCourse = (course) => {
        setEditedCourse({ ...course });
        setIsEditingCourse(true);
    };

    const handleSaveCourse = async () => {
        try {
            await base44.entities.UniversityCourse.update(editedCourse.id, editedCourse);
            toast({ title: "Course updated!", description: "Changes saved successfully." });
            setIsEditingCourse(false);
            setSelectedCourse(editedCourse);
            await loadData();
        } catch (error) {
            console.error("Error updating course:", error);
            toast({ title: "Update failed", variant: "destructive" });
        }
    };

    const handleCancelEdit = () => {
        setEditedCourse(null);
        setIsEditingCourse(false);
    };

    if (selectedCourse) {
        return (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="flex items-center justify-between">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setSelectedCourse(null);
                            setIsEditingCourse(false);
                            setEditedCourse(null);
                        }}
                        className="hover:bg-purple-50 border-purple-200"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Search
                    </Button>
                    
                    {!isEditingCourse && (
                        <Button
                            variant="outline"
                            onClick={() => handleEditCourse(selectedCourse)}
                            className="hover:bg-blue-50 border-blue-200"
                        >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Course
                        </Button>
                    )}
                </div>

                {isEditingCourse ? (
                    <Card className="shadow-2xl border-2 border-blue-200">
                        <CardHeader>
                            <CardTitle className="text-2xl">Edit Course Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Course Name</label>
                                    <Input
                                        value={editedCourse.name}
                                        onChange={(e) => setEditedCourse({ ...editedCourse, name: e.target.value })}
                                        placeholder="e.g., Bachelor of Engineering"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">University</label>
                                    <Input
                                        value={editedCourse.university}
                                        onChange={(e) => setEditedCourse({ ...editedCourse, university: e.target.value })}
                                        placeholder="e.g., University of Melbourne"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Field of Study</label>
                                    <Input
                                        value={editedCourse.field_of_study || ''}
                                        onChange={(e) => setEditedCourse({ ...editedCourse, field_of_study: e.target.value })}
                                        placeholder="e.g., Engineering, Health Science"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Indicative ATAR</label>
                                    <Input
                                        type="number"
                                        value={editedCourse.indicative_atar}
                                        onChange={(e) => setEditedCourse({ ...editedCourse, indicative_atar: parseFloat(e.target.value) })}
                                        min="0"
                                        max="99.95"
                                        step="0.05"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Duration (years)</label>
                                <Input
                                    type="number"
                                    value={editedCourse.duration_years || ''}
                                    onChange={(e) => setEditedCourse({ ...editedCourse, duration_years: parseInt(e.target.value) })}
                                    min="1"
                                    max="10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Description</label>
                                <Textarea
                                    value={editedCourse.description || ''}
                                    onChange={(e) => setEditedCourse({ ...editedCourse, description: e.target.value })}
                                    rows={6}
                                    placeholder="Provide a detailed overview of the course..."
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Prerequisites (one per line)</label>
                                <Textarea
                                    value={(editedCourse.prerequisites || []).join('\n')}
                                    onChange={(e) => setEditedCourse({ 
                                        ...editedCourse, 
                                        prerequisites: e.target.value.split('\n').filter(p => p.trim()) 
                                    })}
                                    rows={4}
                                    placeholder="e.g., English EAL 25&#10;Maths Methods 25"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Career Outcomes (one per line)</label>
                                <Textarea
                                    value={(editedCourse.career_outcomes || []).join('\n')}
                                    onChange={(e) => setEditedCourse({ 
                                        ...editedCourse, 
                                        career_outcomes: e.target.value.split('\n').filter(c => c.trim()) 
                                    })}
                                    rows={4}
                                    placeholder="e.g., Software Engineer&#10;Data Scientist"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Image URL (optional)</label>
                                <Input
                                    value={editedCourse.image_url || ''}
                                    onChange={(e) => setEditedCourse({ ...editedCourse, image_url: e.target.value })}
                                    placeholder="https://example.com/image.jpg"
                                />
                            </div>

                            <div className="flex gap-3 justify-end pt-4">
                                <Button
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveCourse}
                                    className="bg-gradient-to-r from-green-600 to-emerald-600"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Changes
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="shadow-2xl border-2 border-purple-100 overflow-hidden">
                        {selectedCourse.image_url && (
                            <div className="h-64 overflow-hidden">
                                <img 
                                    src={selectedCourse.image_url} 
                                    alt={selectedCourse.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}

                        <CardHeader className="border-b border-gray-100 pb-6">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <CardTitle className="text-3xl font-bold text-gray-900 mb-3">
                                        {selectedCourse.name}
                                    </CardTitle>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        <Badge className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-3 py-1">
                                            {selectedCourse.university}
                                        </Badge>
                                        {selectedCourse.field_of_study && (
                                            <Badge variant="outline" className="border-2 border-blue-200 text-blue-800">
                                                {selectedCourse.field_of_study}
                                            </Badge>
                                        )}
                                        {selectedCourse.duration_years && (
                                            <Badge variant="outline" className="border-2 border-green-200 text-green-800 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {selectedCourse.duration_years} years
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="ml-4 text-center">
                                    <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg mb-2">
                                        <div>
                                            <div className="text-2xl font-bold text-white">
                                                {selectedCourse.indicative_atar}
                                            </div>
                                            <div className="text-xs text-white/90">ATAR</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="p-8 space-y-8">
                            {selectedCourse.description && (
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <BookOpen className="w-5 h-5 text-purple-600" />
                                        Overview
                                    </h3>
                                    <p className="text-gray-700 leading-relaxed">
                                        {selectedCourse.description}
                                    </p>
                                </div>
                            )}

                            {selectedCourse.prerequisites && selectedCourse.prerequisites.length > 0 && (
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        Prerequisites
                                    </h3>
                                    <ul className="space-y-2">
                                        {selectedCourse.prerequisites.map((prereq, idx) => (
                                            <li key={idx} className="flex items-start gap-3 text-gray-700">
                                                <span className="text-green-500 mt-0.5">✓</span>
                                                {prereq}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {selectedCourse.career_outcomes && selectedCourse.career_outcomes.length > 0 && (
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <Target className="w-5 h-5 text-blue-600" />
                                        Career Outcomes
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {selectedCourse.career_outcomes.map((career, idx) => (
                                            <div 
                                                key={idx} 
                                                className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100"
                                            >
                                                <TrendingUp className="w-4 h-4 text-blue-600" />
                                                <span className="text-gray-700">{career}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </motion.div>
        );
    }

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
            >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-xl mb-4">
                    <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">University Course Explorer</h2>
                <p className="text-gray-600">Discover your perfect university course and plan your future</p>
            </motion.div>

            <Card className="shadow-lg border-2 border-purple-100">
                <CardContent className="p-6 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder="Search courses, universities, or fields..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-12 text-lg"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Select value={fieldFilter} onValueChange={setFieldFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Field of Study" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Fields</SelectItem>
                                {fieldOptions.map((field) => (
                                    <SelectItem key={field} value={field}>{field}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={universityFilter} onValueChange={setUniversityFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="University" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Universities</SelectItem>
                                {universityOptions.map((uni) => (
                                    <SelectItem key={uni} value={uni}>{uni}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={atarFilter} onValueChange={setAtarFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="ATAR Range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All ATAR</SelectItem>
                                <SelectItem value="90+">90+</SelectItem>
                                <SelectItem value="80-90">80-90</SelectItem>
                                <SelectItem value="70-80">70-80</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="text-center py-12">
                    <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-gray-600 mt-4">Loading courses...</p>
                </div>
            ) : filteredCourses.length === 0 ? (
                <Card className="shadow-lg">
                    <CardContent className="p-12 text-center">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No courses found</h3>
                        <p className="text-gray-600">Try adjusting your search criteria or filters</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCourses.map((course, index) => (
                        <motion.div
                            key={course.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            whileHover={{ y: -8 }}
                        >
                            <Card
                                className="cursor-pointer hover:shadow-2xl transition-all duration-300 border-2 hover:border-purple-300 h-full overflow-hidden"
                                onClick={() => handleViewCourse(course)}
                            >
                                {course.image_url && (
                                    <div className="h-48 overflow-hidden">
                                        <img
                                            src={course.image_url}
                                            alt={course.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}

                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between mb-2">
                                        <CardTitle className="text-lg leading-tight flex-1">
                                            {course.name}
                                        </CardTitle>
                                        <div className="ml-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg px-2 py-1 flex-shrink-0">
                                            <div className="text-sm font-bold text-white">
                                                {course.indicative_atar}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="outline" className="border-2 border-purple-200 text-purple-800 text-xs">
                                            {course.university}
                                        </Badge>
                                        {course.field_of_study && (
                                            <Badge variant="outline" className="border-2 border-blue-200 text-blue-800 text-xs">
                                                {course.field_of_study}
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>

                                <CardContent className="pt-0">
                                    <p className="text-sm text-gray-600 line-clamp-3">
                                        {course.description}
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}