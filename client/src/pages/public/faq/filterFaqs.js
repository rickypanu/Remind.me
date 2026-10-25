/** FAQ entries matching the search words (question, answer or any step) and the chosen category. */
export function filterFaqs(faqs, query, category) {
  const q = query.trim().toLowerCase();
  return faqs.filter((faq) => {
    const matchesCategory = category === "All" || faq.category === category;
    if (!matchesCategory) return false;
    if (!q) return true;
    return (
      faq.question.toLowerCase().includes(q) ||
      faq.answer.toLowerCase().includes(q) ||
      (faq.steps || []).some((step) => step.toLowerCase().includes(q))
    );
  });
}

export function countByCategory(faqs, category) {
  return category === "All" ? faqs.length : faqs.filter((faq) => faq.category === category).length;
}
