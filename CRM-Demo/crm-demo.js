const supabaseClient = window.supabase?.createClient
  ? window.supabase.createClient(
    "https://aoqbebytxnwlhpisgobk.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvcWJlYnl0eG53bGhwaXNnb2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDA0NzcsImV4cCI6MjA5MzAxNjQ3N30.Tiz0BhJnvvq4_0w8ZbH_7I0dVhmDC8B7UKEz35r_1VQ",
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  )
  : null;

document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();

  if (!supabaseClient) {
    document.body.classList.remove("auth-loading");
    document.getElementById("authScreen")?.classList.add("is-visible");
    const authErrorMessage = document.getElementById("authError");
    if (authErrorMessage) authErrorMessage.textContent = "Supabase could not load. Check your connection and refresh.";
    const previewButton = document.getElementById("localPreviewBtn");
    if (previewButton) previewButton.hidden = false;
    return;
  }

  const demoShell = document.querySelector(".demo-shell");
  const sidebarCollapseBtn = document.getElementById("sidebarCollapseBtn");

  sidebarCollapseBtn?.addEventListener("click", () => {
    const isCollapsed = demoShell?.classList.toggle("sidebar-collapsed");
    sidebarCollapseBtn.setAttribute(
      "aria-label",
      isCollapsed ? "Expand sidebar" : "Collapse sidebar"
    );
    sidebarCollapseBtn.setAttribute("aria-expanded", String(!isCollapsed));
  });

  let allProjects = [];
  let selectedProjectPageId = null;
  let draggedCard = null;
  let isCreatingProject = false;
  let currentSession = null;
  let hasLoadedProjects = false;
  let allClients = [];
  let selectedClientId = null;
  let hasLoadedClients = false;
  let allTasks = [];
  let selectedTaskId = null;
  let hasLoadedTaskPage = false;
  let allActivities = [];
  let hasLoadedActivities = false;
  let allNotes = [];
  let hasLoadedNotes = false;
  let allAttachments = [];
  let hasLoadedAttachments = false;
  let isLocalPreviewMode = false;
  const attachmentBucket = "crm-attachments";

  const pipelineStages = ["new", "discovery", "proposal", "build", "launch"];

  function formatMoney(value) {
    return "$" + Number(value || 0).toLocaleString();
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value = "") {
    return String(value).trim().toLowerCase();
  }

  function formatTimestamp(value) {
    if (!value) return "";
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function noteTypeLabel(type = "update") {
    const labels = {
      internal: "Internal",
      "follow-up": "Follow-Up",
      meeting: "Meeting",
      update: "Update",
      issue: "Issue",
      completed: "Completed"
    };

    return labels[type] || type;
  }

  function updatePipelineTotalsFromData(projects) {
    const totals = {
      new: 0,
      discovery: 0,
      proposal: 0,
      build: 0,
      launch: 0
    };

    projects.forEach(project => {
      const amount = Number(project.value || project.quote_value || 0);
      if (totals[project.stage] !== undefined) {
        totals[project.stage] += amount;
      }
    });

    Object.entries(totals).forEach(([stage, total]) => {
      const totalEl = document.querySelector(`#stage-${stage} .stage-header span`);
      if (totalEl) totalEl.textContent = formatMoney(total);
    });
  }

  async function loadProjects() {
    if (!currentSession) return;

    const { data, error } = await supabaseClient
      .from("projects")
      .select("*");

    if (error) {
      console.error("Load projects failed:", error);
      return;
    }

    allProjects = data || [];
    renderProjects(allProjects);
    renderAllProjects(allProjects);
    renderProjectPage();
    renderReports();
    renderDashboard();
    populateTaskProjectOptions();
  }

  function renderProjects(projects) {
    const pipelineProjects = projects.filter(project =>
      pipelineStages.includes(project.stage)
    );

    updatePipelineTotalsFromData(pipelineProjects);

    document.querySelectorAll(".pipeline-column").forEach(col => {
      col.querySelectorAll(".deal-card").forEach(card => card.remove());
    });

    pipelineProjects.forEach(project => {
      const column = document.querySelector(`#stage-${project.stage}`);
      if (!column) return;

      const card = document.createElement("article");
      card.className = `deal-card stage-${project.stage} ${projectCueClass(project)}`;
      card.setAttribute("draggable", true);
      card.dataset.value = project.value || project.quote_value || 0;
      card.dataset.id = project.id;

      card.innerHTML = `
<div class="deal-top">
  <div class="deal-title">
    <span 
  class="priority-dot priority-${project.priority || "normal"}" 
  title="${(project.priority || "normal").toUpperCase()} priority"
></span>
    <strong>${project.project_name || "Untitled Project"}</strong>
  </div>

  ${projectStatusBadge(project)}
</div>
        <p>${project.client_name || "No client"}</p>
        <div class="deal-meta">
          <span>${formatMoney(project.value || project.quote_value)}</span>
          <span>${project.estimated_completion_date || ""}</span>
        </div>
        <div class="deal-progress">
          <span style="width:${project.progress || 5}%"></span>
        </div>
      `;

      column.appendChild(card);
    });
  }

  function renderAllProjects(projects) {
    const list = document.getElementById("allProjectsList");
    if (!list) return;

    list.innerHTML = "";

    projects.forEach(project => {
      const row = document.createElement("div");
      row.className = `all-project-row ${projectCueClass(project)}`;

      row.innerHTML = `
        <strong>${project.project_name || "Untitled Project"}</strong>
        <span>${project.client_name || "No client"}</span>
        ${projectStatusBadge(project)}
        ${priorityBadge(project.priority)}
        <span>${formatMoney(project.value || project.quote_value)}</span>
      `;

      list.appendChild(row);
    });
  }

  function clientDisplayName(client) {
    return client.name || client.client_name || client.company || "Untitled Client";
  }

  function clientCompanyName(client) {
    return client.company || clientDisplayName(client);
  }

  function normalizedClientName(value = "") {
    return normalizeText(value).replace(/\s+/g, " ");
  }

  function findClientByName(name = "") {
    const normalized = normalizedClientName(name);
    if (!normalized) return null;

    return allClients.find(client => {
      return [
        clientDisplayName(client),
        clientCompanyName(client),
        client.name,
        client.client_name,
        client.company
      ].some(value => normalizedClientName(value) === normalized);
    }) || null;
  }

  function populateProjectClientOptions() {
    const datalist = document.getElementById("projectClientOptions");
    if (!datalist) return;

    datalist.innerHTML = allClients
      .filter(client => client.archived !== true && client.status !== "archived")
      .map(client => `<option value="${escapeHtml(clientDisplayName(client))}">${escapeHtml(clientCompanyName(client))}</option>`)
      .join("");
  }

  function updateProjectClientCreateHint() {
    const input = document.getElementById("clientName");
    const hint = document.getElementById("projectClientCreateHint");
    if (!input || !hint) return;

    const enteredName = input.value.trim();
    if (!enteredName) {
      hint.hidden = true;
      hint.textContent = "";
      return;
    }

    const existingClient = findClientByName(enteredName);
    hint.hidden = false;
    hint.textContent = existingClient
      ? `Will link to existing client: ${clientDisplayName(existingClient)}.`
      : `New client "${enteredName}" will be created automatically.`;
  }

  async function resolveProjectClientFromName(clientName, contact = {}) {
    const enteredName = clientName.trim();
    if (!enteredName) return null;

    if (!hasLoadedClients) await loadClients();

    const existingClient = findClientByName(enteredName);
    if (existingClient) return existingClient;

    const payload = {
      name: enteredName,
      company: contact.company || enteredName,
      contact_name: contact.contactName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      website: contact.website || "",
      status: "active",
      notes: contact.notes || ""
    };

    const { data, error } = await supabaseClient
      .from("clients")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;

    allClients = [data, ...allClients.filter(client => String(client.id) !== String(data.id))];
    hasLoadedClients = true;
    populateProjectClientOptions();
    return data;
  }

  function clientStatusClass(status = "active") {
    const statusMap = {
      active: "green",
      lead: "blue",
      inactive: "neutral",
      archived: "orange"
    };

    return statusMap[status] || "neutral";
  }

  function normalizePriority(priority = "normal") {
    const value = String(priority || "normal").toLowerCase();
    if (["urgent", "high"].includes(value)) return "high";
    if (["medium", "normal"].includes(value)) return "medium";
    if (value === "low") return "low";
    return "medium";
  }

  function priorityLabel(priority = "normal") {
    const labels = {
      high: "High Priority",
      medium: "Medium Priority",
      low: "Low Priority"
    };

    return labels[normalizePriority(priority)];
  }

  function indicatorBadge(label, className = "cue-pending") {
    return `<span class="status-badge ${className}">${escapeHtml(label)}</span>`;
  }

  function priorityBadge(priority = "normal") {
    const normalized = normalizePriority(priority);
    return indicatorBadge(priorityLabel(priority), `priority-badge priority-${normalized}`);
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function taskIsOverdue(task) {
    const status = taskEffectiveStatus(task);
    return status !== "done" && status !== "archived" && task?.due_date && task.due_date < todayIso();
  }

  function taskCueClass(task) {
    const status = taskEffectiveStatus(task);
    if (status === "archived") return "cue-row-archived";
    if (status === "done") return "cue-row-completed";
    if (taskIsOverdue(task)) return "cue-row-overdue";
    if (status === "doing") return "cue-row-doing";
    return "cue-row-todo";
  }

  function taskStatusBadge(task) {
    const status = taskEffectiveStatus(task);
    if (taskIsOverdue(task)) return indicatorBadge("Overdue", "cue-overdue");
    if (status === "done") return indicatorBadge("Completed", "cue-completed");
    if (status === "archived") return indicatorBadge("Archived", "cue-archived");
    if (status === "doing") return indicatorBadge("Doing", "cue-doing");
    return indicatorBadge("Todo", "cue-todo");
  }

  function projectHasOverdueTasks(project) {
    return openTasksForProject(project).some(taskIsOverdue);
  }

  function projectIsStalled(project) {
    const stage = projectEffectiveStage(project);
    if (["archived", "completed", "lost"].includes(stage)) return false;
    return Boolean(projectHasOverdueTasks(project) || (project?.estimated_completion_date && project.estimated_completion_date < todayIso()));
  }

  function projectCueClass(project) {
    const stage = projectEffectiveStage(project);
    if (stage === "archived") return "cue-row-archived";
    if (stage === "completed") return "cue-row-completed";
    if (projectIsStalled(project)) return "cue-row-overdue";
    if (stage === "lost") return "cue-row-risk";
    return "cue-row-active";
  }

  function projectStatusBadge(project) {
    const stage = projectEffectiveStage(project);
    if (stage === "archived") return indicatorBadge("Archived", "cue-archived");
    if (stage === "completed") return indicatorBadge("Completed", "cue-completed");
    if (projectIsStalled(project)) return indicatorBadge("Past Due", "cue-overdue");
    if (stage === "lost") return indicatorBadge("At Risk", "cue-risk");
    return indicatorBadge(projectStageLabel(stage), `cue-${projectStatusClass(stage)}`);
  }

  function clientCueClass(client) {
    const archived = client?.archived === true || client?.status === "archived";
    if (archived) return "cue-row-archived";
    if (client?.status === "inactive") return "cue-row-pending";
    return "cue-row-active";
  }

  function clientStatusBadge(client) {
    const archived = client?.archived === true || client?.status === "archived";
    if (archived) return indicatorBadge("Archived", "cue-archived");
    if (client?.status === "inactive") return indicatorBadge("Pending", "cue-pending");
    return indicatorBadge(client?.status || "Active", `cue-${clientStatusClass(client?.status || "active")}`);
  }

  function attachmentActivityMetadata({ entityType, recordId, filename }) {
    const project = entityType === "project"
      ? allProjects.find(item => String(item.id) === String(recordId))
      : entityType === "task"
        ? projectForTask(allTasks.find(item => String(item.id) === String(recordId)))
        : null;
    const client = entityType === "client"
      ? allClients.find(item => String(item.id) === String(recordId))
      : clientForProject(project);
    const task = entityType === "task"
      ? allTasks.find(item => String(item.id) === String(recordId))
      : null;

    return {
      client_name: client ? clientDisplayName(client) : "",
      project_name: project?.project_name || "",
      task_title: task?.title || "",
      filename
    };
  }

  function attachmentParentField(entityType) {
    return {
      client: "related_client_id",
      project: "related_project_id",
      task: "related_task_id"
    }[entityType];
  }

  function attachmentEntityLabel(entityType) {
    return {
      client: "Client",
      project: "Project",
      task: "Task"
    }[entityType] || "Record";
  }

  function safeFileName(fileName = "file") {
    return fileName
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 140);
  }

  function formatFileSize(bytes = 0) {
    const size = Number(bytes || 0);
    if (!size) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fileIconForAttachment(attachment) {
    const type = attachment.mime_type || "";
    const name = attachment.filename || "";
    if (type.startsWith("image/")) return "image";
    if (type.includes("pdf")) return "file-text";
    if (type.includes("spreadsheet") || /\.(xlsx|xls|csv)$/i.test(name)) return "sheet";
    if (type.includes("word") || /\.(doc|docx)$/i.test(name)) return "file-type";
    return "paperclip";
  }

  function attachmentsForEntity(entityType, recordId) {
    const field = attachmentParentField(entityType);
    if (!field || !recordId) return [];

    return allAttachments
      .filter(attachment => String(attachment[field] || "") === String(recordId))
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }

  function renderAttachmentSection(entityType, recordId, listId) {
    const list = document.getElementById(listId);
    if (!list) return;

    const attachments = attachmentsForEntity(entityType, recordId);
    if (!recordId) {
      list.innerHTML = `<div class="attachment-empty">Select a ${attachmentEntityLabel(entityType).toLowerCase()} to manage files.</div>`;
      return;
    }

    if (!attachments.length) {
      list.innerHTML = '<div class="attachment-empty">No files uploaded yet.</div>';
      return;
    }

    list.innerHTML = attachments.map(attachment => `
      <article class="attachment-item">
        <span class="attachment-icon"><i data-lucide="${fileIconForAttachment(attachment)}"></i></span>
        <div>
          <strong>${escapeHtml(attachment.filename || "Attachment")}</strong>
          <small>${escapeHtml([formatFileSize(attachment.file_size), formatTimestamp(attachment.created_at)].filter(Boolean).join(" / "))}</small>
        </div>
        <div class="attachment-actions">
          <button class="light-btn attachment-open-btn" type="button" data-attachment-id="${escapeHtml(attachment.id)}">Open</button>
          <button class="light-btn attachment-download-btn" type="button" data-attachment-id="${escapeHtml(attachment.id)}">Download</button>
          <button class="light-btn danger attachment-delete-btn" type="button" data-attachment-id="${escapeHtml(attachment.id)}">Delete</button>
        </div>
      </article>
    `).join("");

    if (window.lucide) lucide.createIcons();
  }

  function renderCurrentAttachmentSections() {
    renderAttachmentSection("client", selectedClientId, "clientAttachmentList");
    renderAttachmentSection("project", selectedProjectPageId, "projectAttachmentList");
    renderAttachmentSection("task", selectedTaskId, "taskAttachmentList");
  }

  async function loadAttachments() {
    if (!currentSession) return;

    const { data, error } = await supabaseClient
      .from("attachments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load attachments failed:", error);
      alert("Could not load attachments. Run supabase-attachments-schema.sql if the table or storage bucket is missing.");
      return;
    }

    allAttachments = data || [];
    hasLoadedAttachments = true;
    renderCurrentAttachmentSections();
  }

  async function uploadAttachments(entityType, recordId, files) {
    const fileList = Array.from(files || []);
    const parentField = attachmentParentField(entityType);
    if (!currentSession || !parentField || !fileList.length) return;
    if (!recordId) {
      alert(`Select a ${attachmentEntityLabel(entityType).toLowerCase()} before uploading files.`);
      return;
    }

    for (const file of fileList) {
      const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const storagePath = `${entityType}s/${recordId}/${uniquePrefix}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabaseClient.storage
        .from(attachmentBucket)
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined
        });

      if (uploadError) {
        alert(uploadError.message);
        continue;
      }

      const payload = {
        filename: file.name,
        storage_path: storagePath,
        mime_type: file.type || null,
        file_size: file.size || null,
        uploaded_by: currentSession.user?.id || null,
        [parentField]: recordId
      };

      const { error: insertError } = await supabaseClient
        .from("attachments")
        .insert([payload]);

      if (insertError) {
        await supabaseClient.storage.from(attachmentBucket).remove([storagePath]);
        alert(insertError.message);
        continue;
      }

      await logActivity({
        type: "attachment_uploaded",
        title: "Attachment uploaded",
        description: file.name,
        clientId: entityType === "client" ? recordId : null,
        projectId: entityType === "project" ? recordId : null,
        taskId: entityType === "task" ? recordId : null,
        metadata: attachmentActivityMetadata({ entityType, recordId, filename: file.name })
      });
    }

    await loadAttachments();
  }

  async function openAttachment(attachmentId) {
    const attachment = allAttachments.find(item => String(item.id) === String(attachmentId));
    if (!attachment) return;

    const { data, error } = await supabaseClient.storage
      .from(attachmentBucket)
      .createSignedUrl(attachment.storage_path, 60 * 30);

    if (error) {
      alert(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function downloadAttachment(attachmentId) {
    const attachment = allAttachments.find(item => String(item.id) === String(attachmentId));
    if (!attachment) return;

    const { data, error } = await supabaseClient.storage
      .from(attachmentBucket)
      .createSignedUrl(attachment.storage_path, 60 * 30, {
        download: attachment.filename || true
      });

    if (error) {
      alert(error.message);
      return;
    }

    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.download = attachment.filename || "attachment";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function deleteAttachment(attachmentId) {
    const attachment = allAttachments.find(item => String(item.id) === String(attachmentId));
    if (!attachment) return;
    if (!confirm(`Delete ${attachment.filename || "this file"}?`)) return;

    const { error: storageError } = await supabaseClient.storage
      .from(attachmentBucket)
      .remove([attachment.storage_path]);

    if (storageError) {
      alert(storageError.message);
      return;
    }

    const { error } = await supabaseClient
      .from("attachments")
      .delete()
      .eq("id", attachment.id);

    if (error) {
      alert(error.message);
      return;
    }

    await logActivity({
      type: "attachment_deleted",
      title: "Attachment deleted",
      description: attachment.filename,
      clientId: attachment.related_client_id,
      projectId: attachment.related_project_id,
      taskId: attachment.related_task_id,
      metadata: {
        filename: attachment.filename
      }
    });

    await loadAttachments();
  }

  function setupAttachmentInput(inputId, entityType, getRecordId) {
    const input = document.getElementById(inputId);
    input?.addEventListener("change", async () => {
      await uploadAttachments(entityType, getRecordId(), input.files);
      input.value = "";
    });
  }

  function setupAttachmentDropzone(dropzoneId, entityType, getRecordId) {
    const dropzone = document.getElementById(dropzoneId);
    if (!dropzone) return;

    ["dragenter", "dragover"].forEach(eventName => {
      dropzone.addEventListener(eventName, e => {
        e.preventDefault();
        dropzone.classList.add("is-dragging");
      });
    });

    ["dragleave", "drop"].forEach(eventName => {
      dropzone.addEventListener(eventName, e => {
        e.preventDefault();
        dropzone.classList.remove("is-dragging");
      });
    });

    dropzone.addEventListener("drop", async e => {
      await uploadAttachments(entityType, getRecordId(), e.dataTransfer?.files);
    });
  }

  function getClientProjects(client) {
    const clientId = String(client.id || "");
    const names = [
      clientDisplayName(client),
      clientCompanyName(client)
    ].map(normalizeText).filter(Boolean);

    return allProjects.filter(project => {
      if (project.client_id && String(project.client_id) === clientId) return true;

      return [
        project.client_name,
        project.contact_company
      ].some(value => names.includes(normalizeText(value)));
    });
  }

  function clientWorkspaceIdFromHash() {
    const hash = (window.location.hash || "").replace("#", "");
    const match = hash.match(/^clients\/(.+)$/i);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function isClientWorkspaceRoute(routeName = routeFromHash()) {
    return /^clients\/.+/i.test(routeName);
  }

  function setClientsViewMode(mode = "directory") {
    const layout = document.querySelector(".clients-layout");
    if (!layout) return;

    layout.classList.toggle("client-workspace-mode", mode === "workspace");
    layout.classList.toggle("client-directory-mode", mode !== "workspace");
  }

  function renderClients(clients = allClients) {
    const list = document.getElementById("clientList");
    if (!list) return;

    const searchTerm = normalizeText(document.getElementById("clientSearch")?.value || "");
    const statusFilter = document.getElementById("clientStatusFilter")?.value || "active";
    const workspaceId = clientWorkspaceIdFromHash();
    const visibleClients = clients.filter(client => {
      const isArchived = client.status === "archived" || client.archived === true;
      if (statusFilter === "active" && isArchived) return false;
      if (statusFilter === "archived" && !isArchived) return false;
      if (statusFilter === "inactive" && client.status !== "inactive") return false;

      const searchable = [
        clientDisplayName(client),
        client.company,
        client.contact_name,
        client.email,
        client.phone,
        client.website
      ].filter(Boolean).join(" ");

      return !searchTerm || normalizeText(searchable).includes(searchTerm);
    });

    list.querySelectorAll(".client-data-row, .client-empty-row").forEach(row => row.remove());

    if (!visibleClients.length && !workspaceId) {
      const empty = document.createElement("div");
      empty.className = "table-row client-empty-row";
      empty.textContent = "No clients found.";
      list.appendChild(empty);
      renderClientDetails(null);
      return;
    }

    visibleClients.forEach(client => {
      const projects = getClientProjects(client);
      const row = document.createElement("button");
      row.type = "button";
      row.className = `table-row client-row client-data-row ${clientCueClass(client)} ${String(client.id) === String(selectedClientId) ? "active" : ""}`;
      row.dataset.clientId = client.id;
      row.innerHTML = `
        <span class="client-list-client">
          <strong>${escapeHtml(clientDisplayName(client))}</strong>
          <small>${escapeHtml(clientCompanyName(client))}</small>
        </span>
        <span class="client-list-contact">
          <strong>${escapeHtml(client.contact_name || "No contact")}</strong>
          <small>${escapeHtml(client.email || client.phone || "")}</small>
        </span>
        <span class="client-list-status">${clientStatusBadge(client)}</span>
        <strong class="client-list-count">${projects.length}</strong>
      `;

      list.appendChild(row);
    });

    if (workspaceId) {
      renderClientDetails(allClients.find(client => String(client.id) === String(selectedClientId)));
    } else {
      renderClientDetails(null);
    }
  }

  function renderClientDetails(client) {
    const emptyState = document.getElementById("clientEmptyState");
    const detailContent = document.getElementById("clientDetailContent");
    const detailTitle = document.getElementById("clientDetailTitle");
    const editClientBtn = document.getElementById("editClientBtn");
    const archiveClientBtn = document.getElementById("archiveClientBtn");
    const deleteClientBtn = document.getElementById("deleteClientBtn");

    if (!client) {
      if (detailTitle) detailTitle.textContent = "Select a client";
      if (emptyState) emptyState.hidden = false;
      if (detailContent) detailContent.hidden = true;
      [editClientBtn, archiveClientBtn, deleteClientBtn].forEach(button => {
        if (button) button.disabled = true;
      });
      renderAttachmentSection("client", null, "clientAttachmentList");
      renderClientPageActivity(null);
      return;
    }

    selectedClientId = client.id;
    if (detailTitle) detailTitle.textContent = clientDisplayName(client);
    if (emptyState) emptyState.hidden = true;
    if (detailContent) detailContent.hidden = false;
    [editClientBtn, archiveClientBtn, deleteClientBtn].forEach(button => {
      if (button) button.disabled = false;
    });

    const fields = {
      clientCompany: clientCompanyName(client),
      clientContact: client.contact_name || "Not set",
      clientEmail: client.email || "Not set",
      clientPhone: client.phone || "Not set",
      clientWebsite: client.website || "Not set",
      clientStatus: clientStatusBadge(client),
      clientNotes: "Notes are tracked in the timeline below."
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        if (id === "clientStatus") {
          element.innerHTML = value;
        } else {
          element.textContent = value;
        }
      }
    });

    renderNotesTimeline("clientNotesTimeline", { clientId: client.id }, client.notes || "");
    renderAttachmentSection("client", client.id, "clientAttachmentList");
    renderClientProjects(client);
    renderClientPageActivity(client);
  }

  function renderClientPageActivity(client) {
    const list = document.getElementById("clientPageActivityList");
    if (!list) return;

    if (!client) {
      list.innerHTML = "";
      return;
    }

    const items = allActivities
      .filter(activity => String(activity.related_client_id || "") === String(client.id))
      .slice(0, 8);

    if (!items.length) {
      list.innerHTML = '<div class="attachment-empty">No client activity yet.</div>';
      return;
    }

    list.innerHTML = items.map(activity => {
      const target = reportActivityTarget(activity);
      const linkAttr = target ? `data-link-${target.type}-id="${escapeHtml(target.id)}"` : "";
      return `
        <button class="report-activity-row clickable" type="button" ${linkAttr}>
          <strong>${escapeHtml(activity.title || "Activity")}</strong>
          <span>${escapeHtml([activity.description, formatTimestamp(activity.created_at)].filter(Boolean).join(" / "))}</span>
        </button>
      `;
    }).join("");
  }

  function renderClientProjects(client) {
    const list = document.getElementById("clientProjectList");
    if (!list) return;

    const projects = getClientProjects(client);
    list.innerHTML = "";

    if (!projects.length) {
      const empty = document.createElement("div");
      empty.className = "client-project-item";
      empty.textContent = "No associated projects yet.";
      list.appendChild(empty);
      return;
    }

    projects.forEach(project => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `client-project-item ${projectCueClass(project)}`;
      item.dataset.projectId = project.id;
      const progress = Number(project.progress || 0);
      const openTaskCount = openTasksForProject(project).length;
      item.innerHTML = `
        <strong>${escapeHtml(project.project_name || "Untitled Project")}</strong>
        <span class="indicator-row">${projectStatusBadge(project)} ${priorityBadge(project.priority)}</span>
        <small>${formatMoney(project.value || project.quote_value || 0)} / ${progress}% progress / ${openTaskCount} open tasks</small>
      `;
      list.appendChild(item);
    });
  }

  async function loadClients() {
    if (!currentSession) return;

    const { data, error } = await supabaseClient
      .from("clients")
      .select("*");

    if (error) {
      console.error("Load clients failed:", error);
      alert("Could not load clients.");
      return;
    }

    allClients = (data || []).sort((a, b) => {
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
    hasLoadedClients = true;
    populateProjectClientOptions();
    updateProjectClientCreateHint();
    renderClients();
    renderProjectPage();
    renderReports();
    renderDashboard();
  }

  function selectedClient() {
    return allClients.find(client => String(client.id) === String(selectedClientId));
  }

  function openClientForm(client = null) {
    const panel = document.getElementById("clientFormPanel");
    const title = document.getElementById("clientFormTitle");
    const form = document.getElementById("clientForm");
    if (!panel || !form) return;

    form.reset();
    document.getElementById("clientId").value = client?.id || "";
    document.getElementById("clientNameInput").value = client ? clientDisplayName(client) : "";
    document.getElementById("clientCompanyInput").value = client?.company || "";
    document.getElementById("clientContactInput").value = client?.contact_name || "";
    document.getElementById("clientEmailInput").value = client?.email || "";
    document.getElementById("clientPhoneInput").value = client?.phone || "";
    document.getElementById("clientWebsiteInput").value = client?.website || "";
    document.getElementById("clientStatusInput").value = client?.status || "active";
    document.getElementById("clientNotesInput").value = client?.notes || "";
    if (title) title.textContent = client ? "Edit client" : "Add client";

    panel.hidden = false;
    document.getElementById("clientNameInput")?.focus();
  }

  function closeClientForm() {
    const panel = document.getElementById("clientFormPanel");
    document.getElementById("clientForm")?.reset();
    if (panel) panel.hidden = true;
  }

  function clientColumnSet() {
    const source = selectedClient() || allClients[0] || {};
    return new Set(Object.keys(source));
  }

  function assignClientField(payload, columns, field, value) {
    if (!columns.size || columns.has(field)) {
      payload[field] = value;
    }
  }

  function clientPayloadFromForm() {
    const columns = clientColumnSet();
    const name = document.getElementById("clientNameInput").value.trim();
    const payload = {};
    const nameKey = columns.has("client_name") && !columns.has("name") ? "client_name" : "name";

    payload[nameKey] = name;
    assignClientField(payload, columns, "company", document.getElementById("clientCompanyInput").value.trim());
    assignClientField(payload, columns, "contact_name", document.getElementById("clientContactInput").value.trim());
    assignClientField(payload, columns, "email", document.getElementById("clientEmailInput").value.trim());
    assignClientField(payload, columns, "phone", document.getElementById("clientPhoneInput").value.trim());
    assignClientField(payload, columns, "website", document.getElementById("clientWebsiteInput").value.trim());
    assignClientField(payload, columns, "status", document.getElementById("clientStatusInput").value);
    assignClientField(payload, columns, "notes", document.getElementById("clientNotesInput").value.trim());

    return payload;
  }

  function projectEffectiveStage(project) {
    return project?.archived === true ? "archived" : (project?.stage || "new");
  }

  function projectStageLabel(stage = "new") {
    const labels = {
      new: "New",
      discovery: "Discovery",
      proposal: "Proposal",
      build: "Build",
      launch: "Test / Launch",
      completed: "Completed",
      lost: "Lost",
      archived: "Archived"
    };

    return labels[stage] || stage;
  }

  function projectStatusClass(stage = "new") {
    const classes = {
      new: "blue",
      discovery: "purple",
      proposal: "orange",
      build: "teal",
      launch: "green",
      completed: "green",
      lost: "neutral",
      archived: "orange"
    };

    return classes[stage] || "blue";
  }

  function selectedProjectPage() {
    return allProjects.find(project => String(project.id) === String(selectedProjectPageId));
  }

  function projectWorkspaceIdFromHash() {
    const hash = (window.location.hash || "").replace("#", "");
    const match = hash.match(/^projects\/(.+)$/i);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function isProjectWorkspaceRoute(routeName = routeFromHash()) {
    return /^projects\/.+/i.test(routeName);
  }

  function setProjectsViewMode(mode = "directory") {
    const layout = document.querySelector(".projects-layout");
    if (!layout) return;

    layout.classList.toggle("project-workspace-mode", mode === "workspace");
    layout.classList.toggle("project-directory-mode", mode !== "workspace");
  }

  function clientForProject(project) {
    if (!project) return null;

    if (project.client_id) {
      const linkedClient = allClients.find(client => String(client.id) === String(project.client_id));
      if (linkedClient) return linkedClient;
    }

    const projectClientNames = [
      project.client_name,
      project.contact_company
    ].map(normalizeText).filter(Boolean);

    return allClients.find(client => {
      return [
        clientDisplayName(client),
        clientCompanyName(client)
      ].some(value => projectClientNames.includes(normalizeText(value)));
    }) || null;
  }

  function projectClientName(project) {
    const client = clientForProject(project);
    return client ? clientDisplayName(client) : (project?.client_name || project?.contact_company || "No client");
  }

  function tasksForProject(project) {
    if (!project) return [];

    return allTasks.filter(task => String(task.project_id || "") === String(project.id));
  }

  function openTasksForProject(project) {
    return tasksForProject(project).filter(task => {
      return taskEffectiveStatus(task) !== "done" && taskEffectiveStatus(task) !== "archived";
    });
  }

  function projectColumnSet() {
    const source = selectedProjectPage() || allProjects[0] || {};
    return new Set(Object.keys(source));
  }

  function filteredProjectPageItems() {
    const searchTerm = normalizeText(document.getElementById("projectPageSearch")?.value || "");
    const statusFilter = document.getElementById("projectPageStatusFilter")?.value || "active";

    return allProjects.filter(project => {
      const stage = projectEffectiveStage(project);

      if (statusFilter === "active" && ["archived", "lost", "completed"].includes(stage)) return false;
      if (statusFilter !== "active" && statusFilter !== "all" && stage !== statusFilter) return false;

      const searchable = [
        project.project_name,
        project.client_name,
        project.contact_name,
        project.contact_company,
        project.contact_email,
        project.project_type,
        projectStageLabel(stage)
      ].filter(Boolean).join(" ");

      return !searchTerm || normalizeText(searchable).includes(searchTerm);
    });
  }

  function renderProjectPage() {
    const list = document.getElementById("projectPageList");
    if (!list) return;

    const projects = filteredProjectPageItems();
    const workspaceId = projectWorkspaceIdFromHash();
    list.querySelectorAll(".project-page-data-row, .project-page-empty-row").forEach(row => row.remove());

    if (!projects.length && !workspaceId) {
      const empty = document.createElement("div");
      empty.className = "table-row project-page-empty-row";
      empty.textContent = "No active projects yet.";
      list.appendChild(empty);
      renderProjectPageDetails(null);
      return;
    }

    projects.forEach(project => {
      const stage = projectEffectiveStage(project);
      const row = document.createElement("button");
      row.type = "button";
      row.className = `table-row project-page-row project-page-data-row ${projectCueClass(project)} ${String(project.id) === String(selectedProjectPageId) ? "active" : ""}`;
      row.dataset.projectId = project.id;
      row.innerHTML = `
        <span class="project-list-project">
          <strong>${escapeHtml(project.project_name || "Untitled Project")}</strong>
          <small class="indicator-row">${priorityBadge(project.priority)}</small>
        </span>
        <span class="project-list-client">
          <strong>${escapeHtml(projectClientName(project))}</strong>
          <small>${escapeHtml(project.contact_email || project.contact_phone || "")}</small>
        </span>
        <span class="project-list-status">${projectStatusBadge(project)}</span>
        <strong class="project-list-value">${formatMoney(project.value || project.quote_value || 0)}</strong>
      `;
      list.appendChild(row);
    });

    if (workspaceId) {
      renderProjectPageDetails(allProjects.find(project => String(project.id) === String(selectedProjectPageId)));
    } else {
      renderProjectPageDetails(null);
    }
  }

  function renderProjectPageDetails(project) {
    const emptyState = document.getElementById("projectPageEmptyState");
    const detailContent = document.getElementById("projectPageDetailContent");
    const detailTitle = document.getElementById("projectPageDetailTitle");
    const editBtn = document.getElementById("editProjectPageBtn");
    const archiveBtn = document.getElementById("archiveProjectPageBtn");
    const deleteBtn = document.getElementById("deleteProjectPageBtn");

    if (!project) {
      if (detailTitle) detailTitle.textContent = "Select a project";
      if (emptyState) emptyState.hidden = false;
      if (detailContent) detailContent.hidden = true;
      [editBtn, archiveBtn, deleteBtn].forEach(button => {
        if (button) button.disabled = true;
      });
      renderAttachmentSection("project", null, "projectAttachmentList");
      renderProjectPageTasks(null);
      renderProjectPageActivity(null);
      return;
    }

    selectedProjectPageId = project.id;
    const stage = projectEffectiveStage(project);

    if (detailTitle) detailTitle.textContent = project.project_name || "Untitled Project";
    if (emptyState) emptyState.hidden = true;
    if (detailContent) detailContent.hidden = false;
    [editBtn, archiveBtn, deleteBtn].forEach(button => {
      if (button) button.disabled = false;
    });

    const fields = {
      projectPageClient: projectClientName(project),
      projectPageStatus: projectStatusBadge(project),
      projectPagePriority: priorityBadge(project.priority),
      projectPageValue: formatMoney(project.value || project.quote_value || 0),
      projectPageContact: project.contact_name || project.contact_email || "Not set",
      projectPageDue: project.estimated_completion_date || "No date",
      projectPageNotes: "Notes are tracked in the timeline below."
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        if (["projectPageStatus", "projectPagePriority"].includes(id)) {
          element.innerHTML = value;
        } else {
          element.textContent = value;
        }
      }
    });

    const linkedClient = clientForProject(project);
    const clientElement = document.getElementById("projectPageClient");
    if (clientElement && linkedClient) {
      clientElement.innerHTML = `<button class="relationship-link" type="button" data-link-client-id="${escapeHtml(linkedClient.id)}">${escapeHtml(clientDisplayName(linkedClient))}</button>`;
    }

    renderNotesTimeline("projectNotesTimeline", { projectId: project.id }, project.project_notes || "");
    renderAttachmentSection("project", project.id, "projectAttachmentList");
    renderProjectPageTasks(project);
    renderProjectPageActivity(project);
  }

  function renderProjectPageActivity(project) {
    const list = document.getElementById("projectPageActivityList");
    if (!list) return;

    if (!project) {
      list.innerHTML = "";
      return;
    }

    const items = allActivities
      .filter(activity => String(activity.related_project_id || "") === String(project.id))
      .slice(0, 8);

    if (!items.length) {
      list.innerHTML = '<div class="attachment-empty">No project activity yet.</div>';
      return;
    }

    list.innerHTML = items.map(activity => {
      const target = reportActivityTarget(activity);
      const linkAttr = target ? `data-link-${target.type}-id="${escapeHtml(target.id)}"` : "";
      return `
        <button class="report-activity-row clickable" type="button" ${linkAttr}>
          <strong>${escapeHtml(activity.title || "Activity")}</strong>
          <span>${escapeHtml([activity.description, formatTimestamp(activity.created_at)].filter(Boolean).join(" / "))}</span>
        </button>
      `;
    }).join("");
  }

  const projectColumnStorageKey = "crmProjectColumnWidths";
  const projectColumnDefaults = [190, 260, 76, 72];
  const projectColumnMinimums = [150, 170, 62, 58];

  function applyProjectColumnWidths(widths = null) {
    const list = document.getElementById("projectPageList");
    if (!list) return;

    if (!widths) {
      list.style.removeProperty("--project-col-project");
      list.style.removeProperty("--project-col-client");
      list.style.removeProperty("--project-col-status");
      list.style.removeProperty("--project-col-value");
      return;
    }

    const [projectWidth, clientWidth, statusWidth, valueWidth] = widths;
    list.style.setProperty("--project-col-project", `${Math.round(projectWidth)}px`);
    list.style.setProperty("--project-col-client", `${Math.round(clientWidth)}px`);
    list.style.setProperty("--project-col-status", `${Math.round(statusWidth)}px`);
    list.style.setProperty("--project-col-value", `${Math.round(valueWidth)}px`);
  }

  function savedProjectColumnWidths() {
    try {
      const parsed = JSON.parse(localStorage.getItem(projectColumnStorageKey) || "null");
      if (!Array.isArray(parsed) || parsed.length !== 4) return null;
      return parsed.map((width, index) => Math.max(Number(width) || projectColumnDefaults[index], projectColumnMinimums[index]));
    } catch {
      return null;
    }
  }

  function currentProjectColumnWidths() {
    const headerCells = [...document.querySelectorAll("#projectPageList .project-page-row.table-head span")];
    if (headerCells.length !== 4) return savedProjectColumnWidths() || projectColumnDefaults;
    return headerCells.map((cell, index) => Math.max(cell.getBoundingClientRect().width, projectColumnMinimums[index]));
  }

  function persistProjectColumnWidths(widths) {
    localStorage.setItem(projectColumnStorageKey, JSON.stringify(widths.map(width => Math.round(width))));
  }

  function resetProjectColumnWidths() {
    localStorage.removeItem(projectColumnStorageKey);
    applyProjectColumnWidths(null);
  }

  function setupProjectColumnResizing() {
    const list = document.getElementById("projectPageList");
    const header = list?.querySelector(".project-page-row.table-head");
    if (!list || !header) return;

    applyProjectColumnWidths(savedProjectColumnWidths());

    const headerCells = [...header.querySelectorAll("span")];
    headerCells.slice(0, -1).forEach((cell, index) => {
      if (cell.querySelector(".project-column-resize-handle")) return;

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "project-column-resize-handle";
      handle.dataset.columnIndex = String(index);
      handle.setAttribute("aria-label", `Resize ${cell.textContent.trim()} column`);
      handle.title = "Drag to resize. Double-click to reset columns.";
      cell.appendChild(handle);

      handle.addEventListener("dblclick", event => {
        event.preventDefault();
        resetProjectColumnWidths();
      });

      handle.addEventListener("pointerdown", event => {
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture?.(event.pointerId);

        const startX = event.clientX;
        const startWidths = currentProjectColumnWidths();
        const columnIndex = Number(handle.dataset.columnIndex || 0);
        list.classList.add("is-resizing-columns");
        applyProjectColumnWidths(startWidths);

        const onPointerMove = moveEvent => {
          moveEvent.preventDefault();
          const delta = moveEvent.clientX - startX;
          const nextWidths = [...startWidths];
          const leftMinimum = projectColumnMinimums[columnIndex];
          const rightMinimum = projectColumnMinimums[columnIndex + 1];
          const leftWidth = Math.max(leftMinimum, startWidths[columnIndex] + delta);
          const rightWidth = Math.max(rightMinimum, startWidths[columnIndex + 1] - (leftWidth - startWidths[columnIndex]));

          if (rightWidth === rightMinimum && delta > 0) {
            nextWidths[columnIndex] = startWidths[columnIndex] + startWidths[columnIndex + 1] - rightMinimum;
          } else {
            nextWidths[columnIndex] = leftWidth;
          }

          nextWidths[columnIndex + 1] = rightWidth;
          applyProjectColumnWidths(nextWidths);
        };

        const onPointerUp = () => {
          list.classList.remove("is-resizing-columns");
          persistProjectColumnWidths(currentProjectColumnWidths());
          handle.releasePointerCapture?.(event.pointerId);
          handle.removeEventListener("pointermove", onPointerMove);
          handle.removeEventListener("pointerup", onPointerUp);
          handle.removeEventListener("pointercancel", onPointerUp);
        };

        handle.addEventListener("pointermove", onPointerMove);
        handle.addEventListener("pointerup", onPointerUp);
        handle.addEventListener("pointercancel", onPointerUp);
      });
    });
  }

  function renderProjectPageTasks(project) {
    const list = document.getElementById("projectPageTaskList");
    if (!list) return;

    list.innerHTML = "";

    if (!project) return;

    const tasks = tasksForProject(project).filter(task => task.archived !== true && task.status !== "archived");

    if (!tasks.length) {
      const empty = document.createElement("div");
      empty.className = "project-page-task-item";
      empty.textContent = "No associated tasks yet.";
      list.appendChild(empty);
      return;
    }

    tasks.forEach(task => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `project-page-task-item ${taskCueClass(task)}`;
      item.dataset.taskId = task.id;
      item.innerHTML = `
        <strong>${escapeHtml(task.title || "Untitled Task")}</strong>
        <span class="indicator-row">${taskStatusBadge(task)}${task.due_date ? ` <small>Due ${escapeHtml(task.due_date)}</small>` : ""}</span>
        ${task.notes ? `<small>${escapeHtml(task.notes)}</small>` : ""}
      `;
      list.appendChild(item);
    });
  }

  function taskStatusLabel(status = "todo") {
    const labels = {
      todo: "Todo",
      doing: "Doing",
      done: "Done",
      archived: "Archived"
    };

    return labels[status] || status;
  }

  function taskEffectiveStatus(task) {
    return task?.archived === true ? "archived" : (task?.status || "todo");
  }

  function taskStatusClass(status = "todo") {
    const classes = {
      todo: "purple",
      doing: "blue",
      done: "green",
      archived: "orange"
    };

    return classes[status] || "purple";
  }

  function projectForTask(task) {
    if (!task?.project_id) return null;
    return allProjects.find(project => String(project.id) === String(task.project_id)) || null;
  }

  function clientNameForProject(project) {
    if (!project) return "No client";

    const linkedClient = project.client_id
      ? allClients.find(client => String(client.id) === String(project.client_id))
      : null;

    return linkedClient
      ? clientDisplayName(linkedClient)
      : (project.client_name || project.contact_company || "No client");
  }

  function taskColumnSet() {
    const source = selectedTask() || allTasks[0] || {};
    return new Set(Object.keys(source));
  }

  function assignTaskField(payload, columns, field, value) {
    if (!columns.size || columns.has(field)) {
      payload[field] = value;
    }
  }

  function populateTaskProjectOptions() {
    const select = document.getElementById("taskProjectInput");
    if (!select) return;

    const selectedValue = select.value;
    select.innerHTML = '<option value="">No project</option>';

    allProjects.forEach(project => {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = `${project.project_name || "Untitled Project"} - ${project.client_name || "No client"}`;
      select.appendChild(option);
    });

    if (selectedValue) select.value = selectedValue;
  }

  function selectedTask() {
    return allTasks.find(task => String(task.id) === String(selectedTaskId));
  }

  function taskWorkspaceIdFromHash() {
    const hash = (window.location.hash || "").replace("#", "");
    const match = hash.match(/^tasks\/(.+)$/i);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function isTaskWorkspaceRoute(routeName = routeFromHash()) {
    return /^tasks\/.+/i.test(routeName);
  }

  function setTasksViewMode(mode = "directory") {
    const layout = document.querySelector(".tasks-layout");
    if (!layout) return;

    layout.classList.toggle("task-workspace-mode", mode === "workspace");
    layout.classList.toggle("task-directory-mode", mode !== "workspace");
  }

  function filteredTasks() {
    const searchTerm = normalizeText(document.getElementById("taskSearch")?.value || "");
    const statusFilter = document.getElementById("taskStatusFilter")?.value || "active";

    return allTasks.filter(task => {
      const archived = task.archived === true || task.status === "archived";
      const status = taskEffectiveStatus(task);
      const project = projectForTask(task);
      const clientName = clientNameForProject(project);

      if (statusFilter === "active" && archived) return false;
      if (statusFilter !== "active" && statusFilter !== "all") {
        if (statusFilter === "archived" && !archived) return false;
        if (statusFilter !== "archived" && status !== statusFilter) return false;
      }

      const searchable = [
        task.title,
        task.notes,
        status,
        project?.project_name,
        clientName
      ].filter(Boolean).join(" ");

      return !searchTerm || normalizeText(searchable).includes(searchTerm);
    });
  }

  function renderTaskPage() {
    const list = document.getElementById("taskPageList");
    if (!list) return;

    const tasks = filteredTasks();
    const workspaceId = taskWorkspaceIdFromHash();
    list.querySelectorAll(".task-data-row, .task-empty-row").forEach(row => row.remove());

    if (!tasks.length && !workspaceId) {
      const empty = document.createElement("div");
      empty.className = "table-row task-empty-row";
      empty.textContent = "No active tasks found.";
      list.appendChild(empty);
      renderTaskDetails(null);
      return;
    }

    tasks.forEach(task => {
      const project = projectForTask(task);
      const row = document.createElement("button");
      row.type = "button";
      row.className = `table-row task-row task-data-row ${taskCueClass(task)} ${String(task.id) === String(selectedTaskId) ? "active" : ""}`;
      row.dataset.taskId = task.id;
      row.innerHTML = `
        <span class="task-list-task">
          <strong>${escapeHtml(task.title || "Untitled Task")}</strong>
          <small>${escapeHtml(task.notes || "")}</small>
        </span>
        <span class="task-list-project">
          <strong>${escapeHtml(project?.project_name || "No project")}</strong>
          <small>${escapeHtml(clientNameForProject(project))}</small>
        </span>
        <span class="task-list-status">${taskStatusBadge(task)}</span>
        <strong class="task-list-date ${taskIsOverdue(task) ? "due-overdue" : ""}">${escapeHtml(task.due_date || "No date")}</strong>
      `;
      list.appendChild(row);
    });

    if (workspaceId) {
      renderTaskDetails(allTasks.find(task => String(task.id) === String(selectedTaskId)));
    } else {
      renderTaskDetails(null);
    }
  }

  function renderTaskDetails(task) {
    const emptyState = document.getElementById("taskEmptyState");
    const detailContent = document.getElementById("taskDetailContent");
    const detailTitle = document.getElementById("taskDetailTitle");
    const editBtn = document.getElementById("editTaskPageBtn");
    const archiveBtn = document.getElementById("archiveTaskPageBtn");
    const deleteBtn = document.getElementById("deleteTaskPageBtn");

    if (!task) {
      if (detailTitle) detailTitle.textContent = "Select a task";
      if (emptyState) emptyState.hidden = false;
      if (detailContent) detailContent.hidden = true;
      [editBtn, archiveBtn, deleteBtn].forEach(button => {
        if (button) button.disabled = true;
      });
      renderAttachmentSection("task", null, "taskAttachmentList");
      renderTaskPageActivity(null);
      return;
    }

    selectedTaskId = task.id;
    const project = projectForTask(task);

    if (detailTitle) detailTitle.textContent = task.title || "Untitled Task";
    if (emptyState) emptyState.hidden = true;
    if (detailContent) detailContent.hidden = false;
    [editBtn, archiveBtn, deleteBtn].forEach(button => {
      if (button) button.disabled = false;
    });

    const fields = {
      taskDetailStatus: taskStatusBadge(task),
      taskDetailDueDate: task.due_date || "No date",
      taskDetailProject: project?.project_name || "No project",
      taskDetailClient: clientNameForProject(project),
      taskDetailNotes: "Notes are tracked in the timeline below."
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        if (id === "taskDetailStatus") {
          element.innerHTML = value;
        } else {
          element.textContent = value;
        }
      }
    });

    const projectElement = document.getElementById("taskDetailProject");
    if (projectElement && project) {
      projectElement.innerHTML = `<button class="relationship-link" type="button" data-link-project-id="${escapeHtml(project.id)}">${escapeHtml(project.project_name || "No project")}</button>`;
    }

    const linkedClient = clientForProject(project);
    const clientElement = document.getElementById("taskDetailClient");
    if (clientElement && linkedClient) {
      clientElement.innerHTML = `<button class="relationship-link" type="button" data-link-client-id="${escapeHtml(linkedClient.id)}">${escapeHtml(clientDisplayName(linkedClient))}</button>`;
    }

    renderNotesTimeline("taskNotesTimeline", { taskId: task.id }, task.notes || "");
    renderAttachmentSection("task", task.id, "taskAttachmentList");
    renderTaskPageActivity(task);
  }

  function renderTaskPageActivity(task) {
    const list = document.getElementById("taskPageActivityList");
    if (!list) return;

    if (!task) {
      list.innerHTML = "";
      return;
    }

    const items = allActivities
      .filter(activity => String(activity.related_task_id || "") === String(task.id))
      .slice(0, 8);

    if (!items.length) {
      list.innerHTML = '<div class="attachment-empty">No task activity yet.</div>';
      return;
    }

    list.innerHTML = items.map(activity => {
      const target = reportActivityTarget(activity);
      const linkAttr = target ? `data-link-${target.type}-id="${escapeHtml(target.id)}"` : "";
      return `
        <button class="report-activity-row clickable" type="button" ${linkAttr}>
          <strong>${escapeHtml(activity.title || "Activity")}</strong>
          <span>${escapeHtml([activity.description, formatTimestamp(activity.created_at)].filter(Boolean).join(" / "))}</span>
        </button>
      `;
    }).join("");
  }

  async function loadTaskPage() {
    if (!currentSession) return;

    const { data, error } = await supabaseClient
      .from("tasks")
      .select("*");

    if (error) {
      console.error("Load tasks failed:", error);
      alert("Could not load tasks.");
      return;
    }

    allTasks = (data || []).sort((a, b) => {
      const aDue = a.due_date || "9999-12-31";
      const bDue = b.due_date || "9999-12-31";
      return aDue.localeCompare(bDue) || String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });

    hasLoadedTaskPage = true;
    renderTaskPage();
    renderClients();
    renderProjectPage();
    renderReports();
    renderDashboard();
  }

  async function refreshTaskPageIfLoaded() {
    if (hasLoadedTaskPage) {
      await loadTaskPage();
    }
  }

  function openTaskForm(task = null) {
    const panel = document.getElementById("taskFormPanel");
    const form = document.getElementById("taskPageForm");
    const title = document.getElementById("taskFormTitle");
    if (!panel || !form) return;

    populateTaskProjectOptions();
    form.reset();
    document.getElementById("taskPageId").value = task?.id || "";
    document.getElementById("taskTitleInput").value = task?.title || "";
    document.getElementById("taskProjectInput").value = task?.project_id || "";
    document.getElementById("taskStatusInput").value = task ? taskEffectiveStatus(task) : "todo";
    document.getElementById("taskDueDateInput").value = task?.due_date || "";
    document.getElementById("taskNotesInput").value = task?.notes || "";
    if (title) title.textContent = task ? "Edit task" : "Add task";

    panel.hidden = false;
    document.getElementById("taskTitleInput")?.focus();
  }

  function closeTaskForm() {
    const panel = document.getElementById("taskFormPanel");
    document.getElementById("taskPageForm")?.reset();
    if (panel) panel.hidden = true;
  }

  function taskPayloadFromForm() {
    const columns = taskColumnSet();
    const statusValue = document.getElementById("taskStatusInput").value;
    const payload = {
      title: document.getElementById("taskTitleInput").value.trim()
    };

    assignTaskField(payload, columns, "project_id", document.getElementById("taskProjectInput").value || null);
    assignTaskField(payload, columns, "due_date", document.getElementById("taskDueDateInput").value || null);
    assignTaskField(payload, columns, "notes", document.getElementById("taskNotesInput").value.trim());

    if (columns.has("archived")) {
      payload.archived = statusValue === "archived";
      if (statusValue !== "archived") {
        assignTaskField(payload, columns, "status", statusValue);
      }
    } else {
      assignTaskField(payload, columns, "status", statusValue);
    }

    return payload;
  }

  function activityGroup(type = "") {
    type = String(type || "");
    if (type.includes("note")) return "note";
    if (type.includes("attachment")) return "attachment";
    if (type.includes("status")) return "status";
    if (type.startsWith("client_")) return "client";
    if (type.startsWith("project_")) return "project";
    if (type.startsWith("task_")) return "task";
    return "activity";
  }

  function activityIcon(type = "") {
    const group = activityGroup(type);
    const icons = {
      client: "building-2",
      project: "folder-kanban",
      task: "list-checks",
      note: "file-text",
      attachment: "paperclip",
      status: "shuffle",
      activity: "activity"
    };

    return icons[group] || "activity";
  }

  function relatedActivityText(activity) {
    const metadata = activity.metadata || {};
    const parts = [
      metadata.client_name,
      metadata.project_name,
      metadata.task_title
    ].filter(Boolean);

    return parts.length ? parts.join(" / ") : "CRM";
  }

  function filteredActivities() {
    const searchTerm = normalizeText(document.getElementById("activitySearch")?.value || "");
    const typeFilter = document.getElementById("activityTypeFilter")?.value || "all";

    return allActivities.filter(activity => {
      const group = activityGroup(activity.activity_type);
      const metadata = activity.metadata || {};

      if (typeFilter !== "all" && group !== typeFilter) return false;

      const searchable = [
        activity.activity_type,
        activity.title,
        activity.description,
        metadata.client_name,
        metadata.project_name,
        metadata.task_title
      ].filter(Boolean).join(" ");

      return !searchTerm || normalizeText(searchable).includes(searchTerm);
    });
  }

  function renderActivities() {
    const list = document.getElementById("activityTimelineList");
    if (!list) return;

    const activities = filteredActivities();
    list.innerHTML = "";

    if (!activities.length) {
      const empty = document.createElement("div");
      empty.className = "activity-timeline-empty";
      empty.textContent = "No activity found.";
      list.appendChild(empty);
      return;
    }

    activities.forEach(activity => {
      const item = document.createElement("article");
      item.className = "activity-timeline-item";
      const links = [
        activity.related_client_id ? `<button class="relationship-link" type="button" data-link-client-id="${escapeHtml(activity.related_client_id)}">Client</button>` : "",
        activity.related_project_id ? `<button class="relationship-link" type="button" data-link-project-id="${escapeHtml(activity.related_project_id)}">Project</button>` : "",
        activity.related_task_id ? `<button class="relationship-link" type="button" data-link-task-id="${escapeHtml(activity.related_task_id)}">Task</button>` : ""
      ].filter(Boolean).join("");
      item.innerHTML = `
        <span class="activity-timeline-icon"><i data-lucide="${activityIcon(activity.activity_type)}"></i></span>
        <div class="activity-timeline-copy">
          <strong>${escapeHtml(activity.title || "Activity")}</strong>
          ${activity.description ? `<p>${escapeHtml(activity.description)}</p>` : ""}
          <div class="activity-timeline-meta">
            <span>${escapeHtml(formatTimestamp(activity.created_at))}</span>
            ${indicatorBadge(activity.activity_type || "activity", "cue-pending")}
            <span>${escapeHtml(relatedActivityText(activity))}</span>
            ${links}
          </div>
        </div>
      `;
      list.appendChild(item);
    });

    if (window.lucide) lucide.createIcons();
  }

  function activeProjectItems() {
    return allProjects.filter(project => {
      const stage = projectEffectiveStage(project);
      return !["archived", "lost", "completed"].includes(stage);
    });
  }

  function activeClientItems() {
    return allClients.filter(client => client.archived !== true && client.status !== "archived");
  }

  function activeTaskItems() {
    return allTasks.filter(task => taskEffectiveStatus(task) !== "archived");
  }

  function setReportText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function renderReportBars(containerId, entries, total) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "report-bar-row";
      empty.textContent = "No data yet.";
      container.appendChild(empty);
      return;
    }

    entries.forEach(entry => {
      const [label, count] = Array.isArray(entry) ? entry : [entry.label, entry.count];
      const action = Array.isArray(entry) ? "" : entry.action;
      const value = Array.isArray(entry) ? "" : entry.value;
      const percent = total ? Math.round((count / total) * 100) : 0;
      const row = document.createElement(action ? "button" : "div");
      row.className = `report-bar-row ${action ? "clickable" : ""}`;
      if (action) {
        row.type = "button";
        row.dataset.reportAction = action;
        row.dataset.reportValue = value;
      }
      row.innerHTML = `
        <div class="report-bar-label">
          <strong>${escapeHtml(label)}</strong>
          <span>${count}</span>
        </div>
        <div class="report-bar-track"><span style="width:${percent}%"></span></div>
      `;
      container.appendChild(row);
    });
  }

  function renderReportPriorityPie(containerId, entries, total) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const colors = {
      high: "#f97316",
      medium: "#5366e8",
      low: "#14b8a6"
    };
    const safeTotal = total || entries.reduce((sum, entry) => sum + entry.count, 0);
    let cursor = 0;
    const stops = safeTotal
      ? entries.map(entry => {
        const start = cursor;
        const size = (entry.count / safeTotal) * 100;
        cursor += size;
        return `${colors[entry.value] || "#94a3b8"} ${start}% ${cursor}%`;
      }).join(", ")
      : "#e2e8f0 0 100%";

    container.innerHTML = `
      <div class="report-priority-pie" style="--priority-pie-stops: ${escapeHtml(stops)}">
        <span>${safeTotal}</span>
      </div>
      <div class="report-priority-legend">
        ${entries.map(entry => {
          const percent = safeTotal ? Math.round((entry.count / safeTotal) * 100) : 0;
          return `
            <button class="report-priority-row" type="button" data-report-action="${escapeHtml(entry.action)}" data-report-value="${escapeHtml(entry.value)}">
              <span class="report-priority-dot" style="--priority-color: ${escapeHtml(colors[entry.value] || "#94a3b8")}"></span>
              <strong>${escapeHtml(entry.label)}</strong>
              <span>${entry.count} / ${percent}%</span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function reportTaskPriority(task) {
    const project = projectForTask(task);
    return normalizePriority(project?.priority || "normal");
  }

  function reportActivityTarget(activity) {
    if (activity.related_task_id) return { type: "task", id: activity.related_task_id };
    if (activity.related_project_id) return { type: "project", id: activity.related_project_id };
    if (activity.related_client_id) return { type: "client", id: activity.related_client_id };
    return null;
  }

  function reportDrilldownEmpty(text = "No records found for this report.") {
    return `<div class="attachment-empty">${escapeHtml(text)}</div>`;
  }

  function reportTaskRow(task) {
    const project = projectForTask(task);
    return `
      <button class="report-drilldown-item ${taskCueClass(task)}" type="button" data-link-task-id="${escapeHtml(task.id)}">
        <span>
          <strong>${escapeHtml(task.title || "Untitled Task")}</strong>
          <small>${escapeHtml([project?.project_name || "No project", clientNameForProject(project), task.due_date ? `Due ${task.due_date}` : "No due date"].filter(Boolean).join(" / "))}</small>
        </span>
        ${taskStatusBadge(task)}
      </button>
    `;
  }

  function reportProjectRow(project) {
    return `
      <button class="report-drilldown-item ${projectCueClass(project)}" type="button" data-link-project-id="${escapeHtml(project.id)}">
        <span>
          <strong>${escapeHtml(project.project_name || "Untitled Project")}</strong>
          <small>${escapeHtml([projectClientName(project), formatMoney(project.value || project.quote_value || 0)].filter(Boolean).join(" / "))}</small>
        </span>
        ${projectStatusBadge(project)}
      </button>
    `;
  }

  function reportClientRow(client) {
    return `
      <button class="report-drilldown-item" type="button" data-link-client-id="${escapeHtml(client.id)}">
        <span>
          <strong>${escapeHtml(clientDisplayName(client))}</strong>
          <small>${escapeHtml([client.company, client.contact_name, client.email].filter(Boolean).join(" / ") || "Client record")}</small>
        </span>
        ${clientStatusBadge(client)}
      </button>
    `;
  }

  function reportActivityRow(activity) {
    const target = reportActivityTarget(activity);
    const linkAttr = target ? `data-link-${target.type}-id="${escapeHtml(target.id)}"` : "";
    return `
      <button class="report-drilldown-item" type="button" ${linkAttr}>
        <span>
          <strong>${escapeHtml(activity.title || "Activity")}</strong>
          <small>${escapeHtml([relatedActivityText(activity), activity.description, formatTimestamp(activity.created_at)].filter(Boolean).join(" / "))}</small>
        </span>
        ${indicatorBadge(activityGroup(activity.activity_type), "cue-pending")}
      </button>
    `;
  }

  function projectIsPastDue(project) {
    const stage = projectEffectiveStage(project);
    const dueDate = project?.estimated_completion_date || project?.due_date || "";
    return !["archived", "lost", "completed"].includes(stage) && dueDate && dueDate < todayIso();
  }

  function reportPastDueItems() {
    const overdueTasks = activeTaskItems()
      .filter(taskIsOverdue)
      .map(task => ({ type: "task", record: task, dueDate: task.due_date || "" }));
    const overdueProjects = allProjects
      .filter(projectIsPastDue)
      .map(project => ({ type: "project", record: project, dueDate: project.estimated_completion_date || project.due_date || "" }));

    return [...overdueTasks, ...overdueProjects]
      .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
  }

  function reportPastDueRow(item) {
    if (item.type === "project") {
      const project = item.record;
      return `
        <button class="report-drilldown-item ${projectCueClass(project)}" type="button" data-link-project-id="${escapeHtml(project.id)}">
          <span>
            <strong>${escapeHtml(project.project_name || "Untitled Project")}</strong>
            <small>${escapeHtml([projectClientName(project), item.dueDate ? `Due ${item.dueDate}` : "Past due project"].filter(Boolean).join(" / "))}</small>
          </span>
          ${projectStatusBadge(project)}
        </button>
      `;
    }

    return reportTaskRow(item.record);
  }

  function renderReportPipeline(projects = allProjects) {
    const board = document.getElementById("reportPipelineBoard");
    if (!board) return;

    const stages = ["new", "discovery", "proposal", "build", "launch", "completed", "lost", "archived"];
    board.innerHTML = "";

    stages.forEach(stage => {
      const stageProjects = projects
        .filter(project => projectEffectiveStage(project) === stage)
        .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
      const stageValue = stageProjects.reduce((sum, project) => sum + Number(project.value || project.quote_value || 0), 0);
      const column = document.createElement("article");
      column.className = "report-pipeline-stage";
      column.innerHTML = `
        <button class="report-pipeline-stage-action" type="button" data-report-action="projects-status" data-report-value="${escapeHtml(stage)}">
          <span class="report-pipeline-stage-title">
            <strong>${escapeHtml(projectStageLabel(stage))}</strong>
            <span>${stageProjects.length}</span>
          </span>
          <span class="report-pipeline-stage-total">${formatMoney(stageValue)}</span>
        </button>
        ${stageProjects.length ? stageProjects.map(project => `
          <button class="report-pipeline-card ${projectCueClass(project)}" type="button" data-link-project-id="${escapeHtml(project.id)}">
            <strong>${escapeHtml(project.project_name || "Untitled Project")}</strong>
            <small>${escapeHtml(projectClientName(project))}</small>
            <span class="report-pipeline-card-meta">
              <span>${formatMoney(project.value || project.quote_value || 0)}</span>
              ${priorityBadge(project.priority)}
            </span>
          </button>
        `).join("") : '<div class="attachment-empty">No projects.</div>'}
      `;
      board.appendChild(column);
    });
  }

  function reportTaskPipelineStatus(task) {
    if (taskIsOverdue(task)) return "past-due";
    return taskEffectiveStatus(task);
  }

  function reportTaskPipelineLabel(status = "todo") {
    if (status === "past-due") return "Past due";
    return taskStatusLabel(status);
  }

  function renderReportTaskPipeline(tasks = activeTaskItems()) {
    const board = document.getElementById("reportTaskPipelineBoard");
    if (!board) return;

    const stages = ["todo", "doing", "done", "past-due"];
    board.innerHTML = "";

    stages.forEach(stage => {
      const stageTasks = tasks
        .filter(task => reportTaskPipelineStatus(task) === stage)
        .sort((a, b) => {
          const aDue = a.due_date || "9999-12-31";
          const bDue = b.due_date || "9999-12-31";
          return aDue.localeCompare(bDue) || String(b.created_at || "").localeCompare(String(a.created_at || ""));
        });
      const prioritySummary = ["high", "medium", "low"]
        .map(priority => {
          const count = stageTasks.filter(task => reportTaskPriority(task) === priority).length;
          return count ? `${count} ${priorityLabel(priority).replace(" Priority", "")}` : "";
        })
        .filter(Boolean)
        .join(" / ");
      const column = document.createElement("article");
      column.className = "report-pipeline-stage";
      column.innerHTML = `
        <button class="report-pipeline-stage-action" type="button" data-report-action="tasks-status" data-report-value="${escapeHtml(stage)}">
          <span class="report-pipeline-stage-title">
            <strong>${escapeHtml(reportTaskPipelineLabel(stage))}</strong>
            <span>${stageTasks.length}</span>
          </span>
          <span class="report-pipeline-stage-total">${escapeHtml(prioritySummary || "No priority flags")}</span>
        </button>
        ${stageTasks.length ? stageTasks.map(task => {
          const project = projectForTask(task);
          return `
            <button class="report-pipeline-card ${taskCueClass(task)}" type="button" data-link-task-id="${escapeHtml(task.id)}">
              <strong>${escapeHtml(task.title || "Untitled Task")}</strong>
              <small>${escapeHtml([project?.project_name || "No project", clientNameForProject(project)].filter(Boolean).join(" / "))}</small>
              <span class="report-pipeline-card-meta">
                <span>${escapeHtml(task.due_date ? `Due ${task.due_date}` : "No due date")}</span>
                ${priorityBadge(reportTaskPriority(task))}
              </span>
            </button>
          `;
        }).join("") : '<div class="attachment-empty">No tasks.</div>'}
      `;
      board.appendChild(column);
    });
  }

  function openReportDrilldown(title, items, renderer, emptyText) {
    const panel = document.getElementById("reportDrilldownPanel");
    const heading = document.getElementById("reportDrilldownTitle");
    const list = document.getElementById("reportDrilldownList");
    if (!panel || !heading || !list) return;

    heading.textContent = title;
    list.innerHTML = items.length ? items.map(renderer).join("") : reportDrilldownEmpty(emptyText);
    panel.scrollIntoView({ block: "nearest" });
    if (window.lucide) lucide.createIcons();
  }

  function handleReportAction(action, value = "") {
    const projects = allProjects;
    const activeProjects = activeProjectItems();
    const activeClients = activeClientItems();
    const tasks = activeTaskItems();
    const openTasks = tasks.filter(task => taskEffectiveStatus(task) !== "done");
    const completedTasks = tasks.filter(task => taskEffectiveStatus(task) === "done");
    const today = new Date().toISOString().slice(0, 10);
    const overdueTasks = openTasks.filter(task => task.due_date && task.due_date < today);
    const pastDueItems = reportPastDueItems();

    const actions = {
      "active-projects": () => openReportDrilldown("Active projects", activeProjects, reportProjectRow, "No active projects."),
      "pipeline-projects": () => openReportDrilldown("Pipeline projects", activeProjects, reportProjectRow, "No active pipeline projects."),
      "completed-projects": () => openReportDrilldown("Completed projects", projects.filter(project => projectEffectiveStage(project) === "completed"), reportProjectRow, "No completed projects."),
      "active-clients": () => openReportDrilldown("Active clients", activeClients, reportClientRow, "No active clients."),
      "past-due-items": () => openReportDrilldown("Past due items", pastDueItems, reportPastDueRow, "No past due items."),
      "open-tasks": () => openReportDrilldown("Open tasks", openTasks, reportTaskRow, "No open tasks."),
      "completed-tasks": () => openReportDrilldown("Completed tasks", completedTasks, reportTaskRow, "No completed tasks."),
      "overdue-tasks": () => openReportDrilldown("Overdue tasks", overdueTasks, reportTaskRow, "No overdue tasks."),
      "tasks-priority": () => openReportDrilldown(`${priorityLabel(value)} tasks`, tasks.filter(task => reportTaskPriority(task) === value), reportTaskRow, "No tasks in this priority group."),
      "tasks-status": () => {
        const matchingTasks = tasks.filter(task => reportTaskPipelineStatus(task) === value);
        openReportDrilldown(`${reportTaskPipelineLabel(value)} tasks`, matchingTasks, reportTaskRow, "No tasks in this status group.");
      },
      "projects-status": () => openReportDrilldown(`${projectStageLabel(value)} projects`, projects.filter(project => projectEffectiveStage(project) === value), reportProjectRow, "No projects in this status group."),
      "recent-activity": () => openReportDrilldown("Recent activity", allActivities.slice(0, 10), reportActivityRow, "No recent activity.")
    };

    actions[action]?.();
  }

  function renderReports() {
    const activeProjects = activeProjectItems();
    const tasks = activeTaskItems();
    const completedProjects = allProjects.filter(project => projectEffectiveStage(project) === "completed");
    const pipelineValue = activeProjects.reduce((sum, project) => sum + Number(project.value || project.quote_value || 0), 0);
    const completedRevenue = completedProjects.reduce((sum, project) => sum + Number(project.final_value || project.value || project.quote_value || 0), 0);
    const pastDueItems = reportPastDueItems();

    setReportText("reportActiveProjects", activeProjects.length);
    setReportText("reportProjectsSubtext", `${completedProjects.length} completed / ${allProjects.length} total`);
    setReportText("reportPastDueItems", pastDueItems.length);
    setReportText("reportPastDueSubtext", pastDueItems.length ? "View items needing attention" : "Nothing past due");
    setReportText("reportPipelineValue", formatMoney(pipelineValue));
    setReportText("reportCompletedRevenue", formatMoney(completedRevenue));
    setReportText("reportCompletedProjects", `${completedProjects.length} completed projects`);
    document.getElementById("reportPastDueCard")?.classList.toggle("danger", pastDueItems.length > 0);

    const priorityCounts = ["high", "medium", "low"].map(priority => {
      return {
        label: priorityLabel(priority),
        count: tasks.filter(task => reportTaskPriority(task) === priority).length,
        action: "tasks-priority",
        value: priority
      };
    });
    renderReportPriorityPie("reportTasksByPriority", priorityCounts, tasks.length);
    renderReportPipeline(allProjects);
    renderReportTaskPipeline(tasks);

    const recentContainer = document.getElementById("reportActivitySummary");
    if (recentContainer) {
      recentContainer.innerHTML = "";
      const recent = allActivities.slice(0, 5);
      if (!recent.length) {
        const empty = document.createElement("div");
        empty.className = "report-activity-row";
        empty.textContent = "No recent activity yet.";
        recentContainer.appendChild(empty);
      } else {
        recent.forEach(activity => {
          const row = document.createElement("button");
          const target = reportActivityTarget(activity);
          row.type = "button";
          row.className = "report-activity-row clickable";
          if (target) row.dataset[`link${target.type.charAt(0).toUpperCase() + target.type.slice(1)}Id`] = target.id;
          row.innerHTML = `
            <strong>${escapeHtml(activity.title || "Activity")}</strong>
            <span>${escapeHtml([relatedActivityText(activity), formatTimestamp(activity.created_at)].filter(Boolean).join(" / "))}</span>
          `;
          recentContainer.appendChild(row);
        });
      }
    }

    if (window.lucide) lucide.createIcons();
  }

  function setDashboardText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function dashboardEmpty(text = "Nothing needs attention right now.") {
    return `<div class="dashboard-empty">${escapeHtml(text)}</div>`;
  }

  function dashboardTaskItem(task, label = "") {
    const project = projectForTask(task);
    return `
      <button class="dashboard-action-item ${taskCueClass(task)}" type="button" data-link-task-id="${escapeHtml(task.id)}">
        <span>
          <strong>${escapeHtml(task.title || "Untitled Task")}</strong>
          <small>${escapeHtml([project?.project_name, clientNameForProject(project), label].filter(Boolean).join(" / "))}</small>
        </span>
        ${taskStatusBadge(task)}
      </button>
    `;
  }

  function dashboardProjectItem(project) {
    const openTaskCount = openTasksForProject(project).length;
    const stage = projectEffectiveStage(project);
    const progress = Number(project.progress || 0);
    const healthLabel = openTaskCount > 0 ? `${openTaskCount} open tasks` : "No open tasks";

    return `
      <button class="dashboard-action-item ${projectCueClass(project)}" type="button" data-link-project-id="${escapeHtml(project.id)}">
        <span>
          <strong>${escapeHtml(project.project_name || "Untitled Project")}</strong>
          <small>${escapeHtml(`${projectClientName(project)} / ${progress}% progress / ${healthLabel}`)}</small>
        </span>
        ${projectStatusBadge(project)}
      </button>
    `;
  }

  function renderDashboardList(id, htmlItems, emptyText) {
    const list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = htmlItems.length ? htmlItems.join("") : dashboardEmpty(emptyText);
  }

  function renderDashboard() {
    const activeProjects = activeProjectItems();
    const activeClients = activeClientItems();
    const tasks = activeTaskItems();
    const openTasks = tasks.filter(task => taskEffectiveStatus(task) !== "done");
    const completedTasks = tasks.filter(task => taskEffectiveStatus(task) === "done");
    const today = new Date().toISOString().slice(0, 10);
    const upcomingLimit = new Date();
    upcomingLimit.setDate(upcomingLimit.getDate() + 7);
    const upcomingDate = upcomingLimit.toISOString().slice(0, 10);
    const overdueTasks = openTasks
      .filter(task => task.due_date && task.due_date < today)
      .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));
    const todayTasks = openTasks
      .filter(task => task.due_date === today)
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    const upcomingTasks = openTasks
      .filter(task => task.due_date && task.due_date > today && task.due_date <= upcomingDate)
      .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));
    const pipelineValue = activeProjects.reduce((sum, project) => sum + Number(project.value || project.quote_value || 0), 0);

    setDashboardText("dashboardPipelineValue", formatMoney(pipelineValue));
    setDashboardText("dashboardActiveProjects", activeProjects.length);
    setDashboardText("dashboardActiveClientsText", `Across ${activeClients.length} active clients`);
    setDashboardText("dashboardNeedsAttention", overdueTasks.length + todayTasks.length);
    setDashboardText("dashboardAttentionText", `${overdueTasks.length} overdue / ${todayTasks.length} due today`);
    setDashboardText("dashboardTaskProgress", `${openTasks.length} / ${completedTasks.length}`);

    renderDashboardList(
      "dashboardOverdueTasks",
      overdueTasks.slice(0, 5).map(task => dashboardTaskItem(task, `Due ${task.due_date}`)),
      "No overdue tasks."
    );

    renderDashboardList(
      "dashboardTodayTasks",
      todayTasks.slice(0, 5).map(task => dashboardTaskItem(task, "Due today")),
      "No tasks due today."
    );

    renderDashboardList(
      "dashboardUpcomingDeadlines",
      upcomingTasks.slice(0, 5).map(task => dashboardTaskItem(task, `Due ${task.due_date}`)),
      "No upcoming deadlines this week."
    );

    const healthProjects = [...activeProjects]
      .sort((a, b) => openTasksForProject(b).length - openTasksForProject(a).length)
      .slice(0, 6);
    renderDashboardList(
      "dashboardProjectHealthList",
      healthProjects.map(dashboardProjectItem),
      "No active project health indicators yet."
    );

    const recentClientIds = [
      ...allActivities.map(activity => activity.related_client_id).filter(Boolean),
      ...activeProjects.map(project => clientForProject(project)?.id).filter(Boolean)
    ];
    const recentClients = activeClients
      .filter(client => recentClientIds.includes(client.id))
      .slice(0, 5);
    renderDashboardList(
      "dashboardActiveClients",
      recentClients.map(client => `
        <button class="dashboard-action-item ${clientCueClass(client)}" type="button" data-link-client-id="${escapeHtml(client.id)}">
          <span>
            <strong>${escapeHtml(clientDisplayName(client))}</strong>
            <small>${escapeHtml([client.company, client.contact_name, client.email].filter(Boolean).join(" / ") || "Active client")}</small>
          </span>
          ${clientStatusBadge(client)}
        </button>
      `),
      "No recent client activity yet."
    );

    const focusTask = overdueTasks[0] || todayTasks[0] || upcomingTasks[0];
    const focusProject = activeProjects.find(project => projectEffectiveStage(project) === "proposal") || activeProjects[0];
    const focus = document.getElementById("dashboardSuggestedFocus");
    if (focus) {
      if (focusTask) {
        const project = projectForTask(focusTask);
        focus.innerHTML = `
          <strong>${escapeHtml(focusTask.title || "Task needs attention")}</strong>
          <p>${escapeHtml([project?.project_name, focusTask.due_date ? `Due ${focusTask.due_date}` : ""].filter(Boolean).join(" / ") || "Open task")}</p>
          <button class="primary-btn small dashboard-action-item" type="button" data-link-task-id="${escapeHtml(focusTask.id)}">Open Task</button>
        `;
      } else if (focusProject) {
        focus.innerHTML = `
          <strong>${escapeHtml(focusProject.project_name || "Project needs focus")}</strong>
          <p>${escapeHtml(`${projectClientName(focusProject)} / ${projectStageLabel(projectEffectiveStage(focusProject))}`)}</p>
          <button class="primary-btn small dashboard-action-item" type="button" data-link-project-id="${escapeHtml(focusProject.id)}">Open Project</button>
        `;
      } else {
        focus.innerHTML = "<strong>No urgent focus yet</strong><p>Your highest-priority CRM item will appear here.</p>";
      }
    }

    const recentItems = [
      ...allNotes.slice(0, 3).map(note => ({
        title: `${noteTypeLabel(note.note_type)} note`,
        description: note.body,
        timestamp: note.created_at,
        taskId: note.related_task_id,
        projectId: note.related_project_id,
        clientId: note.related_client_id
      })),
      ...allActivities.slice(0, 5).map(activity => ({
        title: activity.title,
        description: activity.description || relatedActivityText(activity),
        timestamp: activity.created_at,
        taskId: activity.related_task_id,
        projectId: activity.related_project_id,
        clientId: activity.related_client_id
      }))
    ].sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || ""))).slice(0, 5);

    const activityList = document.getElementById("dashboardRecentActivity");
    if (activityList) {
      activityList.innerHTML = recentItems.length
        ? recentItems.map(item => {
          const linkAttr = item.taskId
            ? `data-link-task-id="${escapeHtml(item.taskId)}"`
            : item.projectId
              ? `data-link-project-id="${escapeHtml(item.projectId)}"`
              : item.clientId
                ? `data-link-client-id="${escapeHtml(item.clientId)}"`
                : "";
          return `
            <button class="activity-item dashboard-activity-link" type="button" ${linkAttr}>
              <span></span>
              <p><strong>${escapeHtml(item.title || "Activity")}</strong>${item.description ? ` ${escapeHtml(item.description)}` : ""}</p>
              <small>${escapeHtml(formatTimestamp(item.timestamp))}</small>
            </button>
          `;
        }).join("")
        : dashboardEmpty("No recent notes or activity yet.");
    }

    renderDashboardList(
      "dashboardCompactTasks",
      [...todayTasks, ...overdueTasks, ...upcomingTasks].slice(0, 4).map(task => dashboardTaskItem(task, task.due_date ? `Due ${task.due_date}` : "")),
      "No immediate task focus."
    );

    if (window.lucide) lucide.createIcons();
  }

  async function loadActivities() {
    if (!currentSession) return;

    const { data, error } = await supabaseClient
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Load activities failed:", error);
      alert("Could not load activity. Run supabase-activities-schema.sql if the table is missing.");
      return;
    }

    allActivities = data || [];
    hasLoadedActivities = true;
    renderActivities();
    renderReports();
    renderClientPageActivity(selectedClient());
    renderProjectPageActivity(selectedProjectPage());
    renderTaskPageActivity(selectedTask());
    renderDashboard();
  }

  async function logActivity({
    type,
    title,
    description = "",
    clientId = null,
    projectId = null,
    taskId = null,
    metadata = {}
  }) {
    if (!currentSession) return;

    const { error } = await supabaseClient
      .from("activities")
      .insert([{
        activity_type: type,
        title,
        description,
        related_client_id: clientId,
        related_project_id: projectId,
        related_task_id: taskId,
        metadata
      }]);

    if (error) {
      console.error("Create activity failed:", error);
      return;
    }

    if (hasLoadedActivities) {
      await loadActivities();
    }
  }

  function clientActivityMetadata(client) {
    return {
      client_name: client ? clientDisplayName(client) : ""
    };
  }

  function projectActivityMetadata(project) {
    return {
      project_name: project?.project_name || "Untitled Project",
      client_name: projectClientName(project)
    };
  }

  async function navigateToClient(clientId) {
    if (!clientId) return;
    if (!hasLoadedClients) await loadClients();
    selectedClientId = clientId;
    window.location.hash = `#clients/${encodeURIComponent(clientId)}`;
    renderRoute(`clients/${clientId}`);
  }

  async function navigateToProject(projectId) {
    if (!projectId) return;
    selectedProjectPageId = projectId;
    window.location.hash = `#projects/${encodeURIComponent(projectId)}`;
    renderRoute(`projects/${projectId}`);
  }

  async function navigateToTask(taskId) {
    if (!taskId) return;
    if (!hasLoadedTaskPage) await loadTaskPage();
    selectedTaskId = taskId;
    window.location.hash = `#tasks/${encodeURIComponent(taskId)}`;
    renderRoute(`tasks/${taskId}`);
  }

  function globalSearchItems() {
    const projectItems = allProjects.map(project => ({
      type: "Project",
      id: project.id,
      title: project.project_name || "Untitled Project",
      subtitle: `${projectClientName(project)} / ${projectStageLabel(projectEffectiveStage(project))}`,
      search: [
        project.project_name,
        project.client_name,
        project.contact_name,
        project.contact_company,
        project.contact_email,
        project.project_type,
        projectStageLabel(projectEffectiveStage(project))
      ].filter(Boolean).join(" "),
      action: () => navigateToProject(project.id)
    }));

    const clientItems = allClients.map(client => ({
      type: "Client",
      id: client.id,
      title: clientDisplayName(client),
      subtitle: [client.company, client.contact_name, client.email].filter(Boolean).join(" / ") || "Client record",
      search: [
        clientDisplayName(client),
        client.company,
        client.contact_name,
        client.email,
        client.phone,
        client.website
      ].filter(Boolean).join(" "),
      action: () => navigateToClient(client.id)
    }));

    const taskItems = allTasks.map(task => {
      const project = projectForTask(task);
      return {
        type: "Task",
        id: task.id,
        title: task.title || "Untitled Task",
        subtitle: `${project?.project_name || "No project"} / ${taskStatusLabel(taskEffectiveStatus(task))}`,
        search: [
          task.title,
          task.notes,
          taskStatusLabel(taskEffectiveStatus(task)),
          project?.project_name,
          clientNameForProject(project)
        ].filter(Boolean).join(" "),
        action: () => navigateToTask(task.id)
      };
    });

    const activityItems = allActivities.map(activity => {
      const metadata = activity.metadata || {};
      const action = activity.related_task_id
        ? () => navigateToTask(activity.related_task_id)
        : activity.related_project_id
          ? () => navigateToProject(activity.related_project_id)
          : activity.related_client_id
            ? () => navigateToClient(activity.related_client_id)
            : () => {
              window.location.hash = "#activity";
              renderRoute("activity");
            };

      return {
        type: "Activity",
        id: activity.id,
        title: activity.title || "Activity",
        subtitle: `${formatTimestamp(activity.created_at)} / ${relatedActivityText(activity)}`,
        search: [
          activity.title,
          activity.description,
          activity.activity_type,
          metadata.client_name,
          metadata.project_name,
          metadata.task_title
        ].filter(Boolean).join(" "),
        action
      };
    });

    return [...projectItems, ...clientItems, ...taskItems, ...activityItems];
  }

  async function ensureGlobalSearchData() {
    if (!currentSession) return;
    if (!hasLoadedClients) await loadClients();
    if (!hasLoadedTaskPage) await loadTaskPage();
    if (!hasLoadedActivities) await loadActivities();
  }

  function taskActivityMetadata(task, project = projectForTask(task)) {
    return {
      task_title: task?.title || "Untitled Task",
      project_name: project?.project_name || "",
      client_name: clientNameForProject(project)
    };
  }

  function noteRelationshipText(note) {
    const project = note.related_project_id
      ? allProjects.find(item => String(item.id) === String(note.related_project_id))
      : null;
    const task = note.related_task_id
      ? allTasks.find(item => String(item.id) === String(note.related_task_id))
      : null;
    const client = note.related_client_id
      ? allClients.find(item => String(item.id) === String(note.related_client_id))
      : null;

    if (task) return `Task: ${task.title || "Untitled Task"}`;
    if (project) return `Project: ${project.project_name || "Untitled Project"}`;
    if (client) return `Client: ${clientDisplayName(client)}`;
    return "CRM note";
  }

  function notesForRelation({ clientId = null, projectId = null, taskId = null }) {
    return allNotes.filter(note => {
      if (taskId) return String(note.related_task_id || "") === String(taskId);
      if (projectId) return String(note.related_project_id || "") === String(projectId) && !note.related_task_id;
      if (clientId) return String(note.related_client_id || "") === String(clientId) && !note.related_project_id && !note.related_task_id;
      return false;
    });
  }

  function renderNotesTimeline(containerId, relation, legacyNote = "") {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    const notes = notesForRelation(relation);
    const entries = [...notes];

    if (legacyNote) {
      entries.push({
        id: "legacy",
        body: legacyNote,
        note_type: "update",
        created_at: new Date(0).toISOString(),
        related_client_id: relation.clientId,
        related_project_id: relation.projectId,
        related_task_id: relation.taskId,
        isLegacy: true
      });
    }

    entries.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "notes-timeline-empty";
      empty.textContent = "No timeline notes yet.";
      container.appendChild(empty);
      return;
    }

    entries.forEach(note => {
      const item = document.createElement("article");
      item.className = "note-timeline-item";
      item.innerHTML = `
        <span class="note-timeline-dot"></span>
        <div class="note-timeline-copy">
          <strong>${escapeHtml(noteTypeLabel(note.note_type))}</strong>
          <p>${escapeHtml(note.body || "")}</p>
          <div class="note-timeline-meta">
            <span>${escapeHtml(note.isLegacy ? "Legacy note" : formatTimestamp(note.created_at))}</span>
            <span>${escapeHtml(noteRelationshipText(note))}</span>
          </div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  async function loadNotes() {
    if (!currentSession) return;

    const { data, error } = await supabaseClient
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load notes failed:", error);
      return;
    }

    allNotes = data || [];
    hasLoadedNotes = true;
    renderClients();
    renderProjectPage();
    renderTaskPage();
    renderDashboard();
  }

  async function createNote({ body, noteType, clientId = null, projectId = null, taskId = null }) {
    if (!body.trim()) return;

    const { error } = await supabaseClient
      .from("notes")
      .insert([{
        body: body.trim(),
        note_type: noteType || "update",
        related_client_id: clientId,
        related_project_id: projectId,
        related_task_id: taskId
      }]);

    if (error) {
      console.error("Create note failed:", error);
      alert("Could not save note. Run supabase-notes-schema.sql if the table is missing.");
      return;
    }

    await logActivity({
      type: "note_added",
      title: "Note added",
      description: body.trim(),
      clientId,
      projectId,
      taskId,
      metadata: {
        client_name: clientId ? clientDisplayName(allClients.find(client => String(client.id) === String(clientId))) : "",
        project_name: projectId ? allProjects.find(project => String(project.id) === String(projectId))?.project_name : "",
        task_title: taskId ? allTasks.find(task => String(task.id) === String(taskId))?.title : ""
      }
    });

    await loadNotes();
  }

  function currentQuickAddContext() {
    const route = (window.location.hash || "").replace("#", "").toLowerCase();

    if (route === "clients") {
      const client = selectedClient();
      if (client) return { type: "client", client, label: `Client: ${clientDisplayName(client)}` };
    }

    if (route === "projects") {
      const project = selectedProjectPage();
      if (project) {
        return {
          type: "project",
          project,
          client: clientForProject(project),
          label: `Project: ${project.project_name || "Untitled Project"}`
        };
      }
    }

    if (route === "tasks") {
      const task = selectedTask();
      const project = projectForTask(task);
      if (task) {
        return {
          type: "task",
          task,
          project,
          client: clientForProject(project),
          label: `Task: ${task.title || "Untitled Task"}`
        };
      }
    }

    return { type: "none", label: "No related record selected." };
  }

  function projectOptions(selectedProjectId = "") {
    return [
      '<option value="">No project</option>',
      ...allProjects.map(project => {
        const selected = String(project.id) === String(selectedProjectId) ? "selected" : "";
        return `<option value="${escapeHtml(project.id)}" ${selected}>${escapeHtml(project.project_name || "Untitled Project")}</option>`;
      })
    ].join("");
  }

  function renderQuickAddFields() {
    const type = document.getElementById("quickAddType")?.value || "client";
    const fields = document.getElementById("quickAddFields");
    const contextEl = document.getElementById("quickAddContext");
    const context = currentQuickAddContext();
    if (!fields) return;

    if (contextEl) contextEl.textContent = context.label;

    if (type === "client") {
      fields.innerHTML = `
        <label>Client Name<input id="quickClientName" type="text" required placeholder="Example: North Ridge Dental" /></label>
        <label>Email<input id="quickClientEmail" type="email" placeholder="contact@example.com" /></label>
      `;
      return;
    }

    if (type === "project") {
      const clientName = context.client ? clientDisplayName(context.client) : "";
      fields.innerHTML = `
        <label>Project Name<input id="quickProjectName" type="text" required placeholder="Example: CRM workflow setup" /></label>
        <label>Client<input id="quickProjectClient" type="text" value="${escapeHtml(clientName)}" placeholder="Client name" /></label>
        <label>Status
          <select id="quickProjectStage">
            <option value="new">New</option>
            <option value="discovery">Discovery</option>
            <option value="proposal">Proposal</option>
            <option value="build">Build</option>
            <option value="launch">Test / Launch</option>
          </select>
        </label>
      `;
      return;
    }

    if (type === "task") {
      const selectedProjectId = context.project?.id || "";
      fields.innerHTML = `
        <label>Task Title<input id="quickTaskTitle" type="text" required placeholder="Example: Send recap email" /></label>
        <label>Project<select id="quickTaskProject">${projectOptions(selectedProjectId)}</select></label>
        <label>Due Date<input id="quickTaskDueDate" type="date" /></label>
      `;
      return;
    }

    fields.innerHTML = `
      <label>Note Type
        <select id="quickNoteType">
          <option value="update">Update</option>
          <option value="internal">Internal</option>
          <option value="follow-up">Follow-Up</option>
          <option value="meeting">Meeting</option>
          <option value="issue">Issue</option>
          <option value="completed">Completed</option>
        </select>
      </label>
      <label>Note<textarea id="quickNoteBody" required placeholder="Add a quick note..."></textarea></label>
    `;
  }

  function openQuickAddModal(type = "client") {
    const modal = document.getElementById("quickAddModal");
    const select = document.getElementById("quickAddType");
    if (select) select.value = type;
    renderQuickAddFields();
    modal?.classList.add("open");
    modal?.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => document.querySelector("#quickAddFields input, #quickAddFields textarea")?.focus(), 0);
  }

  function closeQuickAddModal() {
    const modal = document.getElementById("quickAddModal");
    document.getElementById("quickAddForm")?.reset();
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // ===== FILTERS =====
  const projectSearch = document.getElementById("projectSearch");
  const stageFilter = document.getElementById("stageFilter");
  const priorityFilter = document.getElementById("priorityFilter");
  const togglePipelineFilters = document.getElementById("togglePipelineFilters");
  const pipelineControls = document.getElementById("pipelineControls");

  function applyProjectFilters() {
    const searchTerm = projectSearch?.value.toLowerCase().trim() || "";
    const stageValue = stageFilter?.value || "all";
    const priorityValue = priorityFilter?.value || "all";

    const filtered = allProjects.filter(project => {
      const matchesSearch =
        !searchTerm ||
        [
          project.project_name,
          project.client_name,
          project.contact_name,
          project.contact_company,
          project.contact_email,
          project.project_type
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchTerm);

      const matchesStage =
        stageValue === "all" || project.stage === stageValue;

      const matchesPriority =
        priorityValue === "all" || project.priority === priorityValue;

      return matchesSearch && matchesStage && matchesPriority;
    });

    renderProjects(filtered);
    renderAllProjects(filtered);
  }

  togglePipelineFilters?.addEventListener("click", () => {
    pipelineControls?.classList.toggle("open");
  });

  projectSearch?.addEventListener("input", applyProjectFilters);
  stageFilter?.addEventListener("change", applyProjectFilters);
  priorityFilter?.addEventListener("change", applyProjectFilters);

  // ===== CLEAR FILTERS =====
  const clearFilters = document.getElementById("clearFilters");

clearFilters?.addEventListener("click", () => {
  if (projectSearch) projectSearch.value = "";
  if (stageFilter) stageFilter.value = "all";
  if (priorityFilter) priorityFilter.value = "all";

  renderProjects(allProjects);
  renderAllProjects(allProjects);
});

  // ===== CLIENTS =====
  const newClientBtn = document.getElementById("newClientBtn");
  const clientSearch = document.getElementById("clientSearch");
  const clientStatusFilter = document.getElementById("clientStatusFilter");
  const clientList = document.getElementById("clientList");
  const clientProjectList = document.getElementById("clientProjectList");
  const clientForm = document.getElementById("clientForm");
  const cancelClientForm = document.getElementById("cancelClientForm");
  const cancelClientFormSecondary = document.getElementById("cancelClientFormSecondary");
  const editClientBtn = document.getElementById("editClientBtn");
  const archiveClientBtn = document.getElementById("archiveClientBtn");
  const deleteClientBtn = document.getElementById("deleteClientBtn");

  newClientBtn?.addEventListener("click", () => openClientForm());
  clientSearch?.addEventListener("input", () => renderClients());
  clientStatusFilter?.addEventListener("change", () => renderClients());
  setupAttachmentInput("clientAttachmentInput", "client", () => selectedClientId);
  setupAttachmentDropzone("clientAttachmentDropzone", "client", () => selectedClientId);
  cancelClientForm?.addEventListener("click", closeClientForm);
  cancelClientFormSecondary?.addEventListener("click", closeClientForm);

  clientList?.addEventListener("click", e => {
    const row = e.target.closest(".client-data-row");
    if (!row) return;

    navigateToClient(row.dataset.clientId);
  });

  document.getElementById("backToClientsBtn")?.addEventListener("click", () => {
    selectedClientId = null;
    window.location.hash = "#clients";
    renderRoute("clients");
  });

  clientProjectList?.addEventListener("click", async e => {
    const projectItem = e.target.closest(".client-project-item[data-project-id]");
    if (!projectItem) return;

    await navigateToProject(projectItem.dataset.projectId);
  });

  editClientBtn?.addEventListener("click", () => {
    const client = selectedClient();
    if (client) openClientForm(client);
  });

  clientForm?.addEventListener("submit", async e => {
    e.preventDefault();

    const id = document.getElementById("clientId").value;
    const saveBtn = document.getElementById("saveClientBtn");
    const enteredName = document.getElementById("clientNameInput").value.trim();
    const payload = clientPayloadFromForm();
    const existingClient = id ? selectedClient() : null;

    if (!enteredName) return;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    const request = id
      ? supabaseClient.from("clients").update(payload).eq("id", id)
      : supabaseClient.from("clients").insert([payload]).select("*").single();

    const { data, error } = await request;

    if (error) {
      console.error("Save client failed:", error);
      alert(error.message);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Client";
      }
      return;
    }

    if (data?.id) selectedClientId = data.id;
    await logActivity({
      type: id ? "client_updated" : "client_created",
      title: id ? "Client updated" : "Client created",
      description: enteredName,
      clientId: id || data?.id || null,
      metadata: { client_name: enteredName }
    });
    if (id && existingClient?.notes !== payload.notes && payload.notes) {
      await logActivity({
        type: "client_note_added",
        title: "Client note updated",
        description: enteredName,
        clientId: id,
        metadata: { client_name: enteredName }
      });
    }
    if (id && existingClient?.status !== payload.status && payload.status) {
      await logActivity({
        type: "client_status_changed",
        title: "Client status changed",
        description: `${clientDisplayName(existingClient)} moved to ${payload.status}`,
        clientId: id,
        metadata: { client_name: enteredName }
      });
    }
    closeClientForm();
    await loadClients();

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Client";
    }
  });

  archiveClientBtn?.addEventListener("click", async () => {
    const client = selectedClient();
    if (!client) return;

    if (!confirm(`Archive ${clientDisplayName(client)}?`)) return;

    const columns = clientColumnSet();
    const archivePayload = columns.has("archived")
      ? { archived: true }
      : (!columns.size || columns.has("status") ? { status: "archived" } : null);

    if (!archivePayload) {
      alert("Archive needs a status or archived column on the clients table. Use Delete for this record instead.");
      return;
    }

    const { error } = await supabaseClient
      .from("clients")
      .update(archivePayload)
      .eq("id", client.id);

    if (error) {
      console.error("Archive client failed:", error);
      alert(error.message);
      return;
    }

    selectedClientId = null;
    await logActivity({
      type: "client_archived",
      title: "Client archived",
      description: clientDisplayName(client),
      clientId: client.id,
      metadata: clientActivityMetadata(client)
    });
    closeClientForm();
    await loadClients();
    window.location.hash = "#clients";
    renderRoute("clients");
  });

  deleteClientBtn?.addEventListener("click", async () => {
    const client = selectedClient();
    if (!client) return;

    if (!confirm(`Delete ${clientDisplayName(client)}? This cannot be undone.`)) return;

    const { error } = await supabaseClient
      .from("clients")
      .delete()
      .eq("id", client.id);

    if (error) {
      console.error("Delete client failed:", error);
      alert(error.message);
      return;
    }

    selectedClientId = null;
    await logActivity({
      type: "client_deleted",
      title: "Client deleted",
      description: clientDisplayName(client),
      metadata: clientActivityMetadata(client)
    });
    closeClientForm();
    await loadClients();
    window.location.hash = "#clients";
    renderRoute("clients");
  });

  // ===== TASKS PAGE =====
  const newTaskPageBtn = document.getElementById("newTaskPageBtn");
  const taskSearch = document.getElementById("taskSearch");
  const taskStatusFilter = document.getElementById("taskStatusFilter");
  const taskPageList = document.getElementById("taskPageList");
  const taskPageForm = document.getElementById("taskPageForm");
  const cancelTaskForm = document.getElementById("cancelTaskForm");
  const cancelTaskFormSecondary = document.getElementById("cancelTaskFormSecondary");
  const editTaskPageBtn = document.getElementById("editTaskPageBtn");
  const archiveTaskPageBtn = document.getElementById("archiveTaskPageBtn");
  const deleteTaskPageBtn = document.getElementById("deleteTaskPageBtn");

  newTaskPageBtn?.addEventListener("click", () => openTaskForm());
  taskSearch?.addEventListener("input", renderTaskPage);
  taskStatusFilter?.addEventListener("change", renderTaskPage);
  setupAttachmentInput("taskAttachmentInput", "task", () => selectedTaskId);
  setupAttachmentDropzone("taskAttachmentDropzone", "task", () => selectedTaskId);
  cancelTaskForm?.addEventListener("click", closeTaskForm);
  cancelTaskFormSecondary?.addEventListener("click", closeTaskForm);

  taskPageList?.addEventListener("click", e => {
    const row = e.target.closest(".task-data-row");
    if (!row) return;

    navigateToTask(row.dataset.taskId);
  });

  document.getElementById("backToTasksBtn")?.addEventListener("click", () => {
    selectedTaskId = null;
    window.location.hash = "#tasks";
    renderRoute("tasks");
  });

  editTaskPageBtn?.addEventListener("click", () => {
    const task = selectedTask();
    if (task) openTaskForm(task);
  });

  taskPageForm?.addEventListener("submit", async e => {
    e.preventDefault();

    const id = document.getElementById("taskPageId").value;
    const saveBtn = document.getElementById("saveTaskPageBtn");
    const payload = taskPayloadFromForm();
    const existingTask = id ? selectedTask() : null;

    if (!payload.title) return;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    const request = id
      ? supabaseClient.from("tasks").update(payload).eq("id", id)
      : supabaseClient.from("tasks").insert([payload]).select("*").single();

    const { data, error } = await request;

    if (error) {
      console.error("Save task failed:", error);
      alert(error.message);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Task";
      }
      return;
    }

    if (data?.id) selectedTaskId = data.id;
    const loggedTask = data || { ...existingTask, ...payload, id };
    const loggedProject = projectForTask(loggedTask);
    await logActivity({
      type: id ? "task_updated" : "task_created",
      title: id ? "Task updated" : "Task created",
      description: payload.title,
      projectId: loggedTask.project_id || null,
      taskId: loggedTask.id || null,
      metadata: taskActivityMetadata(loggedTask, loggedProject)
    });
    if (id && existingTask?.notes !== payload.notes && payload.notes) {
      await logActivity({
        type: "task_note_added",
        title: "Task note updated",
        description: payload.title,
        projectId: loggedTask.project_id || null,
        taskId: loggedTask.id || null,
        metadata: taskActivityMetadata(loggedTask, loggedProject)
      });
    }
    if (id && taskEffectiveStatus(existingTask) !== taskEffectiveStatus(loggedTask)) {
      await logActivity({
        type: "task_status_changed",
        title: "Task status changed",
        description: `${payload.title} moved to ${taskStatusLabel(taskEffectiveStatus(loggedTask))}`,
        projectId: loggedTask.project_id || null,
        taskId: loggedTask.id || null,
        metadata: taskActivityMetadata(loggedTask, loggedProject)
      });
    }
    closeTaskForm();
    await loadTaskPage();

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Task";
    }
  });

  archiveTaskPageBtn?.addEventListener("click", async () => {
    const task = selectedTask();
    if (!task) return;

    if (!confirm(`Archive ${task.title || "this task"}?`)) return;

    const columns = taskColumnSet();
    const archivePayload = columns.has("archived")
      ? { archived: true }
      : { status: "archived" };

    const { error } = await supabaseClient
      .from("tasks")
      .update(archivePayload)
      .eq("id", task.id);

    if (error) {
      console.error("Archive task failed:", error);
      alert(error.message);
      return;
    }

    selectedTaskId = null;
    await logActivity({
      type: "task_archived",
      title: "Task archived",
      description: task.title || "Untitled Task",
      projectId: task.project_id || null,
      taskId: task.id,
      metadata: taskActivityMetadata(task)
    });
    closeTaskForm();
    await loadTaskPage();
    window.location.hash = "#tasks";
    renderRoute("tasks");
  });

  deleteTaskPageBtn?.addEventListener("click", async () => {
    const task = selectedTask();
    if (!task) return;

    if (!confirm(`Delete ${task.title || "this task"}? This cannot be undone.`)) return;

    const { error } = await supabaseClient
      .from("tasks")
      .delete()
      .eq("id", task.id);

    if (error) {
      console.error("Delete task failed:", error);
      alert(error.message);
      return;
    }

    selectedTaskId = null;
    await logActivity({
      type: "task_deleted",
      title: "Task deleted",
      description: task.title || "Untitled Task",
      projectId: task.project_id || null,
      metadata: taskActivityMetadata(task)
    });
    closeTaskForm();
    await loadTaskPage();
    window.location.hash = "#tasks";
    renderRoute("tasks");
  });

  // ===== NOTES TIMELINE =====
  document.getElementById("addClientNoteBtn")?.addEventListener("click", async () => {
    const client = selectedClient();
    const input = document.getElementById("clientQuickNote");
    if (!client || !input?.value.trim()) return;

    await createNote({
      body: input.value,
      noteType: document.getElementById("clientNoteType")?.value || "update",
      clientId: client.id
    });
    input.value = "";
  });

  document.getElementById("addProjectNoteBtn")?.addEventListener("click", async () => {
    const project = selectedProjectPage();
    const input = document.getElementById("projectQuickNote");
    if (!project || !input?.value.trim()) return;

    await createNote({
      body: input.value,
      noteType: document.getElementById("projectNoteType")?.value || "update",
      clientId: clientForProject(project)?.id || project.client_id || null,
      projectId: project.id
    });
    input.value = "";
  });

  document.getElementById("addTaskNoteBtn")?.addEventListener("click", async () => {
    const task = selectedTask();
    const input = document.getElementById("taskQuickNote");
    if (!task || !input?.value.trim()) return;

    const project = projectForTask(task);
    await createNote({
      body: input.value,
      noteType: document.getElementById("taskNoteType")?.value || "update",
      clientId: clientForProject(project)?.id || project?.client_id || null,
      projectId: project?.id || task.project_id || null,
      taskId: task.id
    });
    input.value = "";
  });

  // ===== GLOBAL QUICK ADD =====
  const quickAddBtn = document.getElementById("quickAddBtn");
  const quickAddModal = document.getElementById("quickAddModal");
  const quickAddForm = document.getElementById("quickAddForm");
  const quickAddType = document.getElementById("quickAddType");
  const closeQuickAddBtn = document.getElementById("closeQuickAddModal");
  const cancelQuickAddBtn = document.getElementById("cancelQuickAddBtn");

  quickAddBtn?.addEventListener("click", () => openQuickAddModal("client"));
  quickAddType?.addEventListener("change", renderQuickAddFields);
  closeQuickAddBtn?.addEventListener("click", closeQuickAddModal);
  cancelQuickAddBtn?.addEventListener("click", closeQuickAddModal);
  quickAddModal?.addEventListener("click", e => {
    if (e.target === quickAddModal) closeQuickAddModal();
  });

  quickAddForm?.addEventListener("submit", async e => {
    e.preventDefault();

    const type = quickAddType?.value || "client";
    const saveBtn = document.getElementById("saveQuickAddBtn");
    const context = currentQuickAddContext();
    const resetQuickAddButton = () => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Create";
      }
    };

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Creating...";
    }

    if (type === "client") {
      const name = document.getElementById("quickClientName")?.value.trim();
      const email = document.getElementById("quickClientEmail")?.value.trim();
      if (!name) {
        resetQuickAddButton();
        return;
      }

      const { data, error } = await supabaseClient
        .from("clients")
        .insert([{ name, email, status: "active" }])
        .select("*")
        .single();

      if (error) {
        alert(error.message);
      } else {
        selectedClientId = data.id;
        await logActivity({
          type: "client_created",
          title: "Client created",
          description: name,
          clientId: data.id,
          metadata: { client_name: name }
        });
        await loadClients();
        closeQuickAddModal();
      }
    }

    if (type === "project") {
      const projectName = document.getElementById("quickProjectName")?.value.trim();
      const clientName = document.getElementById("quickProjectClient")?.value.trim();
      const stage = document.getElementById("quickProjectStage")?.value || "new";
      if (!projectName) {
        resetQuickAddButton();
        return;
      }

      let resolvedClient = null;
      try {
        resolvedClient = await resolveProjectClientFromName(clientName || (context.client ? clientDisplayName(context.client) : ""));
      } catch (error) {
        console.error("Quick add client resolution failed:", error);
        alert("Could not create or link the client for this project.");
        resetQuickAddButton();
        return;
      }

      const payload = {
        project_name: projectName,
        client_id: resolvedClient?.id || context.client?.id || null,
        client_name: resolvedClient ? clientDisplayName(resolvedClient) : (clientName || ""),
        stage,
        priority: "normal",
        value: 0,
        quote_value: 0,
        progress: 5
      };

      const { data, error } = await supabaseClient
        .from("projects")
        .insert([payload])
        .select("*")
        .single();

      if (error) {
        alert(error.message);
      } else {
        selectedProjectPageId = data.id;
        await logActivity({
          type: "project_created",
          title: "Project created",
          description: projectName,
          projectId: data.id,
          clientId: data.client_id || resolvedClient?.id || null,
          metadata: projectActivityMetadata(data)
        });
        await loadProjects();
        if (hasLoadedClients) await loadClients();
        closeQuickAddModal();
      }
    }

    if (type === "task") {
      const title = document.getElementById("quickTaskTitle")?.value.trim();
      const projectId = document.getElementById("quickTaskProject")?.value || null;
      const dueDate = document.getElementById("quickTaskDueDate")?.value || null;
      if (!title) {
        resetQuickAddButton();
        return;
      }

      const { data, error } = await supabaseClient
        .from("tasks")
        .insert([{ title, project_id: projectId, due_date: dueDate, status: "todo" }])
        .select("*")
        .single();

      if (error) {
        alert(error.message);
      } else {
        selectedTaskId = data.id;
        await logActivity({
          type: "task_created",
          title: "Task created",
          description: title,
          projectId,
          taskId: data.id,
          metadata: taskActivityMetadata(data)
        });
        await loadTaskPage();
        closeQuickAddModal();
      }
    }

    if (type === "note") {
      const body = document.getElementById("quickNoteBody")?.value.trim();
      const noteType = document.getElementById("quickNoteType")?.value || "update";
      if (!body) {
        resetQuickAddButton();
        return;
      }

      await createNote({
        body,
        noteType,
        clientId: context.client?.id || null,
        projectId: context.project?.id || null,
        taskId: context.task?.id || null
      });
      closeQuickAddModal();
    }

    resetQuickAddButton();
  });

  // ===== ACTIVITY PAGE =====
  const activitySearch = document.getElementById("activitySearch");
  const activityTypeFilter = document.getElementById("activityTypeFilter");
  const refreshActivityBtn = document.getElementById("refreshActivityBtn");

  activitySearch?.addEventListener("input", renderActivities);
  activityTypeFilter?.addEventListener("change", renderActivities);
  refreshActivityBtn?.addEventListener("click", loadActivities);

  document.addEventListener("click", async e => {
    const attachmentOpenBtn = e.target.closest(".attachment-open-btn");
    if (attachmentOpenBtn) {
      await openAttachment(attachmentOpenBtn.dataset.attachmentId);
      return;
    }

    const attachmentDownloadBtn = e.target.closest(".attachment-download-btn");
    if (attachmentDownloadBtn) {
      await downloadAttachment(attachmentDownloadBtn.dataset.attachmentId);
      return;
    }

    const attachmentDeleteBtn = e.target.closest(".attachment-delete-btn");
    if (attachmentDeleteBtn) {
      await deleteAttachment(attachmentDeleteBtn.dataset.attachmentId);
      return;
    }

    const projectTaskItem = e.target.closest(".project-page-task-item[data-task-id]");
    if (projectTaskItem) {
      await navigateToTask(projectTaskItem.dataset.taskId);
      return;
    }

    const reportAction = e.target.closest("[data-report-action]");
    if (reportAction) {
      handleReportAction(reportAction.dataset.reportAction, reportAction.dataset.reportValue || "");
      return;
    }

    const recordLink = e.target.closest(".dashboard-action-item, .dashboard-activity-link, .report-activity-row, .report-drilldown-item, .report-pipeline-card");
    if (recordLink) {
      if (recordLink.dataset.linkClientId) {
        await navigateToClient(recordLink.dataset.linkClientId);
        return;
      }

      if (recordLink.dataset.linkProjectId) {
        await navigateToProject(recordLink.dataset.linkProjectId);
        return;
      }

      if (recordLink.dataset.linkTaskId) {
        await navigateToTask(recordLink.dataset.linkTaskId);
        return;
      }
    }

    const relationshipLink = e.target.closest(".relationship-link");
    if (!relationshipLink) return;

    if (relationshipLink.dataset.linkClientId) {
      await navigateToClient(relationshipLink.dataset.linkClientId);
      return;
    }

    if (relationshipLink.dataset.linkProjectId) {
      await navigateToProject(relationshipLink.dataset.linkProjectId);
      return;
    }

    if (relationshipLink.dataset.linkTaskId) {
      await navigateToTask(relationshipLink.dataset.linkTaskId);
    }
  });

  // ===== PROJECTS PAGE =====
  const newProjectPageBtn = document.getElementById("newProjectPageBtn");
  const dashboardViewClients = document.getElementById("dashboardViewClients");
  const projectPageSearch = document.getElementById("projectPageSearch");
  const projectPageStatusFilter = document.getElementById("projectPageStatusFilter");
  const projectPageList = document.getElementById("projectPageList");
  const editProjectPageBtn = document.getElementById("editProjectPageBtn");
  const archiveProjectPageBtn = document.getElementById("archiveProjectPageBtn");
  const deleteProjectPageBtn = document.getElementById("deleteProjectPageBtn");

  setupProjectColumnResizing();
  newProjectPageBtn?.addEventListener("click", () => openProjectModal());
  setupAttachmentInput("projectAttachmentInput", "project", () => selectedProjectPageId);
  setupAttachmentDropzone("projectAttachmentDropzone", "project", () => selectedProjectPageId);
  dashboardViewClients?.addEventListener("click", () => {
    window.location.hash = "#clients";
    renderRoute("clients");
  });

  document.getElementById("dashboardNeedsAttentionCard")?.addEventListener("click", () => {
    window.location.hash = "#tasks";
    renderRoute("tasks");
    const taskFilter = document.getElementById("taskStatusFilter");
    if (taskFilter) taskFilter.value = "active";
    renderTaskPage();
  });

  projectPageSearch?.addEventListener("input", renderProjectPage);
  projectPageStatusFilter?.addEventListener("change", renderProjectPage);
  document.getElementById("reportDrilldownClose")?.addEventListener("click", () => {
    const heading = document.getElementById("reportDrilldownTitle");
    const list = document.getElementById("reportDrilldownList");
    if (heading) heading.textContent = "Report details";
    if (list) {
      list.innerHTML = '<div class="attachment-empty">Select a report metric, priority, pipeline stage, or activity item to view details.</div>';
    }
  });

  projectPageList?.addEventListener("click", e => {
    const row = e.target.closest(".project-page-data-row");
    if (!row) return;

    navigateToProject(row.dataset.projectId);
  });

  document.getElementById("backToProjectsBtn")?.addEventListener("click", () => {
    selectedProjectPageId = null;
    window.location.hash = "#projects";
    renderRoute("projects");
  });

  editProjectPageBtn?.addEventListener("click", async () => {
    const project = selectedProjectPage();
    if (project) await openProjectDetailById(project.id);
  });

  archiveProjectPageBtn?.addEventListener("click", async () => {
    const project = selectedProjectPage();
    if (!project) return;

    if (!confirm(`Archive ${project.project_name || "this project"}?`)) return;

    const columns = projectColumnSet();
    const archivePayload = columns.has("archived")
      ? { archived: true }
      : { stage: "lost" };

    const { error } = await supabaseClient
      .from("projects")
      .update(archivePayload)
      .eq("id", project.id);

    if (error) {
      console.error("Archive project failed:", error);
      alert(error.message);
      return;
    }

    selectedProjectPageId = null;
    await logActivity({
      type: "project_archived",
      title: "Project archived",
      description: project.project_name || "Untitled Project",
      projectId: project.id,
      clientId: project.client_id || null,
      metadata: projectActivityMetadata(project)
    });
    await loadProjects();
    renderAllProjects(allProjects);
    if (hasLoadedClients) renderClients();
    if (hasLoadedTaskPage) await loadTaskPage();
    window.location.hash = "#projects";
    renderRoute("projects");
  });

  deleteProjectPageBtn?.addEventListener("click", async () => {
    const project = selectedProjectPage();
    if (!project) return;

    if (!confirm(`Delete ${project.project_name || "this project"}? This cannot be undone.`)) return;

    const { error } = await supabaseClient
      .from("projects")
      .delete()
      .eq("id", project.id);

    if (error) {
      console.error("Delete project failed:", error);
      alert(error.message);
      return;
    }

    selectedProjectPageId = null;
    await logActivity({
      type: "project_deleted",
      title: "Project deleted",
      description: project.project_name || "Untitled Project",
      clientId: project.client_id || null,
      metadata: projectActivityMetadata(project)
    });
    await loadProjects();
    if (hasLoadedTaskPage) await loadTaskPage();
    window.location.hash = "#projects";
    renderRoute("projects");
  });

  // ===== DRAG + DROP =====
  document.addEventListener("dragstart", e => {
    if (!e.target.classList.contains("deal-card")) return;
    draggedCard = e.target;
    draggedCard.classList.add("dragging");
  });

  document.addEventListener("dragend", () => {
    if (!draggedCard) return;
    draggedCard.classList.remove("dragging");
    draggedCard = null;
  });

  document.querySelectorAll(".pipeline-column").forEach(column => {
    column.addEventListener("dragover", e => {
      e.preventDefault();
      column.classList.add("drag-over");
    });

    column.addEventListener("dragleave", () => {
      column.classList.remove("drag-over");
    });

    column.addEventListener("drop", async e => {
      e.preventDefault();
      if (!draggedCard) return;

      const newStage = column.id.replace("stage-", "");
      const projectId = draggedCard.dataset.id;

      column.appendChild(draggedCard);

      const { error } = await supabaseClient
        .from("projects")
        .update({ stage: newStage })
        .eq("id", projectId);

      if (error) {
        console.error("Stage update failed:", error);
        alert(error.message);
        return;
      }

      const movedProject = allProjects.find(project => String(project.id) === String(projectId));
      await logActivity({
        type: "project_status_changed",
        title: "Project status changed",
        description: `${movedProject?.project_name || "Project"} moved to ${projectStageLabel(newStage)}`,
        projectId,
        clientId: movedProject?.client_id || null,
        metadata: projectActivityMetadata({ ...movedProject, stage: newStage })
      });

      column.classList.remove("drag-over");

      await loadProjects();

      const refreshedCard = document.querySelector(`.deal-card[data-id="${projectId}"]`);
      if (refreshedCard) {
        refreshedCard.classList.add("just-dropped");
        setTimeout(() => refreshedCard.classList.remove("just-dropped"), 450);
      }

      column.classList.add("just-dropped");
      setTimeout(() => column.classList.remove("just-dropped"), 500);
    });
  });

  // ===== NEW PROJECT MODAL =====
  const projectModal = document.getElementById("projectModal");
  const newProjectBtn = document.getElementById("newProjectBtn");
  const closeProjectModal = document.getElementById("closeProjectModal");
  const projectForm = document.getElementById("projectForm");

  function openProjectModal() {
    projectModal?.classList.add("open");
    projectModal?.setAttribute("aria-hidden", "false");
    if (!hasLoadedClients) loadClients();
    populateProjectClientOptions();
    updateProjectClientCreateHint();
    document.getElementById("clientName")?.focus();
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    projectModal?.classList.remove("open");
    projectModal?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  newProjectBtn?.addEventListener("click", openProjectModal);
  closeProjectModal?.addEventListener("click", closeModal);
  document.getElementById("clientName")?.addEventListener("input", updateProjectClientCreateHint);

  projectModal?.addEventListener("click", e => {
    if (e.target === projectModal) closeModal();
  });

  projectForm?.addEventListener("submit", async e => {
    e.preventDefault();

    if (isCreatingProject) return;
    isCreatingProject = true;

    const submitBtn = projectForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating...";
    }

    const quote_value = Number(document.getElementById("quoteValue").value || 0);
    const clientNameValue = document.getElementById("clientName").value.trim();
    const contactCompany = document.getElementById("contactCompany").value.trim();
    const contactName = document.getElementById("contactName").value.trim();
    const contactEmail = document.getElementById("contactEmail").value.trim();
    const contactPhone = document.getElementById("contactPhone").value.trim();
    const contactWebsite = document.getElementById("contactWebsite").value.trim();
    const contactNotes = document.getElementById("contactNotes").value.trim();
    let resolvedClient = null;

    try {
      resolvedClient = await resolveProjectClientFromName(clientNameValue, {
        company: contactCompany,
        contactName,
        email: contactEmail,
        phone: contactPhone,
        website: contactWebsite,
        notes: contactNotes
      });
    } catch (error) {
      console.error("Client resolution failed:", error);
      alert("Could not create or link the client for this project.");
      isCreatingProject = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create Project";
      }
      return;
    }

    const newProject = {
      client_id: resolvedClient?.id || null,
      client_name: resolvedClient ? clientDisplayName(resolvedClient) : clientNameValue,
      project_name: document.getElementById("projectName").value.trim(),
      project_type: document.getElementById("projectType").value.trim(),
      stage: document.getElementById("projectStage").value,
      priority: document.getElementById("priority").value,
      estimated_completion_date: document.getElementById("estimatedCompletionDate").value || null,
      quote_value,
      final_value: Number(document.getElementById("finalValue").value || 0),
      value: quote_value,
      source: document.getElementById("projectSource").value.trim(),
      contact_name: contactName || resolvedClient?.contact_name || "",
      contact_company: contactCompany || resolvedClient?.company || "",
      contact_website: contactWebsite || resolvedClient?.website || "",
      contact_phone: contactPhone || resolvedClient?.phone || "",
      contact_email: contactEmail || resolvedClient?.email || "",
      contact_notes: contactNotes,
      project_notes: document.getElementById("projectNotes").value.trim(),
      stack: document.getElementById("stack").value.trim(),
      progress: 5
    };

    const { data, error } = await supabaseClient
      .from("projects")
      .insert([newProject])
      .select("*")
      .single();

    if (error) {
      console.error(error);
      alert("Could not create project.");
      isCreatingProject = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create Project";
      }
      return;
    }

    projectForm.reset();
    await logActivity({
      type: "project_created",
      title: "Project created",
      description: newProject.project_name,
      projectId: data?.id || null,
      clientId: data?.client_id || resolvedClient?.id || null,
      metadata: projectActivityMetadata(data || newProject)
    });
    closeModal();
    await loadProjects();
    if (hasLoadedClients) await loadClients();

    isCreatingProject = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Project";
    }
  });

  // ===== LOAD TASKS =====

async function loadTasks(projectId) {
  const list = document.getElementById("projectTaskList");
  if (!list) return;

  document.querySelectorAll(".task-lane").forEach(lane => {
  lane.querySelectorAll(".project-task-item").forEach(item => item.remove());
});

  const { data, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Load tasks failed:", error);
    return;
  }

  data.forEach(task => {
    const item = document.createElement("div");
    item.className = `project-task-item ${task.status === "done" ? "done" : ""}`;

item.innerHTML = `
  <input type="checkbox" ${task.status === "done" ? "checked" : ""} data-task-id="${task.id}" />

<div class="task-copy">
  <span>${task.title}</span>
  ${task.notes ? `<p>${task.notes}</p>` : ""}
  ${task.due_date ? `<small>${task.due_date}</small>` : ""}
</div>

  <div class="task-actions">
    <button type="button" class="task-edit-btn" data-task-id="${task.id}">Edit</button>
    <button type="button" class="task-delete-btn" data-task-id="${task.id}">Delete</button>
  </div>

  <div class="task-inline-editor" data-task-id="${task.id}">
    <input class="task-edit-title" type="text" value="${task.title || ""}" />
    
    <textarea class="task-edit-notes" placeholder="Task notes...">${task.notes || ""}</textarea>

    <!-- 🔥 THIS WAS MISSING -->
    <select class="task-edit-status">
      <option value="todo" ${task.status === "todo" ? "selected" : ""}>Todo</option>
      <option value="doing" ${task.status === "doing" ? "selected" : ""}>Doing</option>
      <option value="done" ${task.status === "done" ? "selected" : ""}>Done</option>
    </select>

    <input class="task-edit-due" type="date" value="${task.due_date || ""}" />

    <div class="task-actions">
      <button type="button" class="task-save-btn">Save</button>
      <button type="button" class="task-cancel-btn">Cancel</button>
    </div>
  </div>
`;

    const lane = document.querySelector(`.task-lane[data-status="${task.status || "todo"}"]`);
lane?.appendChild(item);


  });
}

  // ===== ADD TASK =====

  const addTaskBtn = document.getElementById("addTaskBtn");

addTaskBtn?.addEventListener("click", async () => {
  const projectId = document.getElementById("detailProjectId").value;
  const titleInput = document.getElementById("newTaskTitle");
  const dueDateInput = document.getElementById("newTaskDueDate");
  const statusInput = document.getElementById("newTaskStatus");
  const status = statusInput.value || "todo";
  const title = titleInput.value.trim();
  const due_date = dueDateInput.value || null;

  if (!projectId || !title) return;

  const { data, error } = await supabaseClient
    .from("tasks")
.insert([{
  project_id: projectId,
  title,
  status,
  due_date
}])
.select("*")
.single();

  if (error) {
    console.error("Create task failed:", error);
    alert(error.message);
    return;
  }

  titleInput.value = "";
  dueDateInput.value = "";

  await logActivity({
    type: "task_created",
    title: "Task created",
    description: title,
    projectId,
    taskId: data?.id || null,
    metadata: taskActivityMetadata(data || { project_id: projectId, title })
  });

  await loadTasks(projectId);
  await refreshTaskPageIfLoaded();
});

   // ===== CHECKBOX COMPLETE =====

  document.addEventListener("change", async e => {
  const checkbox = e.target.closest('#projectTaskList input[type="checkbox"]');
  if (!checkbox) return;

  const taskId = checkbox.dataset.taskId;
  const projectId = document.getElementById("detailProjectId").value;
  const taskTitle = checkbox.closest(".project-task-item")?.querySelector(".task-copy span")?.textContent || "Task";

  const { error } = await supabaseClient
    .from("tasks")
    .update({
      status: checkbox.checked ? "done" : "todo"
    })
    .eq("id", taskId);

  if (error) {
    console.error("Update task failed:", error);
    alert(error.message);
    return;
  }

  await logActivity({
    type: checkbox.checked ? "task_completed" : "task_status_changed",
    title: checkbox.checked ? "Task completed" : "Task reopened",
    description: taskTitle,
    projectId,
    taskId,
    metadata: taskActivityMetadata({ id: taskId, project_id: projectId, title: taskTitle, status: checkbox.checked ? "done" : "todo" })
  });

  await loadTasks(projectId);
  await refreshTaskPageIfLoaded();
});
document.addEventListener("click", e => {
  const note = e.target.closest(".task-copy p");
  if (!note) return;

  const item = note.closest(".project-task-item");
  item?.classList.toggle("expanded");
});
document.addEventListener("click", async e => {
  const saveBtn = e.target.closest(".task-save-btn");
  if (!saveBtn) return;

  const editor = saveBtn.closest(".task-inline-editor");
  if (!editor) return;

  const taskId = editor.dataset.taskId;
  const projectId = document.getElementById("detailProjectId").value;
  const previousTitle = editor.closest(".project-task-item")?.querySelector(".task-copy span")?.textContent || "";
  const previousNotes = editor.closest(".project-task-item")?.querySelector(".task-copy p")?.textContent || "";
  const status = editor.querySelector(".task-edit-status").value;
  const title = editor.querySelector(".task-edit-title").value.trim();
  const notes = editor.querySelector(".task-edit-notes").value.trim();
  const due_date = editor.querySelector(".task-edit-due").value || null;

  if (!title) return;

  const { error } = await supabaseClient
    .from("tasks")
    .update({ title, notes, due_date, status })
    .eq("id", taskId);

  if (error) {
    alert(error.message);
    return;
  }

  await logActivity({
    type: "task_updated",
    title: "Task updated",
    description: title,
    projectId,
    taskId,
    metadata: taskActivityMetadata({ id: taskId, project_id: projectId, title, status })
  });
  if (notes && notes !== previousNotes) {
    await logActivity({
      type: "task_note_added",
      title: "Task note updated",
      description: title || previousTitle,
      projectId,
      taskId,
      metadata: taskActivityMetadata({ id: taskId, project_id: projectId, title, status })
    });
  }

  await loadTasks(projectId);
  await refreshTaskPageIfLoaded();
});

// ===== TASK EDIT / CANCEL / DELETE =====

document.addEventListener("click", async e => {
  const editBtn = e.target.closest(".task-edit-btn");
  const cancelBtn = e.target.closest(".task-cancel-btn");
  const deleteBtn = e.target.closest(".task-delete-btn");

  if (editBtn) {
    const item = editBtn.closest(".project-task-item");
    item?.classList.add("editing");
  }

  if (cancelBtn) {
    const item = cancelBtn.closest(".project-task-item");
    item?.classList.remove("editing");
  }

  if (deleteBtn) {
    const taskId = deleteBtn.dataset.taskId;
    const projectId = document.getElementById("detailProjectId").value;
    const taskTitle = deleteBtn.closest(".project-task-item")?.querySelector(".task-copy span")?.textContent || "Task";

    if (!confirm("Delete this task?")) return;

    const { error } = await supabaseClient
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      alert(error.message);
      return;
    }

    await logActivity({
      type: "task_deleted",
      title: "Task deleted",
      description: taskTitle,
      projectId,
      metadata: taskActivityMetadata({ project_id: projectId, title: taskTitle })
    });

    await loadTasks(projectId);
    await refreshTaskPageIfLoaded();
  }
});
  // ===== PROJECT DETAIL PANEL =====
  const detailBackdrop = document.getElementById("projectDetailBackdrop");
  const detailPanel = document.getElementById("projectDetailPanel");
  const closeProjectDetail = document.getElementById("closeProjectDetail");
  const detailForm = document.getElementById("projectDetailForm");

  function openDetailPanel() {
    detailBackdrop?.classList.add("open");
    detailPanel?.classList.add("open");
    detailPanel?.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDetailPanel() {
    detailBackdrop?.classList.remove("open");
    detailPanel?.classList.remove("open");
    detailPanel?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  closeProjectDetail?.addEventListener("click", closeDetailPanel);
  detailBackdrop?.addEventListener("click", closeDetailPanel);

  async function openProjectDetailById(id) {
    if (!id) return;

    const { data, error } = await supabaseClient
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      alert("Could not load project details.");
      return;
    }


  

    document.getElementById("detailProjectId").value = data.id;
    document.getElementById("detailTitle").textContent = data.project_name || "Project";

    document.getElementById("detailClientName").value = data.client_name || "";
    document.getElementById("detailProjectName").value = data.project_name || "";
    document.getElementById("detailProjectType").value = data.project_type || "";
    document.getElementById("detailStage").value = data.stage || "new";
    document.getElementById("detailPriority").value = data.priority || "normal";
    document.getElementById("detailEstimatedCompletionDate").value = data.estimated_completion_date || "";
    document.getElementById("detailQuoteValue").value = data.quote_value || data.value || "";
    document.getElementById("detailFinalValue").value = data.final_value || "";

    document.getElementById("detailContactName").value = data.contact_name || "";
    document.getElementById("detailContactCompany").value = data.contact_company || "";
    document.getElementById("detailContactWebsite").value = data.contact_website || "";
    document.getElementById("detailContactPhone").value = data.contact_phone || "";
    document.getElementById("detailContactEmail").value = data.contact_email || "";
    document.getElementById("detailContactNotes").value = data.contact_notes || "";

    document.getElementById("detailProjectNotes").value = data.project_notes || "";
    document.getElementById("detailStack").value = data.stack || "";

    await loadTasks(data.id);
    openDetailPanel();
  }

  document.addEventListener("click", async e => {
    const card = e.target.closest(".deal-card");
    if (!card) return;

    await navigateToProject(card.dataset.id);
  });

  detailForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const saveBtn = document.querySelector('button[form="projectDetailForm"]');
if (saveBtn) {
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
}

    const id = document.getElementById("detailProjectId").value;
    const existingProject = allProjects.find(project => String(project.id) === String(id));
    const quoteValue = Number(document.getElementById("detailQuoteValue").value || 0);

    const updates = {
      client_name: document.getElementById("detailClientName").value.trim(),
      project_name: document.getElementById("detailProjectName").value.trim(),
      project_type: document.getElementById("detailProjectType").value.trim(),
      stage: document.getElementById("detailStage").value,
      priority: document.getElementById("detailPriority").value,
      estimated_completion_date: document.getElementById("detailEstimatedCompletionDate").value || null,
      quote_value: quoteValue,
      final_value: Number(document.getElementById("detailFinalValue").value || 0),
      value: quoteValue,
      contact_name: document.getElementById("detailContactName").value.trim(),
      contact_company: document.getElementById("detailContactCompany").value.trim(),
      contact_website: document.getElementById("detailContactWebsite").value.trim(),
      contact_phone: document.getElementById("detailContactPhone").value.trim(),
      contact_email: document.getElementById("detailContactEmail").value.trim(),
      contact_notes: document.getElementById("detailContactNotes").value.trim(),
      project_notes: document.getElementById("detailProjectNotes").value.trim(),
      stack: document.getElementById("detailStack").value.trim()
    };

    const { error } = await supabaseClient
      .from("projects")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Update failed:", error);
      alert(error.message);
      if (saveBtn) {
  saveBtn.disabled = false;
  saveBtn.textContent = "Save Changes";
}
      return;
    }
if (saveBtn) {
  saveBtn.textContent = "Saved ✓";
}

    const loggedProject = { ...existingProject, ...updates, id };
    await logActivity({
      type: "project_updated",
      title: "Project updated",
      description: updates.project_name,
      projectId: id,
      clientId: existingProject?.client_id || null,
      metadata: projectActivityMetadata(loggedProject)
    });
    if (existingProject?.stage !== updates.stage) {
      await logActivity({
        type: "project_status_changed",
        title: "Project status changed",
        description: `${updates.project_name} moved to ${projectStageLabel(updates.stage)}`,
        projectId: id,
        clientId: existingProject?.client_id || null,
        metadata: projectActivityMetadata(loggedProject)
      });
    }
    if (existingProject?.project_notes !== updates.project_notes && updates.project_notes) {
      await logActivity({
        type: "project_note_added",
        title: "Project note updated",
        description: updates.project_name,
        projectId: id,
        clientId: existingProject?.client_id || null,
        metadata: projectActivityMetadata(loggedProject)
      });
    }

    await loadProjects();

setTimeout(() => {
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }

  closeDetailPanel();
}, 500);
  });

  // ===== AUTH =====
  const authScreen = document.getElementById("authScreen");
  const loginForm = document.getElementById("loginForm");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginSubmitBtn = document.getElementById("loginSubmitBtn");
  const authError = document.getElementById("authError");
  const localPreviewBtn = document.getElementById("localPreviewBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const pageTitle = document.getElementById("pageTitle");
  const pageCopy = document.getElementById("pageCopy");
  const globalSearch = document.getElementById("globalSearch");
  const globalSearchInput = document.getElementById("globalSearchInput");
  const globalSearchResults = document.getElementById("globalSearchResults");
  const loginRoute = "#login";
  const defaultRoute = "#dashboard";
  const routes = {
    dashboard: {
      page: "dashboard",
      title: "Workflow Dashboard",
      copy: "Track new leads, discovery, proposals, builds, reviews, launches, and follow-up from one clean workspace."
    },
    pipeline: {
      page: "dashboard",
      title: "Project Pipeline",
      copy: "Review lead flow, stage movement, and project value from the current workflow board."
    },
    projects: {
      page: "projects",
      title: "Projects",
      copy: "Browse, search, filter, and create project records."
    },
    projectWorkspace: {
      page: "projects",
      title: "Project Workspace",
      copy: "Work inside one project with details, client context, notes, tasks, files, and activity."
    },
    tasks: {
      page: "tasks",
      title: "Tasks",
      copy: "Keep follow-up, due dates, and day-to-day work visible in one protected workspace."
    },
    taskWorkspace: {
      page: "tasks",
      title: "Task Workspace",
      copy: "Work inside one task with project context, client links, notes, files, and activity."
    },
    clients: {
      page: "clients",
      title: "Clients",
      copy: "Manage client profiles, contacts, relationships, and account notes."
    },
    clientWorkspace: {
      page: "clients",
      title: "Client Workspace",
      copy: "Work inside one client account with details, projects, notes, files, and activity."
    },
    activity: {
      page: "activity",
      title: "Activity",
      copy: "Track recent updates, timeline events, and CRM movement as the workspace grows."
    },
    reports: {
      page: "reports",
      title: "Reports",
      copy: "Review pipeline health, delivery outcomes, and operating metrics."
    },
    settings: {
      page: "settings",
      title: "Settings",
      copy: "Control workspace preferences, defaults, and CRM configuration."
    }
  };

  function routeFromHash() {
    return (window.location.hash || defaultRoute).replace("#", "").toLowerCase();
  }

  function renderRoute(routeName = routeFromHash()) {
    const canUseRemoteData = currentSession && !isLocalPreviewMode;
    const workspaceRoute = isProjectWorkspaceRoute(routeName)
      ? routes.projectWorkspace
      : isTaskWorkspaceRoute(routeName)
        ? routes.taskWorkspace
        : isClientWorkspaceRoute(routeName)
          ? routes.clientWorkspace
          : null;
    const route = workspaceRoute || routes[routeName] || routes.dashboard;
    const routeKey = isProjectWorkspaceRoute(routeName)
      ? "projects"
      : isTaskWorkspaceRoute(routeName)
        ? "tasks"
        : isClientWorkspaceRoute(routeName)
          ? "clients"
          : routeName;

    document.querySelectorAll("[data-page]").forEach(page => {
      page.classList.toggle("is-active", page.dataset.page === route.page);
    });

    document.querySelectorAll(".sidebar-nav a[data-route]").forEach(link => {
      link.classList.toggle("active", link.dataset.route === routeKey);
    });

    if (pageTitle) pageTitle.textContent = route.title;
    if (pageCopy) pageCopy.textContent = route.copy;

    if (routeName === "pipeline") {
      document.getElementById("pipeline")?.scrollIntoView({ block: "start" });
    } else {
      document.querySelector(".demo-main")?.scrollTo?.({ top: 0 });
      window.scrollTo({ top: 0 });
    }

    if (route.page === "clients" && canUseRemoteData && !hasLoadedClients) {
      loadClients();
    }

    if (route.page === "clients" && canUseRemoteData && !hasLoadedTaskPage) {
      loadTaskPage();
    }

    if (route.page === "clients" && currentSession) {
      const workspaceId = clientWorkspaceIdFromHash();
      if (canUseRemoteData && !hasLoadedActivities) loadActivities();
      setClientsViewMode(workspaceId ? "workspace" : "directory");
      selectedClientId = workspaceId || null;
      renderClients();
    }

    if (["clients", "projects", "tasks"].includes(route.page) && canUseRemoteData) {
      if (!hasLoadedNotes) loadNotes();
      if (!hasLoadedAttachments) loadAttachments();
    }

    if (route.page === "dashboard" && currentSession) {
      if (canUseRemoteData && !hasLoadedClients) loadClients();
      if (canUseRemoteData && !hasLoadedTaskPage) loadTaskPage();
      if (canUseRemoteData && !hasLoadedActivities) loadActivities();
      if (canUseRemoteData && !hasLoadedNotes) loadNotes();
      if (canUseRemoteData && !hasLoadedAttachments) loadAttachments();
      renderDashboard();
    }

    if (route.page === "tasks" && canUseRemoteData && !hasLoadedTaskPage) {
      loadTaskPage();
    }

    if (route.page === "tasks" && canUseRemoteData && !hasLoadedClients) {
      loadClients();
    }

    if (route.page === "tasks" && currentSession) {
      const workspaceId = taskWorkspaceIdFromHash();
      if (canUseRemoteData && !hasLoadedActivities) loadActivities();
      setTasksViewMode(workspaceId ? "workspace" : "directory");
      selectedTaskId = workspaceId || null;
      renderTaskPage();
    }

    if (route.page === "activity" && canUseRemoteData && !hasLoadedActivities) {
      loadActivities();
    }

    if (route.page === "reports" && currentSession) {
      if (canUseRemoteData && !hasLoadedClients) loadClients();
      if (canUseRemoteData && !hasLoadedTaskPage) loadTaskPage();
      if (canUseRemoteData && !hasLoadedActivities) loadActivities();
      renderReports();
    }

    if (route.page === "projects" && currentSession) {
      const workspaceId = projectWorkspaceIdFromHash();
      if (canUseRemoteData && !hasLoadedClients) loadClients();
      if (canUseRemoteData && !hasLoadedTaskPage) loadTaskPage();
      if (canUseRemoteData && !hasLoadedActivities) loadActivities();
      setProjectsViewMode(workspaceId ? "workspace" : "directory");
      selectedProjectPageId = workspaceId || null;
      renderProjectPage();
    }
  }

  function closeGlobalSearch() {
    if (globalSearchResults) {
      globalSearchResults.hidden = true;
      globalSearchResults.innerHTML = "";
    }
  }

  function renderGlobalSearchResults() {
    if (!globalSearchInput || !globalSearchResults) return;

    const query = normalizeText(globalSearchInput.value);
    globalSearchResults.innerHTML = "";

    if (!query) {
      closeGlobalSearch();
      return;
    }

    const results = globalSearchItems()
      .filter(item => normalizeText(`${item.title} ${item.subtitle} ${item.search}`).includes(query))
      .slice(0, 10);

    globalSearchResults.hidden = false;

    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "global-search-empty";
      empty.textContent = "No CRM results found.";
      globalSearchResults.appendChild(empty);
      return;
    }

    results.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `global-search-result ${index === 0 ? "is-active" : ""}`;
      button.dataset.resultIndex = index;
      button.innerHTML = `
        <span>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.subtitle)}</span>
        </span>
        <span class="global-search-type">${escapeHtml(item.type)}</span>
      `;
      button.addEventListener("click", async () => {
        globalSearchInput.value = "";
        closeGlobalSearch();
        await item.action();
      });
      globalSearchResults.appendChild(button);
    });
  }

  function friendlyAuthError(error, fallback = "The CRM could not complete that request. Please try again.") {
    if (!error) return fallback;
    if (typeof error === "string") {
      return error.trim() && error.trim() !== "{}" ? error : fallback;
    }
    if (error.name === "AuthRetryableFetchError") {
      return "Could not reach Supabase auth. Check your connection and try again.";
    }
    if (error.message && String(error.message).trim() !== "{}") return error.message;
    if (error.error_description) return error.error_description;
    if (error.error) return error.error;
    return fallback;
  }

  function setAuthError(message = "") {
    if (authError) authError.textContent = friendlyAuthError(message, "");
  }

  function showLogin() {
    authScreen?.classList.add("is-visible");
    document.body.classList.remove("auth-loading");
    if (localPreviewBtn) localPreviewBtn.hidden = true;
    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.innerHTML = '<i data-lucide="log-in"></i> Sign In';
    }
    loginEmail?.focus();
    if (window.location.hash !== loginRoute) {
      window.location.replace(loginRoute);
    }
    if (window.lucide) lucide.createIcons();
  }

  function enterLocalPreviewMode() {
    isLocalPreviewMode = true;
    currentSession = { user: { id: "local-preview", email: "local-preview@crm.local" } };
    setAuthError("");
    authScreen?.classList.remove("is-visible");
    document.body.classList.remove("auth-loading");

    if (!window.location.hash || window.location.hash === loginRoute) {
      window.location.replace(defaultRoute);
    }

    renderProjects(allProjects);
    renderAllProjects(allProjects);
    renderClients(allClients);
    renderTaskPage();
    renderActivities();
    renderReports();
    renderDashboard();
    renderRoute(routeFromHash());
    if (window.lucide) lucide.createIcons();
  }

  async function showCrm(session) {
    currentSession = session;
    setAuthError("");
    authScreen?.classList.remove("is-visible");
    document.body.classList.remove("auth-loading");

    const routeName = routeFromHash();

    if (!hasLoadedProjects) {
      hasLoadedProjects = true;
      await loadProjects();
    }

    const isWorkspaceRoute = isProjectWorkspaceRoute(routeName) || isTaskWorkspaceRoute(routeName) || isClientWorkspaceRoute(routeName);

    if (!window.location.hash || window.location.hash === loginRoute || (!routes[routeName] && !isWorkspaceRoute)) {
      window.location.replace(defaultRoute);
      renderRoute("dashboard");
    } else {
      renderRoute(routeName);
    }

    if (window.lucide) lucide.createIcons();
  }

  function resetCrmSession() {
    currentSession = null;
    isLocalPreviewMode = false;
    hasLoadedProjects = false;
    hasLoadedClients = false;
    hasLoadedTaskPage = false;
    hasLoadedActivities = false;
    hasLoadedNotes = false;
    hasLoadedAttachments = false;
    allProjects = [];
    selectedProjectPageId = null;
    allClients = [];
    allTasks = [];
    allActivities = [];
    allNotes = [];
    allAttachments = [];
    selectedClientId = null;
    selectedTaskId = null;
    renderProjects([]);
    renderAllProjects([]);
    renderClients([]);
    renderTaskPage();
    renderActivities();
    renderReports();
    closeClientForm();
    closeTaskForm();
    closeModal();
    closeDetailPanel();
    showLogin();
  }

  function protectRoute() {
    if (!currentSession) {
      showLogin();
      return;
    }

    const routeName = routeFromHash();

    const isWorkspaceRoute = isProjectWorkspaceRoute(routeName) || isTaskWorkspaceRoute(routeName) || isClientWorkspaceRoute(routeName);

    if (window.location.hash === loginRoute || (!routes[routeName] && !isWorkspaceRoute)) {
      window.location.replace(defaultRoute);
      renderRoute("dashboard");
      return;
    }

    renderRoute(routeName);
  }

  loginForm?.addEventListener("submit", async e => {
    e.preventDefault();
    setAuthError("");

    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = true;
      loginSubmitBtn.innerHTML = '<i data-lucide="loader-circle"></i> Signing In...';
      if (window.lucide) lucide.createIcons();
    }

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: loginEmail.value.trim(),
      password: loginPassword.value
    });

    if (error) {
      console.error("Sign in failed:", error);
      setAuthError(friendlyAuthError(error, "Sign in failed. Check your email and password, then try again."));
      if (localPreviewBtn && error.name === "AuthRetryableFetchError") localPreviewBtn.hidden = false;
      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.innerHTML = '<i data-lucide="log-in"></i> Sign In';
        if (window.lucide) lucide.createIcons();
      }
      return;
    }

    isLocalPreviewMode = false;
    loginPassword.value = "";
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData?.session) {
      await showCrm(sessionData.session);
    }
  });

  localPreviewBtn?.addEventListener("click", enterLocalPreviewMode);

  globalSearchInput?.addEventListener("focus", async () => {
    await ensureGlobalSearchData();
    renderGlobalSearchResults();
  });

  globalSearchInput?.addEventListener("input", renderGlobalSearchResults);

  globalSearchInput?.addEventListener("keydown", async e => {
    if (e.key === "Escape") {
      closeGlobalSearch();
      globalSearchInput.blur();
      return;
    }

    if (e.key !== "Enter") return;

    const activeResult = globalSearchResults?.querySelector(".global-search-result.is-active");
    if (!activeResult) return;

    e.preventDefault();
    activeResult.click();
  });

  document.addEventListener("click", e => {
    if (!globalSearch?.contains(e.target)) {
      closeGlobalSearch();
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      alert(error.message);
    }
  });

  window.addEventListener("hashchange", protectRoute);

  async function initAuth() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error("Session check failed:", error);
      setAuthError("Could not check your session. Please sign in again.");
      currentSession = null;
      document.body.classList.remove("auth-loading");
      authScreen?.classList.add("is-visible");
      return;
    }

    if (data.session) {
      await showCrm(data.session);
    } else {
      resetCrmSession();
    }

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await showCrm(session);
      } else {
        resetCrmSession();
      }
    });
  }

  initAuth().catch(error => {
    console.error("CRM initialization failed:", error);
    setAuthError("The CRM could not finish loading. Please refresh and sign in again.");
    resetCrmSession();
    document.body.classList.remove("auth-loading");
  });
});
