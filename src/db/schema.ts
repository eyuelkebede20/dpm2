import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  primaryKey,
  pgEnum,
  json,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
  "sys_admin",
  "om",
  "fm",
  "qa",
]);

// -------------------------------------------------------------
// Users & Better Auth Tables
// -------------------------------------------------------------
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("qa"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  createdBy: text("created_by"),
  active: boolean("active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// -------------------------------------------------------------
// Company / Industry Settings
// -------------------------------------------------------------
export const industryProfile = pgTable("industry_profile", {
  id: text("id").primaryKey().default("default"),
  companyName: text("company_name").notNull().default("Daily Production Manager"),
  // Working days stored as array of day numbers (0 = Sun, 1 = Mon, ..., 6 = Sat). Default: [1, 2, 3, 4, 5, 6] (Sun off)
  workingDays: json("working_days").$type<number[]>().notNull().default([1, 2, 3, 4, 5, 6]),
  units: text("units").notNull().default("pcs"),
  calendarSystem: text("calendar_system").notNull().default("ethiopian"), // 'ethiopian' | 'gregorian'
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// -------------------------------------------------------------
// Factories & Factory Users
// -------------------------------------------------------------
export const factories = pgTable("factories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  omId: text("om_id").references(() => users.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const factoryUsers = pgTable(
  "factory_users",
  {
    factoryId: text("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.factoryId, t.userId] }),
  })
);

// -------------------------------------------------------------
// Lines & Products
// -------------------------------------------------------------
export const lines = pgTable("lines", {
  id: text("id").primaryKey(),
  factoryId: text("factory_id")
    .notNull()
    .references(() => factories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  factoryId: text("factory_id")
    .notNull()
    .references(() => factories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const lineProducts = pgTable(
  "line_products",
  {
    lineId: text("line_id")
      .notNull()
      .references(() => lines.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.lineId, t.productId] }),
  })
);

export const qaAssignments = pgTable(
  "qa_assignments",
  {
    qaUserId: text("qa_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.qaUserId, t.productId] }),
  })
);

// -------------------------------------------------------------
// Plans
// -------------------------------------------------------------
export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  lineId: text("line_id")
    .notNull()
    .references(() => lines.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  plannedQty: integer("planned_qty").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// -------------------------------------------------------------
// Special Days & Holidays
// -------------------------------------------------------------
export const specialDays = pgTable("special_days", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  date: text("date").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAm: text("name_am").notNull(),
  type: text("type").notNull().default("holiday"), // 'holiday' | 'weekend' | 'shutdown' | 'custom'
  isWorkingDay: boolean("is_working_day").notNull().default(false),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// -------------------------------------------------------------
// Downtime Reasons
// -------------------------------------------------------------
export const downtimeReasons = pgTable("downtime_reasons", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(), // e.g. DOW-01
  nameEn: text("name_en").notNull(),
  nameAm: text("name_am").notNull(),
  category: text("category").notNull().default("machine"), // 'tooling' | 'machine' | 'power' | 'material' | 'quality' | 'safety' | 'other'
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// -------------------------------------------------------------
// Report Entries (Daily Production)
// -------------------------------------------------------------
export const reportEntries = pgTable(
  "report_entries",
  {
    id: text("id").primaryKey(),
    date: date("date").notNull(),
    lineId: text("line_id")
      .notNull()
      .references(() => lines.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    finishedGood: integer("finished_good").notNull().default(0),
    rework: integer("rework").notNull().default(0),
    reject: integer("reject").notNull().default(0),
    scrap: integer("scrap").notNull().default(0),
    wip: integer("wip").notNull().default(0),
    downtimeMinutes: integer("downtime_minutes").notNull().default(0),
    issueNote: text("issue_note"),
    downtimeReasonId: text("downtime_reason_id").references(
      () => downtimeReasons.id,
      { onDelete: "set null" }
    ),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqueDateLineProduct: uniqueIndex("uniq_report_entry_date_line_product").on(
      t.date,
      t.lineId,
      t.productId
    ),
  })
);

// -------------------------------------------------------------
// QA Inspections
// -------------------------------------------------------------
export const qaInspections = pgTable("qa_inspections", {
  id: text("id").primaryKey(),
  date: date("date").notNull(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  lineId: text("line_id")
    .notNull()
    .references(() => lines.id, { onDelete: "cascade" }),
  checked: integer("checked").notNull().default(0),
  defects: integer("defects").notNull().default(0),
  note: text("note"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// -------------------------------------------------------------
// Stock Ledger
// -------------------------------------------------------------
export const stockLedger = pgTable("stock_ledger", {
  id: text("id").primaryKey(),
  factoryId: text("factory_id")
    .notNull()
    .references(() => factories.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reportEntryId: text("report_entry_id").references(() => reportEntries.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// -------------------------------------------------------------
// Relations
// -------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  factoriesOwned: many(factories),
  factoryUsers: many(factoryUsers),
  qaAssignments: many(qaAssignments),
  inspections: many(qaInspections),
}));

export const factoriesRelations = relations(factories, ({ one, many }) => ({
  operationManager: one(users, {
    fields: [factories.omId],
    references: [users.id],
  }),
  factoryUsers: many(factoryUsers),
  lines: many(lines),
  products: many(products),
  stockLedgers: many(stockLedger),
}));

export const factoryUsersRelations = relations(factoryUsers, ({ one }) => ({
  factory: one(factories, {
    fields: [factoryUsers.factoryId],
    references: [factories.id],
  }),
  user: one(users, {
    fields: [factoryUsers.userId],
    references: [users.id],
  }),
}));

export const linesRelations = relations(lines, ({ one, many }) => ({
  factory: one(factories, {
    fields: [lines.factoryId],
    references: [factories.id],
  }),
  lineProducts: many(lineProducts),
  plans: many(plans),
  reportEntries: many(reportEntries),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  factory: one(factories, {
    fields: [products.factoryId],
    references: [factories.id],
  }),
  lineProducts: many(lineProducts),
  qaAssignments: many(qaAssignments),
  plans: many(plans),
  reportEntries: many(reportEntries),
  qaInspections: many(qaInspections),
  stockLedgers: many(stockLedger),
}));

export const lineProductsRelations = relations(lineProducts, ({ one }) => ({
  line: one(lines, {
    fields: [lineProducts.lineId],
    references: [lines.id],
  }),
  product: one(products, {
    fields: [lineProducts.productId],
    references: [products.id],
  }),
}));

export const qaAssignmentsRelations = relations(qaAssignments, ({ one }) => ({
  qaUser: one(users, {
    fields: [qaAssignments.qaUserId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [qaAssignments.productId],
    references: [products.id],
  }),
}));

export const plansRelations = relations(plans, ({ one }) => ({
  line: one(lines, {
    fields: [plans.lineId],
    references: [lines.id],
  }),
  product: one(products, {
    fields: [plans.productId],
    references: [products.id],
  }),
}));

export const reportEntriesRelations = relations(reportEntries, ({ one, many }) => ({
  line: one(lines, {
    fields: [reportEntries.lineId],
    references: [lines.id],
  }),
  product: one(products, {
    fields: [reportEntries.productId],
    references: [products.id],
  }),
  downtimeReason: one(downtimeReasons, {
    fields: [reportEntries.downtimeReasonId],
    references: [downtimeReasons.id],
  }),
  updater: one(users, {
    fields: [reportEntries.updatedBy],
    references: [users.id],
  }),
  stockLedgers: many(stockLedger),
}));

export const downtimeReasonsRelations = relations(downtimeReasons, ({ many }) => ({
  reportEntries: many(reportEntries),
}));

export const qaInspectionsRelations = relations(qaInspections, ({ one }) => ({
  product: one(products, {
    fields: [qaInspections.productId],
    references: [products.id],
  }),
  line: one(lines, {
    fields: [qaInspections.lineId],
    references: [lines.id],
  }),
  inspector: one(users, {
    fields: [qaInspections.createdBy],
    references: [users.id],
  }),
}));

export const stockLedgerRelations = relations(stockLedger, ({ one }) => ({
  factory: one(factories, {
    fields: [stockLedger.factoryId],
    references: [factories.id],
  }),
  product: one(products, {
    fields: [stockLedger.productId],
    references: [products.id],
  }),
  reportEntry: one(reportEntries, {
    fields: [stockLedger.reportEntryId],
    references: [reportEntries.id],
  }),
}));
