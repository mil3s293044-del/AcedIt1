import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Palette, Sun, Moon } from 'lucide-react';

export default function AppearanceSettings() {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const theme = localStorage.getItem('theme');
        setIsDarkMode(theme === 'dark');
    }, []);

    const toggleDarkMode = (checked) => {
        setIsDarkMode(checked);
        if (checked) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    return (
        <Card className="bg-surface/70 dark:bg-slate-800/50 backdrop-blur-sm border-border/50 dark:border-slate-700/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5"/> Appearance</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <Label htmlFor="dark-mode" className="flex items-center gap-2">
                        {isDarkMode ? <Moon className="w-4 h-4"/> : <Sun className="w-4 h-4"/>}
                        Dark Mode
                    </Label>
                    <Switch
                        id="dark-mode"
                        checked={isDarkMode}
                        onCheckedChange={toggleDarkMode}
                    />
                </div>
            </CardContent>
        </Card>
    );
}