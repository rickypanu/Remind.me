import React, { useState } from "react";
import { X, UploadCloud } from "lucide-react";

// ---------- DiceBear styles (generated avatars) ----------
const BG = ["b6e3f4", "c0aede", "ffdfbf", "ffd5dc"];

const dicebear = (style, seeds) =>
  seeds.map(
    (seed, i) =>
      `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=${BG[i % BG.length]}`
  );

// ---------- Original developer-themed icons (inline SVG, no external requests) ----------
const svgToDataUri = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const wrap = (bg, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#${bg}"/>${body}</svg>`;

const DEV_ICON_SVGS = [
  // Terminal
  wrap("1e293b", `<rect x="14" y="22" width="72" height="56" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="3"/><rect x="14" y="22" width="72" height="12" rx="8" fill="#38bdf8"/><circle cx="23" cy="28" r="2.5" fill="#0f172a"/><circle cx="31" cy="28" r="2.5" fill="#0f172a"/><path d="M26 46l12 10-12 10" fill="none" stroke="#4ade80" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="44" y="63" width="20" height="5" rx="2.5" fill="#4ade80"/>`),
  // Rubber Duck
  wrap("bae6fd", `<ellipse cx="50" cy="66" rx="30" ry="20" fill="#facc15"/><path d="M72 58c10-2 14 6 10 14" fill="none" stroke="#eab308" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="38" r="17" fill="#facc15"/><path d="M26 42l-13 4 13 5z" fill="#fb923c"/><circle cx="40" cy="34" r="3.5" fill="#0f172a"/><ellipse cx="52" cy="70" rx="14" ry="8" fill="#eab308"/>`),
  // Bug
  wrap("fecaca", `<g stroke="#14532d" stroke-width="4" stroke-linecap="round"><path d="M30 44L16 36M30 56H14M32 68L18 78M70 44l14-8M70 56h16M68 68l14 10M42 26l-6-10M58 26l6-10"/></g><ellipse cx="50" cy="58" rx="22" ry="26" fill="#22c55e"/><circle cx="50" cy="32" r="12" fill="#16a34a"/><path d="M50 36v46" stroke="#14532d" stroke-width="3"/><circle cx="40" cy="55" r="4" fill="#14532d"/><circle cx="60" cy="55" r="4" fill="#14532d"/><circle cx="42" cy="70" r="3.5" fill="#14532d"/><circle cx="58" cy="70" r="3.5" fill="#14532d"/><circle cx="45" cy="30" r="2" fill="#fff"/><circle cx="55" cy="30" r="2" fill="#fff"/>`),
  // Rocket
  wrap("312e81", `<path d="M50 12c14 10 20 26 18 46H32c-2-20 4-36 18-46z" fill="#f8fafc"/><circle cx="50" cy="40" r="8" fill="#38bdf8" stroke="#1e293b" stroke-width="3"/><path d="M32 50L18 66l16-4zM68 50l14 16-16-4z" fill="#ef4444"/><path d="M40 62h20l-10 22z" fill="#fb923c"/><path d="M45 62h10l-5 12z" fill="#fde047"/><circle cx="20" cy="20" r="2" fill="#fff"/><circle cx="82" cy="30" r="1.5" fill="#fff"/><circle cx="76" cy="14" r="2" fill="#fff"/>`),
  // Coffee
  wrap("fde68a", `<path d="M26 40h42v28a16 16 0 0 1-16 16H42a16 16 0 0 1-16-16z" fill="#fff" stroke="#78350f" stroke-width="4"/><path d="M68 48h6a9 9 0 0 1 0 18h-6" fill="none" stroke="#78350f" stroke-width="4"/><path d="M26 52h42v6H26z" fill="#92400e"/><path d="M38 30c-4-5 4-8 0-14M52 30c-4-5 4-8 0-14" fill="none" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>`),
  // Git Branch
  wrap("ddd6fe", `<path d="M34 28v44M34 56c0-14 32-6 32-26" fill="none" stroke="#4c1d95" stroke-width="5" stroke-linecap="round"/><circle cx="34" cy="26" r="9" fill="#8b5cf6" stroke="#4c1d95" stroke-width="4"/><circle cx="34" cy="74" r="9" fill="#8b5cf6" stroke="#4c1d95" stroke-width="4"/><circle cx="66" cy="28" r="9" fill="#f472b6" stroke="#4c1d95" stroke-width="4"/>`),
  // CPU
  wrap("bbf7d0", `<g stroke="#064e3b" stroke-width="4" stroke-linecap="round"><path d="M38 14v14M50 14v14M62 14v14M38 72v14M50 72v14M62 72v14M14 38h14M14 50h14M14 62h14M72 38h14M72 50h14M72 62h14"/></g><rect x="28" y="28" width="44" height="44" rx="6" fill="#065f46"/><rect x="38" y="38" width="24" height="24" rx="3" fill="#34d399"/><circle cx="50" cy="50" r="5" fill="#065f46"/>`),
  // Cloud Code
  wrap("e0f2fe", `<path d="M30 70a16 16 0 0 1-2-32 22 22 0 0 1 42-4 17 17 0 0 1 4 36z" fill="#fff" stroke="#0369a1" stroke-width="4" stroke-linejoin="round"/><path d="M42 48l-8 8 8 8M58 48l8 8-8 8M53 44l-6 24" fill="none" stroke="#0369a1" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
];

const ILLUSTRATION_CATEGORIES = {
  "Dev Icons": DEV_ICON_SVGS.map(svgToDataUri),
  "Tech Bots": dicebear("bottts", ["Felix", "Oliver", "Caleb", "Zoey"]),
  "Pixel Art": dicebear("pixel-art", ["Hero1", "Hero2", "Hero3", "Hero4", "Hero5", "Hero6", "Hero7", "Hero8"]),
  Identicons: dicebear("identicon", ["octocat", "linus", "ada", "grace", "alan", "margaret", "dennis", "guido"]),
  Shapes: dicebear("shapes", ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"]),
  Rings: dicebear("rings", ["merge", "commit", "deploy", "build", "push", "fetch", "rebase", "stash"]),
  Animals: dicebear("fun-emoji", ["Milo", "Bella", "Lucy", "Max"]),
  Adventurers: dicebear("adventurer", ["Jack", "Jasmine", "George", "Mia"]),
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