import React, { useLayoutEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Send, Zap, Smartphone, CheckCircle2, Clock, Calendar } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function Home() {
  const navigate = useNavigate();


  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans antialiased selection:bg-blue-200 relative overflow-hidden">
      
      {/* Custom Styles for Floating Elements & Static Dot Pattern */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(12px) rotate(-1deg); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float-reverse 7s ease-in-out infinite; }
        .animate-float-slow { animation: float 8s ease-in-out infinite; }
        
        /* Subtle static dot texture */
        .bg-dot-pattern {
          background-image: radial-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px);
          background-size: 24px 24px;
        }
      `}} />

      {/* Static Subtle Background Texture */}
      <div className="absolute inset-0 z-0 bg-dot-pattern opacity-100 pointer-events-none" />
      
      {/* Ambient Soft Glows (Static) */}
      <div className="absolute top-0 right-0 -mr-[10%] -mt-[10%] w-[40vw] h-[40vw] rounded-full bg-blue-400/10 blur-[100px] z-0 pointer-events-none" />
      <div className="absolute top-[40%] left-0 -ml-[10%] w-[30vw] h-[30vw] rounded-full bg-indigo-400/5 blur-[100px] z-0 pointer-events-none" />

      <div className="relative z-10">
        <Header />

        {/* Dynamic Split-Screen Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-20 pb-24 md:pt-32 md:pb-32 lg:flex lg:items-center lg:gap-16">
          
          {/* Left Text Column */}
          <div className="lg:w-1/2 text-center lg:text-left mb-16 lg:mb-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-blue-600 font-semibold text-sm mb-6">
              <Zap size={16} fill="currentColor" />
              <span>Smarter task management</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 text-slate-900 leading-[1.1]">
              Your memory, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                automated.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-500 mb-10 max-w-lg mx-auto lg:mx-0 font-medium leading-relaxed">
              Drop your tasks, set your deadlines, and let our Telegram bot handle the reminders. Free your mind to actually get the work done.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Link to="/register">
                <button type="button" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95">
                  Start for Free <ArrowRight size={20} />
                </button>
              </Link>
              <Link to="/login">
                <button type="button" className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-3.5 rounded-xl font-bold text-lg flex items-center justify-center shadow-sm transition-all active:scale-95">
                  Sign In
                </button>
              </Link>
            </div>
          </div>

          {/* Right Floating UI Activity Column */}
          <div className="lg:w-1/2 relative h-[400px] md:h-[500px] w-full max-w-md mx-auto lg:max-w-none perspective-1000">
            
            {/* Main Floating Task */}
            <div className="absolute top-10 left-4 right-8 md:left-12 md:right-12 bg-white p-5 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 animate-float z-20">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Send size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Algorithm Final</h3>
                    <p className="text-sm font-medium text-slate-400">Telegram Alert Scheduled</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-red-50 text-red-600 text-xs font-bold uppercase tracking-wider">High</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-2">
                <Clock size={16} /> Reminding today at 5:00 PM
              </div>
            </div>

            {/* Secondary Floating Task (Delayed) */}
            <div className="absolute top-48 -left-4 md:-left-8 right-20 md:right-32 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg shadow-slate-200/40 border border-white animate-float-delayed z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-400 line-through">Buy groceries</h3>
                  <p className="text-xs font-medium text-slate-300">Completed yesterday</p>
                </div>
              </div>
            </div>

            {/* Third Floating Element (Slow) */}
            <div className="absolute bottom-10 left-20 md:left-32 -right-4 md:-right-8 bg-white p-5 rounded-2xl shadow-2xl shadow-slate-200/60 border border-slate-100 animate-float-slow z-30">
               <div className="flex items-center gap-4">
                  <div className="bg-slate-50 border border-slate-100 w-12 h-12 rounded-xl flex items-center justify-center">
                    <Calendar className="text-slate-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Project Deadline</h3>
                    <div className="w-32 h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                      <div className="w-2/3 h-full bg-blue-500 rounded-full" />
                    </div>
                  </div>
               </div>
            </div>

          </div>
        </section>

        {/* Streamlined Features Row */}
        <section className="border-t border-slate-100 bg-white relative z-10">
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="grid md:grid-cols-3 gap-10 text-center md:text-left">
              
              <div className="group">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 mx-auto md:mx-0 border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                  <Zap className="text-slate-600 group-hover:text-blue-600 transition-colors" size={26} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Frictionless Entry</h3>
                <p className="text-slate-500 font-medium leading-relaxed">No bloated menus. Add your tasks in seconds and get back to your life.</p>
              </div>

              <div className="group">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 mx-auto md:mx-0 border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                  <Send className="text-slate-600 group-hover:text-indigo-600 transition-colors" size={26} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Telegram Delivery</h3>
                <p className="text-slate-500 font-medium leading-relaxed">Receive instant, reliable ping notifications directly in your Telegram app.</p>
              </div>

              <div className="group">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 mx-auto md:mx-0 border border-slate-100 group-hover:bg-purple-50 group-hover:border-purple-100 transition-colors">
                  <Smartphone className="text-slate-600 group-hover:text-purple-600 transition-colors" size={26} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Cross-Device Sync</h3>
                <p className="text-slate-500 font-medium leading-relaxed">Manage everything from your laptop, receive alerts on your phone. Perfectly synced.</p>
              </div>

            </div>
          </div>
        </section>

        {/* Soft, Light CTA Section */}
        <section className="px-6 py-24 relative z-10 bg-white">
          <div className="max-w-5xl mx-auto bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-100/50 rounded-[3rem] p-10 md:p-20 text-center shadow-sm">
            
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
              Ready to take control?
            </h2>
            <p className="text-xl text-slate-600 font-medium mb-10 max-w-2xl mx-auto">
              Join thousands of users who have stopped stressing about forgetting and started focusing on executing.
            </p>
            <Link to="/register">
              <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-sm">
                Get Started for Free
              </button>
            </Link>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}