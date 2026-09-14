import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, FileText } from 'lucide-react';

export default function Terms() {
  const navigate = useNavigate();

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 relative">
      
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors font-medium bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200"
      >
        <ArrowLeft size={18} />
        Back
      </button>

      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mt-8">
        
        {/* Header */}
        <div className="bg-blue-600 px-8 py-10 text-center text-white">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            Legal & Privacy
          </h1>
          <p className="text-blue-100 font-medium">
            Last updated: June 27, 2026
          </p>
        </div>

        {/* Content Body */}
        <div className="p-8 sm:p-12 space-y-12 text-gray-700">
          
          {/* Terms of Service Section */}
          <section>
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <FileText className="text-blue-600" size={28} />
              <h2 className="text-2xl font-bold text-gray-900">Terms of Service</h2>
            </div>
            
            <div className="space-y-6 text-sm leading-relaxed">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h3>
                <p>
                  By accessing and using RemindMe, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by these terms, please do not use this service.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">2. User Account</h3>
                <p>
                  To use certain features of our application, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Acceptable Use</h3>
                <p>
                  You agree not to use the service for any unlawful purpose or any purpose prohibited under this clause. You agree not to use the service in any way that could damage the site, the services, or the general business of RemindMe.
                </p>
              </div>
            </div>
          </section>

          {/* Privacy Policy Section */}
          <section>
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <Shield className="text-blue-600" size={28} />
              <h2 className="text-2xl font-bold text-gray-900">Privacy Policy</h2>
            </div>
            
            <div className="space-y-6 text-sm leading-relaxed">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">1. Information We Collect</h3>
                <p>
                  We collect information you provide directly to us when you create an account, such as your email address and password. We also automatically collect certain information about your device and how you interact with our services.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">2. How We Use Your Information</h3>
                <p>
                  We use the information we collect to provide, maintain, and improve our services, to develop new ones, and to protect RemindMe and our users. We may also use this information to communicate with you, such as sending you email notifications regarding your reminders.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Data Security</h3>
                <p>
                  We implement reasonable security measures designed to protect your information from unauthorized access, alteration, disclosure, or destruction. However, no internet or email transmission is ever fully secure or error-free.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">4. Contact Us</h3>
                <p>
                  If you have any questions about these Terms or our Privacy Policy, please contact us at rickypanu2005@gmail.com.
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}