"use client";
import React, { useState } from "react";
import { BlouseVisual } from "../components/measurements/BlouseVisual";
import { StepContent } from "../components/measurements/StepContent";
import { MeasurementStep } from "../components/measurements/types";
import { Ruler } from "lucide-react";

const BLOUSE_FLOW: MeasurementStep[] = [
    { id: "length", label: "Full Length", desc: "Measure from the high point of shoulder to the desired bottom.", path: "length", iconNumber: "1" },
    { id: "shoulder", label: "Shoulder Width", desc: "Across the back from one shoulder joint to the other.", path: "shoulder", iconNumber: "2" },
    { id: "fneck", label: "Front Neck", desc: "Diagonally from shoulder point to the center of front neck.", path: "fneck", iconNumber: "5" },
    { id: "chest", label: "Chest Round", desc: "Measure around the fullest part of the bust.", path: "chest", iconNumber: "8" },
    { id: "waist", label: "Waist Round", desc: "Measure around the narrowest part of your torso.", path: "waist", iconNumber: "9" },
    { id: "sleeve", label: "Sleeve Length", desc: "From shoulder joint to desired sleeve end.", path: "sleeve", iconNumber: "10" },
    { id: "armhole", label: "Arm Hole", desc: "Measure vertically around the shoulder joint.", path: "armhole", iconNumber: "13" },
];

export default function PublicMeasurementForm() {
    const [step, setStep] = useState(-1);
    const [data, setData] = useState<Record<string, string>>({});
    const [user, setUser] = useState({ name: "", phone: "" });

    const handleFinish = () => {
        const message = `🧵 *Saree Palace Elite*\n\n*Customer:* ${user.name}\n*Phone:* ${user.phone}\n\n` +
            BLOUSE_FLOW.map(s => `*${s.label}:* ${data[s.id] || 'N/A'}"`).join('\n');
        window.open(`https://wa.me/917698810804?text=${encodeURIComponent(message)}`, "_blank");
    };

    const handleNextAction = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (step === -1) {
            if (user.name && user.phone) setStep(0);
        } else if (step === BLOUSE_FLOW.length - 1) {
            handleFinish();
        } else {
            setStep(step + 1);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col lg:flex-row">
            <div className="lg:w-1/2 bg-slate-50 flex items-center justify-center min-h-[400px] border-r border-slate-100">
                <BlouseVisual activePath={step === -1 ? "none" : BLOUSE_FLOW[step].path} />
            </div>

            <div className="lg:w-1/2 p-8 lg:p-24 flex flex-col justify-center">
                <form onSubmit={handleNextAction}>
                    {step === -1 ? (
                        <div className="space-y-8 animate-in slide-in-from-right duration-500">
                            <h1 className="text-5xl font-black tracking-tighter">Perfect Fit.</h1>
                            <div className="space-y-4">
                                <input placeholder="Full Name" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 font-bold outline-none focus:border-slate-900" onChange={e => setUser({ ...user, name: e.target.value })} />
                                <input placeholder="WhatsApp Number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 font-bold outline-none focus:border-slate-900" onChange={e => setUser({ ...user, phone: e.target.value })} />
                            </div>
                            <button type="submit" disabled={!user.name || !user.phone} className="w-full bg-slate-900 text-white p-6 rounded-3xl font-black text-xl disabled:opacity-30 shadow-xl">Start Visual Guide</button>
                        </div>
                    ) : (
                        <StepContent
                            step={BLOUSE_FLOW[step]}
                            value={data[BLOUSE_FLOW[step].id] || ""}
                            onChange={val => setData({ ...data, [BLOUSE_FLOW[step].id]: val })}
                            onBack={() => setStep(step - 1)}
                            onNext={handleNextAction}
                            isLast={step === BLOUSE_FLOW.length - 1}
                        />
                    )}
                </form>
            </div>
        </div>
    );
}