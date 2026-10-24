"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  Globe,
  Loader2,
  Lock,
  NotebookPen,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  createClient,
  updateClient,
  type CreateClientState,
} from "@/lib/clients/actions";
import {
  CURRENCIES,
  CYCLES,
  FEATURES,
  FOUNDING_DISCOUNT,
  PAYMENT_METHODS,
  PLANS,
  RESTAURANT_TYPES,
  STAGES,
  STATUSES,
  YEARLY_MONTHS_PAID,
  type FeatureId,
  type PlanId,
} from "@/lib/clients/options";
import {
  billedAmount,
  clientInputSchema,
  fieldErrors,
  firstBillingDate,
  effectiveBillingDay,
  monthlyValue,
  nextBillingAfter,
  nextBillingOnEdit,
  type ClientFormValues,
} from "@/lib/clients/schema";

type Values = ClientFormValues;

const PLAN_FEATURES: Record<PlanId, FeatureId[]> = {
  essential: ["reservations", "qrMenus"],
  pro: [
    "reservations",
    "qrMenus",
    "onlineOrdering",
    "whatsappOrdering",
    "cardPayments",
    "newsletter",
  ],
  signature: FEATURES.map((f) => f.id),
  custom: [],
};

const featuresFor = (plan: PlanId) =>
  Object.fromEntries(
    FEATURES.map((f) => [f.id, PLAN_FEATURES[plan].includes(f.id)]),
  ) as Values["features"];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function initialValues(): Values {
  const start = today();
  const pro = PLANS.find((p) => p.id === "pro")!;
  return {
    name: "",
    slug: "",
    type: "restaurant",
    city: "",
    country: "Lebanon",
    address: "",
    contactName: "",
    contactRole: "",
    phone: "",
    whatsapp: "",
    email: "",
    plan: "pro",
    cycle: "monthly",
    currency: "USD",
    monthlyPrice: String(pro.monthly),
    setupFee: String(pro.setup),
    founding: false,
    setupPaid: false,
    startDate: start,
    billingDay: String(Math.min(Number(start.slice(8, 10)), 28)),
    status: "active",
    trialEndsAt: "",
    paymentMethod: "cash",
    stage: "onboarding",
    domain: "",
    launchDate: "",
    features: featuresFor("pro"),
    vercelProject: "",
    renderService: "",
    apiUrl: "",
    notes: "",
    isDemo: false,
  };
}

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

/** A copy of the object without these keys */
const without = (errors: Record<string, string>, ...keys: string[]) =>
  Object.fromEntries(Object.entries(errors).filter(([k]) => !keys.includes(k)));

const toNumber = (v: string) =>
  v.trim() === "" ? Number.NaN : Number(v.replace(/,/g, ""));

function toPayload(v: Values): Record<string, unknown> {
  return {
    ...v,
    monthlyPrice: toNumber(v.monthlyPrice),
    setupFee: toNumber(v.setupFee),
    billingDay: effectiveBillingDay(v, toNumber(v.billingDay)),
  };
}

