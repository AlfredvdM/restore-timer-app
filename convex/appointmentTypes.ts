import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

// Get only active appointment types (for the timer dropdown)
export const getActiveAppointmentTypes = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAuth(args.token);

    const types = await ctx.db
      .query("appointmentTypes")
      .withIndex("by_active", (idx) => idx.eq("isActive", true))
      .collect();
    return types.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

// Get all appointment types including inactive (for settings management)
export const getAllAppointmentTypes = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAuth(args.token);

    const types = await ctx.db.query("appointmentTypes").collect();
    return types.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

// Create or update an appointment type
export const upsertAppointmentType = mutation({
  args: {
    token: v.string(),
    id: v.optional(v.id("appointmentTypes")),
    name: v.string(),
    code: v.string(),
    defaultDurationMinutes: v.number(),
    colour: v.optional(v.string()),
    isActive: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const { token, ...data } = args;
    requireAuth(token);

    if (data.id) {
      const { id, ...fields } = data;
      await ctx.db.patch(id, fields);
      return id;
    } else {
      const { id: _, ...fields } = data;
      return await ctx.db.insert("appointmentTypes", fields);
    }
  },
});

// Toggle an appointment type active/inactive
export const toggleAppointmentTypeActive = mutation({
  args: { token: v.string(), id: v.id("appointmentTypes") },
  handler: async (ctx, args) => {
    const { token, id } = args;
    requireAuth(token);

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Appointment type not found");
    await ctx.db.patch(id, { isActive: !existing.isActive });
  },
});

// Reorder appointment types by swapping sortOrder values
export const reorderAppointmentTypes = mutation({
  args: {
    token: v.string(),
    orderedIds: v.array(v.id("appointmentTypes")),
  },
  handler: async (ctx, args) => {
    const { token, orderedIds } = args;
    requireAuth(token);

    for (let i = 0; i < orderedIds.length; i++) {
      await ctx.db.patch(orderedIds[i], { sortOrder: i + 1 });
    }
  },
});

// Check if an appointment type has consultation history
export const hasConsultationHistory = query({
  args: { token: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const { token, code } = args;
    requireAuth(token);

    const consultation = await ctx.db
      .query("consultations")
      .filter((q) => q.eq(q.field("appointmentType"), code))
      .first();
    return consultation !== null;
  },
});

// Seed the default appointment types if the table is empty
export const seedAppointmentTypes = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAuth(args.token);

    const existing = await ctx.db.query("appointmentTypes").first();
    if (existing) return; // Table already has data

    const defaults = [
      { name: "Standard Consultation", code: "standard", defaultDurationMinutes: 15, isActive: true, sortOrder: 1 },
      { name: "Long Consultation", code: "long", defaultDurationMinutes: 30, isActive: true, sortOrder: 2 },
      { name: "Follow-Up", code: "follow_up", defaultDurationMinutes: 10, isActive: true, sortOrder: 3 },
      { name: "Telephone Consultation", code: "telephone", defaultDurationMinutes: 5, isActive: true, sortOrder: 4 },
      { name: "Procedure", code: "procedure", defaultDurationMinutes: 20, isActive: true, sortOrder: 5 },
      { name: "Custom", code: "custom", defaultDurationMinutes: 15, isActive: true, sortOrder: 6 },
    ];

    for (const type of defaults) {
      await ctx.db.insert("appointmentTypes", type);
    }
  },
});
