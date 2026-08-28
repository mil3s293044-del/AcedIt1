import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
    ArrowLeft, 
    ArrowRight, 
    CheckCircle,
    XCircle
} from "lucide-react";
import ReactMarkdown from 'react-markdown';

// Sound generation functions
const playCorrectSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    setTimeout(() => {
        oscillator.frequency.value = 1000;
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 1000;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.3);
    }, 150);
};

const playIncorrectSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 200;
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
};

export default function GuideQuizPlayer({ guide, onComplete }) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({});
    const [showResults, setShowResults] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrect, setIsCorrect] = useState(null);

    const questions = guide.quiz_questions || [];
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    const handleAnswerChange = (value) => {
        setUserAnswers(prev => ({
            ...prev,
            [currentQuestionIndex]: value
        }));
    };

    const handleSubmitAnswer = () => {
        const userAnswer = userAnswers[currentQuestionIndex];
        
        if (currentQuestion.type === 'mcq') {
            if (userAnswer === undefined) {
                return;
            }
            
            const correct = parseInt(userAnswer) === currentQuestion.correct_answer;
            setIsCorrect(correct);
            setShowFeedback(true);
            
            if (correct) {
                playCorrectSound();
            } else {
                playIncorrectSound();
            }
            
            // Auto-advance after 2 seconds
            setTimeout(() => {
                setShowFeedback(false);
                setIsCorrect(null);
                handleNext();
            }, 2000);
        } else {
            // For short answer, just move to next
            handleNext();
        }
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            setShowResults(true);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const calculateScore = () => {
        let correct = 0;
        questions.forEach((question, index) => {
            if (question.type === 'mcq' && userAnswers[index] !== undefined) {
                if (parseInt(userAnswers[index]) === question.correct_answer) {
                    correct++;
                }
            }
        });
        return correct;
    };

    if (showResults) {
        const score = calculateScore();
        const percentage = Math.round((score / questions.length) * 100);
        
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl text-green-600">Quiz Complete!</CardTitle>
                        <Badge className="bg-green-100 text-green-800 text-lg px-4 py-2 mt-4">
                            Score: {score}/{questions.length} ({percentage}%)
                        </Badge>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            {questions.map((question, index) => {
                                const userAnswer = userAnswers[index];
                                const isCorrect = question.type === 'mcq' && userAnswer !== undefined && 
                                                parseInt(userAnswer) === question.correct_answer;
                                
                                return (
                                    <Card key={index} className={`border-l-4 ${
                                        question.type === 'mcq' 
                                            ? (isCorrect ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50')
                                            : 'border-l-blue-500 bg-blue-50'
                                    }`}>
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-2 mb-2">
                                                {question.type === 'mcq' && (
                                                    isCorrect ? 
                                                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" /> :
                                                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                                )}
                                                <div className="flex-1">
                                                    <h3 className="font-semibold mb-2">Question {index + 1}</h3>
                                                    <p className="text-muted-foreground mb-3">{question.question}</p>
                                                </div>
                                            </div>
                                            
                                            {question.type === 'mcq' ? (
                                                <div className="space-y-2">
                                                    <p className="text-sm font-medium text-muted-foreground">Your Answer:</p>
                                                    <div className="grid gap-2">
                                                        {question.options?.map((option, optIndex) => (
                                                            <div key={optIndex} className={`p-2 rounded border text-sm ${
                                                                optIndex === question.correct_answer ? 'bg-green-100 border-green-300 font-medium' :
                                                                userAnswer !== undefined && parseInt(userAnswer) === optIndex ? 'bg-red-100 border-red-300' :
                                                                'bg-secondary/50 border-border'
                                                            }`}>
                                                                <span className="font-medium">{String.fromCharCode(65 + optIndex)}.</span> {option}
                                                                {optIndex === question.correct_answer && <Badge className="ml-2 bg-green-600">Correct</Badge>}
                                                                {userAnswer !== undefined && parseInt(userAnswer) === optIndex && optIndex !== question.correct_answer && 
                                                                    <Badge className="ml-2 bg-red-600">Your Choice</Badge>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {question.explanation && (
                                                        <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                                                            <p className="text-sm font-medium text-blue-900 mb-1">Explanation:</p>
                                                            <p className="text-sm text-blue-800">{question.explanation}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground mb-1">Your Answer:</p>
                                                        <div className="bg-secondary/50 p-3 rounded border">
                                                            <p className="text-sm">{userAnswer || "No answer provided"}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    {question.model_answer && (
                                                        <div className="bg-green-50 p-3 rounded border border-green-200">
                                                            <p className="text-sm font-medium text-green-900 mb-1">Model Answer:</p>
                                                            <ReactMarkdown className="text-sm text-green-800">
                                                                {question.model_answer}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>

                        <div className="flex justify-center pt-6">
                            <Button onClick={onComplete}>
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Guide
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <CardTitle className="text-2xl">{guide.title} - Quiz</CardTitle>
                            <Badge variant="outline" className="mt-2">
                                Question {currentQuestionIndex + 1} of {questions.length}
                            </Badge>
                        </div>
                    </div>
                    <Progress value={progress} className="mt-4" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-4">{currentQuestion.question}</h3>
                        
                        {currentQuestion.type === 'mcq' ? (
                            <RadioGroup 
                                value={userAnswers[currentQuestionIndex]?.toString() || ""} 
                                onValueChange={handleAnswerChange}
                                className="space-y-3"
                                disabled={showFeedback}
                            >
                                {currentQuestion.options?.map((option, index) => {
                                    const isSelected = userAnswers[currentQuestionIndex]?.toString() === index.toString();
                                    const isCorrectAnswer = index === currentQuestion.correct_answer;
                                    
                                    let bgColor = "border-border hover:border-blue-300 hover:bg-blue-50/50";
                                    if (showFeedback) {
                                        if (isCorrectAnswer) {
                                            bgColor = "border-green-500 bg-green-100";
                                        } else if (isSelected && !isCorrect) {
                                            bgColor = "border-red-500 bg-red-100";
                                        }
                                    }
                                    
                                    return (
                                        <div key={index} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${bgColor}`}>
                                            <RadioGroupItem value={index.toString()} id={`option-${index}`} disabled={showFeedback} />
                                            <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer text-sm">
                                                <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                                                {option}
                                            </Label>
                                            {showFeedback && isCorrectAnswer && (
                                                <CheckCircle className="w-5 h-5 text-green-600" />
                                            )}
                                        </div>
                                    );
                                })}
                            </RadioGroup>
                        ) : (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-muted-foreground">Your Answer:</Label>
                                <Textarea
                                    placeholder="Write your answer here..."
                                    value={userAnswers[currentQuestionIndex] || ""}
                                    onChange={(e) => handleAnswerChange(e.target.value)}
                                    rows={6}
                                    className="text-sm"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-4">
                        <Button 
                            onClick={handlePrevious} 
                            disabled={currentQuestionIndex === 0 || showFeedback}
                            variant="outline"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Previous
                        </Button>

                        <Button 
                            onClick={currentQuestion.type === 'mcq' ? handleSubmitAnswer : handleNext}
                            disabled={showFeedback}
                        >
                            {currentQuestionIndex === questions.length - 1 ? (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    {currentQuestion.type === 'mcq' ? 'Submit & Finish' : 'Finish Quiz'}
                                </>
                            ) : (
                                <>
                                    {currentQuestion.type === 'mcq' ? 'Submit' : 'Next'}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}