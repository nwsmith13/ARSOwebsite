(() => {
  "use strict";

  const measurementId = "G-Y0H1S4Z1W0";

  function sendEvent(eventName, parameters = {}) {
    if (typeof window.gtag !== "function") return;

    window.gtag("event", eventName, {
      send_to: measurementId,
      page_location: window.location.href,
      page_title: document.title,
      ...parameters
    });
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
  }

  function trackClicks() {
    document.addEventListener("click", (event) => {
      const tracked = event.target.closest("[data-ga-event]");
      if (tracked) {
        sendEvent(tracked.dataset.gaEvent, {
          link_text: cleanText(tracked.textContent),
          link_url: tracked.getAttribute("href") || "",
          content_id: tracked.id || tracked.closest("[id]")?.id || ""
        });
        return;
      }

      const link = event.target.closest("a");
      if (!link) return;

      const label = cleanText(link.textContent).toLowerCase();
      const href = link.getAttribute("href") || "";

      if (label === "request a free demo") {
        sendEvent("cta_demo_clicked", {
          link_text: cleanText(link.textContent),
          link_url: href
        });
      } else if (label === "view examples") {
        sendEvent("cta_examples_clicked", {
          link_text: cleanText(link.textContent),
          link_url: href
        });
      } else if (label === "contact") {
        sendEvent("cta_contact_clicked", {
          link_text: cleanText(link.textContent),
          link_url: href
        });
      }
    });
  }

  function trackContactForm() {
    const form = document.querySelector("#contact-form");
    if (!form) return;

    let started = false;
    const markStarted = (event) => {
      if (started || !event.target.matches("input, select, textarea")) return;

      started = true;
      sendEvent("contact_form_started", {
        form_id: form.id,
        first_field: event.target.name || event.target.id || "unknown"
      });
    };

    form.addEventListener("focusin", markStarted);
    form.addEventListener("input", markStarted);
  }

  window.addEventListener("arso:contact_form_submitted", (event) => {
    const category = cleanText(event.detail?.category || "not_provided");

    sendEvent("contact_form_submitted", {
      form_id: "contact-form",
      category
    });
    sendEvent("lead_generated", {
      form_id: "contact-form",
      category,
      method: "website_contact_form"
    });
  });

  document.addEventListener("DOMContentLoaded", () => {
    trackClicks();
    trackContactForm();
  });

  window.arsoGa4 = { sendEvent };
})();
