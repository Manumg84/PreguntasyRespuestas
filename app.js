import { db } from "./storage.js";
import { nanoid } from "nanoid";

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

      if (this.allowCreate && query) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-select-create";
        btn.textContent = 'Crear nuevo?';
        btn.addEventListener("click", e => {
          e.stopPropagation();
          if (typeof this.onCreate === "function") {
            this.onCreate(query);
          }
        });
        this.dropdown.appendChild(btn);
      }
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

/* Main state */

const state = {
  filterCategoryId: "",
  filterTopicId: "",
  filterTypeId: "",
  editingQuestionId: null
};

const pending = {
  categories: [],
  topics: [],
  types: []
};

/* DOM references */

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

/* Filter selects */

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
modalCategorySelect.onCreate = (label) => {
  const name = label.trim();
  if (!name) return;

  const existing =
    db.getCategories().find(c => c.name === name) ||
    pending.categories.find(c => c.name === name);

  const created =
    existing ||
    { id: nanoid(), name };

  if (!existing) {
    pending.categories.push(created);
  }

  modalCategorySelect.setOptions(mapCategoriesToOptions());
  modalCategorySelect.setValue(created.id, created.name);
};

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
modalTopicSelect.onCreate = (label) => {
  const name = label.trim();
  if (!name || !modalState.categoryId) return;

  const existingBase = db
    .getTopics({ categoryId: modalState.categoryId })
    .find(t => t.name === name);
  const existingPending = pending.topics.find(
    t => t.categoryId === modalState.categoryId && t.name === name
  );
  const existing = existingBase || existingPending;

  const created =
    existing ||
    { id: nanoid(), name, categoryId: modalState.categoryId };

  if (!existing) {
    pending.topics.push(created);
  }

  refreshModalTopicOptions();
  modalTopicSelect.setValue(created.id, created.name);
};

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
modalTypeSelect.onCreate = (label) => {
  const name = label.trim();
  if (!name || !modalState.categoryId || !modalState.topicId) return;

  const existingBase = db
    .getQuizTypes({
      categoryId: modalState.categoryId,
      topicId: modalState.topicId
    })
    .find(t => t.name === name);
  const existingPending = pending.types.find(
    t =>
      t.categoryId === modalState.categoryId &&
      t.topicId === modalState.topicId &&
      t.name === name
  );
  const existing = existingBase || existingPending;

  const created =
    existing ||
    {
      id: nanoid(),
      name,
      categoryId: modalState.categoryId,
      topicId: modalState.topicId
    };

  if (!existing) {
    pending.types.push(created);
  }

  refreshModalTypeOptions();
  modalTypeSelect.setValue(created.id, created.name);
};

const modalState = {
  categoryId: "",
  topicId: "",
  typeId: ""
};

/* Helpers */

function mapCategoriesToOptions() {
  const base = db.getCategories();
  const extra = pending.categories;
  return [...base, ...extra].map(c => ({ value: c.id, label: c.name }));
}

function refreshCategoryFilter() {
  const select = filterCategory;
  const current = state.filterCategoryId;
  select.innerHTML = '<option value="">Todas</option>';
  const categories = db.getCategories();
  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
  if (categories.some(c => c.id === current)) {
    select.value = current;
  } else {
    state.filterCategoryId = "";
  }
}

function refreshTopicFilter() {
  const select = filterTopic;
  const current = state.filterTopicId;
  select.innerHTML = '<option value="">Todos</option>';
  const topics = db.getTopics({
    categoryId: state.filterCategoryId || undefined
  });
  topics.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
  if (topics.some(t => t.id === current)) {
    select.value = current;
  } else {
    state.filterTopicId = "";
  }
}

function refreshTypeFilter() {
  const select = filterType;
  const current = state.filterTypeId;
  select.innerHTML = '<option value="">Todos</option>';
  const types = db.getQuizTypes({
    categoryId: state.filterCategoryId || undefined,
    topicId: state.filterTopicId || undefined
  });
  types.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
  if (types.some(t => t.id === current)) {
    select.value = current;
  } else {
    state.filterTypeId = "";
  }
}

function refreshModalCategoryOptions() {
  modalCategorySelect.setOptions(mapCategoriesToOptions());
}

