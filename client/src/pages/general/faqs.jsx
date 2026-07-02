import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ChevronDown, 
  Search, 
  MessageCircleQuestion, 
  Mail 
} from 'lucide-react';

// Upgraded data structure with categories
const faqData = [
  {
    id: 1,
    category: "Notifications",
    question: "How do I get pinged for upcoming tests?",
    answer: "We use native browser notifications, so you don't need to download another app. Just click 'Allow' when your browser asks for notification permissions, and we'll alert you before your assessments."
  },
  {
    id: 2,
    category: "Notifications",
    question: "Do I need the tab open to get my reminders?",
    answer: "As long as your browser is running in the background and you've granted permissions, your alerts will pop up right on your screen."
  },
  {
    id: 3,
    category: "Tasks",
    question: "Can I separate my homework from my major exams?",
    answer: "Yep. When you add a new entry, you can categorize it as a standard task, a long-term assessment, or a test, so your dashboard stays perfectly organized."
  },
  {
    id: 4,
    category: "Sync",
    question: "Will my schedule sync across my phone and laptop?",
    answer: "Absolutely. Everything you save is instantly synced. You can add a task on your laptop during class and check it off from your phone's browser later."
  },
  {
    id: 5,
    category: "Tasks",
    question: "What happens if I miss a browser notification?",
    answer: "Don't stress. Any past-due tasks or tests will stay pinned in a highly visible 'Overdue' section on your dashboard until you mark them as complete."
  },
  {
    id: 6,
    category: "General",
    question: "Is this application free to use?",
    answer: "Yes! All core task tracking, notification, and synchronization features are completely free to use."
  }
];

// Extract unique categories dynamically
const categories = ["All", ...new Set(faqData.map(faq => faq.category))];

export default function FAQ() {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const toggleFAQ = (id) => {
    setOpenId(openId === id ? null : id);
  };

  // Filter logic for Search + Category
  const filteredFAQs = useMemo(() => {
    return faqData.filter(faq => {
      const matchesSearch = 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === "All" || faq.category === activeCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 sm:px-6 lg:px-8 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Top Navigation */}
        <div>
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors w-fit"
          >
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors">
               <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Profile
          </button>
        </div>

        {/* Header Section */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
            How can we help?
          </h1>
          <p className="text-slate-500 font-medium">
            Everything you need to know about tracking your assessments and managing your tasks.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search for answers..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpenId(null); // Close open accordions when typing
            }}
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all"
          />
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setActiveCategory(category);
                setOpenId(null);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                activeCategory === category
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* FAQ List */}
        <div className="space-y-3 min-h-[300px]">
          {filteredFAQs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <MessageCircleQuestion className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-slate-900 font-bold text-lg mb-1">No results found</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                We couldn't find any FAQs matching "{searchQuery}". Try adjusting your search or category.
              </p>
            </div>
          ) : (
            filteredFAQs.map((faq) => {
              const isOpen = openId === faq.id;
              
              return (
                <div 
                  key={faq.id} 
                  className={`bg-white rounded-2xl border transition-colors duration-200 overflow-hidden ${
                    isOpen ? "border-indigo-200 shadow-md shadow-indigo-100/50" : "border-slate-200 shadow-sm hover:border-slate-300"
                  }`}
                >
                  <button
                    onClick={() => toggleFAQ(faq.id)}
                    className="w-full px-5 py-4 sm:px-6 sm:py-5 flex justify-between items-center focus:outline-none group"
                  >
                    <span className="font-bold text-slate-900 text-left pr-4 group-hover:text-indigo-600 transition-colors">
                      {faq.question}
                    </span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      isOpen ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                    }`}>
                      <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  
                  {/* Smooth Accordion Animation using CSS Grid */}
                  <div 
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 sm:px-6 sm:pb-6 text-slate-600 text-sm leading-relaxed border-t border-slate-50 mt-2 pt-4">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Support CTA */}
        <div className="mt-12 bg-indigo-50 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 border border-indigo-100">
          <div>
            <h3 className="text-indigo-900 font-bold text-lg mb-1">Still have questions?</h3>
            <p className="text-indigo-700/80 text-sm font-medium">
              Can't find the answer you're looking for? Reach out to our team.
            </p>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm w-full sm:w-auto justify-center shrink-0">
            <Mail className="w-4 h-4" />
            Contact Support
          </button>
        </div>

      </div>
    </div>
  );
}