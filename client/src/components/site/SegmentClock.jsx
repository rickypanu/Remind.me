import React, { useEffect, useState } from "react";

// One digit drawn as seven bars (a-g). viewBox 60 x 100.
const BARS = {
  a: "8,6 12,2 48,2 52,6 48,10 12,10",
  b: "54,8 58,12 58,44 54,48 50,44 50,12",
  c: "54,52 58,56 58,88 54,92 50,88 50,56",
  d: "8,94 12,90 48,90 52,94 48,98 12,98",
  e: "6,52 10,56 10,88 6,92 2,88 2,56",
  f: "6,8 10,12 10,44 6,48 2,44 2,12",
  g: "8,50 12,46 48,46 52,50 48,54 12,54",
};
const LIT = { 0: "abcdef", 1: "bc", 2: "abdeg", 3: "abcdg", 4: "bcfg", 5: "acdfg", 6: "acdefg", 7: "abc", 8: "abcdefg", 9: "abcdfg" };

function Digit({ value, x = 0, scale = 1 }) {
  const lit = value === null ? "" : LIT[value];
  return (
    <g transform={`translate(${x} 0) scale(${scale})`}>
      {Object.entries(BARS).map(([bar, points]) => (
        <polygon key={bar} points={points} className={lit.includes(bar) ? "rs-seg rs-seg--on" : "rs-seg"} />
      ))}
    </g>
  );
}

function pad(n) {
  return [Math.floor(n / 10), n % 10];
}

/** The device's real time, drawn like an LED alarm clock. Ticks once a second. 12-hour with an AM/PM lamp. */
export default function SegmentClock({ className = "" }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5); // stay on the second, do not drift
    };
    timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    return () => clearTimeout(timer);
  }, []);

  const h24 = now.getHours();
  const h12 = h24 % 12 || 12;
  const [h1, h2] = pad(h12);
  const [m1, m2] = pad(now.getMinutes());
  const [s1, s2] = pad(now.getSeconds());
  const pm = h24 >= 12;
  const label = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const colonOn = now.getSeconds() % 2 === 0;

  return (
    <div className={`rs-clock ${className}`}>
      <div className="rs-clock-face">
        {/* The label changes once a minute; the moving digits are hidden from screen readers. */}
        <span className="rs-sr">Current time {label}</span>
        <svg viewBox="0 0 372 100" aria-hidden="true" focusable="false" className="rs-clock-svg">
          <g transform="skewX(-5)" style={{ transformOrigin: "0 100px" }}>
            <Digit value={h1 === 0 ? null : h1} x={0} />
            <Digit value={h2} x={68} />
            <g className={colonOn ? "rs-colon rs-colon--on" : "rs-colon"}>
              <rect x="140" y="28" width="9" height="9" rx="2" />
              <rect x="140" y="63" width="9" height="9" rx="2" />
            </g>
            <Digit value={m1} x={158} />
            <Digit value={m2} x={226} />
            <Digit value={s1} x={304} scale={0.42} />
            <Digit value={s2} x={330} scale={0.42} />
          </g>
        </svg>
        <div className="rs-clock-lamps" aria-hidden="true">
          <span className={pm ? "" : "is-on"}>AM</span>
          <span className={pm ? "is-on" : ""}>PM</span>
        </div>
      </div>
    </div>
  );
}
