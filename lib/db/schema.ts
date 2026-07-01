import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  date,
  timestamp,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const availabilityStatus = pgEnum("availability_status", ["open", "booked", "blocked"]);
export const availabilitySource = pgEnum("availability_source", ["manual", "ical"]);
export const eventSource = pgEnum("event_source", ["hebcal", "manual", "llm"]);
export const guestType = pgEnum("guest_type", ["israeli", "foreign_tourist", "unknown"]);
export const otaChannel = pgEnum("ota_channel", ["airbnb", "booking", "vrbo", "direct", "other"]);

/** Single operator in v1; structure is multi-tenant-ready. */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city"),
  area: text("area"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull().default(2),
  bedrooms: integer("bedrooms").notNull().default(1),
  type: text("type"),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull().default("0"),
  variableCost: numeric("variable_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  minMargin: numeric("min_margin", { precision: 10, scale: 2 }).notNull().default("0"),
  ceiling: numeric("ceiling", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Per-unit iCal connection to an OTA. */
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  unitId: integer("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
  ota: otaChannel("ota").notNull(),
  importUrl: text("import_url"), // iCal feed we read from the OTA
  exportToken: text("export_token"), // token for the iCal feed we expose
  lastSynced: timestamp("last_synced"),
  syncStatus: text("sync_status"), // ok | stale | error
});

export const availability = pgTable(
  "availability",
  {
    id: serial("id").primaryKey(),
    unitId: integer("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: availabilityStatus("status").notNull().default("open"),
    source: availabilitySource("source").notNull().default("manual"),
    lastSeen: timestamp("last_seen").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("availability_unit_date").on(t.unitId, t.date)],
);

export const guests = pgTable("guests", {
  id: serial("id").primaryKey(),
  name: text("name"),
  type: guestType("type").notNull().default("unknown"),
  country: text("country"),
});

/**
 * iCal-sourced rows are thin: date range + opaque label only (iCal carries no
 * guest/price/source). Manual or future-PMS rows carry the full fields.
 */
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  unitId: integer("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
  guestId: integer("guest_id").references(() => guests.id),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  channel: otaChannel("channel"),
  price: numeric("price", { precision: 10, scale: 2 }),
  currency: text("currency").default("ILS"),
  externalUid: text("external_uid"),
  rawLabel: text("raw_label"),
  source: availabilitySource("source").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Per-property overrides on DEFAULT_CONFIG_IL (stored as JSON text). */
export const pricingRules = pgTable("pricing_rules", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  config: text("config"),
  occupancyWeight: numeric("occupancy_weight", { precision: 4, scale: 3 }).default("0.300"),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  multiplier: numeric("multiplier", { precision: 4, scale: 2 }).notNull().default("1.00"),
  confidence: numeric("confidence", { precision: 4, scale: 3 }),
  source: eventSource("source").notNull().default("manual"),
});

export const priceRecommendations = pgTable(
  "price_recommendations",
  {
    id: serial("id").primaryKey(),
    unitId: integer("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    recommended: numeric("recommended", { precision: 10, scale: 2 }).notNull(),
    breakdown: text("breakdown"), // JSON breakdown
    explanation: text("explanation"),
    computedAt: timestamp("computed_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("price_rec_unit_date").on(t.unitId, t.date)],
);
