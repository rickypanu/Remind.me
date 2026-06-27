import React from 'react';
import { Link } from 'react-router-dom'; // Added import for Link
import { 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  BrainCircuit, 
  Target, 
  BookOpen, 
  Briefcase 
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Homepage = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100">
      
      <Header />

      {/* Hero Section */}
      <header className="max-w-4xl mx-auto text-center px-6 pt-24 pb-20">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight text-gray-900">
          Your mind is for thinking, <br className="hidden md:block" />
          <span className="text-blue-600">not memorizing.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          We deliver a frictionless way to capture tasks, set smart alerts, and organize your life. Offload your to-dos to Remind Me, and get your focus back.
        </p>
        
        <div className="flex justify-center">
          {/* Replaced <link> with <Link to="..."> */}
          <Link to="/auth">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-bold text-lg flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-1">
              Start for Free Today <ArrowRight size={20} />
            </button>
          </Link>
        </div>
      </header>

      {/* What We Deliver Section */}
      <section id="features" className="bg-gray-50 py-24 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">What We Deliver</h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg">A streamlined system designed to catch everything before it falls through the cracks.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="text-blue-600" size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Frictionless Capture</h3>
              <p className="text-gray-500 leading-relaxed">
                Add tasks in seconds. Our minimal interface gets out of your way so you can log your thoughts and get back to work immediately.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                <Target className="text-emerald-600" size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Smart Prioritization</h3>
              <p className="text-gray-500 leading-relaxed">
                Not all tasks are equal. We help you separate the urgent from the important, ensuring you always tackle the right thing at the right time.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-indigo-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                <BrainCircuit className="text-indigo-600" size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Reliable Automation</h3>
              <p className="text-gray-500 leading-relaxed">
                Set recurring routines, location-based pings, and deadline warnings. Once it's in the system, you can trust we will remind you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for Section */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Built for ambition.</h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg">Whether you are managing a syllabus or a project pipeline, we adapt to your workflow.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Student Card */}
            <div className="bg-gray-50 p-10 rounded-[2.5rem] border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                  <BookOpen className="text-blue-600" size={24} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">For Students</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-gray-600">
                  <CheckCircle2 size={20} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>Never miss an assignment deadline or discussion post.</span>
                </li>
                <li className="flex items-start gap-3 text-gray-600">
                  <CheckCircle2 size={20} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>Break down massive term papers into daily, manageable steps.</span>
                </li>
                <li className="flex items-start gap-3 text-gray-600">
                  <CheckCircle2 size={20} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>Set recurring reminders for study groups and classes.</span>
                </li>
              </ul>
            </div>

            {/* Professional Card */}
            <div className="bg-blue-600 p-10 rounded-[2.5rem] text-white shadow-xl shadow-blue-600/10">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-blue-500 p-3 rounded-xl shadow-inner">
                  <Briefcase className="text-white" size={24} />
                </div>
                <h3 className="text-2xl font-bold">For Professionals</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-blue-50">
                  <CheckCircle2 size={20} className="text-blue-300 shrink-0 mt-0.5" />
                  <span>Track deliverables across multiple clients or projects seamlessly.</span>
                </li>
                <li className="flex items-start gap-3 text-blue-50">
                  <CheckCircle2 size={20} className="text-blue-300 shrink-0 mt-0.5" />
                  <span>Prepare for meetings with timely, automated pre-meeting alerts.</span>
                </li>
                <li className="flex items-start gap-3 text-blue-50">
                  <CheckCircle2 size={20} className="text-blue-300 shrink-0 mt-0.5" />
                  <span>Leave work at work—capture thoughts instantly and enjoy your evening.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section (The Impact) */}
      <section className="py-24 px-6 relative overflow-hidden bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 text-gray-900">Experience the impact of a clear mind.</h2>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
            When you stop trying to remember everything, you reduce anxiety and increase your creative focus. Let us do the remembering for you.
          </p>
          {/* Replaced broken syntax with proper <Link> component */}
          <Link to="/auth">
            <button className="bg-gray-900 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-800 transition-colors shadow-lg">
              Create Your Free Account
            </button>
          </Link>
        </div>
      </section>

      <Footer />
      
    </div>
  );
};

export default Homepage;