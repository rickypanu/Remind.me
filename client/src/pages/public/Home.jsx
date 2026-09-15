import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Send, Zap, Clock, Mic, Sparkles, Plus, Bot } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";

const FONTS = ["font-sans", "font-serif", "font-mono"];

export default function Home() {
  const [randomFont, setRandomFont] = useState("font-sans");
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    setRandomFont(FONTS[Math.floor(Math.random() * FONTS.length)]);
  }, []);

  // Enforced overflow-x-hidden and w-full to permanently remove horizontal scrollbar
  return (
    <div className={`min-h-screen w-full bg-[#FAFAFA] text-slate-900 ${randomFont} antialiased selection:bg-indigo-100 selection:text-indigo-900 relative overflow-x-hidden overflow-y-hidden flex flex-col`}>
      
      {/* Premium CSS Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes soundwave {
          0%, 100% { height: 4px; opacity: 0.4; }
          50% { height: 18px; opacity: 1; }
        }
        .animate-float { animation: float 7s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        
        .wave-1 { animation: soundwave 1.2s ease-in-out infinite 0.1s; }
        .wave-2 { animation: soundwave 1.2s ease-in-out infinite 0.3s; }
        .wave-3 { animation: soundwave 1.2s ease-in-out infinite 0.5s; }
        .wave-4 { animation: soundwave 1.2s ease-in-out infinite 0.2s; }
        .wave-5 { animation: soundwave 1.2s ease-in-out infinite 0.4s; }
      `}} />

      {/* Clean Ambient Background (No Grid) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-100/40 blur-[120px] z-0 pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-100/30 blur-[120px] z-0 pointer-events-none" />

      <Header />

      {/* Hero Section */}
      <main className="flex-grow relative z-10">
        
        {/* Increased side padding (px-8 md:px-12 lg:px-20) for better margins */}
        <section className="max-w-7xl mx-auto px-8 md:px-12 lg:px-20 pt-24 pb-20 md:pt-36 md:pb-32 lg:flex lg:items-center lg:gap-16">
          
          {/* Left: Empathetic & Precise Copy */}
          <div className="lg:w-[55%] text-center lg:text-left mb-20 lg:mb-0">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white border border-slate-200/80 text-slate-600 font-medium text-sm mb-8 shadow-sm">
              <Sparkles size={16} className="text-indigo-500" />
              <span>Your mind is for thinking, not storing.</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter mb-8 text-slate-900 leading-[1.05]">
              Think it. Say it. <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">
                Consider it done.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-500 mb-10 max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed">
              Offload your mental clutter instantly. Speak or type your tasks, and let our intelligent engine schedule and deliver them directly to your Telegram. 
              <strong className="text-slate-800 font-semibold block mt-2">Zero friction. Absolute clarity.</strong>
            </p>

            <div className="flex justify-center lg:justify-start">
              {/* Removed the Cmd+K fake hint, kept the CTA super clean */}
              <Link to="/register" className="w-full sm:w-auto">
                <button type="button" className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-10 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 transition-transform hover:-translate-y-1 active:scale-95">
                  Start Automating Free <ArrowRight size={18} />
                </button>
              </Link>
            </div>
          </div>

          {/* Right: The "Glass" Workspace UI */}
          <div className="lg:w-[45%] relative w-full max-w-lg mx-auto perspective-[2000px]">
            <div className="relative animate-float transition-transform duration-1000 ease-out transform lg:-rotate-y-6 lg:rotate-x-2 z-20">
              
              <div className="bg-white/70 backdrop-blur-3xl border border-white p-8 rounded-[2rem] shadow-2xl shadow-indigo-900/10">
                
                {/* Header of the mock app with the Bot icon restored */}
                <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-bold text-xl text-slate-900">Workspace</h3>
                    <p className="text-slate-400 text-sm font-medium mt-1">AI is standing by.</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100/50 shadow-sm">
                    <Bot size={24} />
                  </div>
                </div>

                {/* Premium Voice Input Widget */}
                <div 
                  className={`relative p-2.5 rounded-2xl transition-all duration-500 mb-8 border ${isListening ? 'border-indigo-300 bg-white shadow-xl shadow-indigo-100/50 scale-[1.02]' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
                  onMouseEnter={() => setIsListening(true)}
                  onMouseLeave={() => setIsListening(false)}
                >
                  <div className="flex items-center gap-4">
                    <button className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 flex-shrink-0 ${isListening ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 shadow-sm border border-slate-200'}`}>
                      <Mic size={20} className={isListening ? 'animate-pulse' : ''} />
                    </button>
                    
                    <div className="flex-1 overflow-hidden flex items-center h-full cursor-pointer">
                      {isListening ? (
                        <div className="flex items-center gap-1.5 px-2 w-full h-8">
                          <span className="w-1 bg-indigo-500 rounded-full wave-1"></span>
                          <span className="w-1 bg-indigo-500 rounded-full wave-2"></span>
                          <span className="w-1 bg-indigo-500 rounded-full wave-3"></span>
                          <span className="w-1 bg-indigo-500 rounded-full wave-4"></span>
                          <span className="w-1 bg-indigo-500 rounded-full wave-5"></span>
                          <span className="text-indigo-600 font-semibold ml-3 text-sm tracking-wide">Listening to you...</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium text-sm">"Remind me to push code at 6 PM..."</span>
                      )}
                    </div>

                    <button className="w-10 h-10 flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm flex-shrink-0 transition-colors">
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                {/* Minimalist Task Representation */}
                <div className="space-y-4">
                  <div className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 transition-all hover:shadow-md">
                    <div className="w-5 h-5 rounded-full border-2 border-indigo-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Review deployment logs</h4>
                      <p className="text-[12px] text-slate-500 font-medium mt-1.5 flex items-center gap-1.5">
                        <Clock size={12} className="text-indigo-400" /> Scheduled for today, 2:00 PM
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Crisp Telegram Notification Overlay */}
              <div className="absolute -bottom-6 -right-2 lg:-right-6 bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl shadow-slate-900/10 border border-slate-100 z-30 flex items-start gap-3 max-w-[280px] transform transition-transform hover:scale-105">
                <div className="w-10 h-10 bg-[#2AABEE] rounded-full flex items-center justify-center flex-shrink-0 text-white shadow-inner">
                  <Send size={16} className="ml-[-2px]" />
                </div>
                <div className="pt-0.5">
                  <h4 className="text-[13px] font-bold text-slate-900 flex justify-between items-center">
                    TaskBot
                  </h4>
                  <p className="text-[12px] text-slate-600 font-medium mt-1 leading-relaxed">It's 2:00 PM. Time to review those deployment logs. ⚡️</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Elegant Features Section */}
        <section className="bg-white/40 backdrop-blur-lg border-y border-slate-200/50 mt-12 relative z-10">
          <div className="max-w-7xl mx-auto px-8 md:px-12 lg:px-20 py-24">
            <div className="grid md:grid-cols-3 gap-12 lg:gap-20">
              
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 transition-all hover:shadow-xl hover:shadow-indigo-900/5 hover:-translate-y-1">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mb-6 shadow-md">
                  <Mic className="text-white" size={20} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">Capture at the speed of thought.</h3>
                <p className="text-slate-500 font-medium leading-relaxed">Don't let ideas slip away. Speak naturally, and our AI extracts the intent, the task, and the timeline instantly.</p>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 transition-all hover:shadow-xl hover:shadow-indigo-900/5 hover:-translate-y-1">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-md shadow-indigo-600/20">
                  <Send className="text-white ml-[-2px]" size={20} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">Delivery where you live.</h3>
                <p className="text-slate-500 font-medium leading-relaxed">No more ignored push notifications. Receive precise, actionable alerts right inside your Telegram workflow.</p>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 transition-all hover:shadow-xl hover:shadow-indigo-900/5 hover:-translate-y-1">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mb-6 shadow-md shadow-blue-500/20">
                  <Zap className="text-white" size={20} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">Designed for execution.</h3>
                <p className="text-slate-500 font-medium leading-relaxed">A ruthless focus on simplicity. No complex menus, no nested folders. Just you, your tasks, and getting things done.</p>
              </div>

            </div>
          </div>
        </section>

        {/* Minimalist Bottom CTA */}
        <section className="max-w-7xl mx-auto py-32 px-8 lg:px-20 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-6">
            Ready to reclaim your focus?
          </h2>
          <p className="text-lg text-slate-500 font-medium mb-10 max-w-xl mx-auto">
            Takes less than 30 seconds to set up. Free your mind today.
          </p>
          <Link to="/register">
            <button type="button" className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-xl font-bold text-lg transition-transform hover:-translate-y-1 shadow-xl shadow-indigo-600/20 inline-flex items-center gap-2">
              Get Started Now <ArrowRight size={18} />
            </button>
          </Link>
        </section>

      </main>

      <Footer />
    </div>
  );
}