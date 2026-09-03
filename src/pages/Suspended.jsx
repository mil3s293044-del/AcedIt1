import React from "react";
import { ShieldOff } from "lucide-react";
import BrandMark from "@/components/shared/BrandMark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

export default function Suspended() {
    const { logout } = useAuth();
    return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 py-12">
            <div className="flex items-center gap-3 mb-10">
                {/* Was a hard-coded #534AB7 that appears nowhere else in the
                    app — a screen nobody tests drifting off the palette. */}
                <BrandMark size="lg" />
            </div>

            <div className="w-full max-w-md text-center">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                        <ShieldOff className="w-8 h-8 text-red-500" />
                    </div>
                </div>

                <h1 className="text-2xl font-extrabold text-foreground mb-3">Account Suspended</h1>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                    Your account has been suspended due to a violation of our Terms of Service.
                    If you believe this is an error, please contact our support team.
                </p>

                <a href="mailto:support@acedit.com.au" className="block">
                    <Button className="w-full" style={{ backgroundColor: "#534AB7" }}>
                        Contact Support
                    </Button>
                </a>

                <button
                    onClick={() => logout(true)}
                    className="mt-4 text-sm text-muted-foreground/60 hover:text-muted-foreground underline"
                >
                    Sign out
                </button>
            </div>
        </div>
    );
}