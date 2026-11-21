import React, { useState } from "react";
import { Moon, Sun, Palette, Check } from "../../components/icons";
import { useTheme, ACCENTS } from "../../theme/ThemeContext";
import { LOOK_OPTIONS, readLook, saveLook } from "../../utils/look";

export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        checked ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-[#ffffff] shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function Row({ icon: Icon, label, subLabel, checked, onChange }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={20} />
        </div>
        <div className="flex flex-col text-left">
          <span className="font-medium text-gray-900">{label}</span>
          <span className="text-xs text-gray-500 mt-0.5">{subLabel}</span>
        </div>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/** "Appearance" card for the Profile page: dark mode, Minimalism theme and accent colour. */
function LookPicker({ name }) {
  const [look, setLook] = useState(readLook);
  const { label, items } = LOOK_OPTIONS[name];
  return (
    <div className="p-4 bg-white border-t border-gray-100">
      <p className="font-medium text-gray-900">{label}</p>
      <div role="radiogroup" aria-label={label} className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => {
          const on = look[name] === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={on}
              title={item.hint}
              onClick={() => {
                saveLook(name, item.id);
                setLook(readLook());
              }}
              className={`rounded-xl border-[1.5px] px-3.5 py-2 text-sm font-semibold transition active:scale-95 ${
                on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-gray-700 hover:border-slate-400"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AppearanceSettings() {
  const { isDark, isMinimal, accent, selectAccent, toggleColorMode, toggleThemeStyle } = useTheme();
  const active = isMinimal ? "black" : accent;
  const swatches = [...ACCENTS, { id: "black", label: "Black", swatch: "#171717" }];

  return (
    <div>
      <h3 className="px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Appearance</h3>
      <div className="bg-white border-[1.5px] border-slate-900 rounded-[24px] overflow-hidden shadow-[4px_4px_0_0_#14161f]">
        <Row
          icon={isDark ? Moon : Sun}
          label="Dark mode"
          subLabel={isDark ? "On - easier on the eyes at night" : "Off - light appearance"}
          checked={isDark}
          onChange={toggleColorMode}
        />
        <Row
          icon={Palette}
          label="Minimalism theme"
          subLabel={isMinimal ? "On - clean, monochrome and flat" : "Off - using the default theme"}
          checked={isMinimal}
          onChange={toggleThemeStyle}
        />
        <div className="p-4 bg-white">
          <div className="flex items-baseline justify-between">
            <p className="font-medium text-gray-900">Accent colour</p>
            <p className="text-xs text-gray-500">{swatches.find((s) => s.id === active)?.label}</p>
          </div>
          <div role="radiogroup" aria-label="Accent colour" className="mt-3 flex flex-wrap gap-3">
            {swatches.map(({ id, label, swatch }) => {
              const on = active === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={label}
                  title={label}
                  onClick={() => selectAccent(id)}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    on ? "ring-2 ring-offset-2" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: swatch, "--tw-ring-color": swatch }}
                >
                  {on && <Check size={18} strokeWidth={3} className="text-[#ffffff]" />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            Black uses the Minimalism theme. Colours change buttons, links and highlights across the app.
          </p>
        </div>
        <LookPicker name="font" />
        <LookPicker name="cards" />
        <LookPicker name="density" />
      </div>
    </div>
  );
}
