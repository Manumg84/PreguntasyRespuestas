import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "TU_SUPABASE_URL_AQUI";
const SUPABASE_ANON_KEY = "TU_SUPABASE_ANON_KEY_AQUI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function safeSelect(query) {
  const { data, error } = await query;
  if (error) {
    console.error("Supabase select error:", error);
    return [];
  }
  return data || [];
}

async function safeSingle(query) {
  const { data, error } = await query;
  if (error) {
    console.error("Supabase single error:", error);
    return null;
  }
  return data || null;
}

export const db = {
  async getSnapshot() {
    const [categories, topics, quizTypes, questions] = await Promise.all([
      this.getCategories(),
      this.getTopics(),
      this.getQuizTypes(),
      this.getQuestions()
    ]);

    return {
      categories,
      topics,
      quizTypes,
      questions
    };
  },

  async getCategories() {
    const data = await safeSelect(
      supabase.from("categories").select("*").order("name", {
        ascending: true
      })
    );
    return data;
  },

  async getTopics({ categoryId } = {}) {
    let query = supabase.from("topics").select("*");
    if (categoryId) {
      query = query.eq("categoryId", categoryId);
    }
    const data = await safeSelect(
      query.order("name", { ascending: true })
    );
    return data;
  },

  async getQuizTypes({ categoryId, topicId } = {}) {
    let query = supabase.from("quiz_types").select("*");
    if (categoryId) {
      query = query.eq("categoryId", categoryId);
    }
    if (topicId) {
      query = query.eq("topicId", topicId);
    }
    const data = await safeSelect(
      query.order("name", { ascending: true })
    );
    return data;
  },

  async getQuestions(filters = {}) {
    const { categoryId, topicId, quizTypeId } = filters;
    let query = supabase.from("questions").select("*");
    if (categoryId) query = query.eq("categoryId", categoryId);
    if (topicId) query = query.eq("topicId", topicId);
    if (quizTypeId) query = query.eq("quizTypeId", quizTypeId);
    const { data, error } = await query;
    if (error) {
      console.error("Supabase getQuestions error:", error);
      return [];
    }
    return (data || []).map(q => ({
      ...q,
      notes: typeof q.notes === "string" ? q.notes : "",
      likes: typeof q.likes === "number" ? q.likes : 0
    }));
  },

  async ensureCategory(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const existing = await safeSingle(
      supabase
        .from("categories")
        .select("*")
        .eq("name", trimmed)
        .maybeSingle()
    );
    if (existing) return existing;

    const insert = {
      id: nanoid(),
      name: trimmed
    };

    const { data, error } = await supabase
      .from("categories")
      .insert(insert)
      .select()
      .single();

    if (error) {
      console.error("Supabase ensureCategory insert error:", error);
      return null;
    }

    return data;
  },

  async ensureTopic(name, categoryId) {
    const trimmed = name.trim();
    if (!trimmed || !categoryId) return null;

    const existing = await safeSingle(
      supabase
        .from("topics")
        .select("*")
        .eq("categoryId", categoryId)
        .eq("name", trimmed)
        .maybeSingle()
    );
    if (existing) return existing;

    const insert = {
      id: nanoid(),
      name: trimmed,
      categoryId
    };

    const { data, error } = await supabase
      .from("topics")
      .insert(insert)
      .select()
      .single();

    if (error) {
      console.error("Supabase ensureTopic insert error:", error);
      return null;
    }

    return data;
  },

  async ensureQuizType(name, categoryId, topicId) {
    const trimmed = name.trim();
    if (!trimmed || !categoryId || !topicId) return null;

    const existing = await safeSingle(
      supabase
        .from("quiz_types")
        .select("*")
        .eq("categoryId", categoryId)
        .eq("topicId", topicId)
        .eq("name", trimmed)
        .maybeSingle()
    );
    if (existing) return existing;

    const insert = {
      id: nanoid(),
      name: trimmed,
      categoryId,
      topicId
    };

    const { data, error } = await supabase
      .from("quiz_types")
      .insert(insert)
      .select()
      .single();

    if (error) {
      console.error("Supabase ensureQuizType insert error:", error);
      return null;
    }

    return data;
  },

  async addQuestion({ categoryId, topicId, quizTypeId, question, answer, notes }) {
    const insert = {
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

    const { data, error } = await supabase
      .from("questions")
      .insert(insert)
      .select()
      .single();

    if (error) {
      console.error("Supabase addQuestion error:", error);
      return null;
    }

    return data;
  },

  async updateQuestion(id, patch) {
    const payload = { ...patch };
    if (typeof payload.question === "string") {
      payload.question = payload.question.trim();
    }
    if (typeof payload.answer === "string") {
      payload.answer = payload.answer.trim();
    }
    if (typeof payload.notes === "string") {
      payload.notes = payload.notes.trim();
    }

    const { data, error } = await supabase
      .from("questions")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase updateQuestion error:", error);
      return null;
    }

    return data;
  },

  async incrementLikes(id) {
    const current = await safeSingle(
      supabase
        .from("questions")
        .select("id, likes")
        .eq("id", id)
        .maybeSingle()
    );
    if (!current) return null;

    const likes = typeof current.likes === "number" ? current.likes + 1 : 1;

    const { data, error } = await supabase
      .from("questions")
      .update({ likes })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase incrementLikes error:", error);
      return null;
    }

    return data;
  }
};