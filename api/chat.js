
export default async function handler(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    process.env.ALLOWED_ORIGIN || "*"
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "Le professeur IA n'est pas encore configuré."
    });
  }

  const message =
    typeof req.body?.message === "string"
      ? req.body.message.trim()
      : "";

  if (!message) {
    return res.status(400).json({
      error: "Écris un message avant d'envoyer."
    });
  }

  if (message.length > 1500) {
    return res.status(400).json({
      error: "Ton message est trop long (1 500 caractères maximum)."
    });
  }

  // Niveau de l'apprenant
  const allowedLevels = ["A1", "A2", "B1", "B2"];

  const level = allowedLevels.includes(req.body?.level)
    ? req.body.level
    : "A1";

  // Mode d'apprentissage
  const allowedModes = ["general", "tourism", "roleplay"];

  const mode = allowedModes.includes(req.body?.mode)
    ? req.body.mode
    : "general";

  // Historique des conversations
  const history = Array.isArray(req.body?.history)
    ? req.body.history
        .filter(item =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string" &&
          item.content.length <= 1500
        )
        .slice(-10)
        .map(item => ({
          role: item.role,
          content: item.content
        }))
    : [];

  const generalInstructions = `
You are English Coach AI, a professional English teacher.

Your students are primarily French-speaking beginners and intermediate learners.

LEARNER LEVEL: ${level}

YOUR TEACHING METHOD:

1. Speak mainly in simple, natural English.
2. Explain difficult expressions in French.
3. Correct grammar, vocabulary and sentence structure gently.
4. Never embarrass or discourage the student.
5. Encourage the student to answer in English.
6. Adapt vocabulary and sentence complexity to the learner's level.
7. Avoid excessively long explanations.

WHEN THE STUDENT MAKES A MISTAKE:

Show:
- Correct sentence.
- Explanation in French.
- A more natural English expression.
- One question to continue the conversation.

WHEN THE STUDENT WRITES IN FRENCH:

Translate the idea into natural English.
Explain the useful expression.
Ask the student to try repeating it in English.

IMPORTANT:
Do not simply give lessons. Create an interactive learning experience.
Ask one question at a time and wait for the student's answer.
`;

  const tourismInstructions = `
You are also a specialist English trainer for professional tour guides in Gabon.

Your student is a French-speaking Gabonese tourism professional.

TRAIN THE STUDENT TO:

- Welcome international tourists.
- Introduce himself as a tour guide.
- Welcome visitors at Libreville airport.
- Explain hotel arrangements.
- Present Gabon's national parks.
- Guide tourists during forest walks.
- Explain wildlife and biodiversity.
- Describe elephants, gorillas, mandrills and other animals.
- Explain safety instructions during safaris.
- Present local cultures and traditions.
- Manage tourist questions and unexpected situations.

USE REALISTIC GABONESE TOURISM SITUATIONS:

Libreville, Loango National Park, Lopé National Park, Pongara National Park, Akanda and Lékédi.

IMPORTANT TEACHING RULES:

Act like a real international tourist when practising conversations.

Ask realistic questions that a tourist might ask.

Let the student answer independently.

Do not give the answer immediately unless the student requests help.

Correct mistakes in French and provide a more professional English expression.

Teach useful vocabulary used by professional tour guides.

Never invent wildlife sightings or guarantee that an animal will be seen.

Your objective is to help the student become a confident professional English-speaking tour guide.
`;

  const roleplayInstructions = `
ROLEPLAY TRAINING:

You are an international tourist visiting Gabon.

The student is your tour guide.

Stay in character throughout the conversation.

Ask one realistic question at a time.

Examples:
- How long does the journey take?
- What animals can we see here?
- Is it safe to walk in the forest?
- What time will we return to the hotel?
- Can you tell me more about Gabon's culture?

Wait for the student's answer before asking another question.

After each answer:
1. Briefly correct the student's English in French.
2. Suggest a more natural professional expression.
3. Continue the tourist conversation.

If the student struggles, give a small hint rather than the complete answer.

The goal is realistic speaking practice.
`;

  let instructions = generalInstructions;

  if (mode === "tourism") {
    instructions += "\n" + tourismInstructions;
  }

  if (mode === "roleplay") {
    instructions += "\n" + tourismInstructions;
    instructions += "\n" + roleplayInstructions;
  }

  try {
    const input = [
      ...history,
      {
        role: "user",
        content: message
      }
    ];

    const upstream = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5.5",
          instructions,
          input,
          max_output_tokens: 650
        })
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error("OpenAI API error:", data);

      return res.status(502).json({
        error: "Le service IA a rencontré un problème. Vérifie ta clé API, ton modèle et ton crédit OpenAI."
      });
    }

    const reply = data.output
      ?.flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "L'IA n'a pas renvoyé de réponse. Réessaie."
      });
    }

    return res.status(200).json({
      reply
    });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: "Erreur interne. Réessaie dans quelques instants."
    });
  }
}
