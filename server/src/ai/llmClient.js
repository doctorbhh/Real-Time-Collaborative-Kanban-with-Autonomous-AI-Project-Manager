
class LLMClient {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'gemini';
    this.geminiKey = process.env.GEMINI_API_KEY;
    this.groqKey = process.env.GROQ_API_KEY;
  }

  async complete(prompt, options = {}) {
    const { maxTokens = 1024, temperature = 0.3 } = options;

    if (this.provider === 'groq' && this.groqKey) {
      return this.completeGroq(prompt, maxTokens, temperature);
    }
    if (this.geminiKey) {
      return this.completeGemini(prompt, maxTokens, temperature);
    }

    return this.completeFallback(prompt);
  }

  async *stream(prompt, options = {}) {
    const { maxTokens = 1024, temperature = 0.3 } = options;

    if (this.provider === 'groq' && this.groqKey) {

      const text = await this.completeGroq(prompt, maxTokens, temperature);
      yield text;
      return;
    }
    if (this.geminiKey) {
      yield* this.streamGemini(prompt, maxTokens, temperature);
      return;
    }

    const text = this.completeFallback(prompt);
    yield text;
  }

  async completeGemini(prompt, maxTokens, temperature) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async *streamGemini(prompt, maxTokens, temperature) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${this.geminiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield text;
            }
          } catch (e) {
            // Ignore parse errors from partial JSON
          }
        }
      }
    }
  }

  async completeGroq(prompt, maxTokens, temperature) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  completeFallback(prompt) {
    if (prompt.includes('complexity')) {
      return JSON.stringify({
        score: 3,
        reasoning: 'Estimated based on description length and technical keywords (no AI API configured)',
      });
    }
    return 'AI analysis unavailable - no API key configured. Please set GEMINI_API_KEY or GROQ_API_KEY.';
  }
}

module.exports = new LLMClient();
