import React, { useState } from "react";
import { X, UploadCloud } from "lucide-react";

const ILLUSTRATION_CATEGORIES = {
  "Tech Bots": [
    "https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=b6e3f4",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Oliver&backgroundColor=c0aede",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Caleb&backgroundColor=ffdfbf",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Zoey&backgroundColor=ffd5dc",
  ],
  Animals: [
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Milo&backgroundColor=b6e3f4",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Bella&backgroundColor=c0aede",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Lucy&backgroundColor=ffdfbf",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Max&backgroundColor=ffd5dc",
  ],
  Adventurers: [
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Jack&backgroundColor=b6e3f4",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Jasmine&backgroundColor=c0aede",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=George&backgroundColor=ffdfbf",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Mia&backgroundColor=ffd5dc",
  ],
};

export default function AvatarPickerModal({ isOpen, onClose, onUploadClick, onSelectIllustration }) {
  const [activeTab, setActiveTab] = useState("Tech Bots");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Choose Profile Picture</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <button
            onClick={onUploadClick}
            className="w-full flex items-center justify-center gap-3 py-4 mb-6 border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/50 hover:bg-indigo-50 text-indigo-600 font-semibold transition-colors"
          >
            <UploadCloud size={24} />
            Upload from Device
          </button>

          <div className="flex items-center gap-4 mb-4">
            <div className="h-px bg-gray-200 flex-1"></div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Or choose illustration
            </span>
            <div className="h-px bg-gray-200 flex-1"></div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {Object.keys(ILLUSTRATION_CATEGORIES).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-3 mt-4">
            {ILLUSTRATION_CATEGORIES[activeTab].map((url, index) => (
              <div
                key={index}
                onClick={() => onSelectIllustration(url)}
                className="aspect-square rounded-2xl bg-gray-50 border-2 border-transparent hover:border-indigo-500 cursor-pointer overflow-hidden transition-all hover:scale-105 active:scale-95"
              >
                <img src={url} alt="avatar option" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}