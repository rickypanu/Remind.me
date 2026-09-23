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
            Last updated: September 24, 2026
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">2. Age Restrictions</h3>
                <p>
                  You must be at least 13 years old to use RemindMe. By using the service, you represent and warrant that you meet this age requirement.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">3. User Account</h3>
                <p>
                  To use our application, you must register for an account. You agree to provide accurate, current, and complete information during the registration process. You are responsible for safeguarding your password and account credentials.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">4. Acceptable Use</h3>
                <p>
                  You agree not to use the service for any unlawful purpose. You agree not to use the service in any way that could damage the site, the services, or the general business of RemindMe, including sending spam or malicious content.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">5. Limitation of Liability</h3>
                <p>
                  RemindMe is provided on an "as is" and "as available" basis. We do not guarantee that notifications will be delivered on time or that the service will be uninterrupted. We are not liable for any missed events, financial losses, or other damages resulting from failed reminders or service downtime.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">6. Account Termination</h3>
                <p>
                  We reserve the right to suspend or terminate your account at our sole discretion, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">7. Notifications and Communications</h3>
                <p>
                  By connecting your account to our Telegram bot, you consent to receiving automated task alerts and reminders. You can opt out of these communications at any time by stopping or blocking the Telegram bot, or by disconnecting it from the website via your Profile settings.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">8. Governing Law</h3>
                <p>
                  These Terms shall be governed and construed in accordance with the laws of India, including the Information Technology Act, 2000, without regard to its conflict of law provisions. 
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
                  We collect information you provide directly to us when you create an account, such as your name, email address and password. We also securely store the reminder data and content you input into the application.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">2. How We Use Your Information</h3>
                <p>
                  We use the information we collect to provide, maintain, and improve our services, and to protect RemindMe and our users. We use your data to trigger and send you the scheduled reminders you create.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Third-Party Services</h3>
                <p>
                  We use trusted third-party infrastructure providers to host and operate RemindMe. This includes Vercel (for frontend hosting), Render (for backend hosting), and MongoDB Atlas (for secure database storage). Your data is processed by these services strictly for the purpose of operating this application.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">4. Data Security</h3>
                <p>
                  We implement reasonable security practices and procedures to protect your information from unauthorized access, alteration, disclosure, or destruction, in compliance with applicable Indian laws. However, no internet or email transmission is ever fully secure or error-free.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">5. Your Data Rights & Deletion</h3>
                <p>
                  You have full control over your data. You can delete your account and all associated personal data and reminders at any time by going to your Profile and clicking the "Delete Account" button. Once deleted, this action cannot be undone and your data is permanently removed from our active databases.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">6. Cookies and Local Storage</h3>
                <p>
                  We use local browser storage and strictly necessary cookies to keep you logged into your account and securely manage your session. We do not use tracking cookies for advertising purposes.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">7. Grievance Officer & Indian Data Protection</h3>
                <p>
                  In compliance with the Digital Personal Data Protection Act, 2023 (DPDPA) and the Information Technology Act, 2000, you have the right to access, correct, and erase your personal data. If you have any grievances regarding your data or privacy, you may contact our Grievance Officer at rickypanu2005@gmail.com.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">8. Contact Us</h3>
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