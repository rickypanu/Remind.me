import { Users } from "lucide-react";
import api from "../../utils/api";
export default function SquadDash() {
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
        <div className="mb-10 flex items-center gap-3 text-gray-700">
          <Users size={28} strokeWidth={2} />
          <span className="text-xl font-semibold">Squad Dashboard</span>
        </div>

        {/* Coming Soon Section */}
        <div className="text-gray-500 text-lg">
          Coming soon...
        </div>
         
      </div>
    </div>
  );
}