function refreshModalTopicOptions() {
  if (!modalState.categoryId) {
    modalTopicSelect.setOptions([]);
    modalTopicSelect.setValue("", "");
    modalState.topicId = "";
    return;
  }

  const base = db.getTopics({ categoryId: modalState.categoryId });
  const extra = pending.topics.filter(t => t.categoryId === modalState.categoryId);
  const list = [...base, ...extra].map(t => ({
    value: t.id,
    label: t.name
  }));

  modalTopicSelect.setOptions(list);
  if (!list.some(t => t.value === modalState.topicId)) {
    modalTopicSelect.setValue("", "");
    modalState.topicId = "";
  }
}

function refreshModalTypeOptions() {
  if (!modalState.categoryId || !modalState.topicId) {
    modalTypeSelect.setOptions([]);
    modalTypeSelect.setValue("", "");
    modalState.typeId = "";
    return;
  }

  const base = db.getQuizTypes({
    categoryId: modalState.categoryId,
    topicId: modalState.topicId
  });
  const extra = pending.types.filter(
    t =>
      t.categoryId === modalState.categoryId &&
      t.topicId === modalState.topicId
  );
  const list = [...base, ...extra].map(t => ({ value: t.id, label: t.name }));

  modalTypeSelect.setOptions(list);
  if (!list.some(t => t.value === modalState.typeId)) {
    modalTypeSelect.setValue("", "");
    modalState.typeId = "";
  }
}

function updateModalEnableFields() {
  const enabled =
    modalState.categoryId && modalState.topicId && modalState.typeId;
  modalQuestion.disabled = !enabled;
  modalAnswer.disabled = !enabled;
  modalNotes.disabled = !enabled;
}

/* Rendering */

