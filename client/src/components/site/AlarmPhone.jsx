import React, { useEffect, useState } from "react";
import SegmentClock from "./SegmentClock";

/** A phone lock screen with the live time and an example reminder ringing. The reminder text is a sample, labelled as one. */
export default function AlarmPhone() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const day = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  return (
    <figure className="rs-phone" aria-label="Example of a reminder ringing on a phone">
      <div className="rs-phone-screen">
        <p className="rs-phone-day">{day}</p>
        <SegmentClock />
        <div className="rs-ring-card">
          <span className="rs-ring-bell" aria-hidden="true">
            <i />
            <i />
            <b />
          </span>
          <div>
            <p className="rs-ring-app">GetRemindMe · now</p>
            <p className="rs-ring-title">Gym</p>
            <p className="rs-ring-line">It's time. You've got this.</p>
          </div>
        </div>
      </div>
      <figcaption className="rs-phone-cap">Example reminder. Yours ring in the tone you pick.</figcaption>
    </figure>
  );
}

const STEPS = [
  { time: "5:00 pm", title: "A heads-up, 1 hour before", note: "Plenty of time to wrap up what you are doing." },
  { time: "5:50 pm", title: "Another, 10 minutes before", note: "Shoes on." },
  { time: "6:00 pm", title: "Rings, on the dot", note: "Gym. With your alarm sound, even if the phone is locked.", ring: true },
  { time: "After", title: "Tick it off, or push it back", note: "Done reminders move out of your way." },
];

/** What happens around one reminder, so a visitor can see it will not be missed. */
export function RingTimeline() {
  return (
    <ol className="rs-timeline" aria-label="What happens for a reminder at 6:00 pm">
      {STEPS.map((s) => (
        <li key={s.time} className={s.ring ? "is-ring" : ""}>
          <span className="rs-tl-time">{s.time}</span>
          <span className="rs-tl-dot" aria-hidden="true" />
          <div>
            <p className="rs-tl-title">{s.title}</p>
            <p className="rs-tl-note">{s.note}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
