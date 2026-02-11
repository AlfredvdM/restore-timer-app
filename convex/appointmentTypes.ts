import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get only active appointment types (for the timer dropdown)
export const getActiveAppointmentTypes = query({
  handler: async (ctx) => {
    const types = await ctx.db
      .query("appointmentTypes")
      .withIndex("by_active", (idx) => idx.eq("isActive", true))
      .collect();
    return types.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

// Get all appointment types including inactive (for settings management)
export const getAllAppointmentTypes = query({
  handler: async (ctx) => {
    const types = await ctx.db.query("appointmentTypes").collect();
    return types.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

// Create or update an appointment type
export const upsertAppointmentType = mutation({
  args: {
    id: v.optional(v.id("appointmentTypes")),
    name: v.string(),
    code: v.string(),
    defaultDurationMinutes: v.number(),
    colour: v.optional(v.string()),
    isActive: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.id) {
      const { id, ...fields } = args;
      await ctx.db.patch(id, fields);
      return id;
    } else {
      const { id: _, ...fields } = args;
      return await ctx.db.insert("appointmentTypes", fields);
    }
  },
});

// Toggle an appointment type active/inactive
export const toggleAppointmentTypeActive = mutation({
  args: { id: v.id("appointmentTypes") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Appointment type not found");
    await ctx.db.patch(args.id, { isActive: !existing.isActive });
  },
});

// Reorder appointment types by swapping sortOrder values
export const reorderAppointmentTypes = mutation({
  args: {
    orderedIds: v.array(v.id("appointmentTypes")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { sortOrder: i + 1 });
    }
  },
});

// Check if an appointment type has consultation history
export const hasConsultationHistory = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const consultation = await ctx.db
      .query("consultations")
      .filter((q) => q.eq(q.field("appointmentType"), args.code))
      .first();
    return consultation !== null;
  },
});

// Seed the default appointment types if the table is empty
export const seedAppointmentTypes = mutation({
  handler: async (ctx) => {
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
