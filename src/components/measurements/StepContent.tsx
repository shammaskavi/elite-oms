import React from "react";
import { ChevronRight, ChevronLeft, Send, CornerDownLeft } from "lucide-react";
import { MeasurementStep } from "./types";

interface StepProps {
    step: MeasurementStep;
    value: string;
    onChange: (val: string) => void;
    onNext: () => void;
    onBack: () => void;
    isLast: boolean;
}

export function StepContent({ step, value, onChange, onNext, onBack, isLast }: StepProps) {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom duration-500">
            <header>
                <div className="flex items-center gap-3 mb-2">
                    <span className="bg-slate-900 text-white text-xs font-black px-2 py-1 rounded">#{step.iconNumber}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Visual Guide</span>
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">{step.label}</h2>
                <p className="text-slate-500 mt-3 leading-relaxed italic border-l-2 border-slate-100 pl-4">{step.desc}</p>
            </header>

            <div className="relative group">
                <input
                    type="number"
                    step="0.1"
                    autoFocus
                    placeholder="0.0"
                    value={value}
                    className="w-full text-8xl md:text-9xl font-black text-slate-900 outline-none bg-transparent placeholder:text-slate-50 border-none p-0 focus:ring-0"
                    onChange={(e) => onChange(e.target.value)}
                />
                <div className="absolute right-0 bottom-4 flex flex-col items-end">
                    <span className="text-2xl font-black text-slate-200 uppercase tracking-tighter leading-none">Inches</span>
                    <div className="hidden md:flex items-center gap-1 text-[10px] font-bold text-slate-300 mt-1 uppercase tracking-widest opacity-0 group-focus-within:opacity-100 transition-opacity">
                        <span>Press Enter</span>
                        <CornerDownLeft size={10} strokeWidth={3} />
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                {/* Explicitly type="button" to prevent form submission */}
                <button
                    type="button"
                    onClick={onBack}
                    className="w-20 h-20 rounded-3xl border-2 border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-all"
                >
                    <ChevronLeft size={32} className="text-slate-400" />
                </button>

                {/* type="submit" enables the Enter-to-Next functionality */}
                <button
                    type="submit"
                    className={`flex-grow rounded-3xl p-6 font-black text-xl flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95 ${isLast ? 'bg-green-600 text-white shadow-green-100' : 'bg-slate-900 text-white shadow-slate-200'}`}
                >
                    {isLast ? "Submit to WhatsApp" : "Next Step"} {isLast ? <Send size={20} /> : <ChevronRight size={20} />}
                </button>
            </div>
        </div>
    );
}