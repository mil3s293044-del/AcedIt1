import React from "react";
import { ShieldOff, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

export default function Suspended() {
    const { logout } = useAuth();
    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
            <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#534AB7" }}>
                    <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold" style={{ color: "#534AB7" }}>AcedIt</span>
            </div>

            <div className="w-full max-w-md text-center">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                        <ShieldOff className="w-8 h-8 text-red-500" />
                    </div>
                </div>

                <h1 className="text-2xl font-extrabold text-gray-900 mb-3">Account Suspended</h1>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
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
                    className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline"
                >
                    Sign out
                </button>
            </div>
        </div>
    );
}