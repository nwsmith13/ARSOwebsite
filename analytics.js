(() => {
  "use strict";

  const config = window.ARSO_POSTHOG_CONFIG || {};
  const token = String(config.token || "").trim();
  const apiHost = String(config.api_host || "https://us.i.posthog.com").trim();
  const enabled = Boolean(token) && !/^YOUR_|^<.+>$/.test(token);
  const attributionKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content"
  ];

  function safeStorage(storage) {
    try {
      const key = "__arso_storage_test__";
      storage.setItem(key, "1");
      storage.removeItem(key);
      return storage;
    } catch (_error) {
      return null;
    }
  }

  const local = safeStorage(window.localStorage);
  const session = safeStorage(window.sessionStorage);

  function referralSource() {
    if (!document.referrer) return "direct";

    try {
      const referrer = new URL(document.referrer);
      return referrer.hostname === window.location.hostname
        ? "internal"
        : referrer.hostname.replace(/^www\./, "");
    } catch (_error) {
      return "unknown";
    }
  }

  function currentAttribution() {
    const params = new URLSearchParams(window.location.search);
    const values = {
      referral_source: referralSource(),
      landing_page: window.location.pathname,
      landing_url: window.location.href
    };

    attributionKeys.forEach((key) => {
      const value = params.get(key);
      if (value) values[key] = value;
    });

    return values;
  }

  function readJson(storage, key) {
    if (!storage) return null;

    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch (_error) {
      return null;
    }
  }

  function writeJson(storage, key, value) {
    if (!storage) return;

    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (_error) {
      // Analytics must never interfere with the website.
    }
  }

  const previousSessionTouch = readJson(session, "arso_current_touch");
  const latestTouch = currentAttribution();
  const currentTouch = {
    ...(previousSessionTouch || {}),
    ...latestTouch
  };

  attributionKeys.forEach((key) => {
    if (!latestTouch[key] && previousSessionTouch?.[key]) {
      currentTouch[key] = previousSessionTouch[key];
    }
  });

  if (
    latestTouch.referral_source === "internal" &&
    previousSessionTouch?.referral_source
  ) {
    currentTouch.referral_source = previousSessionTouch.referral_source;
  }

  const firstTouch =
    readJson(local, "arso_first_touch") ||
    currentTouch;

  writeJson(local, "arso_first_touch", firstTouch);
  writeJson(session, "arso_current_touch", currentTouch);

  function prefixedAttribution() {
    const properties = {
      referral_source: currentTouch.referral_source,
      first_referral_source: firstTouch.referral_source,
      traffic_source:
        currentTouch.utm_source ||
        currentTouch.referral_source ||
        "direct",
      landing_page: firstTouch.landing_page,
      current_page: window.location.pathname,
      page_title: document.title
    };

    attributionKeys.forEach((key) => {
      if (currentTouch[key]) properties[key] = currentTouch[key];
      if (firstTouch[key]) properties[`first_${key}`] = firstTouch[key];
    });

    return properties;
  }

  function loadPostHog() {
    if (!enabled) return;

    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

    window.posthog.init(token, {
      api_host: apiHost,
      defaults: "2026-01-30",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only"
    });

    window.posthog.register(prefixedAttribution());
    window.posthog.register_once(
      Object.fromEntries(
        Object.entries(firstTouch).map(([key, value]) => [`first_${key}`, value])
      )
    );
  }

  function capture(eventName, properties = {}) {
    if (!enabled || !window.posthog || typeof window.posthog.capture !== "function") {
      return false;
    }

    window.posthog.capture(eventName, {
      ...prefixedAttribution(),
      ...properties
    });
    return true;
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  }

  function elementLabel(element) {
    return normalizeText(
      element.getAttribute("data-analytics-label") ||
      element.textContent ||
      element.getAttribute("aria-label")
    );
  }

  function cardName(element, selectors) {
    const card = element.closest(selectors);
    if (!card) return elementLabel(element);

    return normalizeText(
      card.getAttribute("data-analytics-name") ||
      card.querySelector(".service-kicker, .project-example-top span, .project-tag, h2, h3, strong, span")?.textContent
    );
  }

  function destination(element) {
    return element.getAttribute("href") || "";
  }

  function trackClicks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a, button");
      if (!link) return;

      const href = destination(link);
      const label = elementLabel(link);
      const isContactCta =
        link.matches(".contact-form-trigger, .contact-primary-cta, .footer-cta-link") ||
        /(?:^|\/)index\.html#contact(?:-form)?$/.test(href) ||
        /^#contact(?:-form)?$/.test(href);

      if (isContactCta) {
        capture("contact_cta_clicked", {
          cta_label: label,
          destination: href,
          placement: normalizeText(
            link.closest("header, footer, section, nav")?.className || "unknown"
          )
        });
      }

      if (
        link.matches(".service-inline-cta") ||
        link.closest(".homepage-capability-grid article")
      ) {
        capture("service_card_clicked", {
          service_name: cardName(
            link,
            ".service-offering, .homepage-capability-grid article"
          ),
          link_label: label,
          destination: href
        });
      }

      if (
        link.matches(".project-detail-link, .project-example-link") ||
        link.closest(".project-card, .project-example-card, .case-study-card")
      ) {
        capture("project_example_clicked", {
          project_name: cardName(
            link,
            ".project-card, .project-example-card, .case-study-card"
          ),
          link_label: label,
          destination: href
        });
      }
    });
  }

  function trackServiceViews() {
    const services = Array.from(
      document.querySelectorAll(".service-offering")
    );
    if (!services.length || !("IntersectionObserver" in window)) return;

    const seen = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.45) return;

          const serviceName = cardName(entry.target, ".service-offering");
          if (seen.has(serviceName)) return;

          seen.add(serviceName);
          capture("service_viewed", {
            service_name: serviceName,
            service_id: entry.target.id || ""
          });
          observer.unobserve(entry.target);
        });
      },
      { threshold: [0.45] }
    );

    services.forEach((service) => observer.observe(service));
  }

  function trackContactForm() {
    const form = document.querySelector("#contact-form");
    if (!form) return;

    let started = false;
    const markStarted = (event) => {
      if (started || !event.target.matches("input, select, textarea")) return;
      started = true;
      capture("contact_form_started", {
        first_field: event.target.name || event.target.id || "unknown"
      });
    };

    form.addEventListener("focusin", markStarted);
    form.addEventListener("input", markStarted);

    window.addEventListener("arso:contact_form_submitted", (event) => {
      capture("contact_form_submitted", {
        category: normalizeText(event.detail?.category || "not_provided")
      });
    });
  }

  loadPostHog();

  document.addEventListener("DOMContentLoaded", () => {
    capture("page_view", {
      page_path: window.location.pathname,
      page_url: window.location.href
    });
    trackClicks();
    trackServiceViews();
    trackContactForm();
  });

  window.arsoAnalytics = {
    capture,
    enabled,
    attribution: prefixedAttribution()
  };
})();
