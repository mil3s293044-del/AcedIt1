import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

const StatsCard = React.memo(({ title, value, subtitle, icon: Icon, color, gradient, index = 0 }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
        >
            <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <CardContent className={`p-6 bg-gradient-to-br ${gradient}`}>
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
                            <p className="text-3xl font-black text-foreground">{value}</p>
                            {subtitle && (
                                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                            )}
                        </div>
                        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
});

StatsCard.displayName = 'StatsCard';

export default StatsCard;