<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script>
// ================================================
// SUPABASE CONFIGURACIÓN (NO TOQUES ESTO)
// ================================================
const supabaseUrl = 'https://tgfwwnxisohfcbogobza.supabase.co';
const supabaseKey = 'sb_publishable_Mb1vjkL9YvoELvazo4IIdA_8ulD0gsR';

const supabase = Supabase.createClient(supabaseUrl, supabaseKey);
// ================================================

/**
 * Minimal combinable, searchable select
 */
class FilterSelect {
  constructor(root, { placeholder, allowCreate, onChange }) {
    this.root = root;
    this.placeholder = placeholder || "";
    this.allowCreate = !!allowCreate;
    this.onChange = onChange;
    this.options = [];
    this.value = "";
    this.label = "";
    this.isOpen = false;
    this._build();
  }
  _build() {
    this.root.innerHTML = "";
    this.root.classList.add("filter-select");
    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.className = "filter-select-input";
    this.input.placeholder = this.placeholder;
    this.clearBtn = document.createElement("button");
    this.clearBtn.type = "button";
    this.clearBtn.className = "filter-select-clear";
    this.clearBtn.textContent = "×";
    this.arrow = document.createElement("span");
    this.arrow.className = "filter-select-arrow";
    this.arrow.textContent = "▾";
    this.dropdown = document.createElement("div");
    this.dropdown.className = "filter-select-dropdown";
    this.dropdown.style.display = "none";
    this.root.append(this.input, this.clearBtn, this.arrow, this.dropdown);
    this.input.addEventListener("focus", () => {
      this.open();
      this._renderList();
    });
    this.input.addEventListener("input", () => {
      this.open();
      this._renderList();
    });
    this.input.addEventListener("click", e => {
      e.stopPropagation();
      this.toggle();
    });
    this.clearBtn.addEventListener("click", e => {
      e.stopPropagation();
      this.setValue("");
    });
    document.addEventListener("click", e => {
      if (!this.root.contains(e.target)) this.close();
    });
  }
  setOptions(options) {
    this.options = options || [];
    this._renderList();
  }
  setValue(value, label) {
    this.value = value || "";
    this.label = label || "";
    if (this.value && !this.label) {
      const found = this.options.find(o => o.value === this.value);
      this.label = found ? found.label : "";
    }
    this.input.value = this.label || "";
    if (!this.value) this.input.value = "";
    this.close();
    if (typeof this.onChange === "function") {
      this.onChange(this.value || "", this.label || "");
    }
  }
  open() {
    this.isOpen = true;
    this.dropdown.style.display = "block";
    this._renderList();
  }
  close() {
    this.isOpen = false;
    this.dropdown.style.display = "none";
  }
  toggle() {
    this.isOpen ? this.close() : this.open();
  }
  _renderList() {
    const query = this.input.value.trim().toLowerCase();
    const items = !query
      ? this.options
      : this.options.filter(o => o.label.toLowerCase().includes(query));
    this.dropdown.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "filter-select-empty";
      empty.textContent = "Sin coincidencias";
      this.dropdown.appendChild(empty);
      return;
    }
    items.forEach(opt => {
      const div = document.createElement("div");
      div.className = "filter-select-option";
      div.textContent = opt.label;
      div.addEventListener("click", e => {
        e.stopPropagation();
        this.setValue(opt.value, opt.label);
      });
      this.dropdown.appendChild(div);
    });
  }
}

/* ==================== MAIN STATE ==================== */
const state = {
  filterCategoryId: "",
  filterTopicId: "",
  filterTypeId: "",
  editingQuestionId: null
};

const modalState = {
  categoryId: "",
  topicId: "",
  typeId: ""
};

/* ==================== DOM REFERENCES ==================== */
const cardsContainer = document.getElementById("cards-container");
const btnAdd = document.getElementById("btn-add");
const filterCategory = document.getElementById("filter-category");
const filterTopic = document.getElementById("filter-topic");
const filterType = document.getElementById("filter-type");
const modalBackdrop = document.getElementById("modal-backdrop");
const modalTitle = document.getElementById("modal-title");
const modalClose = document.getElementById("modal-close");
const modalQuestion = document.getElementById("modal-question");
const modalAnswer = document.getElementById("modal-answer");
const modalNotes = document.getElementById("modal-notes");
const modalSave = document.getElementById("modal-save");

