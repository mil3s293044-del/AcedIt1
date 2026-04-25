import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, RefreshCw, Ban } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AdminIPPanel() {
    const [user, setUser] = useState(null);
    const [ipStats, setIpStats] = useState([]);
    const [blockedIPs, setBlockedIPs] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const init = async () => {
            const me = await base44.auth.me();
            if (me?.role !== 'admin') {
                setUser(null);
                setLoading(false);
                return;
            }
            setUser(me);
            await loadData();
        };
        init();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const now = Date.now();
            const DAY_MS = 24 * 60 * 60 * 1000;
            const logs = await base44.entities.IPCallLog.list('-timestamp', 1000);
            const todayLogs = logs.filter(l => now - l.timestamp < DAY_MS);

            // Aggregate by IP
            const ipMap = {};
            for (const log of todayLogs) {
                if (!ipMap[log.ip_address]) {
                    ipMap[log.ip_address] = { ip: log.ip_address, count: 0, users: new Set(), lastSeen: 0 };
                }
                ipMap[log.ip_address].count++;
                ipMap[log.ip_address].users.add(log.user_id);
                if (log.timestamp > ipMap[log.ip_address].lastSeen) {
                    ipMap[log.ip_address].lastSeen = log.timestamp;
                }
            }

            const sorted = Object.values(ipMap)
                .map(e => ({ ...e, users: [...e.users] }))
                .sort((a, b) => b.count - a.count);

            setIpStats(sorted);

            const blocked = await base44.entities.BlockedIPs.list();
            setBlockedIPs(blocked);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const blockIP = async (ip) => {
        try {
            const existing = blockedIPs.find(b => b.ip_address === ip);
            if (existing) {
                await base44.entities.BlockedIPs.update(existing.id, {
                    is_blocked_ip: true,
                    is_permanent: true,
                    blocked_at: new Date().toISOString(),
                    block_reason: 'manual_admin'
                });
            } else {
                await base44.entities.BlockedIPs.create({
                    ip_address: ip,
                    is_blocked_ip: true,
                    is_permanent: true,
                    blocked_at: new Date().toISOString(),
                    block_reason: 'manual_admin'
                });
            }
            toast({ title: `IP ${ip} permanently blocked.` });
            await loadData();
        } catch (e) {
            toast({ title: "Error blocking IP", variant: "destructive" });
        }
    };

    const unblockIP = async (record) => {
        try {
            await base44.entities.BlockedIPs.update(record.id, { is_blocked_ip: false, is_permanent: false });
            toast({ title: `IP ${record.ip_address} unblocked.` });
            await loadData();
        } catch (e) {
            toast({ title: "Error unblocking IP", variant: "destructive" });
        }
    };

    if (!user) {
        return (
            <div className="p-8 text-center text-gray-500">
                Admin access required.
            </div>
        );
    }

    const blockedSet = new Set(blockedIPs.filter(b => b.is_blocked_ip).map(b => b.ip_address));

    return (
        <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Shield className="w-7 h-7 text-red-600" />
                    <h1 className="text-2xl font-bold text-gray-900">IP Security Panel</h1>
                </div>
                <Button variant="outline" onClick={loadData} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Top IPs today */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Top IPs by Call Volume (Today)</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-gray-500 text-sm">Loading...</p>
                    ) : ipStats.length === 0 ? (
                        <p className="text-gray-500 text-sm">No calls logged today.</p>
                    ) : (
                        <div className="space-y-2">
                            {ipStats.slice(0, 50).map(entry => {
                                const isBlocked = blockedSet.has(entry.ip);
                                return (
                                    <div key={entry.ip} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-sm font-semibold text-gray-800">{entry.ip}</span>
                                            {isBlocked && <Badge className="bg-red-100 text-red-700 border-red-200">Blocked</Badge>}
                                            <span className="text-xs text-gray-500">{entry.users.length} user(s)</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge className={entry.count >= 50 ? "bg-red-100 text-red-800" : entry.count >= 20 ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-700"}>
                                                {entry.count} calls
                                            </Badge>
                                            {!isBlocked ? (
                                                <Button size="sm" variant="destructive" onClick={() => blockIP(entry.ip)}>
                                                    <Ban className="w-3 h-3 mr-1" /> Block
                                                </Button>
                                            ) : (
                                                <Button size="sm" variant="outline" onClick={() => {
                                                    const rec = blockedIPs.find(b => b.ip_address === entry.ip);
                                                    if (rec) unblockIP(rec);
                                                }}>
                                                    Unblock
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Currently blocked IPs */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Currently Blocked IPs</CardTitle>
                </CardHeader>
                <CardContent>
                    {blockedIPs.filter(b => b.is_blocked_ip).length === 0 ? (
                        <p className="text-gray-500 text-sm">No IPs are currently blocked.</p>
                    ) : (
                        <div className="space-y-2">
                            {blockedIPs.filter(b => b.is_blocked_ip).map(record => (
                                <div key={record.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                                    <div>
                                        <span className="font-mono text-sm font-semibold text-red-800">{record.ip_address}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            {record.is_permanent && <Badge className="bg-red-200 text-red-900 text-xs">Permanent</Badge>}
                                            <span className="text-xs text-gray-500">{record.block_reason} — {record.blocked_at ? new Date(record.blocked_at).toLocaleString() : ''}</span>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => unblockIP(record)}>
                                        Unblock
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}