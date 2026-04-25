import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flag, PersonStanding, MapPin, CheckSquare, Square, Plus, Trash2, Edit, Sun, Cloud } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

// A series of points defining the path up the mountain
const pathPoints = [
  { x: 10, y: 90 }, { x: 20, y: 85 }, { x: 35, y: 82 }, { x: 45, y: 75 },
  { x: 40, y: 68 }, { x: 30, y: 62 }, { x: 35, y: 55 }, { x: 50, y: 50 },
  { x: 60, y: 42 }, { x: 55, y: 35 }, { x: 65, y: 28 }, { x: 75, y: 22 },
  { x: 85, y: 15 },
];

const MilestoneEditModal = ({ milestone, onSave, onCancel }) => {
    const [title, setTitle] = useState(milestone.title);
    const [description, setDescription] = useState(milestone.description);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{opacity: 0, scale: 0.9}} animate={{opacity: 1, scale: 1}} className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
                <h3 className="text-lg font-bold">Edit Milestone</h3>
                <div>
                    <label className="text-sm font-medium">Title</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                 <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button onClick={() => onSave({ ...milestone, title, description })}>Save Changes</Button>
                </div>
            </motion.div>
        </div>
    );
};

export default function MountainView({ goalLabel, goalValue, milestones, onMilestoneUpdate, onMilestoneDelete }) {
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [localMilestone, setLocalMilestone] = useState(null);
  const [isEditingMilestone, setIsEditingMilestone] = useState(false);
  const [newTask, setNewTask] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (selectedMilestone) {
      setLocalMilestone(milestones.find(m => m.id === selectedMilestone.id));
    } else {
      setLocalMilestone(null);
    }
  }, [selectedMilestone, milestones]);

  const progress = milestones.length > 0
    ? (milestones.filter(m => m.is_completed).length / milestones.length) * 100
    : 0;

  const avatarIndex = Math.floor((progress / 100) * (pathPoints.length - 1));
  const avatarPos = pathPoints[avatarIndex];

  const handleSelectMilestone = (milestone) => {
    setSelectedMilestone(milestone);
  };
  
  const handleToggleTask = (taskIndex) => {
    if (!localMilestone) return;
    const updatedTasks = [...(localMilestone.action_items || [])];
    updatedTasks[taskIndex].completed = !updatedTasks[taskIndex].completed;
    updateMilestoneTasks(updatedTasks);
  };

  const handleAddTask = () => {
    if (newTask.trim() === '' || !localMilestone) return;
    const updatedTasks = [...(localMilestone.action_items || []), { task: newTask, completed: false }];
    updateMilestoneTasks(updatedTasks);
    setNewTask('');
  };

  const handleDeleteTask = (taskIndex) => {
    if (!localMilestone) return;
    const updatedTasks = [...(localMilestone.action_items || [])];
    updatedTasks.splice(taskIndex, 1);
    updateMilestoneTasks(updatedTasks);
  };

  const updateMilestoneTasks = (tasks) => {
    const updatedMilestone = { ...localMilestone, action_items: tasks };
    
    const allTasksCompleted = tasks.every(t => t.completed);
    if(localMilestone.is_completed !== allTasksCompleted) {
        updatedMilestone.is_completed = allTasksCompleted;
        if(allTasksCompleted) {
            toast({ title: 'Checkpoint Reached!', description: `You've completed '${localMilestone.title}'!` });
        }
    }
    
    setLocalMilestone(updatedMilestone);
    onMilestoneUpdate(updatedMilestone);
  };

  const handleSaveMilestoneEdit = (editedMilestone) => {
      onMilestoneUpdate(editedMilestone);
      setIsEditingMilestone(false);
      toast({ title: 'Milestone Updated!' });
  };

  const handleDeleteMilestone = () => {
      if (!localMilestone || !window.confirm(`Are you sure you want to delete the milestone: "${localMilestone.title}"?`)) return;
      onMilestoneDelete(localMilestone.id);
      setSelectedMilestone(null);
      toast({ title: 'Milestone Deleted' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {isEditingMilestone && localMilestone && (
          <MilestoneEditModal 
            milestone={localMilestone}
            onSave={handleSaveMilestoneEdit}
            onCancel={() => setIsEditingMilestone(false)}
          />
      )}
      {/* Mountain Visualization */}
      <div className="lg:col-span-2">
        <Card className="bg-sky-100 h-[600px] relative overflow-hidden border-2 border-sky-200">
          <CardContent className="p-0">
            {/* Sun */}
            <Sun className="w-16 h-16 text-yellow-400 absolute top-4 right-8" />
            {/* Clouds */}
            <Cloud className="w-24 h-24 text-white/80 absolute top-16 left-12 opacity-50" />
            <Cloud className="w-20 h-20 text-white/80 absolute top-24 right-24 opacity-60" />
            <Cloud className="w-32 h-32 text-white/80 absolute top-40 left-32 opacity-40" />
          
            {/* Mountain SVG Background */}
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute bottom-0 left-0">
                <path d="M -10 110 C 20 10, 30 70, 50 50 S 80 20, 110 110 Z" fill="#a7f3d0" />
                <path d="M -10 110 C 10 70, 30 90, 60 60 S 80 30, 110 110 Z" fill="#6ee7b7" />
                <path d="M -10 110 C 20 90, 40 100, 70 80 S 90 60, 110 110 Z" fill="#34d399" />
            </svg>

            {/* Path */}
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="absolute inset-0">
              <path
                d={pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                stroke="#4a5568" strokeWidth="1" fill="none" strokeDasharray="2 2"
              />
            </svg>

            {/* Goal Flag */}
            <div className="absolute" style={{ left: `${pathPoints[pathPoints.length - 1].x}%`, top: `${pathPoints[pathPoints.length - 1].y}%`, transform: 'translate(-50%, -100%)' }}>
              <div className="text-center">
                  <Flag className="w-8 h-8 text-red-500" />
                  <Badge className="bg-amber-400 text-amber-900 border border-amber-500">{goalLabel}: {goalValue}</Badge>
              </div>
            </div>

            {/* Milestones */}
            {milestones.map((milestone, index) => {
              const pointIndex = Math.floor(((index + 1) / (milestones.length + 1)) * pathPoints.length);
              const pos = pathPoints[pointIndex];
              return (
                <motion.div
                  key={milestone.id}
                  className="absolute cursor-pointer group"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                  onClick={() => handleSelectMilestone(milestone)}
                  whileHover={{ scale: 1.1 }}
                >
                  <MapPin className={`w-6 h-6 transition-colors ${milestone.is_completed ? 'text-green-500' : 'text-gray-600'} ${selectedMilestone?.id === milestone.id ? 'text-blue-600' : ''}`} />
                  <div className="absolute bottom-full mb-2 w-48 text-center left-1/2 -translate-x-1/2 p-2 bg-white/80 rounded-lg shadow-lg text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {milestone.title}
                  </div>
                </motion.div>
              );
            })}

            {/* Avatar */}
            <motion.div
              className="absolute"
              initial={{ x: `${pathPoints[0].x}%`, y: `${pathPoints[0].y}%`}}
              animate={{ x: `${avatarPos.x}%`, y: `${avatarPos.y}%` }}
              transition={{ type: 'spring', stiffness: 100 }}
              style={{ transform: 'translate(-50%, -50%)' }}
            >
              <PersonStanding className="w-8 h-8 text-blue-700" />
            </motion.div>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
                Checkpoint Tasks
                {localMilestone && (
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditingMilestone(true)}>
                            <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDeleteMilestone}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                    </div>
                )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {localMilestone ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">{localMilestone.title}</h3>
                <p className="text-sm text-gray-600">{localMilestone.description}</p>
                
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {(localMilestone.action_items || []).map((task, index) => (
                        <div key={index} className="flex items-center gap-2 group">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleTask(index)}>
                                {task.completed ? <CheckSquare className="w-5 h-5 text-green-500" /> : <Square className="w-5 h-5 text-gray-400" />}
                            </Button>
                            <span className={`flex-1 text-sm ${task.completed ? 'line-through text-gray-500' : ''}`}>
                                {task.task}
                            </span>
                             <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteTask(index)}>
                                <Trash2 className="w-4 h-4 text-red-500"/>
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 pt-4">
                    <Input 
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder="Add a new task..."
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                    />
                    <Button onClick={handleAddTask}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <MapPin className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-800">Select a checkpoint</h3>
                <p className="text-sm text-gray-500">Click on a pin on the mountain to see its tasks.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}