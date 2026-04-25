import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User } from '@/entities/all';
import { KeyRound, ShieldCheck } from 'lucide-react';

export default function AccountSettings() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
            } catch (error) {
                console.error("Failed to load user", error);
            }
        };
        loadUser();
    }, []);

    return (
        <Card className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-sm border-gray-200/50 dark:border-slate-700/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5"/> Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                    <p className="font-semibold text-lg">{user?.email}</p>
                </div>
                 <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Password</p>
                    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg mt-1">
                        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            Your account is secured by your login provider (e.g., Google). To change your password, please do so through your provider's account settings.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}