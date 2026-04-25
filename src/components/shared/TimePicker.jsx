import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TimePicker({ value, onChange, className }) {
    const [hour, setHour] = useState('09');
    const [minute, setMinute] = useState('00');

    // Parse value when it changes externally
    useEffect(() => {
        if (value && value.includes(':')) {
            const [h, m] = value.split(':');
            setHour(h.padStart(2, '0'));
            setMinute(m.padStart(2, '0'));
        }
    }, [value]);

    // Update parent when hour or minute changes
    useEffect(() => {
        if (hour && minute) {
            onChange(`${hour}:${minute}`);
        }
    }, [hour, minute, onChange]);

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];

    return (
        <div className={`flex gap-2 ${className || ''}`}>
            <Select value={hour} onValueChange={setHour}>
                <SelectTrigger className="w-20">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {hours.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <span className="flex items-center text-gray-500 font-medium">:</span>
            <Select value={minute} onValueChange={setMinute}>
                <SelectTrigger className="w-20">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {minutes.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}