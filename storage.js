import { nanoid } from "nanoid";

const STORAGE_KEY = "examQuestionBank_v1";

const defaultData = {
  categories: [],
  topics: [],
  quizTypes: [],
  questions: []
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);
    return {
      categories: parsed.categories || [],
      topics: parsed.topics || [],
      quizTypes: parsed.quizTypes || [],
      questions: (parsed.questions || []).map(q => ({
        ...q,
        notes: typeof q.notes === "string" ? q.notes : "",
        likes: typeof q.likes === "number" ? q.likes : 0
      }))
    };
  } catch {
    return structuredClone(defaultData);
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const db = {
  _data: load(),

  getSnapshot() {
    return structuredClone(this._data);
  },

  getCategories() {
    return [...this._data.categories].sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );
  },

  getTopics({ categoryId } = {}) {
    let list = this._data.topics;
    if (categoryId) list = list.filter(t => t.categoryId === categoryId);
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );
  },

  getQuizTypes({ categoryId, topicId } = {}) {
    let list = this._data.quizTypes;
    if (categoryId) list = list.filter(t => t.categoryId === categoryId);
    if (topicId) list = list.filter(t => t.topicId === topicId);
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );
  },

  getQuestions(filters = {}) {
    const { categoryId, topicId, quizTypeId } = filters;
    return this._data.questions.filter(q => {
      if (categoryId && q.categoryId !== categoryId) return false;
      if (topicId && q.topicId !== topicId) return false;
      if (quizTypeId && q.quizTypeId !== quizTypeId) return false;
      return true;
    });
  },

  ensureCategory(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = this._data.categories.find(
      c => c.name === trimmed
    );
    if (existing) return existing;
    const cat = { id: nanoid(), name: trimmed };
    this._data.categories.push(cat);
    save(this._data);
    return cat;
  },

  ensureTopic(name, categoryId) {
    const trimmed = name.trim();
    if (!trimmed || !categoryId) return null;
    const existing = this._data.topics.find(
      t =>
        t.categoryId === categoryId &&
        t.name === trimmed
    );
    if (existing) return existing;
    const topic = { id: nanoid(), name: trimmed, categoryId };
    this._data.topics.push(topic);
    save(this._data);
    return topic;
  },

  ensureQuizType(name, categoryId, topicId) {
    const trimmed = name.trim();
    if (!trimmed || !categoryId || !topicId) return null;
    const existing = this._data.quizTypes.find(
      t =>
        t.categoryId === categoryId &&
        t.topicId === topicId &&
        t.name === trimmed
    );
    if (existing) return existing;
    const type = { id: nanoid(), name: trimmed, categoryId, topicId };
    this._data.quizTypes.push(type);
    save(this._data);
    return type;
  },

  addQuestion({ categoryId, topicId, quizTypeId, question, answer, notes }) {
    const q = {
      id: nanoid(),
      categoryId,
      topicId,
      quizTypeId,
      question: question.trim(),
      answer: answer.trim(),
      notes: (notes || "").trim(),
      likes: 0,
      createdAt: Date.now()
    };
    this._data.questions.push(q);
    save(this._data);
    return q;
  },

  updateQuestion(id, patch) {
    const idx = this._data.questions.findIndex(q => q.id === id);
    if (idx === -1) return null;
    this._data.questions[idx] = { ...this._data.questions[idx], ...patch };
    save(this._data);
    return this._data.questions[idx];
  },

  incrementLikes(id) {
    const idx = this._data.questions.findIndex(q => q.id === id);
    if (idx === -1) return null;
    const current = this._data.questions[idx];
    const likes = typeof current.likes === "number" ? current.likes : 0;
    this._data.questions[idx] = { ...current, likes: likes + 1 };
    save(this._data);
    return this._data.questions[idx];
  }
};
