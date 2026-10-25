/**
 * Motivation content for the dashboard card. Pure data: edit freely, nothing here runs code.
 *
 * THEMES (what a line is good for; the card picks lines whose themes match the user's situation):
 *   start        beginning is the hard part      focus        deep work, doing the thing
 *   persist      keep going when it's hard       comeback     failed, slipped, behind: get back up
 *   consistency  small steps, daily habits       rest         recharge, sleep, balance
 *   courage      take the shot                   joy          celebrate, enjoy the work
 *
 * CLASSIC quotes are short, widely attributed lines from athletes, leaders and thinkers.
 * Attributions are the commonly cited ones; some famous quotes have disputed origins, so check a primary source
 * before you reuse one outside the app.
 *
 * RELATABLE lines are written for the app (no author). They speak to the moments people actually have: tired,
 * behind, nervous before an exam, scrolling instead of starting.
 */

export const CLASSIC_QUOTES = [
  { text: "I've failed over and over and over again in my life. And that is why I succeed.", author: "Michael Jordan", role: "Basketball legend", themes: ["comeback", "persist"] },
  { text: "I can accept failure, everyone fails at something. But I can't accept not trying.", author: "Michael Jordan", role: "Basketball legend", themes: ["courage", "start"] },
  { text: "Don't quit. Suffer now and live the rest of your life as a champion.", author: "Muhammad Ali", role: "Boxing champion", themes: ["persist", "focus"] },
  { text: "A champion is defined not by their wins but by how they can recover when they fail.", author: "Serena Williams", role: "Tennis champion", themes: ["comeback", "persist"] },
  { text: "Rest at the end, not in the middle.", author: "Kobe Bryant", role: "Basketball legend", themes: ["focus", "persist"] },
  { text: "The moment you give up is the moment you let someone else win.", author: "Kobe Bryant", role: "Basketball legend", themes: ["persist", "comeback"] },
  { text: "There's no way around hard work. Embrace it.", author: "Roger Federer", role: "Tennis great", themes: ["persist", "focus"] },
  { text: "Talent without working hard is nothing.", author: "Cristiano Ronaldo", role: "Footballer", themes: ["focus", "persist"] },
  { text: "I'd rather regret the risks that didn't work out than the chances I didn't take at all.", author: "Simone Biles", role: "Olympic gymnast", themes: ["courage", "start"] },
  { text: "You can't put a limit on anything. The more you dream, the farther you get.", author: "Michael Phelps", role: "Olympic swimmer", themes: ["start", "courage"] },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky", role: "Ice hockey legend", themes: ["courage", "start"] },
  { text: "The more difficult the victory, the greater the happiness in winning.", author: "Pelé", role: "Footballer", themes: ["persist", "joy"] },
  { text: "Champions keep playing until they get it right.", author: "Billie Jean King", role: "Tennis champion", themes: ["persist", "comeback"] },
  { text: "If you want to shine like the sun, first burn like the sun.", author: "A. P. J. Abdul Kalam", role: "Scientist and former President of India", themes: ["persist", "focus"] },
  { text: "Dream, dream, dream. Dreams transform into thoughts, and thoughts result in action.", author: "A. P. J. Abdul Kalam", role: "Scientist and former President of India", themes: ["start", "courage"] },
  { text: "Arise, awake, and stop not till the goal is reached.", author: "Swami Vivekananda", role: "Philosopher and monk", themes: ["start", "persist"] },
  { text: "You can't cross the sea merely by standing and staring at the water.", author: "Rabindranath Tagore", role: "Poet and Nobel laureate", themes: ["start", "courage"] },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi", role: "Leader of India's independence movement", themes: ["start", "focus"] },
  { text: "Courage is not the absence of fear, but the triumph over it.", author: "Nelson Mandela", role: "Anti-apartheid leader", themes: ["courage", "comeback"] },
  { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu", role: "Philosopher", themes: ["start"] },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", role: "Philosopher", themes: ["consistency", "persist"] },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Will Durant", role: "Historian, summing up Aristotle", themes: ["consistency", "focus"] },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt", role: "U.S. President", themes: ["start", "comeback"] },
  { text: "Do the best you can until you know better. Then when you know better, do better.", author: "Maya Angelou", role: "Poet and author", themes: ["comeback", "consistency"] },
  { text: "Nothing will work unless you do.", author: "Maya Angelou", role: "Poet and author", themes: ["focus", "start"] },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison", role: "Inventor", themes: ["comeback", "persist"] },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs", role: "Co-founder of Apple", themes: ["joy", "focus"] },
  { text: "Whether you think you can, or you think you can't, you're right.", author: "Henry Ford", role: "Industrialist", themes: ["courage", "focus"] },
  { text: "Fall seven times, stand up eight.", author: "Japanese proverb", role: "", themes: ["comeback", "persist"] },
  { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall", role: "Chaplain of the U.S. Senate", themes: ["start", "consistency"] },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier", role: "Author", themes: ["consistency", "persist"] },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", role: "Humorist and teacher", themes: ["consistency", "persist"] },
  { text: "Perseverance is not a long race; it is many short races one after the other.", author: "Walter Elliot", role: "Scottish politician", themes: ["consistency", "persist"] },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear", role: "Author of Atomic Habits", themes: ["consistency", "focus"] },
  { text: "Rest is not idleness.", author: "John Lubbock", role: "Scientist and writer", themes: ["rest"] },
  { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott", role: "Author", themes: ["rest"] },
  { text: "Take rest; a field that has rested gives a bountiful crop.", author: "Ovid", role: "Roman poet", themes: ["rest", "consistency"] },
];

export const RELATABLE_LINES = [
  { text: "You don't have to do it all today. You have to do the next thing.", themes: ["comeback", "start", "focus"] },
  { text: "Behind is not broken. It's just a starting line you haven't crossed yet.", themes: ["comeback", "start"] },
  { text: "Start badly. A messy first ten minutes beats a perfect plan you never begin.", themes: ["start"] },
  { text: "Can't do the whole thing? Do five minutes. Five minutes has a way of turning into an hour.", themes: ["start", "focus"] },
  { text: "Someone's highlight reel isn't your Tuesday. Run your own race.", themes: ["persist", "courage", "comeback"] },
  { text: "Feeling nervous means it matters to you. So prepare, then breathe.", themes: ["courage", "focus"] },
  { text: "Progress that looks tiny today is a big number a month from now.", themes: ["consistency", "persist"] },
  { text: "Talk to yourself the way you'd talk to a friend who's trying their best.", themes: ["comeback", "rest"] },
  { text: "Rest isn't a reward for finishing everything. It's part of how things get finished.", themes: ["rest"] },
  { text: "It's late. Whatever's left, tomorrow-you can handle. Sleep is productive too.", themes: ["rest"] },
  { text: "New day, blank page. You decide the first line.", themes: ["start"] },
  { text: "You showed up today. That's most of the game.", themes: ["joy", "consistency", "rest"] },
  { text: "You don't need to feel ready. You just need to begin.", themes: ["start", "courage"] },
  { text: "Boring and consistent beats exciting and occasional.", themes: ["consistency"] },
  { text: "The goal is not to be perfect. The goal is to not quit on yourself.", themes: ["persist", "comeback"] },
  { text: "Future you is already grateful for what you do in the next hour.", themes: ["focus", "start"] },
];