function formatMoney(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return "–";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "LBP" ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "–";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** Field names in words, for the list of problems above the form */
const FIELD_LABELS: Record<string, string> = {
  name: "Restaurant name",
  slug: "Site id",
  type: "Type",
  city: "City",
  country: "Country",
  address: "Address",
  isDemo: "MESA Demo",
  contactName: "Contact name",
  contactRole: "Role",
  phone: "Phone",
  whatsapp: "WhatsApp number",
  email: "Email",
  plan: "Plan",
  cycle: "Billing",
  currency: "Currency",
  monthlyPrice: "Monthly price",
  setupFee: "Setup fee",
  founding: "Founding client",
  setupPaid: "Setup fee paid",
  status: "Status",
  startDate: "Start date",
  billingDay: "Billing day",
  trialEndsAt: "Trial ends",
  nextBillingDate: "Next payment",
  paymentMethod: "Usually pays by",
  stage: "Stage",
  domain: "Domain",
  launchDate: "Launch date",
  apiUrl: "API address",
  features: "Included features",
  vercelProject: "Vercel project",
  renderService: "Render service",
  notes: "Notes",
};

/* ───────────── the form ───────────── */

/**
 * Creates a client, or edits one when `client` is given (/clients/edit/<slug>): the same form,
 * prefilled, with the site id locked and the next payment date editable.
 */
export function ClientForm({
  client,
  prefill,
}: {
  client?: { slug: string; values: Values };
  /** "Convert to client": a new client filled from an onboarding request */
  prefill?: { requestId: string; values: Values };
} = {}) {
  const editing = !!client;
  const [values, setValues] = useState<Values>(
    () => client?.values ?? prefill?.values ?? initialValues(),
  );
  // When editing, plan changes no longer overwrite the slug or the chosen features. From a
  // request, the features come from their answers: a plan change keeps them too.
  const [slugEdited, setSlugEdited] = useState(editing);
  const [featuresEdited, setFeaturesEdited] = useState(editing || !!prefill);
  const [sameWhatsapp, setSameWhatsapp] = useState(
    !(client?.values.whatsapp || prefill?.values.whatsapp),
  );
  const [showHosting, setShowHosting] = useState(
    !!(client?.values.vercelProject || client?.values.renderService),
  );
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [state, action, pending] = useActionState<CreateClientState, FormData>(
    client ? updateClient.bind(null, client.slug) : createClient,
    undefined,
  );

  // New answer from the server: its errors show until each field is edited again
  const [seenState, setSeenState] = useState(state);
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  if (state !== seenState) {
    setSeenState(state);
    setCleared(new Set());
  }

  const errors: Record<string, string> = { ...localErrors };
  const serverErrors: Record<string, string> = state?.errors ?? {};
  for (const [k, msg] of Object.entries(serverErrors))
    if (!cleared.has(k)) errors[k] ??= msg;
  const errorCount = Object.keys(errors).length;

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key as string]) {
      setLocalErrors((e) => without(e, key as string));
      setCleared((c) => new Set(c).add(key as string));
    }
  };

  const payloadValues: Values = {
    ...values,
    whatsapp: sameWhatsapp ? "" : values.whatsapp,
  };
  const payload = JSON.stringify(toPayload(payloadValues));

  // Editing: nothing to save until something changed, and a warning before leaving with changes
  const [startPayload] = useState(payload);
  const dirty = !editing || payload !== startPayload;
  useEffect(() => {
    if (!editing || !dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing, dirty, pending]);

  /* plan changes prefill prices and features (features only until you change them yourself) */
  const pickPlan = (plan: PlanId) => {
    const p = PLANS.find((x) => x.id === plan)!;
    setValues((v) => ({
      ...v,
      plan,
      ...(plan !== "custom" && {
        monthlyPrice: String(p.monthly),
        setupFee: String(
          Math.round(p.setup * (v.founding ? 1 - FOUNDING_DISCOUNT : 1)),
        ),
      }),
      ...(!featuresEdited && { features: featuresFor(plan) }),
    }));
    setLocalErrors((e) => without(e, "monthlyPrice", "setupFee"));
  };

  const toggleFounding = (on: boolean) => {
    const p = PLANS.find((x) => x.id === values.plan)!;
    setValues((v) => ({
      ...v,
      founding: on,
      ...(v.plan !== "custom" && {
        setupFee: String(
          Math.round(p.setup * (on ? 1 - FOUNDING_DISCOUNT : 1)),
        ),
      }),
    }));
  };

  const onName = (name: string) => {
    setValues((v) => ({
      ...v,
      name,
      ...(!slugEdited && { slug: slugify(name) }),
    }));
    if (errors.name || (!slugEdited && errors.slug)) {
      setLocalErrors((e) => without(e, "name", "slug"));
      setCleared((c) => new Set(c).add("name").add("slug"));
    }
  };

  /* checked here first: instant messages, and the first problem scrolled into view */
  /* scrolls to a field (or the first part of it) and puts the cursor in it */
  const goTo = (key: string) => {
    const el = document.querySelector<HTMLElement>(
      `[data-field="${key.split(".")[0]}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector<HTMLElement>("input, textarea, button")?.focus({
      preventScroll: true,
    });
  };

  // The server said no: bring its message (and the list of fields) into view
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state?.message)
      alertRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const result = clientInputSchema.safeParse(toPayload(payloadValues));
    if (result.success) {
      setLocalErrors({});
      return; // the action runs
    }
    event.preventDefault();
    const found = fieldErrors(result.error);
    setLocalErrors(found);
    const first = Object.keys(found)[0];
    requestAnimationFrame(() => goTo(first));
  };

  return (
    <form
      action={action}
      onSubmit={onSubmit}
      noValidate
      className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-6 pb-28 lg:grid-cols-[minmax(0,1fr)_320px] lg:pb-0 xl:grid-cols-[minmax(0,1fr)_340px]"
    >
      <input type="hidden" name="payload" value={payload} />
      {prefill && (
        <input type="hidden" name="fromRequest" value={prefill.requestId} />
      )}

      <div className="space-y-6">
        {state?.message && (!state.errors || errorCount > 0) && (
          <div
            ref={alertRef}
            role="alert"
            className="scroll-mt-6 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <p className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.message}
            </p>
            {errorCount > 0 && (
              <ul className="mt-2 space-y-1 pl-6.5">
                {Object.entries(errors).map(([key, message]) => (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => goTo(key)}
                      className="text-left underline decoration-destructive/40 underline-offset-2 hover:decoration-destructive"
                    >
                      <span className="font-semibold">
                        {FIELD_LABELS[key.split(".")[0]] ?? key}:
                      </span>{" "}
                      {message}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 1. Restaurant */}
        <Section
          n={1}
          icon={<Building2 />}
          title="Restaurant"
          text="Who the client is and where."
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
            <Field
              label="Restaurant name"
              name="name"
              error={errors.name}
              className="sm:col-span-2"
            >
              <Input
                value={values.name}
                onChange={onName}
                placeholder="Sea Salt Grill"
                autoFocus={!editing}
              />
            </Field>
            <Field
              label="Site id"
              name="slug"
              error={errors.slug}
              hint={
                editing
                  ? "Locked: the site's folder, MESA_SITE and its database use it."
                  : "Its id everywhere: sites/<id>, MESA_SITE, the mesa_<id> database."
              }
              className="sm:col-span-2"
            >
              <div className="relative flex">
                <span className="hidden items-center rounded-l-xl border border-r-0 border-border bg-muted px-3 font-mono text-sm text-muted-foreground sm:flex">
                  sites/
                </span>
                <Input
                  value={values.slug}
                  onChange={(v) => {
                    setSlugEdited(true);
                    set("slug", slugify(v) || v.toLowerCase());
                  }}
                  placeholder="sea-salt-grill"
                  className={`font-mono sm:rounded-l-none ${editing ? "cursor-not-allowed pr-10 text-muted-foreground" : ""}`}
                  spellCheck={false}
                  readOnly={editing}
                  aria-readonly={editing}
                />
                {editing && (
                  <Lock className="pointer-events-none absolute inset-y-0 right-3.5 my-auto size-4 text-muted-foreground" />
                )}
              </div>
            </Field>
            <Field
              label="Type"
              name="type"
              error={errors.type}
              className="sm:col-span-2"
            >
              <Chips
                options={RESTAURANT_TYPES}
                value={values.type}
                onChange={(v) => set("type", v)}
              />
            </Field>
            <Field label="City" name="city" error={errors.city}>
              <Input
                value={values.city}
                onChange={(v) => set("city", v)}
                placeholder="Jounieh"
              />
            </Field>
            <Field label="Country" name="country" error={errors.country}>
              <Input
                value={values.country}
                onChange={(v) => set("country", v)}
              />
            </Field>
            <Field
              label="Address"
              name="address"
              error={errors.address}
              optional
              className="sm:col-span-2"
            >
              <Input
                value={values.address}
                onChange={(v) => set("address", v)}
                placeholder="Seaside Road 40, Maameltein"
              />
            </Field>
            <div className="sm:col-span-2" data-field="isDemo">
              <Toggle
                checked={values.isDemo}
                onChange={(on) => set("isDemo", on)}
                label="This is the MESA Demo"
                hint="Your showcase site: pinned at the top of Clients and Health, left out of income and stats, and protected from deleting."
              />
            </div>
          </div>
        </Section>

        {/* 2. Contact */}
        <Section
          n={2}
          icon={<UserRound />}
          title="Contact"
          text="The person you deal with, for payments and changes."
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
            <Field
              label="Full name"
              name="contactName"
              error={errors.contactName}
            >
              <Input
                value={values.contactName}
                onChange={(v) => set("contactName", v)}
                placeholder="Rami Haddad"
                autoComplete="off"
              />
            </Field>
            <Field
              label="Role"
              name="contactRole"
              error={errors.contactRole}
              optional
            >
              <Input
                value={values.contactRole}
                onChange={(v) => set("contactRole", v)}
                placeholder="Owner, manager…"
              />
            </Field>
            <Field label="Phone" name="phone" error={errors.phone}>
              <Input
                value={values.phone}
                onChange={(v) => set("phone", v)}
                placeholder="+961 70 123 456"
                inputMode="tel"
              />
            </Field>
            <Field label="Email" name="email" error={errors.email}>
              <Input
                value={values.email}
                onChange={(v) => set("email", v)}
                placeholder="rami@seasaltgrill.com"
                inputMode="email"
              />
            </Field>
            <div className="sm:col-span-2" data-field="whatsapp">
              <Toggle
                checked={sameWhatsapp}
                onChange={(on) => {
                  setSameWhatsapp(on);
                  if (on) set("whatsapp", "");
                }}
                label="Same number on WhatsApp"
                hint="Used for payment reminders."
              />
              {!sameWhatsapp && (
                <div className="mt-4">
                  <Field
                    label="WhatsApp number"
                    name="whatsapp"
                    error={errors.whatsapp}
                  >
                    <Input
                      value={values.whatsapp}
                      onChange={(v) => set("whatsapp", v)}
                      placeholder="+961 71 234 567"
                      inputMode="tel"
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* 3. Plan & price */}
        <Section
          n={3}
          icon={<Sparkles />}
          title="Plan & price"
          text="Prefilled from your pricing. Adjust for this client if needed."
        >
          <div
            data-field="plan"
            className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2"
          >
            {PLANS.map((p) => {
              const active = values.plan === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickPlan(p.id)}
                  aria-pressed={active}
                  className={`relative rounded-2xl border p-4 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/8 shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                      : "border-border bg-elevated/40 hover:border-border-strong"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold">
                      {p.name}
                      {"recommended" in p && p.recommended && (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                          Popular
                        </span>
                      )}
                    </span>
                    <span
                      className={`grid size-5 place-items-center rounded-full border transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border-strong"
                      }`}
                    >
                      {active && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {p.blurb}
                  </span>
                  {p.id !== "custom" && (
                    <span className="mt-3 flex items-baseline gap-1.5 text-sm">
                      <span className="text-lg font-semibold tabular-nums">
                        ${p.monthly}
                      </span>
                      <span className="text-muted-foreground">
                        / month · ${p.setup} setup
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
            <Field
              label="Billing"
              name="cycle"
              error={errors.cycle}
              hint={
                values.cycle === "yearly"
                  ? `Prepaid: they pay ${YEARLY_MONTHS_PAID} months and get 12.`
                  : "Paid every month."
              }
            >
              <Segmented
                options={CYCLES}
                value={values.cycle}
                onChange={(v) => set("cycle", v)}
              />
            </Field>
            <Field label="Currency" name="currency" error={errors.currency}>
              <Segmented
                options={CURRENCIES.map((c) => ({ id: c, label: c }))}
                value={values.currency}
                onChange={(v) => set("currency", v)}
              />
            </Field>
            <Field
              label="Monthly price"
              name="monthlyPrice"
              error={errors.monthlyPrice}
              hint={
                values.cycle === "yearly"
                  ? `Billed ${formatMoney(billedAmount(toNumber(values.monthlyPrice), "yearly"), values.currency)} a year`
                  : undefined
              }
            >
              <MoneyInput
                currency={values.currency}
                value={values.monthlyPrice}
                onChange={(v) => set("monthlyPrice", v)}
              />
            </Field>
            <Field
              label="Setup fee"
              name="setupFee"
              error={errors.setupFee}
              hint="One time, at the start."
            >
              <MoneyInput
                currency={values.currency}
                value={values.setupFee}
                onChange={(v) => set("setupFee", v)}
              />
            </Field>
            <div className="space-y-3 sm:col-span-2">
              <Toggle
                checked={values.founding}
                onChange={toggleFounding}
                label={`Founding client (−${Math.round(FOUNDING_DISCOUNT * 100)}% setup)`}
                hint="For your first restaurants, in exchange for a testimonial."
              />
              <Toggle
                checked={values.setupPaid}
                onChange={(on) => set("setupPaid", on)}
                label="Setup fee already paid"
              />
            </div>
          </div>
        </Section>

        {/* 4. Billing */}
        <Section
          n={4}
          icon={<Wallet />}
          title="Billing"
          text="When they pay and how."
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
            <Field
              label="Status"
              name="status"
              error={errors.status}
              className="sm:col-span-2"
            >
              <Chips
                options={STATUSES}
                value={values.status}
                onChange={(v) => set("status", v)}
              />
            </Field>
            <Field label="Start date" name="startDate" error={errors.startDate}>
              <Input
                type="date"
                value={values.startDate}
                onChange={(v) => set("startDate", v)}
              />
            </Field>
            {values.status === "trial" && (
              <Field
                label="Trial ends"
                name="trialEndsAt"
                error={errors.trialEndsAt}
              >
                <Input
                  type="date"
                  value={values.trialEndsAt}
                  onChange={(v) => set("trialEndsAt", v)}
                  min={values.startDate}
                />
              </Field>
            )}
            {/* Yearly plans renew a year after the first payment: no day to pick */}
            {values.cycle === "monthly" && (
              <Field
                label={
                  values.status === "trial"
                    ? "Billing day after the trial"
                    : "Billing day"
                }
                name="billingDay"
                error={errors.billingDay}
                hint="Day of the month, 1 to 28."
              >
                <Input
                  value={values.billingDay}
                  onChange={(v) =>
                    set("billingDay", v.replace(/\D/g, "").slice(0, 2))
                  }
                  inputMode="numeric"
                />
              </Field>
            )}
            {editing &&
              (values.status === "active" || values.status === "trial") && (
                <Field
                  label="Next payment"
                  name="nextBillingDate"
                  error={errors.nextBillingDate}
                  hint={
                    values.nextBillingDate
                      ? "Moves forward by itself once payments are recorded."
                      : "Empty: the first billing date (or today, if it has passed)."
                  }
                >
                  <Input
                    type="date"
                    value={values.nextBillingDate ?? ""}
                    onChange={(v) => set("nextBillingDate", v)}
                  />
                </Field>
              )}
            <Field
              label="Usually pays by"
              name="paymentMethod"
              error={errors.paymentMethod}
              className="sm:col-span-2"
            >
              <Chips
                options={PAYMENT_METHODS}
                value={values.paymentMethod}
                onChange={(v) => set("paymentMethod", v)}
              />
            </Field>
          </div>
        </Section>

        {/* 5. Website */}
        <Section
          n={5}
          icon={<Globe />}
          title="Website"
          text="Where their MESA site stands, and what it includes."
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
            <Field
              label="Stage"
              name="stage"
              error={errors.stage}
              className="sm:col-span-2"
            >
              <Chips
                options={STAGES}
                value={values.stage}
                onChange={(v) => set("stage", v)}
              />
            </Field>
            <Field label="Domain" name="domain" error={errors.domain} optional>
              <Input
                value={values.domain}
                onChange={(v) => set("domain", v.trim())}
                placeholder="seasaltgrill.com"
                className="font-mono"
                spellCheck={false}
              />
            </Field>
            <Field
              label="Launch date"
              name="launchDate"
              error={errors.launchDate}
              optional
            >
              <Input
                type="date"
                value={values.launchDate}
                onChange={(v) => set("launchDate", v)}
              />
            </Field>
            <Field
              label="API address"
              name="apiUrl"
              error={errors.apiUrl}
              optional
              className="sm:col-span-2"
              hint="Their MESA API on Render. HQ checks it for health once the site is live."
            >
              <Input
                value={values.apiUrl}
                onChange={(v) => set("apiUrl", v.trim())}
                placeholder={`https://mesa-${values.slug || "site-id"}-api.onrender.com`}
                className="font-mono"
                spellCheck={false}
                inputMode="url"
              />
            </Field>
            <Field
              label="Included features"
              name="features"
              error={errors.features}
              className="sm:col-span-2"
              hint="Prefilled from the plan."
            >
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                {FEATURES.map((f) => {
                  const on = values.features[f.id];
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setFeaturesEdited(true);
                        set("features", { ...values.features, [f.id]: !on });
                      }}
                      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                        on
                          ? "border-primary/50 bg-primary/8 text-foreground"
                          : "border-border text-muted-foreground hover:border-border-strong"
                      }`}
                    >
                      <span
                        className={`grid size-4.5 shrink-0 place-items-center rounded-md border transition-colors ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border-strong"
                        }`}
                      >
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={() => setShowHosting((s) => !s)}
                aria-expanded={showHosting}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronDown
                  className={`size-4 transition-transform ${showHosting ? "rotate-180" : ""}`}
                />
                Hosting details
                <span className="font-normal">(optional)</span>
              </button>
              {showHosting && (
                <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
                  <Field
                    label="Vercel project"
                    name="vercelProject"
                    error={errors.vercelProject}
                  >
                    <Input
                      value={values.vercelProject}
                      onChange={(v) => set("vercelProject", v)}
                      placeholder={`mesa-${values.slug || "site-id"}`}
                      className="font-mono"
                    />
                  </Field>
                  <Field
                    label="Render service"
                    name="renderService"
                    error={errors.renderService}
                  >
                    <Input
                      value={values.renderService}
                      onChange={(v) => set("renderService", v)}
                      placeholder={`mesa-${values.slug || "site-id"}-api`}
                      className="font-mono"
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* 6. Notes */}
        <Section
          n={6}
          icon={<NotebookPen />}
          title="Notes"
          text="Only for you."
        >
          <Field
            label="Notes"
            name="notes"
            error={errors.notes}
            optional
            hideLabel
          >
            <textarea
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Agreed terms, preferences, anything worth remembering…"
              className={`${inputClass} min-h-28 resize-y py-3`}
            />
          </Field>
        </Section>
      </div>

      <Summary
        values={payloadValues}
        pending={pending}
        errorCount={errorCount}
        editing={editing}
        dirty={dirty}
      />
    </form>
  );
}

/* ───────────── summary (side on desktop, bottom bar on phones) ───────────── */

function Summary({
  values,
  pending,
  errorCount,
  editing,
  dirty,
}: {
  values: Values;
  pending: boolean;
  errorCount: number;
  editing: boolean;
  dirty: boolean;
}) {
  const plan = PLANS.find((p) => p.id === values.plan)!;
  const monthly = toNumber(values.monthlyPrice);
  const setup = toNumber(values.setupFee);
  const day = Math.min(
    Math.max(effectiveBillingDay(values, toNumber(values.billingDay)) || 1, 1),
    28,
  );
  const status = STATUSES.find((s) => s.id === values.status)!;
  const billed = billedAmount(monthly, values.cycle);
  const first = firstBillingDate(values);
  const second = useMemo(
    () =>
      /^\d{4}-\d{2}-\d{2}$/.test(first)
        ? nextBillingAfter(first, day, values.cycle)
        : "",
    [first, day, values.cycle],
  );
  const billsNow = values.status === "active" || values.status === "trial";
  // Editing shows the date that will be saved, not the first one
  const upcoming = editing ? nextBillingOnEdit(values, today()) : first;
  const upcomingLabel = editing ? "Next payment" : "First payment";
  const planSetup = plan.id === "custom" ? setup : plan.setup;

  return (
    <>
      <aside className="sticky top-8 hidden space-y-4 lg:block">
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="relative border-b border-border px-5 py-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 -right-10 size-44 rounded-full bg-primary/25 blur-3xl"
            />
            <p className="relative text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Summary
            </p>
            <p className="relative mt-2 truncate text-lg font-semibold">
              {values.name || "New client"}
            </p>
            <p className="relative truncate font-mono text-xs text-muted-foreground">
              sites/{values.slug || "…"}
            </p>
          </div>
          <dl className="space-y-3.5 px-5 py-5 text-sm">
            <Row label="Plan">
              <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {plan.name}
              </span>
            </Row>
            <Row
              label={
                values.cycle === "yearly" ? "Billed yearly" : "Billed monthly"
              }
            >
              <span className="font-semibold tabular-nums">
                {formatMoney(billed, values.currency)}
              </span>
            </Row>
            {values.cycle === "yearly" && Number.isFinite(monthly) && (
              <Row label="Per month">
                <span className="tabular-nums text-muted-foreground">
                  {formatMoney(
                    monthlyValue(monthly, "yearly"),
                    values.currency,
                  )}{" "}
                  (12 for {YEARLY_MONTHS_PAID})
                </span>
              </Row>
            )}
            <Row label="Setup fee">
              <span className="tabular-nums">
                {values.founding && planSetup !== setup && (
                  <s className="mr-1.5 text-muted-foreground">
                    {formatMoney(planSetup, values.currency)}
                  </s>
                )}
                {formatMoney(setup, values.currency)}
                {values.setupPaid && (
                  <span className="ml-1.5 text-xs text-success">paid</span>
                )}
              </span>
            </Row>
            <Row label="Status">
              <span className="flex items-center gap-1.5">
                <StatusDot status={values.status} /> {status.label}
              </span>
            </Row>
          </dl>
          <div className="border-t border-border bg-elevated/40 px-5 py-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CalendarClock className="size-4 text-primary" /> Billing
            </p>
            <p className="mt-1.5 text-muted-foreground">
              {billsNow ? (
                <>
                  {upcomingLabel}{" "}
                  <span className="text-foreground">
                    {formatDate(upcoming)}
                  </span>
                  {editing
                    ? "."
                    : second &&
                      (values.cycle === "yearly" ? (
                        <>
                          , then once a year (next{" "}
                          <span className="text-foreground">
                            {formatDate(second)}
                          </span>
                          ).
                        </>
                      ) : (
                        <>
                          , then on the{" "}
                          <span className="text-foreground">
                            {ordinal(day)}
                          </span>{" "}
                          of each month (next {formatDate(second)}).
                        </>
                      ))}
                </>
              ) : (
                `Not billed while ${status.label.toLowerCase()}.`
              )}
            </p>
          </div>
        </div>
        <SaveButton
          pending={pending}
          errorCount={errorCount}
          editing={editing}
          dirty={dirty}
          className="w-full"
        />
      </aside>

      {/* Phones and tablets */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {plan.name} · {formatMoney(billed, values.currency)}
              <span className="font-normal text-muted-foreground">
                /{values.cycle === "yearly" ? "yr" : "mo"}
              </span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {billsNow
                ? `${upcomingLabel} ${formatDate(upcoming)}`
                : `Not billed while ${status.label.toLowerCase()}`}
            </p>
          </div>
          <SaveButton
            pending={pending}
            errorCount={errorCount}
            editing={editing}
            dirty={dirty}
          />
        </div>
      </div>
    </>
  );
}

function SaveButton({
  pending,
  errorCount,
  editing,
  dirty,
  className = "",
}: {
  pending: boolean;
  errorCount: number;
  editing: boolean;
  dirty: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="submit"
        disabled={pending || !dirty}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground shadow-[0_14px_30px_-14px_var(--primary)] transition-all hover:brightness-110 active:translate-y-px disabled:opacity-60 disabled:shadow-none"
      >
        {pending ? (
          <Loader2 className="size-4.5 animate-spin" />
        ) : (
          <Check className="size-4.5" />
        )}
        {pending
          ? "Saving…"
          : !editing
            ? "Create client"
            : dirty
              ? "Save changes"
              : "No changes"}
      </button>
      {errorCount > 0 && (
        <p className="mt-2 hidden text-center text-xs text-destructive lg:block">
          {errorCount} field{errorCount === 1 ? " needs" : "s need"} your
          attention
        </p>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: Values["status"] }) {
  const color = {
    trial: "bg-accent",
    active: "bg-success",
    paused: "bg-muted-foreground",
    cancelled: "bg-destructive",
  }[status];
  return <span className={`size-2 rounded-full ${color}`} />;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/* ───────────── building blocks ───────────── */

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-elevated/60 px-3.5 text-[15px] text-foreground outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/55 hover:border-border-strong focus:border-primary focus:bg-elevated focus:ring-3 focus:ring-primary/20 aria-invalid:border-destructive aria-invalid:ring-destructive/15";

function Section({
  n,
  icon,
  title,
  text,
  children,
}: {
  n: number;
  icon: ReactNode;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
      <header className="mb-6 flex items-start gap-3.5">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-border-strong bg-elevated text-primary [&_svg]:size-4.5">
          {icon}
          <span className="absolute -top-1.5 -right-1.5 grid size-4.5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {n}
          </span>
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  optional,
  hideLabel,
  className = "",
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div data-field={name} className={className}>
      <div
        className={
          hideLabel
            ? "sr-only"
            : "mb-2 flex items-baseline justify-between gap-3"
        }
      >
        <span className="text-sm font-medium">{label}</span>
        {optional && (
          <span className="text-xs text-muted-foreground">Optional</span>
        )}
      </div>
      <div
        className={
          error
            ? "[&_input]:border-destructive [&_textarea]:border-destructive"
            : ""
        }
      >
        {children}
      </div>
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-3.5 shrink-0" /> {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function Input({
  value,
  onChange,
  className = "",
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} ${rest.type === "date" ? "scheme-dark" : ""} ${className}`}
    />
  );
}

function MoneyInput({
  currency,
  value,
  onChange,
}: {
  currency: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-medium text-muted-foreground">
        {currency === "USD" ? "$" : "LBP"}
      </span>
      <Input
        value={value}
        onChange={(v) => onChange(v.replace(/[^\d.,]/g, ""))}
        inputMode="decimal"
        className={`tabular-nums ${currency === "USD" ? "pl-8" : "pl-12"}`}
      />
    </div>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.id)}
            className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${
              active
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex rounded-xl border border-border bg-elevated/60 p-1"
      role="radiogroup"
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`flex-1 truncate rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-elevated/40 px-4 py-3 text-left transition-colors hover:border-border-strong"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        )}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border-strong"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </span>
    </button>
  );
}
