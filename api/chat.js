export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Le professeur IA n'est pas encore configuré. L'administrateur doit ajouter OPENAI_API_KEY dans les variables d'environnement." });

  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "Écris un message avant d'envoyer." });
  if (message.length > 1500) return res.status(400).json({ error: "Ton message est trop long (1 500 caractères maximum)." });

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.5",
        instructions: `You are English Coach AI, a patient English teacher for French-speaking learners in Africa.
Always respond primarily in simple English, then provide a short explanation in French.
Correct the user's English gently. When there are mistakes, show:
1) Correct version
2) Brief explanation in French
3) One natural alternative
4) One short follow-up question in English to keep the conversation going.
Adapt to beginner A1 unless the learner shows a higher level. Use practical situations such as travel, tourism, hotels, restaurants, work and everyday life. Never shame the learner. Keep replies concise and educational. If the user writes in French, translate their idea into natural English and invite them to repeat it.`,
        input: message,
        max_output_tokens: 450
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      console.error("OpenAI API error:", data);
      return res.status(502).json({ error: "Le service IA a rencontré un problème. Vérifie la clé API, le modèle et le crédit de ton compte OpenAI." });
    }
    const reply = data.output?.flatMap(item => item.content || []).filter(c => c.type === "output_text").map(c => c.text).join("\n").trim();
    if (!reply) return res.status(502).json({ error: "L'IA n'a pas renvoyé de réponse. Réessaie." });
    return res.status(200).json({ reply });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur interne. Réessaie dans quelques instants." });
  }
}