/* ==================== FILTER SELECTS ==================== */
const modalCategorySelect = new FilterSelect(
  document.getElementById("modal-category"),
  {
    placeholder: "Selecciona o escribe...",
    allowCreate: true,
    onChange: (id) => {
      modalState.categoryId = id || "";
      refreshModalTopicOptions();
      refreshModalTypeOptions();
      updateModalEnableFields();
    }
  }
);

const modalTopicSelect = new FilterSelect(
  document.getElementById("modal-topic"),
  {
    placeholder: "Selecciona o escribe...",
    allowCreate: true,
    onChange: (id) => {
      modalState.topicId = id || "";
      refreshModalTypeOptions();
      updateModalEnableFields();
    }
  }
);

const modalTypeSelect = new FilterSelect(
  document.getElementById("modal-type"),
  {
    placeholder: "Selecciona o escribe...",
    allowCreate: true,
    onChange: (id) => {
      modalState.typeId = id || "";
      updateModalEnableFields();
    }
  }
);

/* ==================== CREACIÓN AUTOMÁTICA (onCreate) ==================== */
modalCategorySelect.onCreate = async (label) => {
  const name = label.trim();
  if (!name) return;
  const { data, error } = await supabase
    .from('categories')
    .insert({ name })
    .select('id, name')
    .single();
  if (error) { console.error(error); return; }
  modalCategorySelect.setValue(data.id, data.name);
  await refreshModalCategoryOptions();
};

modalTopicSelect.onCreate = async (label) => {
  const name = label.trim();
  if (!name || !modalState.categoryId) return;
  const { data, error } = await supabase
    .from('topics')
    .insert({ name, category_id: modalState.categoryId })
    .select('id, name')
    .single();
  if (error) { console.error(error); return; }
  modalTopicSelect.setValue(data.id, data.name);
  await refreshModalTopicOptions();
};

modalTypeSelect.onCreate = async (label) => {
  const name = label.trim();
  if (!name || !modalState.categoryId || !modalState.topicId) return;
  const { data, error } = await supabase
    .from('quiz_types')
    .insert({ name, category_id: modalState.categoryId, topic_id: modalState.topicId })
    .select('id, name')
    .single();
  if (error) { console.error(error); return; }
  modalTypeSelect.setValue(data.id, data.name);
  await refreshModalTypeOptions();
};

/* ==================== HELPERS ASYNC ==================== */
async function mapCategoriesToOptions() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .order('name');
  if (error) { console.error(error); return []; }
  return data.map(c => ({ value: c.id, label: c.name }));
}

async function getTopicsForCategory(categoryId) {
  if (!categoryId) return [];
  const { data } = await supabase
    .from('topics')
    .select('id, name')
    .eq('category_id', categoryId)
    .order('name');
  return data.map(t => ({ value: t.id, label: t.name }));
}

async function getQuizTypesForCategoryTopic(categoryId, topicId) {
  if (!categoryId || !topicId) return [];
  const { data } = await supabase
    .from('quiz_types')
    .select('id, name')
    .eq('category_id', categoryId)
    .eq('topic_id', topicId)
    .order('name');
  return data.map(t => ({ value: t.id, label: t.name }));
}

async function refreshCategoryFilter() {
  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .order('name');

  filterCategory.innerHTML = '<option value="">Todas</option>';
  data?.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    filterCategory.appendChild(opt);
  });

  if (data?.some(c => c.id === state.filterCategoryId)) {
    filterCategory.value = state.filterCategoryId;
  } else {
    state.filterCategoryId = "";
  }
}

async function refreshTopicFilter() {
  const { data } = await supabase
    .from('topics')
    .select('id, name')
    .eq('category_id', state.filterCategoryId || '')
    .order('name');

  filterTopic.innerHTML = '<option value="">Todos</option>';
  data?.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    filterTopic.appendChild(opt);
  });

  if (data?.some(t => t.id === state.filterTopicId)) {
    filterTopic.value = state.filterTopicId;
  } else {
    state.filterTopicId = "";
  }
}

async function refreshTypeFilter() {
  const { data } = await supabase
    .from('quiz_types')
    .select('id, name')
    .eq('category_id', state.filterCategoryId || '')
    .eq('topic_id', state.filterTopicId || '')
    .order('name');

  filterType.innerHTML = '<option value="">Todos</option>';
  data?.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    filterType.appendChild(opt);
  });

  if (data?.some(t => t.id === state.filterTypeId)) {
    filterType.value = state.filterTypeId;
  } else {
    state.filterTypeId = "";
  }
}

async function refreshModalCategoryOptions() {
  const options = await mapCategoriesToOptions();
  modalCategorySelect.setOptions(options);
}

