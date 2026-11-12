/**
 * EXAMPLE DATA ONLY.
 *
 * Placeholder content for designing the UI before the backend contract is
 * agreed with Member 2. Nothing here is a real claim, policy rule or backend
 * response, and every place that renders it shows an "Example data" tag.
 * Replace with real API data once the contract is agreed.
 */

export const examplePrompts = [
  { icon: "meal", text: "₹2,400 client dinner yesterday" },
  { icon: "flight", text: "₹8,500 flight to Mumbai for a client summit" },
  { icon: "cab", text: "₹650 cab to the regional office" },
] as const;

export const exampleConversation = {
  userMessage: "I spent ₹2,400 on a client dinner yesterday, submit it.",
  assistantMessage:
    "Here's what I understood. Check the details, correct anything that's wrong, then confirm to submit.",
  extracted: {
    amount: 2400,
    expenseDate: "2026-11-11",
    description: "Client dinner",
    category: "Meals & Entertainment",
  },
};

export const exampleRecentClaims = [
  { id: "example-1", title: "Cab to Kempegowda Airport", expenseDate: "2026-11-03", amount: 820, status: "Submitted", tone: "accent" },
  { id: "example-2", title: "Team lunch with client", expenseDate: "2026-10-28", amount: 4100, status: "Flagged", tone: "warning" },
  { id: "example-3", title: "Cloud certification exam", expenseDate: "2026-10-20", amount: 6400, status: "Submitted", tone: "accent" },
] as const;

export const examplePolicyHighlights = [
  "Meals & Entertainment: up to ₹3,500 per claim",
  "Travel: economy domestic flights",
  "Expenses older than 60 days can't be submitted",
] as const;
