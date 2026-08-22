import random

# Category Emojis for Visual Clarity
CATEGORY_EMOJIS = {
    "Assignment": "📝",
    "Project": "💻",
    "Exam / Quiz": "🎓",
    "Placement / Internship": "💼",
    "Extracurricular": "🏆",
    "Personal": "🌱",
    "Other": "📌"
}

def _get_emoji(category: str) -> str:
    return CATEGORY_EMOJIS.get(category, "⏰")

# ---------------------------------------------------------
# 1. DUE SOON MESSAGES (T-60 Minutes)
# ---------------------------------------------------------

def get_due_soon_copy(task_title: str, category: str = "Other") -> tuple[str, str]:
    """Urgency copy customized by task category."""
    emoji = _get_emoji(category)
    cat_lower = category.lower()

    if category == "Exam / Quiz":
        templates = [
            (f"{emoji} Exam Alert | 1 Hour Left", f"'{task_title}' starts/is due in 60 minutes! Final review time—stay calm and sharp."),
            (f"{emoji} Quiz Time Approaching", f"Just 1 hour left for '{task_title}'. Double-check your prep and get ready to crush it!"),
            (f"{emoji} High Stakes Focus", f"'{task_title}' is approaching quickly. Review your key notes and lock in.")
        ]
    elif category == "Assignment":
        templates = [
            (f"{emoji} Submission Deadline Approaching", f"1 hour remaining to submit '{task_title}'. Time for final formatting checks!"),
            (f"{emoji} Assignment Due Shortly", f"'{task_title}' is due in 60 minutes. Get your files ready and hit submit."),
            (f"{emoji} Final Sprint!", f"Just 1 hour left for '{task_title}'. Finish up and get it submitted on time.")
        ]
    elif category == "Project":
        templates = [
            (f"{emoji} Milestone Deadline | 1 Hour Left", f"1 hour left to hit your project target for '{task_title}'. Final code review & cleanup!"),
            (f"{emoji} Project Due Soon", f"Just 60 minutes left on '{task_title}'. Wrap up your active branch or deliverables."),
            (f"{emoji} Final Polish Required", f"'{task_title}' deadline is in 1 hour. Time to push your final changes.")
        ]
    elif category == "Placement / Internship":
        templates = [
            (f"{emoji} Career Milestone Focus", f"1 hour until '{task_title}'. Bring your best self—stay focused and prepared!"),
            (f"{emoji} Opportunity Countdown", f"'{task_title}' is scheduled in 60 minutes. Review company details, resume, or prep notes."),
            (f"{emoji} High Priority Task", f"Just 1 hour left for '{task_title}'. Don't miss this crucial step in your career prep.")
        ]
    elif category == "Extracurricular":
        templates = [
            (f"{emoji} Activity Starts Soon", f"'{task_title}' is happening in 1 hour. Get ready to show up and participate!"),
            (f"{emoji} Event Countdown", f"Just 60 minutes until '{task_title}'. Gear up!"),
        ]
    elif category == "Personal":
        templates = [
            (f"{emoji} Personal Commitment", f"1 hour left for '{task_title}'. Take a quick break and take care of business."),
            (f"{emoji} Personal Goal Alert", f"Time to check off '{task_title}'—just 60 minutes remaining for today's goal."),
        ]
    else:  # Other / Default
        templates = [
            (f"{emoji} Action Required | 1 Hour Left", f"'{task_title}' is due shortly! Time to lock in."),
            (f"{emoji} Final Stretch!", f"Just 60 minutes remaining for '{task_title}'. Finish strong!"),
            (f"{emoji} Clock is Ticking", f"'{task_title}' deadline is approaching. Check it off your list!")
        ]

    return random.choice(templates)


# ---------------------------------------------------------
# 2. TODAY'S DIGEST MESSAGES
# ---------------------------------------------------------

def get_today_digest_copy(tasks: list[dict], hour: int) -> tuple[str, str]:
    """Generates time-contextual digest grouped or highlighted by high-priority categories."""
    count = len(tasks)
    
    # Format task list with individual category emojis
    formatted_tasks = []
    for t in tasks:
        title = t.get("title", "Untitled Task")
        cat = t.get("category", "Other")
        formatted_tasks.append(f"{_get_emoji(cat)} [{cat}] {title}")
    
    task_list_str = "\n• " + "\n• ".join(formatted_tasks)

    # Check for critical categories to give custom titles
    categories = {t.get("category") for t in tasks}
    has_exam = "Exam / Quiz" in categories
    has_placement = "Placement / Internship" in categories

    if hour < 12:  # Morning Digest
        if has_exam or has_placement:
            title = "🔥 High Stakes Today | Morning Plan"
            body = f"Big day ahead with critical academic/career goals! You have {count} item(s) lined up:\n{task_list_str}\n\nStay composed and lock in!"
        else:
            templates = [
                ("🌅 Good Morning! Today's Action Plan", f"You have {count} critical task(s) queued for today:\n{task_list_str}\n\nStart strong and set the pace!"),
                ("🚀 Morning Focus | Ready for Launch?", f"Here is your agenda today ({count} task(s)):\n{task_list_str}\n\nPick the first one and dive in."),
                ("☕ Daily Kickoff", f"Tackle these {count} item(s) today to build momentum:\n{task_list_str}")
            ]
            return random.choice(templates)

    elif hour < 17:  # Midday Digest
        templates = [
            ("⚡ Midday Momentum Check", f"Halfway through the day! You still have {count} pending task(s):\n{task_list_str}\n\nKeep driving forward."),
            ("🎯 Afternoon Reset", f"Stay sharp! {count} task(s) are waiting for your attention:\n{task_list_str}\n\nCross one off right now."),
            ("📈 Midday Focus Check", f"Don't lose steam. Here is what's left for today:\n{task_list_str}")
        ]
        return random.choice(templates)

    else:  # Evening Digest
        templates = [
            ("🌙 Evening Review | Pending Tasks", f"Clear your mind before calling it a day. {count} task(s) remaining:\n{task_list_str}\n\nFinish up or reschedule!"),
            ("🌆 Wrap Up Strong", f"End the day on a high note. You have {count} pending item(s):\n{task_list_str}"),
            ("🏁 Final Lap for Today", f"Just a few hours left. Can you clear these {count} task(s)?\n{task_list_str}")
        ]
        return random.choice(templates)

    return title, body


# ---------------------------------------------------------
# 3. TOMORROW'S DIGEST MESSAGES
# ---------------------------------------------------------

def get_tomorrow_digest_copy(tasks: list[dict]) -> tuple[str, str]:
    """Generates night-before preparation digest."""
    count = len(tasks)
    
    formatted_tasks = []
    for t in tasks:
        title = t.get("title", "Untitled Task")
        cat = t.get("category", "Other")
        formatted_tasks.append(f"{_get_emoji(cat)} [{cat}] {title}")
    
    task_list_str = "\n• " + "\n• ".join(formatted_tasks)

    templates = [
        (
            "📅 Tomorrow's Head Start",
            f"Planning ahead reduces stress. You have {count} task(s) queued for tomorrow:\n{task_list_str}"
        ),
        (
            "🧠 Prepare Your Mind for Tomorrow",
            f"Here is your agenda for tomorrow ({count} task(s)):\n{task_list_str}\n\nGet rest knowing you're fully prepared."
        ),
        (
            "🌙 Tonight's Prep = Tomorrow's Win",
            f"A quick look at tomorrow ({count} item(s)):\n{task_list_str}\n\nRest up and conquer them tomorrow!"
        )
    ]
    return random.choice(templates)