function renderCards() {
  const questions = db.getQuestions({
    categoryId: state.filterCategoryId || undefined,
    topicId: state.filterTopicId || undefined,
    quizTypeId: state.filterTypeId || undefined
  });

  cardsContainer.innerHTML = "";

  if (!questions.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent =
      "Todavía no hay preguntas para estos filtros. Agrega tu primera pregunta para empezar.";
    cardsContainer.appendChild(empty);
    return;
  }

  const categories = db.getCategories();
  const topics = db.getTopics();
  const types = db.getQuizTypes();

  const catById = Object.fromEntries(categories.map(c => [c.id, c]));
  const topicById = Object.fromEntries(topics.map(t => [t.id, t]));
  const typeById = Object.fromEntries(types.map(t => [t.id, t]));

  questions
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(q => {
      const card = document.createElement("article");
      card.className = "card";

      const head = document.createElement("div");
      head.className = "card-head";

      const meta = document.createElement("div");
      meta.className = "card-meta";

      const cat = catById[q.categoryId];
      const topic = topicById[q.topicId];
      const type = typeById[q.quizTypeId];

      const badgeCat = document.createElement("span");
      badgeCat.className = "badge badge-pill";
      badgeCat.textContent = cat ? cat.name : "Sin categoría";

      const badgeTopic = document.createElement("span");
      badgeTopic.className = "badge badge-soft";
      badgeTopic.textContent = topic ? topic.name : "Tema";

      const badgeType = document.createElement("span");
      badgeType.className = "badge badge-outline";
      badgeType.textContent = type ? type.name : "Tipo";

      meta.append(badgeCat, badgeTopic, badgeType);

      const editBtn = document.createElement("button");
      editBtn.className = "card-edit-btn";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", () => openEditModal(q.id));

      head.append(meta, editBtn);

      const controls = document.createElement("div");
      controls.className = "card-controls";

      const likeBtn = document.createElement("button");
      likeBtn.className = "card-like-btn";
      const likeIcon = document.createElement("span");
      likeIcon.className = "card-like-icon";
      likeIcon.textContent = "👍";
      const likeCount = document.createElement("span");
      likeCount.className = "card-like-count";
      likeCount.textContent =
        typeof q.likes === "number" && q.likes >= 0 ? q.likes : 0;
      likeBtn.append(likeIcon, likeCount);
      likeBtn.addEventListener("click", () => {
        const updated = db.incrementLikes(q.id);
        if (updated) {
          likeCount.textContent = updated.likes;
        }
      });

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

/* Modal control */

function openCreateModal() {
  state.editingQuestionId = null;
  modalTitle.textContent = "Nueva pregunta";

  pending.categories = [];
  pending.topics = [];
  pending.types = [];

  modalState.categoryId = "";
  modalState.topicId = "";
  modalState.typeId = "";
  modalQuestion.value = "";
  modalAnswer.value = "";
  modalNotes.value = "";

  refreshModalCategoryOptions();
  modalCategorySelect.setValue("", "");
  modalTopicSelect.setOptions([]);
  modalTypeSelect.setOptions([]);
  updateModalEnableFields();

  modalBackdrop.classList.remove("hidden");
}

function openEditModal(questionId) {
  const snapshot = db.getSnapshot();
  const q = snapshot.questions.find(item => item.id === questionId);
  if (!q) return;

  state.editingQuestionId = q.id;
  modalTitle.textContent = "Editar pregunta";

  pending.categories = [];
  pending.topics = [];
  pending.types = [];

  modalState.categoryId = q.categoryId;
  modalState.topicId = q.topicId;
  modalState.typeId = q.quizTypeId;

  refreshModalCategoryOptions();
  const cat = snapshot.categories.find(c => c.id === q.categoryId);
  modalCategorySelect.setValue(q.categoryId, cat ? cat.name : "");

  refreshModalTopicOptions();
  const topic = snapshot.topics.find(t => t.id === q.topicId);
  modalTopicSelect.setValue(q.topicId, topic ? topic.name : "");

  refreshModalTypeOptions();
  const type = snapshot.quizTypes.find(t => t.id === q.quizTypeId);
  modalTypeSelect.setValue(q.quizTypeId, type ? type.name : "");

  modalQuestion.value = q.question;
  modalAnswer.value = q.answer;
  modalNotes.value = q.notes || "";
  updateModalEnableFields();

  modalBackdrop.classList.remove("hidden");
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
  pending.categories = [];
  pending.topics = [];
  pending.types = [];
}

/* Events */

btnAdd.addEventListener("click", openCreateModal);

modalClose.addEventListener("click", closeModal);

modalBackdrop.addEventListener("click", e => {
  if (e.target === modalBackdrop) closeModal();
});

filterCategory.addEventListener("change", () => {
  state.filterCategoryId = filterCategory.value || "";
  state.filterTopicId = "";
  state.filterTypeId = "";
  filterTopic.value = "";
  filterType.value = "";
  refreshTopicFilter();
  refreshTypeFilter();
  renderCards();
});

filterTopic.addEventListener("change", () => {
  state.filterTopicId = filterTopic.value || "";
  state.filterTypeId = "";
  filterType.value = "";
  refreshTypeFilter();
  renderCards();
});

filterType.addEventListener("change", () => {
  state.filterTypeId = filterType.value || "";
  renderCards();
});

modalSave.addEventListener("click", () => {
  let { categoryId, topicId, typeId } = modalState;
  const question = modalQuestion.value.trim();
  const answer = modalAnswer.value.trim();
  const notes = modalNotes.value.trim();

  if (!categoryId || !topicId || !typeId || !question || !answer) {
    return;
  }

  // Resolver y persistir categorías/temas/tipos pendientes
  const snapshot = db.getSnapshot();

  let cat =
    snapshot.categories.find(c => c.id === categoryId) ||
    pending.categories.find(c => c.id === categoryId);
  if (cat && !snapshot.categories.find(c => c.id === cat.id)) {
    cat = db.ensureCategory(cat.name);
    categoryId = cat.id;
  }

  let topic =
    db.getTopics().find(t => t.id === topicId) ||
    pending.topics.find(t => t.id === topicId);
  if (topic && !db.getTopics().find(t => t.id === topic.id)) {
    topic = db.ensureTopic(topic.name, categoryId);
    topicId = topic.id;
  }

  let quizType =
    db.getQuizTypes().find(t => t.id === typeId) ||
    pending.types.find(t => t.id === typeId);
  if (quizType && !db.getQuizTypes().find(t => t.id === quizType.id)) {
    quizType = db.ensureQuizType(quizType.name, categoryId, topicId);
    typeId = quizType.id;
  }

  if (!categoryId || !topicId || !typeId) {
    return;
  }

  if (state.editingQuestionId) {
    db.updateQuestion(state.editingQuestionId, {
      categoryId,
      topicId,
      quizTypeId: typeId,
      question,
      answer,
      notes
    });
  } else {
    db.addQuestion({
      categoryId,
      topicId,
      quizTypeId: typeId,
      question,
      answer,
      notes
    });
  }

  pending.categories = [];
  pending.topics = [];
  pending.types = [];

  // Refresh filters to capture potential new category / topic / type
  refreshCategoryFilter();
  refreshTopicFilter();
  refreshTypeFilter();
  renderCards();
  closeModal();
});

/* Initial render */

refreshCategoryFilter();
refreshTopicFilter();
refreshTypeFilter();
renderCards();