/**
 * EXAMPLE DATA ONLY.
 *
 * Placeholder content shown until Member 3's assistant (POST /api/extract)
 * is connected. Nothing here is a real claim or a backend response, and every
 * place that renders it shows an "Example" tag.
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
  /** What the assistant would extract. The date is "yesterday" relative to today. */
  extracted: {
    category: "client_entertainment",
    amount: "2400",
    daysAgo: 1,
    description: "Client dinner",
    has_receipt: true,
  },
} as const;