async function refreshModalTopicOptions() {
  if (!modalState.categoryId) {
    modalTopicSelect.setOptions([]);
    modalTopicSelect.setValue("", "");
    modalState.topicId = "";
    return;
  }
  const options = await getTopicsForCategory(modalState.categoryId);
  modalTopicSelect.setOptions(options);
  if (!options.some(t => t.value === modalState.topicId)) {
    modalTopicSelect.setValue("", "");
    modalState.topicId = "";
  }
}

async function refreshModalTypeOptions() {
  if (!modalState.categoryId || !modalState.topicId) {
    modalTypeSelect.setOptions([]);
    modalTypeSelect.setValue("", "");
    modalState.typeId = "";
    return;
  }
  const options = await getQuizTypesForCategoryTopic(modalState.categoryId, modalState.topicId);
  modalTypeSelect.setOptions(options);
  if (!options.some(t => t.value === modalState.typeId)) {
    modalTypeSelect.setValue("", "");
    modalState.typeId = "";
  }
}

function updateModalEnableFields() {
  const enabled = modalState.categoryId && modalState.topicId && modalState.typeId;
  modalQuestion.disabled = !enabled;
  modalAnswer.disabled = !enabled;
  modalNotes.disabled = !enabled;
}

/* ==================== RENDER CARDS (ASYNC) ==================== */
async function renderCards() {
  let query = supabase
    .from('questions')
    .select(`
      id,
      question,
      answer,
      notes,
      likes,
      created_at,
      categories (name),
      topics (name),
      quiz_types (name)
    `)
    .order('created_at', { ascending: false });

  if (state.filterCategoryId) query = query.eq('category_id', state.filterCategoryId);
  if (state.filterTopicId)     query = query.eq('topic_id', state.filterTopicId);
  if (state.filterTypeId)      query = query.eq('quiz_type_id', state.filterTypeId);

  const { data: questions, error } = await query;

  if (error) {
    console.error("Error cargando preguntas:", error);
    cardsContainer.innerHTML = "<p style='color:red'>Error al cargar las preguntas</p>";
    return;
  }

  cardsContainer.innerHTML = "";

  if (!questions || questions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Todavía no hay preguntas para estos filtros. Agrega tu primera pregunta para empezar.";
    cardsContainer.appendChild(empty);
    return;
  }

  questions.forEach(q => {
    const card = document.createElement("article");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "card-head";

    const meta = document.createElement("div");
    meta.className = "card-meta";

    const badgeCat = document.createElement("span");
    badgeCat.className = "badge badge-pill";
    badgeCat.textContent = q.categories?.name || "Sin categoría";

    const badgeTopic = document.createElement("span");
    badgeTopic.className = "badge badge-soft";
    badgeTopic.textContent = q.topics?.name || "Tema";

    const badgeType = document.createElement("span");
    badgeType.className = "badge badge-outline";
    badgeType.textContent = q.quiz_types?.name || "Tipo";

    meta.append(badgeCat, badgeTopic, badgeType);

    const controls = document.createElement("div");
    controls.className = "card-controls";

    const likeBtn = document.createElement("button");
    likeBtn.className = "card-like-btn";
    const likeIcon = document.createElement("span");
    likeIcon.className = "card-like-icon";
    likeIcon.textContent = "👍";
    const likeCount = document.createElement("span");
    likeCount.className = "card-like-count";
    likeCount.textContent = q.likes || 0;

    likeBtn.append(likeIcon, likeCount);
    likeBtn.addEventListener("click", async () => {
      const newCount = await incrementQuestionLikes(q.id);
      if (newCount !== undefined) likeCount.textContent = newCount;
    });

    const editBtn = document.createElement("button");
    editBtn.className = "card-edit-btn";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", () => openEditModal(q.id));

    controls.append(likeBtn, editBtn);
    head.append(meta, controls);

    const body = document.createElement("div");
    body.className = "card-body";

    const qEl = document.createElement("div");
    qEl.className = "card-question";
    qEl.textContent = q.question;

    const answerLabel = document.createElement("div");
    answerLabel.className = "card-answer-label";
    answerLabel.textContent = "Respuesta";

    const aEl = document.createElement("div");
    aEl.className = "card-answer";
    aEl.textContent = q.answer;

    body.append(qEl, answerLabel, aEl);

    if (q.notes && q.notes.trim()) {
      const notesLabel = document.createElement("div");
      notesLabel.className = "card-answer-label";
      notesLabel.textContent = "Observaciones";
      const notesEl = document.createElement("div");
      notesEl.className = "card-answer";
      notesEl.textContent = q.notes;
      body.append(notesLabel, notesEl);
    }

    card.append(head, body);
    cardsContainer.appendChild(card);
  });
}

