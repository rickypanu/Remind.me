import React, { useState } from 'react';

const faqs = [
  {
    question: "How do I get pinged for upcoming tests?",
    answer: "We use native browser notifications, so you don't need to download another app. Just click 'Allow' when your browser asks for notification permissions, and we'll alert you before your assessments."
  },
  {
    question: "Do I need the tab open to get my reminders?",
    answer: "As long as your browser is running in the background and you've granted permissions, your alerts will pop up right on your screen."
  },
  {
    question: "Can I separate my homework from my major exams?",
    answer: "Yep. When you add a new entry, you can categorize it as a standard task, a long-term assessment, or a test, so your dashboard stays perfectly organized."
  },
  {
    question: "Will my schedule sync across my phone and laptop?",
    answer: "Absolutely. Everything you save is instantly synced. You can add a task on your laptop during class and check it off from your phone's browser later."
  },
  {
    question: "What happens if I miss a browser notification?",
    answer: "Don't stress. Any past-due tasks or tests will stay pinned in a highly visible 'Overdue' section on your dashboard until you mark them as complete."
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        
        {/* Back Button */}
        <div className="mb-8">
          <button 
            onClick={() => window.history.back()} 
            className="flex items-center text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium focus:outline-none"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Profile
          </button>
        </div>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Frequently Asked Questions
          </h1>
          <p className="text-gray-500">
            Everything you need to know about tracking your assessments.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 flex justify-between items-center bg-white hover:bg-gray-50 transition-colors focus:outline-none"
              >
                <span className="font-medium text-gray-900 text-left">
                  {faq.question}
                </span>
                <span className={`transform transition-transform duration-200 ml-4 ${
                  openIndex === index ? 'rotate-180' : ''
                }`}>
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              
              <div 
                className={`px-6 overflow-hidden transition-all duration-200 ease-in-out ${
                  openIndex === index ? 'max-h-48 pb-4 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="text-gray-600 text-sm leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}