/* ==================== INCREMENT LIKES ==================== */
async function incrementQuestionLikes(questionId) {
  const { data: current } = await supabase
    .from('questions')
    .select('likes')
    .eq('id', questionId)
    .single();

  const newLikes = (current?.likes || 0) + 1;

  const { error } = await supabase
    .from('questions')
    .update({ likes: newLikes })
    .eq('id', questionId);

  if (!error) return newLikes;
}

/* ==================== MODAL FUNCTIONS ==================== */
async function openCreateModal() {
  state.editingQuestionId = null;
  modalTitle.textContent = "Nueva pregunta";
  modalState.categoryId = "";
  modalState.topicId = "";
  modalState.typeId = "";
  modalQuestion.value = "";
  modalAnswer.value = "";
  modalNotes.value = "";
  await refreshModalCategoryOptions();
  modalCategorySelect.setValue("", "");
  modalTopicSelect.setOptions([]);
  modalTypeSelect.setOptions([]);
  updateModalEnableFields();
  modalBackdrop.classList.remove("hidden");
}

async function openEditModal(questionId) {
  const { data: q, error } = await supabase
    .from('questions')
    .select(`
      id,
      category_id,
      topic_id,
      quiz_type_id,
      question,
      answer,
      notes,
      categories (name),
      topics (name),
      quiz_types (name)
    `)
    .eq('id', questionId)
    .single();

  if (error || !q) return;

  state.editingQuestionId = q.id;
  modalTitle.textContent = "Editar pregunta";

  modalState.categoryId = q.category_id;
  modalState.topicId = q.topic_id;
  modalState.typeId = q.quiz_type_id;

  await refreshModalCategoryOptions();
  modalCategorySelect.setValue(q.category_id, q.categories?.name || "");

  await refreshModalTopicOptions();
  modalTopicSelect.setValue(q.topic_id, q.topics?.name || "");

  await refreshModalTypeOptions();
  modalTypeSelect.setValue(q.quiz_type_id, q.quiz_types?.name || "");

  modalQuestion.value = q.question;
  modalAnswer.value = q.answer;
  modalNotes.value = q.notes || "";

  updateModalEnableFields();
  modalBackdrop.classList.remove("hidden");
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
}

/* ==================== EVENTS ==================== */
btnAdd.addEventListener("click", openCreateModal);

modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", e => {
  if (e.target === modalBackdrop) closeModal();
});

filterCategory.addEventListener("change", async () => {
  state.filterCategoryId = filterCategory.value || "";
  state.filterTopicId = "";
  state.filterTypeId = "";
  filterTopic.value = "";
  filterType.value = "";
  await refreshTopicFilter();
  await refreshTypeFilter();
  await renderCards();
});

filterTopic.addEventListener("change", async () => {
  state.filterTopicId = filterTopic.value || "";
  state.filterTypeId = "";
  filterType.value = "";
  await refreshTypeFilter();
  await renderCards();
});

filterType.addEventListener("change", async () => {
  state.filterTypeId = filterType.value || "";
  await renderCards();
});

modalSave.addEventListener("click", async () => {
  const { categoryId, topicId, typeId } = modalState;
  const questionText = modalQuestion.value.trim();
  const answer = modalAnswer.value.trim();
  const notes = modalNotes.value.trim();

  if (!categoryId || !topicId || !typeId || !questionText || !answer) {
    alert("Faltan campos obligatorios");
    return;
  }

  const payload = {
    category_id: categoryId,
    topic_id: topicId,
    quiz_type_id: typeId,
    question: questionText,
    answer: answer,
    notes: notes || null,
    likes: 0
  };

  let error;
  if (state.editingQuestionId) {
    ({ error } = await supabase
      .from('questions')
      .update(payload)
      .eq('id', state.editingQuestionId));
  } else {
    ({ error } = await supabase
      .from('questions')
      .insert(payload));
  }

  if (error) {
    console.error(error);
    alert("Error al guardar: " + error.message);
    return;
  }

  await refreshCategoryFilter();
  await refreshTopicFilter();
  await refreshTypeFilter();
  await renderCards();
  closeModal();
});

/* ==================== INITIAL RENDER ==================== */
(async () => {
  await refreshCategoryFilter();
  await refreshTopicFilter();
  await refreshTypeFilter();
  await renderCards();
})();
</script>
